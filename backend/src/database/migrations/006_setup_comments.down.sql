-- Migration 006: setup comments (down)

DROP INDEX IF EXISTS idx_setup_comments_setup_created;
DROP TABLE IF EXISTS setup_comments;

DELETE FROM moderation_audit_log WHERE target_type = 'comment';

ALTER TABLE moderation_audit_log
  DROP CONSTRAINT IF EXISTS moderation_audit_log_target_type_check;

ALTER TABLE moderation_audit_log
  ADD CONSTRAINT moderation_audit_log_target_type_check
  CHECK (target_type IN ('user', 'setup'));
