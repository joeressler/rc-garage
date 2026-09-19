-- Migration 003: chassis radio-box electronics spec (down)

ALTER TABLE vehicles
  DROP COLUMN IF EXISTS electronics;
