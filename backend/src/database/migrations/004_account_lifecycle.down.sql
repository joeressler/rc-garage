-- Migration 004: account lifecycle (down)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM moderation_audit_log WHERE actor_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot restore ON DELETE RESTRICT while null audit actors exist';
  END IF;
END $$;

ALTER TABLE moderation_audit_log
  DROP CONSTRAINT IF EXISTS moderation_audit_log_actor_user_id_fkey;

ALTER TABLE moderation_audit_log
  ALTER COLUMN actor_user_id SET NOT NULL;

ALTER TABLE moderation_audit_log
  ADD CONSTRAINT moderation_audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE users
  DROP COLUMN IF EXISTS age_attested_at;
