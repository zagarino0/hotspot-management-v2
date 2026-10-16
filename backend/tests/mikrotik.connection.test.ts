import assert from "node:assert/strict";
import { test } from "node:test";

// env.ts validates required secrets at import time; use disposable test values.
process.env.JWT_SECRET ??= "test-only-jwt-secret";
process.env.CREDENTIALS_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.DATABASE_PASSWORD ??= "test-only-password";

const { resolveMikroTikProtocol, resolveMikroTikTlsOptions } = await import("../src/mikrotik/connection.js");

test("port 8728 selects unencrypted RouterOS API", () => {
  assert.equal(resolveMikroTikProtocol({ port: 8728 }), "api");
  assert.equal(resolveMikroTikTlsOptions({ host: "router.example.test", port: 8728 }), undefined);
});

test("port 8729 selects API-SSL with certificate verification enabled", () => {
  assert.equal(resolveMikroTikProtocol({ port: 8729 }), "api-ssl");
  assert.deepEqual(resolveMikroTikTlsOptions({ host: "router.example.test", port: 8729 }), {
    servername: "router.example.test",
    rejectUnauthorized: true,
  });
});

test("explicit protocol overrides inferred port", () => {
  assert.equal(resolveMikroTikProtocol({ port: 8728, protocol: "api-ssl" }), "api-ssl");
  assert.equal(resolveMikroTikProtocol({ port: 8729, protocol: "api" }), "api");
});

test("custom TLS options can provide a trusted CA while verification remains enabled", () => {
  const options = resolveMikroTikTlsOptions({
    host: "router.example.test",
    port: 8729,
    tls: { ca: "test-ca" },
  });
  assert.equal(options?.rejectUnauthorized, true);
  assert.equal(options?.servername, "router.example.test");
  assert.equal(options?.ca, "test-ca");
});
