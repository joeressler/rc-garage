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

# Strip CRLF so a Windows-checked-out entrypoint still executes under Alpine sh.
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' docker-entrypoint.sh ; chmod +x docker-entrypoint.sh

# Establish non-root execution privileges
USER node

# Copy production dependencies and compiled artifacts
COPY --chown=node:node package.json ./
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/dist ./dist

# Environmental constraints (non-standard PORT avoids collisions with common 5000/8000 services)
ENV NODE_ENV=production
ENV PORT=5742

EXPOSE 5742

# Apply pending SQL then start Nest with a 192MB heap (256MB container cap).
CMD ["./docker-entrypoint.sh"]
