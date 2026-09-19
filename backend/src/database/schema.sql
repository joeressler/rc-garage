-- Canonical PostgreSQL 16 DDL for RC Garage (TECHNICAL_SPECIFICATION.md §5.2)
-- Enforce UUID generation capabilities
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Users Table
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    callsign VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    bio VARCHAR(250),
    role VARCHAR(20) NOT NULL DEFAULT 'driver'
        CHECK (role IN ('driver', 'moderator', 'admin')),
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_at TIMESTAMP WITH TIME ZONE,
    suspension_reason VARCHAR(500),
    age_attested_at TIMESTAMP WITH TIME ZONE,
    legal_accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_callsign_format CHECK (callsign ~ '^[a-zA-Z0-9_-]+$')
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_suspended ON users(is_suspended) WHERE is_suspended = TRUE;

-- -----------------------------------------------------------------------------
-- Vehicles Table (Digital Garage Fleet)
-- -----------------------------------------------------------------------------
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    scale VARCHAR(10) NOT NULL,
    vehicle_class VARCHAR(40) NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    electronics JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_class ON vehicles(vehicle_class);

-- -----------------------------------------------------------------------------
-- Setups Table (Mechanical Configurations & Lineage)
-- -----------------------------------------------------------------------------
CREATE TABLE setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_at TIMESTAMP WITH TIME ZONE,
    hidden_reason VARCHAR(500),

    -- Provenance & Fork Lineage Pointers
    forked_from_setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
    root_ancestor_setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
    fork_count INTEGER DEFAULT 0 NOT NULL,
    like_count INTEGER DEFAULT 0 NOT NULL,

    -- QR Engine Integration Identifier
    qr_slug VARCHAR(16) UNIQUE NOT NULL,

    -- Normalized Quick Filters
    calculated_fdr NUMERIC(6, 2) NOT NULL,
    front_bias_percentage NUMERIC(4, 1) NOT NULL,
    surface_type VARCHAR(40) NOT NULL,
    location_tag VARCHAR(80),

    -- Comprehensive Structured JSONB Settings Vector
    settings JSONB NOT NULL,
    tags TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for setup searches, fork tracking, and feed performance
CREATE INDEX idx_setups_vehicle_id ON setups(vehicle_id);
CREATE INDEX idx_setups_user_id ON setups(user_id);
CREATE INDEX idx_setups_forked_from ON setups(forked_from_setup_id);
CREATE INDEX idx_setups_root_ancestor ON setups(root_ancestor_setup_id);
CREATE INDEX idx_setups_qr_slug ON setups(qr_slug);
CREATE INDEX idx_setups_feed_composite ON setups(is_public, created_at DESC) WHERE is_public = TRUE AND is_hidden = FALSE;
CREATE INDEX idx_setups_surface ON setups(surface_type);
CREATE INDEX idx_setups_tags_gin ON setups USING GIN(tags);
CREATE INDEX idx_setups_settings_gin ON setups USING GIN(settings);

-- -----------------------------------------------------------------------------
-- Setup Likes Table (Community Validation)
-- -----------------------------------------------------------------------------
CREATE TABLE setup_likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    setup_id UUID REFERENCES setups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, setup_id)
);

CREATE INDEX idx_setup_likes_setup_id ON setup_likes(setup_id);

-- -----------------------------------------------------------------------------
-- Setup Comments (flat Pit Notes on public sheets)
-- -----------------------------------------------------------------------------
CREATE TABLE setup_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setup_id UUID NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body VARCHAR(2000) NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_at TIMESTAMPTZ,
    hidden_reason VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_setup_comments_setup_created
    ON setup_comments (setup_id, created_at ASC)
    WHERE is_hidden = FALSE;

-- -----------------------------------------------------------------------------
-- Moderation Audit Log (Immutable Operator Actions)
-- -----------------------------------------------------------------------------
CREATE TABLE moderation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'setup', 'comment')),
    target_id UUID NOT NULL,
    reason VARCHAR(500),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_moderation_audit_created ON moderation_audit_log(created_at DESC);
CREATE INDEX idx_moderation_audit_target ON moderation_audit_log(target_type, target_id);

-- -----------------------------------------------------------------------------
-- Content Reports (driver-initiated queue; comment reserved for Milestone 19)
-- -----------------------------------------------------------------------------
CREATE TABLE content_reports (
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

CREATE INDEX idx_content_reports_open ON content_reports (created_at DESC) WHERE status = 'open';
CREATE INDEX idx_content_reports_target ON content_reports (target_type, target_id);
