-- Migration 002: admin console and community moderation schema extensions (up)

-- 1. users table extensions
ALTER TABLE users
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'driver'
    CHECK (role IN ('driver', 'moderator', 'admin')),
  ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN suspended_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN suspension_reason VARCHAR(500) NULL;

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_suspended ON users(is_suspended) WHERE is_suspended = TRUE;

-- 2. setups table extensions
ALTER TABLE setups
  ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN hidden_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN hidden_reason VARCHAR(500) NULL;

DROP INDEX IF EXISTS idx_setups_feed_composite;
CREATE INDEX idx_setups_feed_composite ON setups(is_public, created_at DESC)
  WHERE is_public = TRUE AND is_hidden = FALSE;

-- 3. moderation_audit_log table
CREATE TABLE moderation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(40) NOT NULL,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'setup')),
  target_id UUID NOT NULL,
  reason VARCHAR(500),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_moderation_audit_created ON moderation_audit_log(created_at DESC);
CREATE INDEX idx_moderation_audit_target ON moderation_audit_log(target_type, target_id);
