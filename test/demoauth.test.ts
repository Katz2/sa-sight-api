import test from "node:test";
import assert from "node:assert/strict";
import { demoAuth } from "../src/demoauth";

const secret = "x".repeat(40);
test("demo token: exact match only, case officer role only", () => {
  assert.deepEqual(demoAuth(`Bearer ${secret}`, secret), { actor: "demo-case-officer", role: "CASE_OFFICER" });
  assert.equal(demoAuth(`Bearer ${secret}y`, secret), undefined);
  assert.equal(demoAuth("Bearer wrong", secret), undefined);
  assert.equal(demoAuth(undefined, secret), undefined);
  assert.equal(demoAuth("Basic abc", secret), undefined);
});
test("demo token disabled when unset or too short", () => {
  assert.equal(demoAuth("Bearer short", "short"), undefined);
  assert.equal(demoAuth(`Bearer ${secret}`, undefined), undefined);
  assert.equal(demoAuth("Bearer ", ""), undefined);
});
