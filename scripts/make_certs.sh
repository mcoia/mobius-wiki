#!/bin/bash
# =============================================================================
# MOBIUS Wiki - Let's Encrypt Certificate Generation
# =============================================================================
# Adapted from MCOIA's standard acme.sh script for the wiki server.
#
# This server does NOT use NFS - certs are stored locally.
#
# Usage:
#   sudo ./make_certs.sh          # Generate/renew certificates
#
# Domains (hard-coded):
#   - wiki-dev.mobiusconsortium.org (staging)
#   - wiki.mobiusconsortium.org (production)
# =============================================================================

# Exit on error
set -e

# Configuration
ACME="/root/.acme.sh/acme.sh"
CERTS="/etc/letsencrypt"
ACME_WEBROOT="/var/www/acme"
WIKI_DIR="/home/ma/repo/mobius-wiki"

# Hard-coded domains for this server
VHOSTS="-d wiki-dev.mobiusconsortium.org -d wiki.mobiusconsortium.org"
PRIMARY_DOMAIN="wiki-dev.mobiusconsortium.org"

# Email for Let's Encrypt notifications
ACME_EMAIL="mcoia@mobiusconsortium.org"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
pushd () {
    command pushd "$@" > /dev/null
}

popd () {
    command popd "$@" > /dev/null
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# -----------------------------------------------------------------------------
# Root check
# -----------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# -----------------------------------------------------------------------------
# Create directories
# -----------------------------------------------------------------------------
if [ ! -d "${CERTS}" ]; then
    log "Creating certificate directory: ${CERTS}"
    mkdir -p ${CERTS}
    chmod 755 ${CERTS}
fi

if [ ! -d "${ACME_WEBROOT}/.well-known/acme-challenge" ]; then
    log "Creating ACME webroot: ${ACME_WEBROOT}"
    mkdir -p ${ACME_WEBROOT}/.well-known/acme-challenge
    chmod -R 755 ${ACME_WEBROOT}
fi

# -----------------------------------------------------------------------------
# Install acme.sh if not present
# -----------------------------------------------------------------------------
pushd $PWD
if [ ! -f "${ACME}" ]; then
    log "Installing acme.sh..."
    apt-get install -y socat
    cd ~
    git clone https://github.com/acmesh-official/acme.sh.git && cd acme.sh
    ./acme.sh --install --cert-home ${CERTS} --accountemail "${ACME_EMAIL}"

    # Set up email notifications
    export MAIL_FROM="${ACME_EMAIL}"
    export MAIL_TO="${ACME_EMAIL}"
    export MAIL_BIN="sendmail"
    $ACME --set-notify --notify-hook mail --notify-level 2 --notify-mode 0 || true
fi

# Upgrade acme.sh
log "Upgrading acme.sh..."
$ACME --upgrade || true

# -----------------------------------------------------------------------------
# Issue or Renew Certificate
# -----------------------------------------------------------------------------
CERT_DIR="${CERTS}/${PRIMARY_DOMAIN}"

if [ ! -d "${CERT_DIR}" ] || [ ! -f "${CERT_DIR}/fullchain.cer" ]; then
    log "Issuing new certificate for: ${VHOSTS}"
    $ACME --issue \
        --server letsencrypt \
        --cert-home ${CERTS} \
        ${VHOSTS} \
        -w ${ACME_WEBROOT}
else
    log "Running certificate renewal check..."
    $ACME --cron \
        --cert-home ${CERTS} \
        --home "/root/.acme.sh"
fi

# -----------------------------------------------------------------------------
# Reload nginx if cert was updated
# -----------------------------------------------------------------------------
CERT_FILE="${CERT_DIR}/fullchain.cer"
if [ -f "${CERT_FILE}" ]; then
    # Check if cert was modified in last 5 minutes (just renewed)
    if [ $(find "${CERT_FILE}" -mmin -5 2>/dev/null | wc -l) -gt 0 ]; then
        log "Certificate was updated, reloading nginx..."

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
        log "Certificate not changed, no reload needed"
    fi
fi

popd
log "Certificate check complete!"
