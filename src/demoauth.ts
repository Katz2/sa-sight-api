import { timingSafeEqual } from "node:crypto";
import type { Identity } from "./auth";

/**
 * DEMO MODE ONLY: lets one case-officer action (verify a tip) be shown without an identity provider.
 * The token comes from the DEMO_STAFF_TOKEN environment variable at deploy time, never from the repository.
 * Requires at least 32 characters; compared in constant time; grants CASE_OFFICER only (not analyst or auditor).
 */
export function demoAuth(header: string | undefined, secret: string | undefined): Identity | undefined {
  if (!secret || secret.length < 32) return undefined;
  const m = /^Bearer (\S+)$/.exec(header ?? "");
  if (!m) return undefined;
  const a = Buffer.from(m[1]!), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? { actor: "demo-case-officer", role: "CASE_OFFICER" } : undefined;
}
