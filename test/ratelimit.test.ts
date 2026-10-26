import test from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "../src/ratelimit";

test("allows up to the limit, blocks the next, recovers after the window", () => {
  const rl = new RateLimiter(3, 1000);
  assert.deepEqual([0, 1, 2, 3].map(() => rl.allow("a", 0)), [true, true, true, false]);
  assert.equal(rl.allow("a", 999), false);
  assert.equal(rl.allow("a", 1001), true);
});
test("clients are independent", () => {
  const rl = new RateLimiter(1, 1000);
  assert.ok(rl.allow("a", 0)); assert.ok(!rl.allow("a", 1)); assert.ok(rl.allow("b", 1));
});
test("memory stays bounded under a many-clients flood", () => {
  const rl = new RateLimiter(1, 60_000, 100);
  for (let i = 0; i < 1000; i++) rl.allow("c" + i, i);
  assert.ok((rl as unknown as { hits: Map<string, number[]> }).hits.size <= 100);
});

import { InMemoryStore } from "../src/store";
import { AuditLog } from "../src/audit";
import { submitTip, getStatus, claimReward, type Deps } from "../src/handlers";
import { sha256 } from "../src/crypto";

test("demo auto-verify lets a judge finish the journey, is audited, and is off by default", async () => {
  const mk = (autoVerifyMs?: number): Deps => ({ store: new InMemoryStore(), audit: new AuditLog(), saps: { forward: async () => {} }, vouchers: { issue: async () => "VCH" }, autoVerifyMs });
  const secret = "ab".repeat(32), tip = { category: "GBV", geohash: "k3vqh", hourBucket: "2026-10-26T10:00:00.000Z", ciphertext: "QUJD", commitment: sha256(Buffer.from(secret, "hex")) };
  const on = mk(0), { receiptId } = await submitTip(tip, on);
  assert.equal((await getStatus(receiptId, on)).status, "VERIFIED");
  assert.deepEqual(await claimReward(receiptId, secret, on), { voucher: "VCH" });
  assert.ok(on.audit.read("AUDITOR", "a").some((e) => e.actor === "system:demo-auto-verify"));
  const off = mk(), r2 = await submitTip(tip, off);
  assert.equal((await getStatus(r2.receiptId, off)).status, "RECEIVED");
  await assert.rejects(() => claimReward(r2.receiptId, secret, off), { status: 403 });
  const wait = mk(1e9), r3 = await submitTip(tip, wait);
  assert.notEqual((await getStatus(r3.receiptId, wait)).status, "VERIFIED");
});
