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

# Copy custom Nginx SPA routing configuration (listens on non-standard 3742)
COPY --chown=nginx:nginx docker/frontend-nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA bundle from builder stage
COPY --from=builder --chown=nginx:nginx /usr/src/app/dist /usr/share/nginx/html

# Expose internal unprivileged container port (non-standard to avoid host collisions)
EXPOSE 3742

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
