# RC Car & Rock Crawler Garage & Setup Logger
## Production Technical Specification & Architectural Blueprint

---

## 1. Executive Summary & High-Level Architecture

The **RC Car & Rock Crawler Garage & Setup Logger** is a community-driven, telemetry-grade web platform engineered for competitive RC racers, scale rock crawlers, and basher enthusiasts. The platform provides digital vehicle profile management, mechanical setup sheet logging, an immutable "fork" ecosystem for tuning iterations, and high-density QR code generation for physical chassis stickers.

```
+-----------------------------------------------------------------------------------+
|                                  EC2 Host Server                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     Host Nginx (Reverse Proxy & TLS Edge)                   |  |
|  |   - Port 80 / 443 (Public Internet Ingress)                                 |  |
|  |   - SSL/TLS Termination (Let's Encrypt / Certbot)                           |  |
|  |   - Static Asset Caching & Rate Limiting                                    |  |
|  +--------------------+------------------------------------+-------------------+  |
|                       |                                    |                      |
|         Proxy Pass    | 127.0.0.1:3742                     | 127.0.0.1:5742       |
|         Location /    v                                    v Location /api/       |
|  +-----------------------------------------------------------------------------+  |
|  |                        Docker Engine Bridge Network                         |  |
|  |                             (rc-isolated-net)                               |  |
|  |                                                                             |  |
|  |  +-----------------------+              +--------------------------------+  |  |
|  |  |      rc-frontend      |              |           rc-backend           |  |  |
|  |  |  - React 18 + Vite    |              |  - NestJS 10 (TypeScript)      |  |  |
|  |  |  - Nginx Alpine SPA   |              |  - Zod Request Validation      |  |  |
|  |  |  - Zustand Stores     |              |  - JWT Authentication          |  |  |
|  |  |  - Tailwind Pit-Mat   |              |  - QR Code Generation Engine   |  |  |
|  |  |  - Max RAM: 128 MB    |              |  - Max RAM: 256 MB             |  |  |
|  |  +-----------------------+              +---------------+----------------+  |  |
|  |                                                         |                   |  |
|  |                                         Internal Bridge | TCP 5432          |  |
|  |                                         (No Host Port)  v                   |  |
|  |                                         +--------------------------------+  |  |
|  |                                         |             rc-db              |  |  |
|  |                                         |  - PostgreSQL 16 (Alpine)      |  |  |
|  |                                         |  - Tuned Buffers for 256MB RAM |  |  |
|  |                                         |  - Max RAM: 256 MB             |  |  |
|  |                                         +---------------+----------------+  |  |
|  +---------------------------------------------------------|-------------------+  |
|                                                            |                      |
|                                                Named Mount v                      |
|                                                +----------------------------+     |
|                                                | Volume: pg_data            |     |
|                                                | /var/lib/postgresql/data   |     |
|                                                +----------------------------+     |
+-----------------------------------------------------------------------------------+
```

### 1.1 Technology Stack Matrix

| Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Backend Framework** | NestJS (v10) / Node.js 20 LTS | Modular enterprise dependency injection, predictable layered architecture, structured REST controllers. |
| **Data Validation** | Zod (v3) | Single source of truth for runtime validation and static TypeScript type inference across domains. |
| **Frontend Framework** | React (v18) / Vite | Optimized single-page application (SPA) execution, fast Hot Module Replacement (HMR), minimal footprint. |
| **Client State** | Zustand (v4) | Lightweight, decentralized store slices without Redux boilerplate; atomic selectors for rapid re-renders. |
| **CSS & Design Tokens** | TailwindCSS (v3) | Hardware-inspired custom utility tokens, zero-runtime CSS overhead, dark-mode-first aesthetic. |
| **Database** | PostgreSQL 16 (Alpine) | Strict relational integrity for user-vehicle-setup hierarchies, native JSONB support for setup sheets. |
| **Containerization** | Docker / Docker Compose | Hermetic deployment, explicit CPU/memory caps tailored for cost-effective 1GB/2GB EC2 hosts. |
| **Edge Reverse Proxy** | Nginx (Host-level) | Low-overhead SSL offloading, gzip compression, request throttling, and isolated localhost binding. |

---

## 2. Core Functional Requirements Specification

### 2.1 The Digital Garage
- **Entity Scope:** Users maintain a personal fleet of radio-controlled models.
- **Attributes:** Make (Manufacturer), Model name, Scale (`1/24`, `1/18`, `1/10`, `1/8`, `1/7`, `1/5`), Class category (`crawler_scale`, `rock_bouncer`, `comp_crawler_pro`, `buggy_2wd`, `buggy_4wd`, `short_course`, `touring_onroad`, `drift_rwd`, `monster_truck`).
- **Fleet Constraints:** Each vehicle maintains an isolated history of setups and active configurations. Soft deletion preserves public setups linked to historical forks.

### 2.2 Setup Sheet Logging Engine
- **Telemetry Vector Captures:**
  - **Drivetrain & Gearing:** Pinion gear teeth count, Spur gear teeth count, Internal transmission ratio, calculated Final Drive Ratio (FDR), Rollout distance, Motor KV rating, and Brushless/Brushed motor typology.
  - **Suspension Geometry (Front & Rear):** Shock oil viscosity (WT/CST dual-unit normalization), spring rates, damping piston hole dimensions, static ride height, droop, camber angles (-5° to +5°), and toe angles (-5° toe-out to +5° toe-in).
  - **Tires, Inserts & Weight Distribution:** Tire brand/compound selection, foam insert architecture (single-stage, dual-stage, printed silicone matrix), unsprung wheel brass weights (grams per corner), and gross Center of Gravity (CoG) front-to-rear percentage split.
  - **Track & Environmental Metadata:** Terrain surface typology (Granite rock, slick clay, loose loam, carpet, asphalt), ambient temperature, and surface grip index.

### 2.3 The "Fork" Ecosystem (Lineage & Provenance)
- **Concept:** Enables decentralized community collaboration similar to Git version control. Any public setup sheet can be cloned ("forked") into another driver's garage.
- **Lineage Tree:** Every forked setup stores a pointer to its immediate parent (`forked_from_setup_id`) and the root progenitor (`root_ancestor_setup_id`).
- **Immutability Contract:** A fork creates an independent, decoupled copy of all mechanical settings in the recipient's garage. Modifications to the fork never mutate the ancestor.
- **Diff Engine:** The UI provides side-by-side diagnostic diffing highlighting mechanical deviations between the fork and its parent.

### 2.4 QR Code Sharing Engine
- **Chassis Physical Integration:** Generates standardized, high-contrast QR codes formatted for 1.5" x 1.5" vinyl pit-box stickers and lexan chassis tags.
- **Resolution & ECC:** Employs Error Correction Level 'H' (30% damage tolerance) to maintain readability despite mud, grease, and scratch exposure on the track.
- **Canonical Routing:** Embeds short URLs pointing to `/s/:slug`, rendering an ultra-fast, mobile-optimized read-only pit inspection sheet without requiring native app downloads.

### 2.5 Admin Console & Community Moderation
- **Operator Roles:** Accounts carry a `role` of `driver`, `moderator`, or `admin`. Moderators and admins access the Scrutineering Desk (`/admin`); only admins may change roles or hard-delete setups.
- **Driver Suspension:** Operators can suspend abusive accounts with a required reason. Suspended drivers cannot authenticate or perform authenticated mutations until reinstated.
- **Content Moderation:** Operators can force-hide (`is_hidden`) public setups so they disappear from the community feed and QR inspection routes, or (admins) permanently delete setups while preserving fork lineage via `ON DELETE SET NULL`.
- **Audit Trail:** Every moderation mutation writes an immutable `moderation_audit_log` row (actor, action, target, reason, metadata, timestamp) queryable from the admin console.
- **Bootstrap:** Optional `BOOTSTRAP_ADMIN_EMAIL` promotes the matching account to `admin` idempotently when no admin yet exists. The last remaining admin cannot be demoted or suspended.

---

## 3. Visual & UI Theme: "The Industrial Garage Pit-Mat"

### 3.1 Design Philosophy
The user interface replicates an engineer's workbench, combining elements of an anodized aluminum setup board, high-contrast mechanical readouts, heavy-duty toggle switches, and rugged pit-mat textures.

### 3.2 Design Token Palette

```css
/* Color Palette Tokens */
--color-pit-black: #0E1012;       /* Base layout backdrop (deep oil-stained pit-mat) */
--color-pit-grease: #16191D;      /* Secondary container background */
--color-pit-steel: #21262D;       /* Elevated card surface & drawer panel */
--color-pit-rubber: #2A313A;      /* Tool-tray borders and recessed panels */

--color-hazard-orange: #FF5500;   /* Primary CTA, critical alerts, gear mesh highlight */
--color-hazard-stripe: #E04800;   /* Secondary stripe accent for diagnostic warnings */
--color-neon-radio: #00FF66;      /* Active state, verified setup seal, live telemetry */
--color-nitromethane: #FFB800;    /* Fork indicator, pending changes, warning badges */
--color-anodized-blue: #00B4D8;   /* Shock fluid viscosity, metric suspension markers */

--color-metal-border: #3D444E;    /* Brushed aluminum structural borders */
--color-metal-highlight: #6B7280; /* Beveled metallic component top-edge highlights */
--color-readout-bright: #F9FAFB;  /* High-contrast telemetry text */
--color-readout-dim: #9CA3AF;     /* Metric units and secondary technical labels */
--color-readout-muted: #6B7280;   /* Inactive states and stencil watermarks */
```

### 3.3 Typography Hierarchy

| Category | Font Family | Usage |
| :--- | :--- | :--- |
| **Telemetry Readouts** | `"JetBrains Mono", "Share Tech Mono", monospace` | Gear ratios, fluid CST/WT ratings, camber/toe degrees, wheel weight grams. |
| **Industrial Headings** | `"Barlow Condensed", "Chakra Petch", sans-serif` | Component titles, drawer labels, vehicle class badges, uppercase inspection headers. |
| **Interface Body** | `"Inter", -apple-system, sans-serif` | Track condition descriptions, driver setup notes, user bios. |

### 3.4 Layout Motifs & Tactile Affordances
- **Clipboard Inspection Sheets:** Main setup view designed with an embossed metallic binder clip header, printed alignment grid backdrop, and official scrutineering pass stamps.
- **Toolbox Drawer Tabs:** Navigation tabs mimic beveled aluminum drawer pulls with spring-loaded sliding animations and knurled grip accents.
- **Diagnostic Workbench Widgets:** Key calculations (FDR, CoG distribution, Shock Dyno) display as instrument gauge cards with analog bar meters and digital LED segments.
- **Corner Hardware:** Heavy-duty card containers feature stylized corner hex-bolt rivets (`border-t-2 border-l-2 border-pit-rubber`).

---

## 4. Step 1: DevOps & Multi-Container Deployment Specification

### 4.1 Production Multi-Stage `Dockerfile` - Frontend (React/Vite)

```dockerfile
# Multi-stage build for React SPA with unprivileged Nginx edge server
# ------------------------------------------------------------------------------
# Stage 1: Build static assets
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Enforce deterministic dependency installation
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source and build production bundle
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/

ENV NODE_ENV=production
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Minimal runtime image serving static assets
# ------------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:alpine-slim AS runner

# Hardened unprivileged security context (UID 101)
USER nginx

# Copy custom Nginx SPA routing configuration
COPY --chown=nginx:nginx docker/frontend-nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA bundle from builder stage
COPY --from=builder --chown=nginx:nginx /usr/src/app/dist /usr/share/nginx/html

# Expose internal unprivileged container port (non-standard to avoid host collisions)
EXPOSE 3742

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
```

### 4.2 Production Multi-Stage `Dockerfile` - Backend (NestJS)

```dockerfile
# Multi-stage build for NestJS backend with pruned production dependencies
# ------------------------------------------------------------------------------
# Stage 1: Build application and compile TypeScript
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies including devDependencies for TypeScript compilation
COPY package.json package-lock.json ./
RUN npm ci

# Copy configuration and source code
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/

ENV NODE_ENV=production
RUN npm run build

# Remove development dependencies to minimize disk footprint
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Production runtime image
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Establish non-root execution privileges
USER node

# Copy production dependencies and compiled artifacts
COPY --chown=node:node package.json ./
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/dist ./dist

# Environmental constraints
ENV NODE_ENV=production
ENV PORT=5742

EXPOSE 5742

# Enforce V8 heap size bounds aligned with container memory cap (256MB limit -> 192MB heap)
CMD ["node", "--max-old-space-size=192", "dist/main.js"]
```

### 4.3 Container Orchestration: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # ----------------------------------------------------------------------------
  # PostgreSQL Database Service
  # Isolated within internal bridge network; no public host ports exposed
  # ----------------------------------------------------------------------------
  rc-db:
    image: postgres:16-alpine
    container_name: rc-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-rc_garage_prod}
      POSTGRES_USER: ${POSTGRES_USER:-rc_garage_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Database password must be supplied}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - rc-isolated-net
    command: >
      postgres
      -c shared_buffers=64MB
      -c work_mem=4MB
      -c maintenance_work_mem=16MB
      -c effective_cache_size=128MB
      -c max_connections=40
      -c checkpoint_completion_target=0.7
      -c wal_buffers=2MB
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 256M
        reservations:
          cpus: '0.10'
          memory: 128M
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  # ----------------------------------------------------------------------------
  # NestJS REST API Backend Service
  # Bound exclusively to host loopback interface on port 5742 (non-standard to avoid collisions)
  # ----------------------------------------------------------------------------
  rc-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    image: rc-backend:prod
    container_name: rc-backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:5742:5742"
    environment:
      NODE_ENV: production
      PORT: 5742
      DATABASE_URL: postgresql://${POSTGRES_USER:-rc_garage_admin}:${POSTGRES_PASSWORD}@rc-db:5432/${POSTGRES_DB:-rc_garage_prod}?schema=public
      JWT_SECRET: ${JWT_SECRET:?JWT Secret must be configured}
      JWT_EXPIRATION: ${JWT_EXPIRATION:-7d}
      BOOTSTRAP_ADMIN_EMAIL: ${BOOTSTRAP_ADMIN_EMAIL:-}
      APP_BASE_URL: ${APP_BASE_URL:-http://127.0.0.1:3742}
    depends_on:
      rc-db:
        condition: service_healthy
    networks:
      - rc-isolated-net
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 256M
        reservations:
          cpus: '0.15'
          memory: 128M
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:5742/api/garage/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s

  # ----------------------------------------------------------------------------
  # React SPA Static Frontend Service (Nginx Unprivileged)
  # Bound exclusively to host loopback interface on port 3742 (non-standard to avoid collisions)
  # ----------------------------------------------------------------------------
  rc-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: rc-frontend:prod
    container_name: rc-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3742:3742"
    depends_on:
      - rc-backend
    networks:
      - rc-isolated-net
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 128M
        reservations:
          cpus: '0.05'
          memory: 64M

# ------------------------------------------------------------------------------
# Isolated Bridge Network and Persistent Volumes
# ------------------------------------------------------------------------------
networks:
  rc-isolated-net:
    driver: bridge
    name: rc-isolated-net

volumes:
  pg_data:
    name: rc_garage_pg_data
    driver: local
```

### 4.4 Host-Level Nginx Reverse Proxy Architecture (`/etc/nginx/sites-available/rc-garage.conf`)

```nginx
# Rate limiting zone to protect NestJS auth routes on low-tier EC2 instances
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=15r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=3r/s;

server {
    listen 80;
    server_name rc-garage.community www.rc-garage.community;

    # Certbot ACME challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name rc-garage.community www.rc-garage.community;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/rc-garage.community/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rc-garage.community/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Performance optimizations
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 1024;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # API Backend Reverse Proxy
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:5742;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Strict Rate Limit for Auth Endpoints
    location /api/garage/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:5742;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Frontend SPA Reverse Proxy
    location / {
        proxy_pass http://127.0.0.1:3742;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Step 2: Zod Schemas & Database Relational Contracts

### 5.1 Zod Domain Schemas & Derived TypeScript Interfaces

```typescript
import { z } from 'zod';

// =============================================================================
// Vehicle & System Enums
// =============================================================================
export const VehicleScaleEnum = z.enum([
  '1/24',
  '1/18',
  '1/10',
  '1/8',
  '1/7',
  '1/5',
]);

export const VehicleClassEnum = z.enum([
  'crawler_scale',
  'rock_bouncer',
  'comp_crawler_pro',
  'buggy_2wd',
  'buggy_4wd',
  'short_course',
  'touring_onroad',
  'drift_rwd',
  'monster_truck',
]);

export const MotorTypeEnum = z.enum([
  'brushed',
  'brushless_sensored',
  'brushless_sensorless',
]);

export const GearPitchEnum = z.enum([
  '48P',
  '32P',
  'mod0.8',
  'mod1.0',
  '64P',
]);

export const FluidUnitEnum = z.enum([
  'WT',
  'CST',
]);

export const FoamInsertTypeEnum = z.enum([
  'single_stage_foam',
  'dual_stage_foam',
  'printed_silicone_matrix',
  'air_pocket',
  'none',
]);

export const BatteryPositionEnum = z.enum([
  'front_tray',
  'rear_tray',
  'center_low',
  'chassis_slider_left',
  'chassis_slider_right',
  'forward_axle_mount',
]);

export const SurfaceTypeEnum = z.enum([
  'granite_rock',
  'slick_rock',
  'river_stone',
  'packed_dirt',
  'loose_loam',
  'clay_indoor',
  'carpet_offroad',
  'asphalt',
  'snow_ice',
]);

export const GripLevelEnum = z.enum([
  'low',
  'medium',
  'high',
  'extreme',
]);

// =============================================================================
// Vector 1: Drivetrain & Gearing Schema
// =============================================================================
export const DrivetrainSettingsSchema = z.object({
  pinionTeeth: z.number().int().min(9, 'Pinion must have at least 9 teeth').max(60),
  spurTeeth: z.number().int().min(30, 'Spur must have at least 30 teeth').max(120),
  transmissionInternalRatio: z.number().positive().min(1.0).max(6.0),
  calculatedFdr: z.number().positive().optional(),
  gearPitch: GearPitchEnum.default('48P'),
  motorKv: z.number().int().min(500).max(12000).optional(),
  motorType: MotorTypeEnum.default('brushless_sensored'),
  batteryCellCount: z.number().int().min(1).max(8).default(3),
  underdriveOverdrivePercentage: z.number().min(-50).max(50).default(0),
}).refine((data) => data.spurTeeth > data.pinionTeeth, {
  message: 'Spur gear teeth must exceed pinion gear teeth',
  path: ['spurTeeth'],
});

// =============================================================================
// Vector 2: Suspension (Corner & Axle Specific) Schema
// =============================================================================
export const ShockSpecificationSchema = z.object({
  oilViscosityValue: z.number().positive().min(10).max(5000),
  oilViscosityUnit: FluidUnitEnum.default('CST'),
  springRateDescription: z.string().min(1).max(50),
  springRateLbsInch: z.number().positive().optional(),
  pistonHoles: z.number().int().min(1).max(8).default(2),
  pistonHoleDiameterMm: z.number().positive().min(0.5).max(3.0).default(1.2),
  shockLengthEyeToEyeMm: z.number().positive().min(50).max(160),
  camberAngleDeg: z.number().min(-8.0).max(8.0).default(0.0),
  toeAngleDeg: z.number().min(-8.0).max(8.0).default(0.0),
  rideHeightMm: z.number().min(0).max(120),
  droopMm: z.number().min(0).max(50).default(5),
  swayBarDiameterMm: z.number().min(0).max(5.0).optional(),
});

export const AxleSuspensionSchema = z.object({
  front: ShockSpecificationSchema,
  rear: ShockSpecificationSchema,
  diffFluidFrontWeight: z.string().optional(),
  diffFluidCenterWeight: z.string().optional(),
  diffFluidRearWeight: z.string().optional(),
  portalGearsInstalled: z.boolean().default(false),
  portalBoxRatio: z.number().positive().optional(),
});

// =============================================================================
// Vector 3: Tires & Corner Weight Distribution Schema
// =============================================================================
export const AxleTireSpecificationSchema = z.object({
  brand: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  compound: z.string().min(1).max(50),
  wheelDiameterInch: z.number().positive().default(1.9),
  insertType: FoamInsertTypeEnum.default('dual_stage_foam'),
  brassWheelWeightGramsPerWheel: z.number().min(0).max(500).default(0),
  knuckleWeightGramsPerSide: z.number().min(0).max(300).default(0),
  ventedTireRims: z.boolean().default(false),
});

export const WeightDistributionSchema = z.object({
  totalRtrWeightGrams: z.number().positive().min(200).max(25000),
  frontAxleWeightGrams: z.number().positive(),
  rearAxleWeightGrams: z.number().positive(),
  frontWeightBiasPercentage: z.number().min(0).max(100).optional(),
  rearWeightBiasPercentage: z.number().min(0).max(100).optional(),
  batteryMountLocation: BatteryPositionEnum.default('center_low'),
}).refine(
  (data) => Math.abs(data.totalRtrWeightGrams - (data.frontAxleWeightGrams + data.rearAxleWeightGrams)) <= 10,
  {
    message: 'Front plus rear axle weights must equal total ready-to-run weight within a 10g tolerance',
    path: ['totalRtrWeightGrams'],
  }
);

export const TiresAndWeightSchema = z.object({
  front: AxleTireSpecificationSchema,
  rear: AxleTireSpecificationSchema,
  weight: WeightDistributionSchema,
});

// =============================================================================
// Vector 4: Comprehensive Composite Setup Settings Block
// =============================================================================
export const SetupSettingsSchema = z.object({
  drivetrain: DrivetrainSettingsSchema,
  suspension: AxleSuspensionSchema,
  tiresAndWeight: TiresAndWeightSchema,
  trackConditions: z.object({
    surface: SurfaceTypeEnum.default('granite_rock'),
    grip: GripLevelEnum.default('high'),
    ambientTempCelsius: z.number().min(-20).max(60).optional(),
    locationTag: z.string().max(80).optional(),
  }),
  driverNotes: z.string().max(2000).optional(),
});

// =============================================================================
// Domain Level Entities (Vehicle, Setup, User)
// =============================================================================
export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  callsign: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Callsign must be alphanumeric'),
});

export const CreateVehicleSchema = z.object({
  name: z.string().min(1).max(60),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  scale: VehicleScaleEnum.default('1/10'),
  vehicleClass: VehicleClassEnum.default('crawler_scale'),
});

export const CreateSetupSchema = z.object({
  vehicleId: z.string().uuid(),
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  tags: z.array(z.string().min(2).max(30)).max(10).default([]),
  settings: SetupSettingsSchema,
});

export const ForkSetupSchema = z.object({
  targetVehicleId: z.string().uuid(),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  settingOverrides: SetupSettingsSchema.deepPartial().optional(),
});

// =============================================================================
// Inferred TypeScript Type Definitions
// =============================================================================
export type VehicleScale = z.infer<typeof VehicleScaleEnum>;
export type VehicleClass = z.infer<typeof VehicleClassEnum>;
export type DrivetrainSettings = z.infer<typeof DrivetrainSettingsSchema>;
export type ShockSpecification = z.infer<typeof ShockSpecificationSchema>;
export type AxleSuspension = z.infer<typeof AxleSuspensionSchema>;
export type AxleTireSpecification = z.infer<typeof AxleTireSpecificationSchema>;
export type WeightDistribution = z.infer<typeof WeightDistributionSchema>;
export type TiresAndWeight = z.infer<typeof TiresAndWeightSchema>;
export type SetupSettings = z.infer<typeof SetupSettingsSchema>;
export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>;
export type CreateSetupDto = z.infer<typeof CreateSetupSchema>;
export type ForkSetupDto = z.infer<typeof ForkSetupSchema>;
```

### 5.2 PostgreSQL Relational Database Schema (DDL)

```sql
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
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
CREATE INDEX idx_setups_hidden ON setups(is_hidden) WHERE is_hidden = TRUE;

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
-- Moderation Audit Log (Immutable Operator Actions)
-- -----------------------------------------------------------------------------
CREATE TABLE moderation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(40) NOT NULL,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'setup')),
    target_id UUID NOT NULL,
    reason VARCHAR(500),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_moderation_audit_created ON moderation_audit_log(created_at DESC);
CREATE INDEX idx_moderation_audit_target ON moderation_audit_log(target_type, target_id);
```

---

## 6. Step 3: NestJS Controller & API Routes Specification

### 6.1 Base Subpath Prefix
All endpoints are exposed under the base path: `/api/garage`.

### 6.2 Standardized REST Envelope Contracts

#### Success Envelope (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "timestamp": "2026-09-15T12:00:00.000Z"
}
```

#### Error Envelope (`400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `422 Unprocessable`)
```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "settings.drivetrain.pinionTeeth: Pinion must have at least 9 teeth"
  ],
  "timestamp": "2026-09-15T12:00:00.000Z"
}
```

### 6.3 Complete API Endpoint Matrix

| Method | Subpath | Auth Required | Request Body Type | Response Data Type | HTTP Status | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | None | `UserRegistrationSchema` | `{ token: string, user: UserProfile }` | `201 Created` | Creates driver profile and returns signed JWT token. |
| `POST` | `/auth/login` | None | `{ email, password }` | `{ token: string, user: UserProfile }` | `200 OK` | Authenticates credentials and returns JWT token. |
| `GET` | `/auth/me` | Bearer JWT | None | `UserProfile` | `200 OK` | Retrieves authenticated driver profile and fleet statistics. |
| `POST` | `/vehicles` | Bearer JWT | `CreateVehicleSchema` | `VehicleEntity` | `201 Created` | Registers a new RC chassis in the driver's garage. |
| `GET` | `/vehicles` | Bearer JWT | None (Query: `?archived=false`) | `VehicleEntity[]` | `200 OK` | Returns all vehicles belonging to the authenticated driver. |
| `GET` | `/vehicles/:id` | Bearer JWT | None (Param: `id`) | `VehicleWithSetupsEntity` | `200 OK` | Retrieves specific vehicle details and linked setups. |
| `PUT` | `/vehicles/:id` | Bearer JWT | `Partial<CreateVehicleSchema>`| `VehicleEntity` | `200 OK` | Updates vehicle make, model, or class. |
| `DELETE`| `/vehicles/:id` | Bearer JWT | None (Param: `id`) | `{ deleted: true, id: string }`| `200 OK` | Soft-deletes or removes vehicle from garage. |
| `POST` | `/setups` | Bearer JWT | `CreateSetupSchema` | `SetupEntity` | `201 Created` | Records a new setup sheet, computing FDR and QR slug. |
| `GET` | `/setups` | Bearer JWT | Query: `?vehicleId=:uuid` | `SetupSummary[]` | `200 OK` | Lists setups for a specific vehicle in the user's fleet. |
| `GET` | `/setups/:id` | Optional | None (Param: `id`) | `SetupDetailEntity` | `200 OK` | Returns full setup sheet with fork provenance and likes. |
| `PUT` | `/setups/:id` | Bearer JWT | `Partial<CreateSetupSchema>`| `SetupEntity` | `200 OK` | Modifies an existing setup sheet (owner only). |
| `DELETE`| `/setups/:id` | Bearer JWT | None (Param: `id`) | `{ deleted: true, id: string }`| `200 OK` | Deletes a setup sheet from garage. |
| `POST` | `/setups/:id/fork`| Bearer JWT | `ForkSetupSchema` | `SetupEntity` | `201 Created` | Clones a public setup into target vehicle with lineage link. |
| `GET` | `/setups/:id/qr` | None | Query: `?format=svg\|png&size=512` | Binary Stream or `{ dataUrl, directUrl }` | `200 OK` | Outputs physical chassis sticker QR code for setup. |
| `GET` | `/feed` | None | Query: `?model=&class=&surface=&tag=&cursor=&limit=20` | `PaginatedFeedResponse` | `200 OK` | Community setup discovery feed with multi-vector filters. |
| `POST` | `/setups/:id/like`| Bearer JWT | None (Param: `id`) | `{ liked: boolean, likeCount: number }` | `200 OK` | Toggles star/like endorsement on a setup sheet. |
| `GET` | `/admin/overview` | Bearer JWT (moderator\|admin) | None | `{ userCount, setupCount, publicSetupCount, hiddenSetupCount, suspendedUserCount, likes24h }` | `200 OK` | Admin console KPI snapshot. |
| `GET` | `/admin/users` | Bearer JWT (moderator\|admin) | Query: `?q=&role=&suspended=&cursor=&limit=` | `PaginatedAdminUsers` | `200 OK` | Search and filter driver accounts for moderation. |
| `PATCH` | `/admin/users/:id/suspension` | Bearer JWT (moderator\|admin) | `{ suspend, reason? }` | `AdminUserSummary` | `200 OK` | Suspend or reinstate a driver (reason required on suspend). |
| `PATCH` | `/admin/users/:id/role` | Bearer JWT (**admin**) | `{ role }` | `AdminUserSummary` | `200 OK` | Promote/demote staff roles; blocked for last admin / self-lockout. |
| `GET` | `/admin/setups` | Bearer JWT (moderator\|admin) | Query: `?q=&hidden=&isPublic=&authorCallsign=&cursor=&limit=` | `PaginatedAdminSetups` | `200 OK` | Review public, private, and hidden setups. |
| `PATCH` | `/admin/setups/:id/visibility` | Bearer JWT (moderator\|admin) | `{ hide, reason? }` | `AdminSetupSummary` | `200 OK` | Force-hide or restore a setup from public surfaces. |
| `DELETE` | `/admin/setups/:id` | Bearer JWT (**admin**) | `{ reason }` | `{ deleted: true, id }` | `200 OK` | Hard-delete abusive setup; writes audit row. |
| `GET` | `/admin/audit-log` | Bearer JWT (moderator\|admin) | Query: `?cursor=&limit=` | `PaginatedAuditLog` | `200 OK` | Chronological moderation action history. |

### 6.4 The Fork Ecosystem Endpoint Contract Detail

```typescript
// POST /api/garage/setups/:id/fork
// Payload Contract
export interface ForkSetupPayload {
  targetVehicleId: string; // Target vehicle in caller's garage
  title?: string;          // Optional custom title (defaults to: "Fork of {Original Title}")
  description?: string;    // Custom driver fork notes
  settingOverrides?: DeepPartial<SetupSettings>; // Specific adjustments made upon cloning
}

// Controller Logic Execution Flow
// 1. Fetch source setup by :id; verify is_public === true OR source.user_id === caller.user_id.
// 2. Fetch target vehicle by targetVehicleId; verify caller owns the vehicle.
// 3. Deep-merge: clonedSettings = deepMerge(source.settings, payload.settingOverrides || {}).
// 4. Compute derived telemetry (FDR, CoG bias) from clonedSettings.
// 5. Generate unique nano-id qr_slug for physical sticker mapping.
// 6. Set lineage pointers:
//      forked_from_setup_id = source.id
//      root_ancestor_setup_id = source.root_ancestor_setup_id ?? source.id
// 7. Atomic transaction:
//      INSERT INTO setups (..., forked_from_setup_id, root_ancestor_setup_id, ...)
//      UPDATE setups SET fork_count = fork_count + 1 WHERE id = source.id
// 8. Return 201 Created with newly created setup entity.
```

---

## 7. Step 4: Zustand Store Architecture (Frontend State Management)

```typescript
// =============================================================================
// Store 1: useAuthStore (Session, Identity & JWT Lifecycle)
// =============================================================================
export interface UserProfile {
  id: string;
  callsign: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  role: 'driver' | 'moderator' | 'admin';
  isSuspended: boolean;
  createdAt: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; callsign: string }) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<void>;
  clearAuthError: () => void;
}

// =============================================================================
// Store 2: useGarageStore (Fleet Vehicle Management)
// =============================================================================
export interface Vehicle {
  id: string;
  userId: string;
  name: string;
  make: string;
  model: string;
  scale: string;
  vehicleClass: string;
  setupCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GarageState {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  isLoading: boolean;
  error: string | null;

  // Selectors
  getActiveVehicle: () => Vehicle | undefined;

  // Actions
  fetchVehicles: () => Promise<void>;
  selectVehicle: (vehicleId: string) => void;
  createVehicle: (payload: { name: string; make: string; model: string; scale: string; vehicleClass: string }) => Promise<Vehicle>;
  updateVehicle: (vehicleId: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (vehicleId: string) => Promise<void>;
}

// =============================================================================
// Store 3: useSetupStore (Active Setup Sheet, Gearing Calc & Community Feed)
// =============================================================================
export interface SetupSummary {
  id: string;
  vehicleId: string;
  userId: string;
  title: string;
  calculatedFdr: number;
  frontBiasPercentage: number;
  surfaceType: string;
  forkCount: number;
  likeCount: number;
  qrSlug: string;
  isForked: boolean;
  originalAuthorCallsign?: string;
  createdAt: string;
}

export interface FeedFilters {
  vehicleModel?: string;
  vehicleClass?: string;
  surfaceType?: string;
  locationTag?: string;
  sortBy: 'newest' | 'most_forked' | 'most_liked';
  cursor?: string;
  limit: number;
}

export interface SetupState {
  // Current Editor / Active Sheet State
  activeSetup: SetupSummary | null;
  activeSettings: SetupSettings | null;
  isDirty: boolean;
  isSaving: boolean;
  validationErrors: Record<string, string>;

  // Community Feed State
  feedSetups: SetupSummary[];
  feedFilters: FeedFilters;
  feedHasMore: boolean;
  isFeedLoading: boolean;

  // Forking & Diff Inspection Cache
  comparisonParentSetup: SetupSettings | null;

  // Live Math Computation Actions (Zero-latency pit-mat feedback)
  updateGearing: (pinion: number, spur: number, internalRatio: number) => void;
  updateWeights: (frontWeight: number, rearWeight: number) => void;
  updateSuspensionCorner: (axle: 'front' | 'rear', spec: Partial<ShockSpecification>) => void;
  
  // Persistence Actions
  loadSetupById: (setupId: string) => Promise<void>;
  saveCurrentSetup: () => Promise<void>;
  forkSetupIntoGarage: (sourceSetupId: string, targetVehicleId: string, title?: string) => Promise<string>;
  loadParentForComparison: (parentSetupId: string) => Promise<void>;

  // Feed Actions
  fetchFeed: (reset?: boolean) => Promise<void>;
  setFeedFilters: (filters: Partial<FeedFilters>) => void;
}
```

---

## 8. Step 5: Frontend UI Component Blueprint ("The Industrial Garage Pit-Mat")

### 8.1 Visual Wireframe & Layout Architecture

```
+---------------------------------------------------------------------------------------------------------+
| [ PIT-MAT WORKBENCH ]  CALLSIGN: "CRAWLER_KING"  | FLEET: 4 CHASSIS | TELEMETRY: ONLINE  [LOGOUT]       |
+---------------------------------------------------------------------------------------------------------+
| [TOOLBOX DRAWERS]:  [1. FLEET GARAGE]  [[2. SETUP CLIPBOARD]]  [3. COMMUNITY FEED]  [4. QR PIT-STICKERS]|
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  +------------------------------------ CLIPBOARD INSPECTION SHEET -----------------------------------+  |
|  | [METAL CLIP HEADER]  CHASSIS: VANQUISH VS4-10 PHOENIX | SCALE: 1/10 | CLASS: SCALE CRAWLER       |  |
|  | SHEET TITLE: "RUBICON TRAIL LOW-COG COMP SPEC"                  QR BADGE: [||||| /s/v9k2pq]       |  |
|  | STATUS: [PUBLIC]  FORK OF: @RockSpider_V1 (Diff Detected)       STAMP: [VERIFIED SCRUTINEERING]   |  |
|  +---------------------------------------------------------------------------------------------------+  |
|                                                                                                         |
|  +-- [DRAWER A: DRIVETRAIN & GEARING] ----------------+-- [DRAWER B: TIRES & CORNER BALANCE] --------+  |
|  |                                                    |                                               |  |
|  |  PINION TEETH (Slider): [ 13 T ]                   |  FRONT AXLE: PRO-LINE HYRAX 1.9 PREDATOR      |  |
|  |  SPUR TEETH   (Slider): [ 54 T ]                   |  INSERTS:    DUAL-STAGE SILICONE MATRIX       |  |
|  |  INTERNAL TRANSMISSION: [ 2.60:1 ]                 |  BRASS RINGS: [ 95g ] / SIDE                  |  |
|  |                                                    |                                               |  |
|  |  +----------------------------------------------+  |  +-- CENTER OF GRAVITY (CoG) SCALE ----------+  |
|  |  | DIAGNOSTIC READOUT:                          |  |  |  FRONT: 1560g [ 59.2% ]  REAR: 1075g       |  |
|  |  | FINAL DRIVE RATIO (FDR) = 10.80:1            |  |  |  [======= HAZARD BIAS BAR =======------]   |  |
|  |  +----------------------------------------------+  |  +--------------------------------------------+  |
|  +----------------------------------------------------+-----------------------------------------------+  |
|                                                                                                         |
|  +-- [DRAWER C: SUSPENSION & SHOCK DYNO READOUTS] ---------------------------------------------------+  |
|  |                                                                                                   |  |
|  |  [ FRONT AXLE SHOCKS ]                             |  [ REAR AXLE SHOCKS ]                        |  |
|  |  - FLUID VISCOSITY:  35 WT / 425 CST (Anodized)    |  - FLUID VISCOSITY:  30 WT / 350 CST         |  |
|  |  - SPRINGS:          1.4 lbs/in (Blue Code)        |  - SPRINGS:          1.1 lbs/in (Yellow)     |  |
|  |  - CAMBER ANGLE:    -1.5 DEG                       |  - CAMBER ANGLE:     0.0 DEG                 |  |
|  |  - TOE ANGLE:       +1.0 DEG (Toe-Out)             |  - TOE ANGLE:        0.0 DEG                 |  |
|  |  - RIDE HEIGHT:      68 mm                         |  - RIDE HEIGHT:      64 mm                   |  |
|  +---------------------------------------------------------------------------------------------------+  |
|                                                                                                         |
|  [ BUTTON: SAVE TELEMETRY SHEET ]   [ BUTTON: FORK TO MY GARAGE ]   [ BUTTON: PRINT 1.5" CHASSIS QR ] |  |
+---------------------------------------------------------------------------------------------------------+
```

### 8.2 Component Hierarchy Tree

```
<PitMatAppLayout>
  ├── <DiagnosticTopBar>
  │     ├── <WorkbenchBrandLogo motif="anodized_aluminum" />
  │     ├── <DriverCallsignBadge />
  │     ├── <FleetTelemetryStatusIndicator />
  │     └── <AuthControls />
  │
  ├── <ToolboxDrawerNavigation>
  │     ├── <DrawerTab label="Fleet Garage" icon="wrench" />
  │     ├── <DrawerTab label="Setup Clipboard" icon="clipboard" active />
  │     ├── <DrawerTab label="Community Feed" icon="radio" />
  │     └── <DrawerTab label="QR Pit-Stickers" icon="qrcode" />
  │
  ├── <MainWorkbenchStage>
  │     │
  │     ├── VIEW: <GarageFleetView>
  │     │     ├── <FleetSummaryToolbar />
  │     │     ├── <ChassisRackGrid>
  │     │     │     └── <ChassisBayCard>
  │     │     │           ├── <VehicleTreadBorder />
  │     │     │           ├── <ClassBadge motif="stencil" />
  │     │     │           ├── <SetupCountReadout />
  │     │     │           └── <BayActionToolbar />
  │     │     └── <AddChassisModal />
  │     │
  │     ├── VIEW: <SetupClipboardView>
  │     │     ├── <ClipboardHeaderClamp>
  │     │     │     ├── <ChassisIdentityPlate />
  │     │     │     ├── <ScrutineeringStamp isVerified={true} />
  │     │     │     ├── <ForkLineageBanner onInspectParentDiff={openDiffModal} />
  │     │     │     └── <QrMiniTag slug="v9k2pq" />
  │     │     │
  │     │     ├── <SetupSheetGrid>
  │     │     │     ├── <DrivetrainToolboxCard>
  │     │     │     │     ├── <PinionSpurSliderGroup />
  │     │     │     │     ├── <TransmissionRatioSelector />
  │     │     │     │     └── <FdrDigitalReadout led="hazard_orange" />
  │     │     │     │
  │     │     │     ├── <TireAndBalanceToolboxCard>
  │     │     │     │     ├── <AxleTireCompoundSelector axle="front" />
  │     │     │     │     ├── <AxleTireCompoundSelector axle="rear" />
  │     │     │     │     ├── <BrassWeightCounter corner="each" />
  │     │     │     │     └── <CogDistributionBalanceScale frontBiasPct={59.2} />
  │     │     │     │
  │     │     │     ├── <SuspensionDynoCard>
  │     │     │     │     ├── <ShockCornerModule position="front_left" />
  │     │     │     │     ├── <ShockCornerModule position="front_right" />
  │     │     │     │     ├── <ShockCornerModule position="rear_left" />
  │     │     │     │     ├── <ShockCornerModule position="rear_right" />
  │     │     │     │     └── <AlignmentAngleDials camber={-1.5} toe={1.0} />
  │     │     │     │
  │     │     │     └── <TrackEnvironmentNotesCard>
  │     │     │           ├── <SurfaceTexturePicker />
  │     │     │           └── <DriverNotesTextarea />
  │     │     │
  │     │     └── <ClipboardActionBar>
  │     │           ├── <SaveSetupButton variant="hazard_orange" />
  │     │           ├── <ForkSetupModalButton variant="nitromethane" />
  │     │           └── <OpenQrStickerPrinterButton variant="neon_radio" />
  │     │
  │     ├── VIEW: <CommunityFeedWorkbench>
  │     │     ├── <FeedFilterDrawer>
  │     │     │     ├── <SurfaceTypeFilter />
  │     │     │     ├── <ClassFilterChips />
  │     │     │     └── <SortRadioGroup options={['Newest', 'Most Forked', 'Top Rated']} />
  │     │     │
  │     │     └── <FeedCardsGrid>
  │     │           └── <SetupSheetCard>
  │     │                 ├── <AuthorCallsignStencil />
  │     │                 ├── <QuickFdrBadge />
  │     │                 ├── <ForkLineageCounter />
  │     │                 └── <QuickForkAction trigger="forkModal" />
  │     │
  │     ├── VIEW: <AdminConsoleWorkbench> (role: moderator | admin)
  │     │     ├── <AdminOverviewPanel />
  │     │     ├── <UserModerationTable onSuspend={openModerationModal} />
  │     │     ├── <SetupModerationTable onHide={openModerationModal} />
  │     │     ├── <ModerationAuditLogPanel />
  │     │     └── <ModerationActionModal requiresReason />
  │     │
  │     └── MODAL: <ForkDiffInspectorModal>
  │           ├── <SideBySideSpecTable parent={parentSetup} fork={activeSetup} />
  │           └── <DeltaHighlighter changedFields={['fdr', 'shockOil', 'brassGrams']} />
  │
  └── <QrPitStickerPrinterModal>
        ├── <StickerScalePreview dimensions="1.5x1.5_inches" dpi={300}>
        │     ├── <QrCodeMatrix level="H" />
        │     ├── <ChassisModelLabel />
        │     └── <FdrWatermark />
        └── <PrintDownloadToolbar>
              ├── <DownloadSvgButton />
              └── <DownloadPngHighResButton />
```

---

## 9. Architectural Integrity & Operational Verification

### 9.1 Memory Bounds on Low-Tier EC2 Hardware
- **PostgreSQL (`rc-db`):** Capped at `256MB` RAM (`shared_buffers=64MB`, `work_mem=4MB`, `max_connections=40`). Prevents Linux OOM-killer invocation under complex JSONB GIN indexing queries.
- **NestJS API (`rc-backend`):** Capped at `256MB` RAM container limit with V8 heap capped at `--max-old-space-size=192`.
- **Frontend SPA (`rc-frontend`):** Capped at `128MB` RAM running lightweight `nginx-unprivileged:alpine-slim`.
- **Total Combined Consumption:** ~640MB RAM under peak concurrency, comfortably operating within a standard 1GB (t3.micro / t4g.micro) or 2GB (t3.small / t4g.small) EC2 instance with headroom for OS background processes.

### 9.2 Security & Data Isolation
- **Network Isolation:** PostgreSQL port 5432 is completely unexposed to the host and WAN; only accessible over the internal Docker bridge network (`rc-isolated-net`).
- **Host Loopback Binding:** Frontend (3742) and Backend (5742) bind strictly to `127.0.0.1`, forcing all public ingress through the host Nginx reverse proxy with TLS termination, rate limiting, and HTTP security headers. Non-standard ports avoid collisions with common dev services (3000/5000/8000/8080).
- **Unprivileged Execution:** Both frontend (UID 101 `nginx`) and backend (UID 1000 `node`) run as non-root users inside their respective containers.
- **Role-Gated Moderation:** `/api/garage/admin/*` endpoints require JWT authentication plus `moderator` or `admin` roles (`RolesGuard`). Suspended accounts are denied authentication and mutating garage actions. Optional `BOOTSTRAP_ADMIN_EMAIL` seeds the first admin without hard-coding credentials in source.
