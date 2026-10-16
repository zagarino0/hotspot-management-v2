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


test("environment trusted CA is used when no router-specific CA is supplied", () => {
  const previous = process.env.MIKROTIK_TLS_CA;
  process.env.MIKROTIK_TLS_CA = "environment-ca";
  try {
    const options = resolveMikroTikTlsOptions({
      host: "router.example.test",
      port: 8729,
    });
    assert.equal(options?.ca, "environment-ca");
    assert.equal(options?.rejectUnauthorized, true);
  } finally {
    if (previous === undefined) delete process.env.MIKROTIK_TLS_CA;
    else process.env.MIKROTIK_TLS_CA = previous;
  }
});

test("router-specific CA takes precedence and verification cannot be disabled", () => {
  const previous = process.env.MIKROTIK_TLS_CA;
  process.env.MIKROTIK_TLS_CA = "environment-ca";
  try {
    const options = resolveMikroTikTlsOptions({
      host: "router.example.test",
      port: 8729,
      tls: { ca: "router-ca", rejectUnauthorized: false },
    });
    assert.equal(options?.ca, "router-ca");
    assert.equal(options?.rejectUnauthorized, true);
  } finally {
    if (previous === undefined) delete process.env.MIKROTIK_TLS_CA;
    else process.env.MIKROTIK_TLS_CA = previous;
  }
});
