-- Migration 001: initial relational schema (up)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    callsign VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    bio VARCHAR(250),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_callsign_format CHECK (callsign ~ '^[a-zA-Z0-9_-]+$')
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    scale VARCHAR(10) NOT NULL,
    vehicle_class VARCHAR(40) NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_class ON vehicles(vehicle_class);

CREATE TABLE setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE NOT NULL,
    forked_from_setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
    root_ancestor_setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
    fork_count INTEGER DEFAULT 0 NOT NULL,
    like_count INTEGER DEFAULT 0 NOT NULL,
    qr_slug VARCHAR(16) UNIQUE NOT NULL,
    calculated_fdr NUMERIC(6, 2) NOT NULL,
    front_bias_percentage NUMERIC(4, 1) NOT NULL,
    surface_type VARCHAR(40) NOT NULL,
    location_tag VARCHAR(80),
    settings JSONB NOT NULL,
    tags TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_setups_vehicle_id ON setups(vehicle_id);
CREATE INDEX idx_setups_user_id ON setups(user_id);
CREATE INDEX idx_setups_forked_from ON setups(forked_from_setup_id);
CREATE INDEX idx_setups_root_ancestor ON setups(root_ancestor_setup_id);
CREATE INDEX idx_setups_qr_slug ON setups(qr_slug);
CREATE INDEX idx_setups_feed_composite ON setups(is_public, created_at DESC) WHERE is_public = TRUE;
CREATE INDEX idx_setups_surface ON setups(surface_type);
CREATE INDEX idx_setups_tags_gin ON setups USING GIN(tags);
CREATE INDEX idx_setups_settings_gin ON setups USING GIN(settings);

CREATE TABLE setup_likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    setup_id UUID REFERENCES setups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, setup_id)
);

CREATE INDEX idx_setup_likes_setup_id ON setup_likes(setup_id);
