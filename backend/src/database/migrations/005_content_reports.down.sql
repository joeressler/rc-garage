-- Migration 005: content reports (down)

DROP INDEX IF EXISTS idx_content_reports_target;
DROP INDEX IF EXISTS idx_content_reports_open;
DROP TABLE IF EXISTS content_reports;

ALTER TABLE users
  DROP COLUMN IF EXISTS legal_accepted_at;
