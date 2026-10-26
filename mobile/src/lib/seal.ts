import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { concatBytes, utf8ToBytes } from "@noble/hashes/utils";

/**
 * Tip sealing protocol "sa-sight/v1" (sealed box):
 *   ephemeral X25519 key -> shared secret with the SAPS public key -> HKDF-SHA256 -> XChaCha20-Poly1305.
 * Payload = 0x01 | ephemeralPublicKey(32) | nonce(24) | ciphertext. Plaintext is length-prefixed and padded
 * to a multiple of 512 bytes so message length leaks as little as possible. Pure JS (audited noble libraries):
 * works in Expo Go and release builds. Only SAPS, holding the private key, can open a sealed tip.
 */
export type Rng = (n: number) => Uint8Array;
export interface RecipientJwk { kty: "OKP"; crv: "X25519"; x: string }
export interface Sealed { ciphertext: string }

const VERSION = 1, MAX_TEXT_BYTES = 16_000;
export const MAX_FILE_BYTES = 140_000; // one photo after shrinking; keeps three photos under the demo database's 1 MiB document limit
const INFO = utf8ToBytes("sa-sight/v1/tip");
const defaultRng: Rng = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function toBase64(b: Uint8Array): string {
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] ?? 0) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ALPHA[(n >> 18) & 63]! + ALPHA[(n >> 12) & 63]! + (i + 1 < b.length ? ALPHA[(n >> 6) & 63]! : "=") + (i + 2 < b.length ? ALPHA[n & 63]! : "=");
  }
  return out;
}
export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const c of clean) {
    const v = ALPHA.indexOf(c);
    if (v < 0) throw new Error("Invalid base64");
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
  }
  return Uint8Array.from(out);
}

function recipientKey(jwk: RecipientJwk): Uint8Array {
  if (jwk?.kty !== "OKP" || jwk.crv !== "X25519") throw new Error("Unsupported key");
  const k = fromBase64(jwk.x);
  if (k.length !== 32) throw new Error("Bad key length");
  return k;
}
const deriveKey = (shared: Uint8Array, eph: Uint8Array, rcpt: Uint8Array) => hkdf(sha256, shared, concatBytes(eph, rcpt), INFO, 32);

/** 4-byte length prefix, then padding (512-byte steps for small items, 8 KB for photos) so exact size leaks less. */
function pad(data: Uint8Array): Uint8Array {
  const need = data.length + 4, bucket = need <= 16_384 ? 512 : 8_192;
  const out = new Uint8Array(Math.ceil(need / bucket) * bucket);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(data, 4);
  return out;
}
function unpad(p: Uint8Array): Uint8Array {
  const len = new DataView(p.buffer, p.byteOffset, p.byteLength).getUint32(0);
  if (len > p.length - 4) throw new Error("Bad payload");
  return p.slice(4, 4 + len);
}

function seal(data: Uint8Array, recipient: RecipientJwk, rng: Rng): string {
  const rcpt = recipientKey(recipient);
  const ephPriv = rng(32), ephPub = x25519.getPublicKey(ephPriv);
  const key = deriveKey(x25519.getSharedSecret(ephPriv, rcpt), ephPub, rcpt);
  const nonce = rng(24);
  return toBase64(concatBytes(Uint8Array.of(VERSION), ephPub, nonce, xchacha20poly1305(key, nonce).encrypt(pad(data))));
}
function open(ciphertext: string, recipientPrivate: Uint8Array): Uint8Array {
  const b = fromBase64(ciphertext);
  if (b.length < 1 + 32 + 24 + 16 || b[0] !== VERSION) throw new Error("Bad payload");
  const ephPub = b.slice(1, 33), nonce = b.slice(33, 57), ct = b.slice(57);
  const key = deriveKey(x25519.getSharedSecret(recipientPrivate, ephPub), ephPub, x25519.getPublicKey(recipientPrivate));
  return unpad(xchacha20poly1305(key, nonce).decrypt(ct)); // throws if tampered
}

/** Encrypts the tip text for SAPS. The claim code (and its commitment) come from claimcode.ts. */
export function sealTip(text: string, recipient: RecipientJwk, rng: Rng = defaultRng): Sealed {
  const data = utf8ToBytes(text);
  if (data.length === 0 || data.length > MAX_TEXT_BYTES) throw new Error("Message length not allowed");
  return { ciphertext: seal(data, recipient, rng) };
}
/** Encrypts one (already shrunk) photo for SAPS. */
export function sealFile(bytes: Uint8Array, recipient: RecipientJwk, rng: Rng = defaultRng): string {
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) throw new Error("File size not allowed");
  return seal(bytes, recipient, rng);
}

/** Reference decryptors for SAPS tooling and tests. The private key never exists on the phone or on our servers. */
export const openTip = (ciphertext: string, recipientPrivate: Uint8Array): string => new TextDecoder().decode(open(ciphertext, recipientPrivate));
export const openFile = open;
