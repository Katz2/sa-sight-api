import { createServer } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import { createRemoteJWKSet } from "jose";
import { handle, type HttpDeps } from "./http";
import { AuditLog } from "./audit";
import { InMemoryStore, type TipStore } from "./store";
import { authenticate, AuthError } from "./auth";
import { demoAuth } from "./demoauth";
import { newId } from "./crypto";
import { RateLimiter } from "./ratelimit";

// Fail closed: production adapters (DynamoDB, SQS, SAPS mTLS gateway, voucher partner) are not wired yet.
if (process.env.DEMO !== "1") { console.error("Refusing to start: set DEMO=1 (synthetic data only)."); process.exit(1); }

const issuer = process.env.AUTH_ISSUER, audience = process.env.AUTH_AUDIENCE;
const getKey = issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : undefined;
const { publicKey } = generateKeyPairSync("x25519"); // demo key; private half is discarded

const demoCases = [ // sample open cases: Cape Town CBD, Mfuleni, Somerset West
  { id: "DEMO-CASE-1", category: "GBV", geohash: "k3vp5" }, { id: "DEMO-CASE-2", category: "GBV", geohash: "k3vq8" }, { id: "DEMO-CASE-3", category: "GBV", geohash: "k3vqh" },
];
let store: TipStore;
if (process.env.STORE === "firestore") {
  const fs = new (await import("./firestore")).FirestoreStore();
  await fs.ensureCases(demoCases);
  store = fs;
} else store = new InMemoryStore(demoCases);

const deps: HttpDeps = {
  store,
  audit: new AuditLog(),
  saps: { forward: async () => {} },
  autoVerifyMs: Number(process.env.DEMO_AUTO_VERIFY_SECONDS) > 0 ? Number(process.env.DEMO_AUTO_VERIFY_SECONDS) * 1000 : undefined,
  vouchers: { issue: async () => `DEMO-${newId(6).toUpperCase()}` },
  sapsPublicKey: publicKey.export({ format: "jwk" }),
  authenticate: async (h) => {
    const demo = demoAuth(h, process.env.DEMO_STAFF_TOKEN); // demo-only, set at deploy time
    if (demo) return demo;
    if (issuer && audience && getKey) return authenticate(h, { issuer, audience, getKey });
    throw new AuthError("Unauthorized");
  },
};

const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
} as const;
const MAX_BODY = 800_000; // text plus up to 3 sealed photos
// Abuse control (in memory, hashed with a random salt, never logged). Edge firewall rules replace this in production.
const tipLimit = new RateLimiter(Number(process.env.TIP_RATE_LIMIT ?? 20), 10 * 60_000); // tips per client per 10 min
const tipGlobal = new RateLimiter(600, 60_000); // tips per minute across everyone
const apiLimit = new RateLimiter(120, 60_000); // any API call per client per minute
const clientKey = (req: import("node:http").IncomingMessage) =>
  process.env.TRUST_PROXY === "1" ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0]!.trim() || "proxy" : req.socket.remoteAddress ?? "unknown";

createServer(async (req, res) => {
  const send = (status: number, type: string, body: string) => { res.writeHead(status, { ...SECURITY_HEADERS, "content-type": type }); res.end(body); };
  const path = (req.url ?? "/").split("?")[0]!;
  const ck = clientKey(req);
  const isTip = req.method === "POST" && path === "/api/tips";
  if (!apiLimit.allow(ck) || (isTip && !(tipLimit.allow(ck) && tipGlobal.allow("all")))) {
    res.writeHead(429, { ...SECURITY_HEADERS, "content-type": "application/json", "retry-after": "60" }); return res.end('{"error":"Too many requests"}');
  }
  let size = 0; const chunks: Buffer[] = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(413, "application/json", '{"error":"Too large"}'); chunks.push(c as Buffer); }
  let body: unknown;
  try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined; }
  catch { return send(400, "application/json", '{"error":"Invalid JSON"}'); }
  const out = await handle({ method: req.method ?? "GET", path, authorization: req.headers.authorization, body }, deps);
  send(out.status, "application/json", JSON.stringify(out.body)); // note: no request logging, so no IPs retained
}).listen(Number(process.env.PORT ?? 8080));
