# MOBIUS Wiki Deployment Guide

This guide covers deploying MOBIUS Wiki on Google Cloud Platform (GCP) using Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [GCP Setup](#gcp-setup)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Deployment Steps](#deployment-steps)
6. [Database Migration](#database-migration)
7. [Verification](#verification)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Security Checklist](#security-checklist)

---

## Prerequisites

Before deploying, ensure you have:

- **GCP Account**: With billing enabled and appropriate permissions
- **Domain Name**: Pointed to your GCP instance IP (e.g., `wiki.mobius.org`)
- **SSL Certificate**: From your internal CA or a certificate authority
- **Docker & Docker Compose**: Installed on the target server
- **Git**: For cloning the repository

### Software Versions

| Software | Minimum Version |
|----------|----------------|
| Docker | 24.0+ |
| Docker Compose | 2.20+ |
| Git | 2.30+ |

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │            GCP Compute Engine           │
                    │                                         │
  Internet          │  ┌─────────────────────────────────┐   │
     │              │  │         nginx (reverse proxy)    │   │
     │              │  │         Port: 443 (HTTPS only)   │   │
     ▼              │  │         SSL Termination          │   │
┌─────────┐         │  └──────────┬──────────┬───────────┘   │
│ HTTPS   │◄────────┼─────────────┘          │               │
│ Port 443│         │                        │               │
└─────────┘         │  ┌─────────────┐  ┌────▼────────┐      │
                    │  │  frontend   │  │   backend   │      │
                    │  │  (Angular)  │  │  (NestJS)   │      │
                    │  │  nginx:443  │  │  Port 10000 │      │
                    │  └─────────────┘  └──────┬──────┘      │
                    │                          │              │
                    │                   ┌──────▼──────┐       │
                    │                   │  PostgreSQL │       │
                    │                   │  Port 5432  │       │
                    │                   └─────────────┘       │
                    │                                         │
                    │  Volumes: pgdata, uploads               │
                    └─────────────────────────────────────────┘
```

### Services

| Service | Container | Internal Port | External Port |
|---------|-----------|---------------|---------------|
| nginx (proxy) | mobius-nginx | 443 | 443 |
| Frontend | mobius-frontend | 443 | (internal) |
| Backend | mobius-backend | 10000 | (internal) |
| Database | mobius-db | 5432 | (internal) |

---

## GCP Setup

### Option A: Single GCE VM (Recommended for Start)

This is the simplest deployment option, suitable for small to medium workloads.

#### 1. Create VM Instance

```bash
# Create a Compute Engine instance
gcloud compute instances create mobius-wiki \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server
```

**Recommended Specs:**
- **Instance Type**: e2-medium (2 vCPU, 4GB RAM) minimum
- **Disk**: 50GB SSD persistent disk
- **OS**: Ubuntu 22.04 LTS
- **Estimated Cost**: ~$25-40/month

#### 2. Configure Firewall

```bash
# Allow HTTPS traffic only (no HTTP - HTTPS-only architecture)
gcloud compute firewall-rules create allow-https \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:443 \
  --target-tags=https-server
```

#### 3. Reserve Static IP

```bash
# Reserve a static external IP
gcloud compute addresses create mobius-wiki-ip \
  --region=us-central1

# Get the IP address
gcloud compute addresses describe mobius-wiki-ip \
  --region=us-central1 --format="get(address)"

# Assign to instance
gcloud compute instances delete-access-config mobius-wiki \
  --zone=us-central1-a \
  --access-config-name="external-nat"

gcloud compute instances add-access-config mobius-wiki \
  --zone=us-central1-a \
  --address=<STATIC_IP>
```

#### 4. Install Docker on VM

SSH into your instance and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Logout and login again for group changes to take effect
exit
```

### Option B: Cloud Run + Cloud SQL (Scalable)

For auto-scaling production workloads, consider:

- **Backend**: Cloud Run (serverless containers)
- **Frontend**: Cloud Storage + Cloud CDN (static hosting)
- **Database**: Cloud SQL for PostgreSQL
- **SSL**: GCP Load Balancer with managed certificates

This option provides better scaling but is more complex to set up. Contact your DevOps team for implementation.

---

## SSL Certificate Setup

### Certificate Requirements

You need two files:
- `fullchain.pem` - Your certificate + intermediate chain
- `privkey.pem` - Your private key

### For Local Development (Self-Signed)

For local/development testing, use the included script to generate a self-signed certificate:

```bash
./scripts/generate-ssl-cert.sh
```

This creates a certificate for `localhost` that works for local Docker testing.

### For Internal CA Certificates

1. Request certificate from your IT/Security team for your domain
2. Place files in `nginx/ssl/`:
   ```
   nginx/ssl/
   ├── fullchain.pem
   └── privkey.pem
   ```

### For Let's Encrypt (Free)

```bash
# Install certbot
sudo apt install certbot -y

# Obtain certificate (standalone mode, stop nginx first)
sudo certbot certonly --standalone -d wiki.mobius.org

# Copy certificates
sudo cp /etc/letsencrypt/live/wiki.mobius.org/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/wiki.mobius.org/privkey.pem nginx/ssl/

# Set permissions
sudo chown $USER:$USER nginx/ssl/*.pem
chmod 600 nginx/ssl/privkey.pem
```

### Certificate Permissions

```bash
# Secure the private key
chmod 600 nginx/ssl/privkey.pem
chmod 644 nginx/ssl/fullchain.pem
```

---

## Deployment Steps

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/mobius-wiki.git
cd mobius-wiki
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.production.example .env

# Edit with your settings
nano .env
```

**Critical settings to configure:**

```bash
# Database password (use strong password)
DATABASE_PASSWORD=your-strong-database-password

# Session secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your-64-character-random-string

# Your domain
FRONTEND_URL=https://wiki.mobius.org

# SMTP settings for email
SMTP_HOST=smtp.your-provider.com
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=noreply@mobius.org
```

### 3. Place SSL Certificates

```bash
# Copy your certificates to nginx/ssl/
cp /path/to/your/fullchain.pem nginx/ssl/
cp /path/to/your/privkey.pem nginx/ssl/

# Secure permissions
chmod 600 nginx/ssl/privkey.pem
```

### 4. Build and Start Services

```bash
# Build images and start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Watch the logs
docker compose logs -f
```

### 5. Verify Services

```bash
# Check all containers are running
docker compose ps

# Expected output:
# NAME              STATUS          PORTS
# mobius-nginx      Up (healthy)    0.0.0.0:443->443/tcp
# mobius-frontend   Up (healthy)
# mobius-backend    Up (healthy)
# mobius-db         Up (healthy)
```

---

## Database Migration

After the first deployment, run database migrations:

```bash
# Run migrations
docker compose exec backend npm run migrate

# Seed initial data (first deployment only)
docker compose exec backend npm run db:seed

# Verify database
docker compose exec backend npm run sql -- --tables
```

---

## Verification

### 1. Health Check

```bash
# Check backend health (HTTPS)
curl -k https://your-domain.com/api/v1/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":...}
```

### 2. SSL Verification

```bash
# Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com </dev/null 2>/dev/null | openssl x509 -noout -dates
```

### 3. Functional Tests

1. **Login**: Navigate to `https://your-domain.com/login`
   - Use test credentials: `admin@mobius.org` / `admin123`

2. **Create Wiki**: Test creating a new wiki

3. **Create Page**: Test creating and editing a page

4. **File Upload**: Test uploading an image to a page

### 4. Log Review

```bash
# Check for errors in logs
docker compose logs --tail=100 backend | grep -i error
docker compose logs --tail=100 nginx | grep -i error
```

---

## Maintenance

### Backups

#### Database Backup

```bash
# Create backup
docker compose exec db pg_dump -U postgres mobius_wiki > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
cat backup.sql | docker compose exec -T db psql -U postgres mobius_wiki
```

#### Automated Daily Backups

Create `/opt/mobius-backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR=/opt/backups
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
cd /path/to/mobius-wiki
docker compose exec -T db pg_dump -U postgres mobius_wiki | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Uploads backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /var/lib/docker/volumes mobius-uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

Add to crontab:
```bash
# Run daily at 2 AM
0 2 * * * /opt/mobius-backup.sh
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Run any new migrations
docker compose exec backend npm run migrate
```

### Logs

```bash
# View all logs
docker compose logs

# Follow specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 nginx
```

### SSL Certificate Renewal

For Let's Encrypt certificates:

```bash
# Renew certificate
sudo certbot renew

# Copy new certificates
sudo cp /etc/letsencrypt/live/your-domain/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain/privkey.pem nginx/ssl/

# Reload nginx
docker compose exec nginx nginx -s reload
```

Add to crontab for automatic renewal:
```bash
# Check renewal twice daily
0 0,12 * * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain/*.pem /path/to/mobius-wiki/nginx/ssl/ && docker compose -f /path/to/mobius-wiki/docker-compose.yml exec nginx nginx -s reload
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker compose logs backend

# Common issues:
# - Database connection failed: Check DATABASE_* env vars
# - Port already in use: Check for other services on ports 80/443
# - Permission denied: Check file permissions
```

### Database Connection Failed

```bash
# Test database connectivity
docker compose exec backend npm run test:connection

# Check if database container is healthy
docker compose ps db

# View database logs
docker compose logs db
```

### 502 Bad Gateway

```bash
# Check if backend is running
docker compose ps backend

# Check backend logs for errors
docker compose logs backend

# Verify nginx can reach backend
docker compose exec nginx wget -qO- http://backend:10000/api/v1/health
```

### SSL Certificate Errors

```bash
# Verify certificate files exist
ls -la nginx/ssl/

# Check certificate validity
openssl x509 -in nginx/ssl/fullchain.pem -noout -text | grep -A2 "Validity"

# Check nginx SSL config
docker compose exec nginx nginx -t
```

### Permission Denied on Uploads

```bash
# Fix uploads volume permissions
docker compose exec backend chown -R nestjs:nodejs /app/uploads
```

### Memory Issues

```bash
# Check container resource usage
docker stats

# Increase VM size if needed
gcloud compute instances set-machine-type mobius-wiki \
  --zone=us-central1-a \
  --machine-type=e2-standard-2
```

---

## Security Checklist

Before going live, verify:

- [ ] **Strong passwords**: DATABASE_PASSWORD and SESSION_SECRET are random, long strings
- [ ] **HTTPS only**: Only port 443 exposed (no HTTP)
- [ ] **SSL certificate**: Valid and not expired
- [ ] **Firewall**: Only port 443 open
- [ ] **Environment file**: `.env` has restrictive permissions (`chmod 600`)
- [ ] **Admin password**: Changed from default `admin123`
- [ ] **Backups**: Automated backup script configured and tested
- [ ] **Monitoring**: Log aggregation or alerting configured
- [ ] **Updates**: Plan for regular security updates

---

## Quick Reference

### Common Commands

```bash
# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Restart a service
docker compose restart backend

# Shell into container
docker compose exec backend sh

# Run migrations
docker compose exec backend npm run migrate

# Database backup
docker compose exec db pg_dump -U postgres mobius_wiki > backup.sql
```

### File Locations

| File | Purpose |
|------|---------|
| `.env` | Environment configuration |
| `nginx/ssl/` | SSL certificates |
| `docker-compose.yml` | Base compose config |
| `docker-compose.prod.yml` | Production overrides |
| `/var/lib/docker/volumes/mobius-pgdata` | Database data |
| `/var/lib/docker/volumes/mobius-uploads` | Uploaded files |

### Support

For issues:
1. Check [Troubleshooting](#troubleshooting) section
2. Review container logs
3. Contact the development team
