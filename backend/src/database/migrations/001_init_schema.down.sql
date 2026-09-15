-- Migration 001: initial relational schema (down)
DROP TABLE IF EXISTS setup_likes;
DROP TABLE IF EXISTS setups;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS users;

DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS "pgcrypto";
