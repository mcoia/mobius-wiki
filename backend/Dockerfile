# =============================================================================
# MOBIUS Wiki Backend - Multi-stage Docker Build
# =============================================================================
# Stage 1: Build the NestJS application
# Stage 2: Production image with minimal footprint
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and configuration
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install curl for health checks, bash and postgresql-client for migrations
RUN apk add --no-cache curl bash postgresql-client

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy migrations and seeds for database setup
COPY migrations/ ./migrations/
COPY seeds/ ./seeds/
COPY scripts/ ./scripts/

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown -R nestjs:nodejs uploads

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:10000/api/v1/health || exit 1

# Start the application
CMD ["node", "dist/main"]
