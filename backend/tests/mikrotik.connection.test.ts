import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveMikroTikProtocol, resolveMikroTikTlsOptions } from "../src/mikrotik/connection.js";

test("port 8728 selects unencrypted RouterOS API", () => {
  assert.equal(resolveMikroTikProtocol({ port: 8728 }), "api");
  assert.equal(resolveMikroTikTlsOptions({ host: "router.example.test", port: 8728 }), undefined);
});

test("port 8729 selects API-SSL with certificate verification enabled", () => {
  assert.equal(resolveMikroTikProtocol({ port: 8729 }), "api-ssl");
  assert.deepEqual(resolveMikroTikTlsOptions({ host: "router.example.test", port: 8729 }), {
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
  assert.equal(options?.ca, "test-ca");
});
