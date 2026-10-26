import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

/**
 * One short claim code replaces the old Receipt ID + secret. Format: XXXXX-XXXXX-XXXXX-XXXXX
 * (19 random symbols = 95 bits, plus 1 check symbol). Crockford alphabet: no I, L, O or U, so it is easy to copy by hand.
 * The claim secret, its commitment and the receipt ID are all derived from the code, so the user keeps one thing.
 */
export type Rng = (n: number) => Uint8Array;
const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DATA = 19;
const check = (vals: number[]) => vals.reduce((a, v, i) => a + v * (i + 1), 0) % 32; // catches typos and most swaps

export function newClaimCode(rng: Rng): string {
  const vals = Array.from(rng(DATA), (b) => b & 31); // 256 is divisible by 32: no bias
  const s = [...vals, check(vals)].map((v) => ALPHA[v]).join("");
  return `${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10, 15)}-${s.slice(15)}`;
}

/** Forgiving input: any case, dashes or spaces, O read as 0, I and L read as 1. Returns null if it cannot be valid. */
export function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== DATA + 1) return null;
  const vals: number[] = [];
  for (const c of s) { const v = ALPHA.indexOf(c); if (v < 0) return null; vals.push(v); }
  return check(vals.slice(0, DATA)) === vals[DATA] ? s : null;
}

/** receiptId is derived from the commitment so the server and the phone agree without sharing anything extra. */
export const receiptIdFor = (commitment: string): string => bytesToHex(sha256(utf8ToBytes("sa-sight/receipt/v1:" + commitment))).slice(0, 32);

export function derive(canonical: string): { secret: string; commitment: string; receiptId: string } {
  const secretBytes = sha256(utf8ToBytes("sa-sight/claim/v1:" + canonical));
  const commitment = bytesToHex(sha256(secretBytes));
  return { secret: bytesToHex(secretBytes), commitment, receiptId: receiptIdFor(commitment) };
}
