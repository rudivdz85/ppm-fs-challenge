# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy root package.json for workspace setup
COPY package*.json ./
COPY packages/types/package*.json ./packages/types/
COPY packages/config/package*.json ./packages/config/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS builder

# Install all dependencies (including dev)
RUN npm ci

# Copy shared packages
COPY packages/ ./packages/

# Build shared packages
WORKDIR /app/packages/types
RUN npm run build

# Copy server source
WORKDIR /app
COPY apps/server/ ./apps/server/

# Build server
WORKDIR /app/apps/server
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist ./node_modules/@ppm/types/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/package.json ./node_modules/@ppm/types/

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]