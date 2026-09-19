-- Migration 004: account lifecycle (age attestation, self-delete vs audit actors)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age_attested_at TIMESTAMP WITH TIME ZONE NULL;

ALTER TABLE moderation_audit_log
  ALTER COLUMN actor_user_id DROP NOT NULL;

ALTER TABLE moderation_audit_log
  DROP CONSTRAINT IF EXISTS moderation_audit_log_actor_user_id_fkey;

ALTER TABLE moderation_audit_log
  ADD CONSTRAINT moderation_audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
