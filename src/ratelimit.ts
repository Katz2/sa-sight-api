import { createHash, randomBytes } from "node:crypto";

const SALT = randomBytes(16); // random per process; never stored or logged

/**
 * Sliding-window limiter for abuse control. Privacy: the client address is hashed with a random per-process salt,
 * counters live only in memory and vanish with the window or on restart. Nothing is written to disk or logs.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number, private maxKeys = 50_000) {}

  allow(rawKey: string, now = Date.now()): boolean {
    const k = createHash("sha256").update(SALT).update(rawKey).digest("hex").slice(0, 16);
    const recent = (this.hits.get(k) ?? []).filter((t) => now - t < this.windowMs);
    const ok = recent.length < this.limit;
    if (ok) recent.push(now);
    this.hits.delete(k); this.hits.set(k, recent); // re-insert keeps oldest keys first
    if (this.hits.size > this.maxKeys) this.prune(now);
    return ok;
  }

  private prune(now: number): void {
    for (const [k, a] of this.hits) if (!a.length || now - a[a.length - 1]! >= this.windowMs) this.hits.delete(k);
    for (const k of this.hits.keys()) { if (this.hits.size <= this.maxKeys) break; this.hits.delete(k); } // bounded memory under attack
  }
}
