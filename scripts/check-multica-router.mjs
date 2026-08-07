export function isPullRequestComment(event) {
  return Boolean(event?.issue?.pull_request);
}

export function isExactCommand(event, command) {
  return isPullRequestComment(event) && event.comment?.body === command;
}

export function shouldRouteReview(event) {
  return (
    (event?.review?.state === "changes_requested" && event.pull_request?.id != null) ||
    isExactCommand(event, "/review-remediation")
  );
}

export function shouldRouteRelease(event) {
  const mergedRelease = event?.pull_request?.merged === true &&
    (event.pull_request.head?.ref?.startsWith("release/") || event.pull_request.head?.ref?.startsWith("hotfix/"));
  return mergedRelease || isExactCommand(event, "/release-preparation");
}

export function stableIdempotencyKey(channel, event) {
  if (event?.comment?.id != null) return `multica-${channel}-comment-${event.comment.id}`;
  if (event?.review?.id != null) return `multica-${channel}-review-${event.review.id}`;
  if (event?.pull_request?.id != null) {
    const revision = event.pull_request.merge_commit_sha ?? event.pull_request.head?.sha ?? "unknown";
    return `multica-${channel}-pull-request-${event.pull_request.id}-${event.action ?? "unknown"}-${revision}`;
  }
  return `multica-${channel}-event-${event?.repository?.full_name ?? "unknown"}-${event?.action ?? "unknown"}`;
}
