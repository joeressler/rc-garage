-- Migration 003: chassis radio-box electronics spec (up)

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS electronics JSONB NOT NULL DEFAULT '{}'::JSONB;
