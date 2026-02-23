# =============================================================================
# MOBIUS Wiki Frontend - Multi-stage Docker Build
# =============================================================================
# Stage 1: Build the Angular application
# Stage 2: Serve with nginx
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and configuration
COPY angular.json tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build for production
# Note: TinyMCE assets are automatically copied via angular.json assets config
RUN npm run build -- --configuration production

# -----------------------------------------------------------------------------
# Stage 2: nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Install curl for HTTPS health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
# Angular 21 outputs to dist/frontend/browser/
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

# Create non-root user for security (nginx runs as nginx user by default)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port 443
EXPOSE 443

# Health check (uses -k to accept self-signed certificates)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -k -f https://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
