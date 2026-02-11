# MOBIUS Wiki Ansible Deployment

Automated deployment of MOBIUS Wiki using Ansible.

## Prerequisites

- Ansible 2.12+ installed locally
- SSH access to target server
- Target server running Ubuntu 22.04 LTS
- Domain name pointed to server IP

### Install Ansible

```bash
# macOS
brew install ansible

# Ubuntu/Debian
sudo apt update && sudo apt install ansible

# pip
pip install ansible
```

### Install Required Collections

```bash
ansible-galaxy collection install community.docker
```

## Quick Start

### 1. Configure Inventory

Edit `inventory.yml` with your server details:

```yaml
wiki-prod:
  ansible_host: "YOUR_SERVER_IP"
  ansible_user: "YOUR_SSH_USER"
```

### 2. Configure Variables

Edit `group_vars/all.yml`:

```yaml
# Required - change these!
domain_name: "wiki.mobius.org"
database_password: "your-strong-password"
session_secret: "64-character-random-string"

# SSL - choose one option
use_letsencrypt: true
letsencrypt_email: "admin@mobius.org"
```

Generate secure passwords:

```bash
# Database password
openssl rand -base64 32

# Session secret
openssl rand -hex 32
```

### 3. Encrypt Sensitive Variables (Recommended)

```bash
ansible-vault encrypt group_vars/all.yml
```

### 4. Run Playbook

```bash
# Full deployment
ansible-playbook -i inventory.yml playbook.yml

# With vault password
ansible-playbook -i inventory.yml playbook.yml --ask-vault-pass

# Dry run (check mode)
ansible-playbook -i inventory.yml playbook.yml --check

# Only specific tags
ansible-playbook -i inventory.yml playbook.yml --tags deploy
ansible-playbook -i inventory.yml playbook.yml --tags ssl
ansible-playbook -i inventory.yml playbook.yml --tags backup
```

## Tags

| Tag | Description |
|-----|-------------|
| `setup` | Install Docker and system dependencies |
| `deploy` | Deploy application with Docker Compose |
| `migrate` | Run database migrations |
| `ssl` | Configure SSL certificates |
| `backup` | Set up automated backups |

## Directory Structure

```
ansible/
├── playbook.yml          # Main playbook
├── inventory.yml         # Server inventory
├── group_vars/
│   └── all.yml           # Variables (encrypt this!)
├── templates/
│   ├── env.j2            # .env file template
│   └── backup.sh.j2      # Backup script template
└── README.md             # This file
```

## SSL Options

### Option 1: Let's Encrypt (Recommended)

```yaml
use_letsencrypt: true
letsencrypt_email: "admin@mobius.org"
```

Certificates auto-renew via cron.

### Option 2: Custom Certificates

```yaml
use_letsencrypt: false
ssl_cert_path: "/local/path/to/fullchain.pem"
ssl_key_path: "/local/path/to/privkey.pem"
```

## Post-Deployment

### Login

- URL: `https://your-domain.com`
- Email: `admin@localhost`
- Password: `admin123`

**IMPORTANT:** Change the admin password after first login!

### Useful Commands (on server)

```bash
cd /opt/mobius-wiki

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Check status
docker compose ps

# Manual backup
/opt/mobius-backup.sh

# Run migrations
docker compose exec backend npm run migrate
```

## Troubleshooting

### SSH Connection Failed

```bash
# Test SSH connection
ssh -i ~/.ssh/id_rsa user@server-ip

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa
```

### Playbook Fails at Docker Tasks

```bash
# Install docker collection
ansible-galaxy collection install community.docker

# Verify collection
ansible-galaxy collection list | grep docker
```

### SSL Certificate Issues

```bash
# On server: Check certificate
openssl x509 -in /opt/mobius-wiki/nginx/ssl/fullchain.pem -noout -dates

# Force certificate renewal
sudo certbot renew --force-renewal
```

### Container Not Starting

```bash
# On server: Check logs
docker compose -f /opt/mobius-wiki/docker-compose.yml logs backend
docker compose -f /opt/mobius-wiki/docker-compose.yml logs nginx
```

## Updating

To update the application:

```bash
ansible-playbook -i inventory.yml playbook.yml --tags deploy,migrate
```

## Security Notes

1. **Never commit `group_vars/all.yml` with real passwords**
2. Use `ansible-vault` to encrypt sensitive files
3. Change admin password after deployment
4. Restrict SSH access to known IPs
5. Enable firewall (only ports 80, 443)
