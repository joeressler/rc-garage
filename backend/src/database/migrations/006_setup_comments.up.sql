-- Migration 006: flat setup-sheet comments and audit target_type comment

ALTER TABLE moderation_audit_log
  DROP CONSTRAINT IF EXISTS moderation_audit_log_target_type_check;

ALTER TABLE moderation_audit_log
  ADD CONSTRAINT moderation_audit_log_target_type_check
  CHECK (target_type IN ('user', 'setup', 'comment'));

CREATE TABLE IF NOT EXISTS setup_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id UUID NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body VARCHAR(2000) NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_at TIMESTAMPTZ,
  hidden_reason VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_setup_comments_setup_created
  ON setup_comments (setup_id, created_at ASC)
  WHERE is_hidden = FALSE;
