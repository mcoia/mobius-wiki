#!/bin/bash
# =============================================================================
# MOBIUS Wiki - Certificate Refresh Script
# =============================================================================
# Adapted from MCOIA's standard brickrefresh script for the wiki server.
#
# This script checks if certificates have been updated and reloads nginx.
# On this server, certs are stored locally (no NFS).
#
# Usage:
#   sudo ./brickrefresh.sh
# =============================================================================

# Configuration
CERTS="/etc/letsencrypt"
WIKI_DIR="/home/ma/repo/mobius-wiki"
DOMAINS="wiki-dev.mobiusconsortium.org wiki.mobiusconsortium.org"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Root check
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Track if any cert was updated
CERT_UPDATED=false

for DOMAIN in $DOMAINS; do
    CERT_DIR="${CERTS}/${DOMAIN}"
    CERT_FILE="${CERT_DIR}/fullchain.cer"
    MARKER_FILE="${CERT_DIR}/.last_refresh"

    if [ ! -f "${CERT_FILE}" ]; then
        log "No certificate found for ${DOMAIN}, skipping"
        continue
    fi

    # Create marker file if it doesn't exist
    if [ ! -f "${MARKER_FILE}" ]; then
        touch -d "2000-01-01 00:00:00" "${MARKER_FILE}"
    fi

    # Check if cert is newer than marker
    if [ "${CERT_FILE}" -nt "${MARKER_FILE}" ]; then
        log "Certificate updated for ${DOMAIN}"
        CERT_UPDATED=true
        touch "${MARKER_FILE}"
    fi
done

# Reload nginx if any cert was updated
if [ "$CERT_UPDATED" = true ]; then
    log "Reloading nginx due to certificate update..."

    # Check if running in Docker
    if docker ps --format '{{.Names}}' | grep -q "mobius-nginx"; then
        log "Reloading Docker nginx container..."
        docker exec mobius-nginx nginx -s reload || \
        docker compose -f ${WIKI_DIR}/docker-compose.multi-env.yml restart nginx
    elif systemctl is-active --quiet nginx; then
        log "Reloading system nginx..."
        systemctl reload nginx
    else
        log "Warning: nginx not found, skipping reload"
    fi
else
    log "No certificate updates detected"
fi

log "Refresh check complete!"
