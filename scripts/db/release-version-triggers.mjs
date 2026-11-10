/** Drizzle has no trigger declaration; these generated constraints make source revisions append-only. */
export const releaseVersionTriggers = [
  "CREATE TRIGGER content_versions_no_update BEFORE UPDATE ON content_versions BEGIN SELECT RAISE(ABORT, 'Content versions are immutable'); END;",
  "CREATE TRIGGER content_versions_no_delete BEFORE DELETE ON content_versions BEGIN SELECT RAISE(ABORT, 'Content versions are immutable'); END;",
]
