-- Migration 002: admin console and community moderation schema extensions (down)

DROP TABLE IF EXISTS moderation_audit_log;

DROP INDEX IF EXISTS idx_setups_feed_composite;
CREATE INDEX idx_setups_feed_composite ON setups(is_public, created_at DESC)
  WHERE is_public = TRUE;

ALTER TABLE setups
  DROP COLUMN IF EXISTS hidden_reason,
  DROP COLUMN IF EXISTS hidden_at,
  DROP COLUMN IF EXISTS is_hidden;

DROP INDEX IF EXISTS idx_users_suspended;
DROP INDEX IF EXISTS idx_users_role;

ALTER TABLE users
  DROP COLUMN IF EXISTS suspension_reason,
  DROP COLUMN IF EXISTS suspended_at,
  DROP COLUMN IF EXISTS is_suspended,
  DROP COLUMN IF EXISTS role;
