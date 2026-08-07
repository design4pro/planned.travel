import assert from "node:assert/strict";
import test from "node:test";
import { isExactCommand, shouldRouteRelease, shouldRouteReview, stableIdempotencyKey } from "./check-multica-router.mjs";

const pullRequestComment = (body) => ({ issue: { pull_request: { url: "https://api.github.com/pulls/7" } }, comment: { id: 42, body } });

test("routes the exact review command only on a pull request", () => {
  assert.equal(shouldRouteReview(pullRequestComment("/review-remediation")), true);
  assert.equal(shouldRouteReview(pullRequestComment("/review-remediation-now")), false);
  assert.equal(shouldRouteReview({ issue: { number: 7 }, comment: { body: "/review-remediation" } }), false);
});

test("routes the exact release command only on a pull request", () => {
  assert.equal(shouldRouteRelease(pullRequestComment("/release-preparation")), true);
  assert.equal(shouldRouteRelease(pullRequestComment("/release-preparation-now")), false);
  assert.equal(shouldRouteRelease({ issue: { number: 7 }, comment: { body: "/release-preparation" } }), false);
});

test("review and release command matching is exact", () => {
  assert.equal(isExactCommand(pullRequestComment("/review-remediation"), "/review-remediation"), true);
  assert.equal(isExactCommand(pullRequestComment("/review-remediation extra"), "/review-remediation"), false);
});

test("idempotency keys remain unchanged across retries of the same event", () => {
  const event = { action: "synchronize", pull_request: { id: 7, head: { sha: "abc123" } } };
  assert.equal(stableIdempotencyKey("merge", event), stableIdempotencyKey("merge", structuredClone(event)));
  assert.equal(stableIdempotencyKey("review", { review: { id: 99 } }), "multica-review-review-99");
});

test("merged release and hotfix pull requests route", () => {
  assert.equal(shouldRouteRelease({ pull_request: { merged: true, head: { ref: "release/v1.2.3" } } }), true);
  assert.equal(shouldRouteRelease({ pull_request: { merged: true, head: { ref: "hotfix/security" } } }), true);
  assert.equal(shouldRouteRelease({ pull_request: { merged: true, head: { ref: "feature/trips" } } }), false);
});
