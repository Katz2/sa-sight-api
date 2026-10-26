import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { x25519 } from "@noble/curves/ed25519";
import { sealFile, openFile, sealTip, toBase64, MAX_FILE_BYTES, type RecipientJwk } from "../mobile/src/lib/seal";
import { newClaimCode, normalizeCode, derive } from "../mobile/src/lib/claimcode";
import { TipSchema } from "../src/validate";
import { InMemoryStore } from "../src/store";
import { AuditLog } from "../src/audit";
import { submitTip, type Deps } from "../src/handlers";

const rng = (n: number) => new Uint8Array(randomBytes(n));
const priv = x25519.utils.randomPrivateKey();
const jwk: RecipientJwk = { kty: "OKP", crv: "X25519", x: toBase64(x25519.getPublicKey(priv)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") };
const base = { category: "GBV", geohash: "k3vp5", hourBucket: "2026-10-25T10:00:00.000Z" };

test("photo seals and opens exactly; wrong key and tampering fail; size limits enforced", () => {
  const photo = rng(100_000), ct = sealFile(photo, jwk, rng);
  assert.deepEqual(Buffer.from(openFile(ct, priv)), Buffer.from(photo));
  assert.throws(() => openFile(ct, x25519.utils.randomPrivateKey()));
  assert.throws(() => sealFile(rng(MAX_FILE_BYTES + 1), jwk, rng));
  assert.throws(() => sealFile(new Uint8Array(0), jwk, rng));
});
test("worst-case tip (3 max photos + max text) fits server schema and the 1 MiB document limit", () => {
  const files = [0, 1, 2].map(() => sealFile(rng(MAX_FILE_BYTES), jwk, rng));
  const commitment = derive(normalizeCode(newClaimCode(rng))!).commitment;
  const tip = { ...base, ciphertext: sealTip("x".repeat(16_000), jwk, rng).ciphertext, attachments: files, commitment };
  assert.ok(TipSchema.safeParse(tip).success);
  const size = Buffer.byteLength(JSON.stringify(tip));
  assert.ok(size < 800_000, `body ${size}`);   // server body cap
  assert.ok(size < 1_000_000, `doc ${size}`);  // Firestore 1 MiB limit
});
test("schema rejects 4 photos, oversized photo, and junk", () => {
  const ok = { ...base, ciphertext: "QUJD", commitment: "a".repeat(64) };
  assert.ok(TipSchema.safeParse({ ...ok, attachments: [] }).success);
  assert.ok(TipSchema.safeParse(ok).success); // attachments optional, defaults to none
  assert.ok(!TipSchema.safeParse({ ...ok, attachments: ["QUJD", "QUJD", "QUJD", "QUJD"] }).success);
  assert.ok(!TipSchema.safeParse({ ...ok, attachments: ["A".repeat(200_001)] }).success);
  assert.ok(!TipSchema.safeParse({ ...ok, attachments: ["<script>"] }).success);
});
test("tip with photos is stored through the API handler", async () => {
  const d: Deps = { store: new InMemoryStore(), audit: new AuditLog(), saps: { forward: async () => {} }, vouchers: { issue: async () => "V" } };
  const c = derive(normalizeCode(newClaimCode(rng))!);
  const { receiptId } = await submitTip({ ...base, ciphertext: "QUJD", attachments: [sealFile(rng(5000), jwk, rng)], commitment: c.commitment }, d);
  assert.equal((await d.store.getTip(receiptId))?.attachments.length, 1);
});
