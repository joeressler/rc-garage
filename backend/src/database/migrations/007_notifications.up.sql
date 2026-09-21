-- Migration 007: in-app pit-signal notifications for likes, forks, comments, and report outcomes

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(32) NOT NULL
    CHECK (type IN ('like', 'fork', 'comment', 'report_outcome')),
  setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
  comment_id UUID REFERENCES setup_comments(id) ON DELETE SET NULL,
  report_id UUID REFERENCES content_reports(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_user_id)
  WHERE read_at IS NULL;
