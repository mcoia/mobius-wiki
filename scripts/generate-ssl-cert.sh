#!/bin/bash
# =============================================================================
# MOBIUS Wiki - Self-Signed SSL Certificate Generator
# =============================================================================
# Usage: ./scripts/generate-ssl-cert.sh
# Generates a self-signed certificate for local/development HTTPS testing
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"

echo "Generating self-signed SSL certificate..."

# Create SSL directory
mkdir -p "$SSL_DIR"

# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Certificate generated successfully!"
echo "  - Certificate: $SSL_DIR/fullchain.pem"
echo "  - Private key: $SSL_DIR/privkey.pem"
echo ""
echo "Note: Browsers will show a security warning for self-signed certificates."
echo "      You can accept the warning to proceed for local testing."
