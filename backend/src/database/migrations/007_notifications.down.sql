-- Migration 007: in-app notifications (down)

DROP INDEX IF EXISTS idx_notifications_recipient_unread;
DROP INDEX IF EXISTS idx_notifications_recipient_created;
DROP TABLE IF EXISTS notifications;
