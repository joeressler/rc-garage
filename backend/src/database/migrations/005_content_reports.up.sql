-- Migration 005: legal acceptance stamp and driver-initiated content reports

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMP WITH TIME ZONE NULL;

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('setup', 'user', 'comment')),
  target_id UUID NOT NULL,
  reason_code VARCHAR(40) NOT NULL,
  details VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_reports_open
  ON content_reports (created_at DESC) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON content_reports (target_type, target_id);
