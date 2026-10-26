import test from "node:test";
import assert from "node:assert/strict";
import { x25519 } from "@noble/curves/ed25519";
import { randomBytes } from "node:crypto";
import { sealTip, openTip, toBase64, fromBase64, type RecipientJwk } from "../mobile/src/lib/seal";
import { encode } from "../mobile/src/lib/geohash";
import { secretMatches } from "../src/crypto";
import { TipSchema } from "../src/validate";
import { InMemoryStore } from "../src/store";
import { AuditLog } from "../src/audit";
import { submitTip, verifyTip, claimReward, type Deps } from "../src/handlers";

const priv = x25519.utils.randomPrivateKey();
const jwk: RecipientJwk = { kty: "OKP", crv: "X25519", x: toBase64(x25519.getPublicKey(priv)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") };

test("seal/open round trip, unicode, and wrong key fails", () => {
  const s = sealTip("Hy, ek het iets gesien \u{1F6A8} at the corner", jwk);
  assert.equal(openTip(s.ciphertext, priv), "Hy, ek het iets gesien \u{1F6A8} at the corner");
  assert.throws(() => openTip(s.ciphertext, x25519.utils.randomPrivateKey()));
});
test("tampering is detected; payload is non-deterministic", () => {
  const s = sealTip("hello", jwk), b = fromBase64(s.ciphertext);
  b[b.length - 1] = (b[b.length - 1] ?? 0) ^ 1;
  assert.throws(() => openTip(toBase64(b), priv));
  assert.notEqual(sealTip("hello", jwk).ciphertext, s.ciphertext);
});
test("padding hides length within a bucket; input limits enforced", () => {
  assert.equal(sealTip("a", jwk).ciphertext.length, sealTip("a".repeat(400), jwk).ciphertext.length);
  assert.throws(() => sealTip("", jwk));
  assert.throws(() => sealTip("x".repeat(16_001), jwk));
  assert.throws(() => sealTip("x", { ...jwk, crv: "P-256" } as never));
});
