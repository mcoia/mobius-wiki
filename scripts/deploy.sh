#!/bin/bash
# =============================================================================
# MOBIUS Wiki - Deployment Script
# =============================================================================
# Automates deployment of the MOBIUS Wiki application.
#
# Usage:
#   ./scripts/deploy.sh              # Standard deployment
#   ./scripts/deploy.sh --init       # First deployment (imports wiki content)
#   ./scripts/deploy.sh --no-build   # Deploy without rebuilding images
#   ./scripts/deploy.sh --rollback   # Rollback to previous deployment
#   ./scripts/deploy.sh --help       # Show help
#
# Prerequisites:
#   - Docker & Docker Compose installed
#   - .env file configured
#   - SSL certificates in nginx/ssl/
#   - Git repository cloned
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
BACKUP_DIR="${PROJECT_ROOT}/backups"
HEALTH_TIMEOUT=120
HEALTH_INTERVAL=5

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
MOBIUS Wiki Deployment Script

Usage: ./scripts/deploy.sh [OPTIONS]

Options:
  --init        First deployment: creates database and imports all wiki content
                (runs migrations + imports 8 wikis from source files)
  --no-build    Skip building images (use existing images)
  --rollback    Rollback to previous deployment (restores database + images)
  --help        Show this help message

Examples:
  First deployment:
    ./scripts/deploy.sh --init

  Standard update:
    ./scripts/deploy.sh

  Rollback after failed deployment:
    ./scripts/deploy.sh --rollback

Environment:
  Requires .env file with DATABASE_PASSWORD, SESSION_SECRET, etc.
  Requires SSL certificates in nginx/ssl/fullchain.pem and nginx/ssl/privkey.pem

For more information, see docs/guides/deployment.md
EOF
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

preflight_checks() {
    log_info "Running pre-flight checks..."

    local errors=0

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        errors=$((errors + 1))
    else
        log_success "Docker installed: $(docker --version | cut -d' ' -f3 | tr -d ',')"
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        errors=$((errors + 1))
    else
        log_success "Docker Compose installed: $(docker compose version --short)"
    fi

    # Check .env file
    if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
        log_error ".env file not found. Copy from .env.production.example and configure."
        errors=$((errors + 1))
    else
        log_success ".env file exists"

        # Check required variables
        local required_vars=("DATABASE_PASSWORD" "SESSION_SECRET" "FRONTEND_URL")
        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" "${PROJECT_ROOT}/.env"; then
                log_warn "Missing required variable: ${var}"
            fi
        done
    fi

    # Check SSL certificates
    if [[ ! -f "${PROJECT_ROOT}/nginx/ssl/fullchain.pem" ]]; then
        log_error "SSL certificate not found: nginx/ssl/fullchain.pem"
        errors=$((errors + 1))
    else
        log_success "SSL certificate exists"
    fi

    if [[ ! -f "${PROJECT_ROOT}/nginx/ssl/privkey.pem" ]]; then
        log_error "SSL private key not found: nginx/ssl/privkey.pem"
        errors=$((errors + 1))
    else
        log_success "SSL private key exists"
    fi

    # Check if we can access docker
    if ! docker ps &> /dev/null; then
        log_warn "Cannot access Docker. You may need to use sudo or add user to docker group."
    fi

    if [[ $errors -gt 0 ]]; then
        log_error "Pre-flight checks failed with ${errors} error(s)"
        exit 1
    fi

    log_success "All pre-flight checks passed"
}

# =============================================================================
# Backup Functions
# =============================================================================

create_backup() {
    log_info "Creating backup..."

    mkdir -p "${BACKUP_DIR}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_prefix="${BACKUP_DIR}/backup_${timestamp}"

    # Check if database container is running
    if docker compose ps db 2>/dev/null | grep -q "Up"; then
        log_info "Backing up database..."
        docker compose exec -T db pg_dump -U postgres mobius_wiki | gzip > "${backup_prefix}_db.sql.gz"
        log_success "Database backup: ${backup_prefix}_db.sql.gz"
    else
        log_warn "Database container not running, skipping database backup"
    fi

    # Tag current images as :previous
    log_info "Tagging current images..."
    for service in frontend backend; do
        local image=$(docker compose images -q ${service} 2>/dev/null | head -1)
        if [[ -n "$image" ]]; then
            docker tag "$image" "mobius-wiki-${service}:previous" 2>/dev/null || true
        fi
    done

    # Save backup info
    echo "${timestamp}" > "${BACKUP_DIR}/latest"
    log_success "Backup created: ${timestamp}"
}

# =============================================================================
# Rollback Function
# =============================================================================

rollback() {
    log_info "Starting rollback..."

    # Find latest backup
    if [[ ! -f "${BACKUP_DIR}/latest" ]]; then
        log_error "No backup found. Cannot rollback."
        exit 1
    fi

    local timestamp=$(cat "${BACKUP_DIR}/latest")
    local db_backup="${BACKUP_DIR}/backup_${timestamp}_db.sql.gz"

    log_info "Rolling back to backup: ${timestamp}"

    # Stop current containers
    log_info "Stopping containers..."
    docker compose ${COMPOSE_FILES} down

    # Restore database
    if [[ -f "$db_backup" ]]; then
        log_info "Restoring database..."
        docker compose ${COMPOSE_FILES} up -d db
        sleep 10  # Wait for database to start

        # Drop and recreate database
        docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS mobius_wiki;"
        docker compose exec -T db psql -U postgres -c "CREATE DATABASE mobius_wiki;"

        # Restore from backup
        gunzip -c "$db_backup" | docker compose exec -T db psql -U postgres mobius_wiki
        log_success "Database restored"
    else
        log_warn "Database backup not found, skipping database restore"
    fi

    # Try to restore previous images
    log_info "Restoring previous images..."
    for service in frontend backend; do
        if docker image inspect "mobius-wiki-${service}:previous" &>/dev/null; then
            docker tag "mobius-wiki-${service}:previous" "mobius-wiki-${service}:latest" 2>/dev/null || true
        fi
    done

    # Start services
    log_info "Starting services..."
    docker compose ${COMPOSE_FILES} up -d

    # Wait for health
    wait_for_health

    log_success "Rollback completed"
}

# =============================================================================
# Health Check Functions
# =============================================================================

wait_for_health() {
    log_info "Waiting for services to become healthy..."

    local elapsed=0
    local healthy=false

    while [[ $elapsed -lt $HEALTH_TIMEOUT ]]; do
        # Check nginx health endpoint
        if curl -ks --connect-timeout 5 https://localhost/health 2>/dev/null | grep -q "healthy"; then
            healthy=true
            break
        fi

        sleep $HEALTH_INTERVAL
        elapsed=$((elapsed + HEALTH_INTERVAL))
        echo -n "."
    done

    echo ""

    if [[ "$healthy" == "true" ]]; then
        log_success "Services are healthy"
        return 0
    else
        log_error "Health check timed out after ${HEALTH_TIMEOUT} seconds"
        log_info "Checking container status..."
        docker compose ${COMPOSE_FILES} ps
        log_info "Checking logs..."
        docker compose ${COMPOSE_FILES} logs --tail=50
        return 1
    fi
}

# =============================================================================
# Deploy Function
# =============================================================================

deploy() {
    local skip_build=$1
    local init_mode=$2

    cd "${PROJECT_ROOT}"

    # Create backup of existing deployment
    create_backup

    # Pull latest code
    log_info "Pulling latest code..."
    git fetch origin
    git pull origin $(git rev-parse --abbrev-ref HEAD)

    # Build and deploy
    if [[ "$skip_build" == "true" ]]; then
        log_info "Deploying without rebuild..."
        docker compose ${COMPOSE_FILES} up -d
    else
        log_info "Building and deploying..."
        docker compose ${COMPOSE_FILES} up -d --build
    fi

    # Wait for services to be healthy
    if ! wait_for_health; then
        log_error "Deployment failed - services not healthy"
        log_warn "Run './scripts/deploy.sh --rollback' to restore previous version"
        exit 1
    fi

    # Run migrations
    log_info "Running database migrations..."
    docker compose exec -T backend npm run migrate
    log_success "Migrations complete"

    # Initial data import (first deployment only)
    if [[ "$init_mode" == "true" ]]; then
        log_info "Running initial data import..."
        log_warn "This will create the database schema and import all wiki content."
        docker compose exec -T backend npm run db:reset:clean
        log_success "Initial data import complete (8 wikis imported)"
    fi

    # Final verification
    log_info "Verifying deployment..."

    # Check backend health
    local backend_health=$(curl -ks https://localhost/api/v1/health 2>/dev/null)
    if echo "$backend_health" | grep -q "ok"; then
        log_success "Backend API is healthy"
    else
        log_warn "Backend health check returned unexpected response"
    fi

    # Show container status
    log_info "Container status:"
    docker compose ${COMPOSE_FILES} ps

    log_success "Deployment completed successfully!"
    echo ""
    log_info "Application is available at: $(grep FRONTEND_URL ${PROJECT_ROOT}/.env | cut -d= -f2)"
}

# =============================================================================
# Main
# =============================================================================

main() {
    local skip_build=false
    local init_mode=false
    local rollback_mode=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --init)
                init_mode=true
                shift
                ;;
            --no-build)
                skip_build=true
                shift
                ;;
            --rollback)
                rollback_mode=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    cd "${PROJECT_ROOT}"

    echo ""
    echo "========================================"
    echo "  MOBIUS Wiki Deployment"
    echo "========================================"
    echo ""

    # Run pre-flight checks
    preflight_checks

    echo ""

    # Execute requested operation
    if [[ "$rollback_mode" == "true" ]]; then
        rollback
    else
        deploy "$skip_build" "$init_mode"
    fi
}

main "$@"
