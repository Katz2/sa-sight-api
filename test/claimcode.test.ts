import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { newClaimCode, normalizeCode, derive, receiptIdFor as mobileId } from "../mobile/src/lib/claimcode";
import { receiptIdFor, secretMatches } from "../src/crypto";
import { TipSchema } from "../src/validate";
import { InMemoryStore } from "../src/store";
import { AuditLog } from "../src/audit";
import { submitTip, verifyTip, claimReward, type Deps } from "../src/handlers";

const rng = (n: number) => new Uint8Array(randomBytes(n));
const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

test("code format, uniqueness, and forgiving input", () => {
  const code = newClaimCode(rng);
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
  assert.equal(new Set(Array.from({ length: 2000 }, () => newClaimCode(rng))).size, 2000);
  const canon = normalizeCode(code)!;
  assert.equal(normalizeCode(code.toLowerCase()), canon);
  assert.equal(normalizeCode(code.replace(/-/g, " ")), canon);
  assert.equal(normalizeCode(" " + code + " "), canon);
});
test("typos and swaps are caught before any network call", () => {
  const canon = normalizeCode(newClaimCode(rng))!;
  const alt = (c: string) => ALPHA[(ALPHA.indexOf(c) + 7) % 32]!;
  for (let i = 0; i < 20; i++) assert.equal(normalizeCode(canon.slice(0, i) + alt(canon[i]!) + canon.slice(i + 1)), null, `substitution at ${i}`);
  let swaps = 0, caught = 0;
  for (let i = 0; i < 19; i++) if (canon[i] !== canon[i + 1]) { swaps++; if (normalizeCode(canon.slice(0, i) + canon[i + 1] + canon[i] + canon.slice(i + 2)) === null) caught++; }
  assert.ok(caught >= swaps - 2, `swaps caught ${caught}/${swaps}`);
  assert.equal(normalizeCode("ABC"), null);
  assert.equal(normalizeCode("U".repeat(20)), null);
});
test("phone and server derive the same receipt ID; commitment passes the server check", () => {
  const d = derive(normalizeCode(newClaimCode(rng))!);
  assert.equal(d.receiptId, receiptIdFor(d.commitment));
  assert.equal(mobileId(d.commitment), receiptIdFor(d.commitment));
  assert.ok(secretMatches(d.secret, d.commitment));
  assert.ok(!secretMatches("00".repeat(32), d.commitment));
  assert.ok(TipSchema.safeParse({ category: "GBV", geohash: "k3vp5", hourBucket: "2026-10-25T10:00:00.000Z", ciphertext: "QUJD", commitment: d.commitment }).success);
});
test("end to end with one code: submit, check, verify, claim once; wrong code fails", async () => {
  const dep: Deps = { store: new InMemoryStore(), audit: new AuditLog(), saps: { forward: async () => {} }, vouchers: { issue: async () => "V1" } };
  const code = newClaimCode(rng), d = derive(normalizeCode(code)!);
  const { receiptId } = await submitTip({ category: "GBV", geohash: "k3vp5", hourBucket: "2026-10-25T10:00:00.000Z", ciphertext: "QUJD", commitment: d.commitment }, dep);
  assert.equal(receiptId, d.receiptId);
  await verifyTip("CASE_OFFICER", "co1", receiptId, dep);
  const wrong = derive(normalizeCode(newClaimCode(rng))!);
  await assert.rejects(() => claimReward(wrong.receiptId, wrong.secret, dep), { status: 403 });
  await assert.rejects(() => claimReward(receiptId, wrong.secret, dep), { status: 403 });
  assert.deepEqual(await claimReward(receiptId, d.secret, dep), { voucher: "V1" });
  await assert.rejects(() => claimReward(receiptId, d.secret, dep), { status: 403 });
});
