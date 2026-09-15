# Milestone 02: PostgreSQL Database Engine & Relational Schema Migrations

## 1. Objective
Implement the PostgreSQL database schema migrations, relational tables, constraints, foreign keys, cascade rules, and indexes supporting users, garage vehicles, telemetry setups, and likes.

---

## 2. Scope & Target Files
- `/backend/src/database/migrations/*`
- `/backend/src/database/schema.sql`
- `/backend/src/database/database.module.ts`
- `/backend/src/database/database.service.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Extensions Required
Execute prior to table creation:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 3.2 Relational Tables & Constraints
1. **`users` Table:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `callsign VARCHAR(30) UNIQUE NOT NULL` (alphanumeric validation)
   - `email VARCHAR(255) UNIQUE NOT NULL`
   - `password_hash VARCHAR(255) NOT NULL` (Argon2id or bcrypt)
   - `avatar_url TEXT NULL`
   - `bio VARCHAR(250) NULL`
   - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`

2. **`vehicles` Table:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `name VARCHAR(60) NOT NULL`
   - `make VARCHAR(50) NOT NULL`
   - `model VARCHAR(50) NOT NULL`
   - `scale VARCHAR(10) NOT NULL` (e.g. `1/10`, `1/24`)
   - `vehicle_class VARCHAR(40) NOT NULL` (e.g. `crawler_scale`, `rock_bouncer`)
   - `is_archived BOOLEAN DEFAULT FALSE NOT NULL`
   - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - Index: `idx_vehicles_user_id` on `user_id`
   - Index: `idx_vehicles_class` on `vehicle_class`

3. **`setups` Table:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE`
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `title VARCHAR(100) NOT NULL`
   - `description TEXT NULL`
   - `is_public BOOLEAN DEFAULT TRUE NOT NULL`
   - `forked_from_setup_id UUID REFERENCES setups(id) ON DELETE SET NULL`
   - `root_ancestor_setup_id UUID REFERENCES setups(id) ON DELETE SET NULL`
   - `fork_count INTEGER DEFAULT 0 NOT NULL`
   - `like_count INTEGER DEFAULT 0 NOT NULL`
   - `qr_slug VARCHAR(16) UNIQUE NOT NULL`
   - `calculated_fdr NUMERIC(6, 2) NOT NULL`
   - `front_bias_percentage NUMERIC(4, 1) NOT NULL`
   - `surface_type VARCHAR(40) NOT NULL`
   - `location_tag VARCHAR(80) NULL`
   - `settings JSONB NOT NULL` (contains drivetrain, suspension, tires, and weights)
   - `tags TEXT[] DEFAULT '{}'::TEXT[] NOT NULL`
   - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - Indexes:
     - `idx_setups_vehicle_id` on `vehicle_id`
     - `idx_setups_user_id` on `user_id`
     - `idx_setups_forked_from` on `forked_from_setup_id`
     - `idx_setups_root_ancestor` on `root_ancestor_setup_id`
     - `idx_setups_qr_slug` on `qr_slug`
     - `idx_setups_feed_composite` on `(is_public, created_at DESC) WHERE is_public = TRUE`
     - `idx_setups_tags_gin` USING GIN(`tags`)
     - `idx_setups_settings_gin` USING GIN(`settings`)

4. **`setup_likes` Table:**
   - `user_id UUID REFERENCES users(id) ON DELETE CASCADE`
   - `setup_id UUID REFERENCES setups(id) ON DELETE CASCADE`
   - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - `PRIMARY KEY (user_id, setup_id)`
   - Index: `idx_setup_likes_setup_id` on `setup_id`

### 3.3 Cascade Behavior & Integrity Rules
- Deleting a `user` cascades to delete all their `vehicles` and owned `setups`.
- Deleting a parent `setup` that has forks preserves the forks by setting `forked_from_setup_id` to `NULL` (`ON DELETE SET NULL`), preventing orphaned child data corruption.

---

## 4. Verification & Acceptance Criteria
1. Initial migration scripts apply cleanly against PostgreSQL 16.
2. Rollback scripts successfully reverse all created tables and extensions without error.
3. Foreign key constraints enforce referential integrity across users, vehicles, and setups.
4. JSONB queries over the `settings` column utilize the GIN index effectively.
