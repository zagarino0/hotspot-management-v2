import test from "node:test";
import assert from "node:assert/strict";
import {
  NETWORK_PROBLEM_ROUTER_THRESHOLD,
  NETWORK_PROBLEM_WINDOW_SECONDS,
  ROUTER_OFFLINE_FAILURE_THRESHOLD,
  SYNC_ERROR_FAILURE_THRESHOLD,
  shouldNotifyNetworkProblem,
  shouldNotifyRouterOffline,
} from "../src/modules/notifications/notification.rules.js";

test("SYNC_ERROR is triggered on the first failed synchronization", () => {
  assert.equal(SYNC_ERROR_FAILURE_THRESHOLD, 1);
});

test("ROUTER_OFFLINE requires two consecutive connection failures", () => {
  assert.equal(ROUTER_OFFLINE_FAILURE_THRESHOLD, 2);
  assert.equal(shouldNotifyRouterOffline(0), false);
  assert.equal(shouldNotifyRouterOffline(1), false);
  assert.equal(shouldNotifyRouterOffline(2), true);
  assert.equal(shouldNotifyRouterOffline(3), true);
});

test("NETWORK_PROBLEM requires two distinct routers already filtered to the 30-second window", () => {
  assert.equal(NETWORK_PROBLEM_ROUTER_THRESHOLD, 2);
  assert.equal(NETWORK_PROBLEM_WINDOW_SECONDS, 30);
  assert.equal(shouldNotifyNetworkProblem(1), false);
  assert.equal(shouldNotifyNetworkProblem(2), true);
  assert.equal(shouldNotifyNetworkProblem(3), true);
  assert.equal(shouldNotifyNetworkProblem(0), false);
});

test("invalid router counts cannot trigger NETWORK_PROBLEM", () => {
  assert.equal(shouldNotifyNetworkProblem(1.5), false);
  assert.equal(shouldNotifyNetworkProblem(Number.NaN), false);
});
