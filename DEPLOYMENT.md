# Creatrend Backend — VPS Deployment Guide

## Overview

This document describes the complete setup for deploying the Creatrend backend on a **single VPS** running **two completely isolated environments** — staging and production — using Docker Compose.

```
                         INTERNET
                            │
                            ▼
                         NGINX (port 443 / 80)
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
 staging-api.creatrend.com      api.creatrend.com
 (127.0.0.1:5001)               (127.0.0.1:5000)
              │                           │
              ▼                           ▼
       STAGING STACK              PRODUCTION STACK
  (creatrend-staging-backend)  (creatrend-production-backend)
              │                           │
        ┌─────┘                     ┌─────┘
        ▼                           ▼
  creatrend-staging-redis    creatrend-production-redis
        │                           │
        ▼                           ▼
  Neon STAGING DB            Neon PRODUCTION DB
              └───────────┬──────────────┘
                          ▼
                      Cloudinary
              (staging prefix / production prefix)
```

## Branch → Environment Mapping

| Git Branch | Environment | Domain |
|---|---|---|
| `master` | STAGING | `staging-api.creatrend.com` |
| `main` | PRODUCTION | `api.creatrend.com` |

**Never deploy `main` to staging or `master` to production.**

---

## Section 1 — Initial VPS Setup

### 1.1 Install Docker

```bash
# Install Docker Engine (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (log out and back in after)
usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

### 1.2 Install Nginx and Certbot

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx

# Verify
nginx -v
certbot --version
```

### 1.3 Configure Firewall (UFW)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'   # ports 80 and 443

# IMPORTANT: Do NOT expose ports 5000, 5001, or 6379 publicly
# These are internal-only ports

ufw enable
ufw status
```

### 1.4 Create VPS Directory Structure

```bash
mkdir -p /opt/creatrend/staging
mkdir -p /opt/creatrend/production

# Restrict permissions
chmod 700 /opt/creatrend/staging
chmod 700 /opt/creatrend/production
```

### 1.5 Configure GitHub Access

**Option A — Deploy key (recommended):**

```bash
# Generate a deploy key (no passphrase)
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/creatrend_deploy -N ""

# Display the public key — add this to GitHub repository Settings → Deploy keys
cat ~/.ssh/creatrend_deploy.pub

# Configure SSH to use it
cat >> ~/.ssh/config << EOF
Host github.com
    IdentityFile ~/.ssh/creatrend_deploy
    IdentitiesOnly yes
EOF
```

**Option B — GitHub Personal Access Token** (for private repos via HTTPS clone).

---

## Section 2 — Staging Deployment

### 2.1 Clone the Repository

```bash
cd /opt/creatrend/staging
git clone git@github.com:pushkar33/Leeds-Alpha.git .
git checkout master
```

### 2.2 Configure Staging `.env`

```bash
cp .env.example .env
nano .env
```

Required values to set (staging-specific):

```bash
# Compose isolation — CRITICAL
COMPOSE_PROJECT_NAME=creatrend-staging
HOST_PORT=5001

# Environment
NODE_ENV=staging
APP_ENV=staging
PORT=8080

# Staging Neon database (NEVER use production DB here)
DB_HOST=your-staging-neon-host.neon.tech
DB_USER=your_staging_db_user
DB_PASSWORD=your_staging_db_password
DB_NAME=your_staging_db_name
DB_DIALECT=postgres
DB_SSL=true

# Redis — use service hostname inside Docker, not localhost
REDIS_URL=redis://redis:6379

# Staging-specific JWT secrets (different from production)
JWT_SECRET=staging_jwt_secret_generate_64_random_bytes
JWT_REFRESH_SECRET=staging_jwt_refresh_secret_generate_64_random_bytes

# Cloudinary environment separation
CLOUDINARY_FOLDER_PREFIX=creatrend/staging

# All other vars from .env.example...
```

**Verify no production values are present:**

```bash
# Should show 'creatrend-staging' — if it shows 'creatrend-production', STOP
grep COMPOSE_PROJECT_NAME .env

# Should show staging Neon host — if it shows production host, STOP
grep DB_HOST .env
```

### 2.3 Build the Staging Image

```bash
cd /opt/creatrend/staging
docker compose -p creatrend-staging build
```

### 2.4 Start Staging Stack

```bash
# Migrations run automatically at container startup
docker compose -p creatrend-staging up -d

# Watch startup logs (migrations take ~30 seconds)
docker compose -p creatrend-staging logs -f backend
```

### 2.5 Verify Staging

```bash
# Check containers are running
docker compose -p creatrend-staging ps

# Test health endpoint
curl http://127.0.0.1:5001/health

# Expected response:
# {"status":"ok","environment":"staging","uptime":42}

# Check Redis connectivity
docker exec creatrend-staging-redis redis-cli ping
# Expected: PONG

# Check migration log
docker compose -p creatrend-staging logs backend | grep -i migrat
```

---

## Section 3 — Production Deployment

### 3.1 Clone the Repository

```bash
cd /opt/creatrend/production
git clone git@github.com:pushkar33/Leeds-Alpha.git .
git checkout main
```

### 3.2 Configure Production `.env`

```bash
cp .env.example .env
nano .env
```

Required values to set (production-specific):

```bash
# Compose isolation — CRITICAL
COMPOSE_PROJECT_NAME=creatrend-production
HOST_PORT=5000

# Environment
NODE_ENV=production
APP_ENV=production
PORT=8080

# Production Neon database (NEVER use staging DB here)
DB_HOST=your-production-neon-host.neon.tech
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
DB_NAME=your_production_db_name
DB_DIALECT=postgres
DB_SSL=true

# Redis — service hostname inside Docker
REDIS_URL=redis://redis:6379

# Production JWT secrets (DIFFERENT from staging)
JWT_SECRET=production_jwt_secret_generate_64_random_bytes
JWT_REFRESH_SECRET=production_jwt_refresh_secret_generate_64_random_bytes

# Cloudinary environment separation
CLOUDINARY_FOLDER_PREFIX=creatrend/production

# CORS — restrict to your production frontend domain
CORS_ORIGIN=https://creatrend.com
FRONTEND_URL=https://creatrend.com

# Enable Cloudflare Turnstile in production
TURNSTILE_ENABLED=true
TURNSTILE_SECRET_KEY=your_real_turnstile_secret_key
TURNSTILE_FAIL_OPEN=false

# All other vars from .env.example...
```

**Verify no staging values are present:**

```bash
grep COMPOSE_PROJECT_NAME .env   # Must show creatrend-production
grep DB_HOST .env                # Must show production Neon host
grep HOST_PORT .env              # Must show 5000
```

### 3.3 Build the Production Image

```bash
cd /opt/creatrend/production
docker compose -p creatrend-production build
```

### 3.4 Start Production Stack

```bash
docker compose -p creatrend-production up -d

# Watch startup logs
docker compose -p creatrend-production logs -f backend
```

### 3.5 Verify Production

```bash
docker compose -p creatrend-production ps

curl http://127.0.0.1:5000/health
# Expected: {"status":"ok","environment":"production","uptime":...}

docker exec creatrend-production-redis redis-cli ping
# Expected: PONG
```

---

## Section 4 — Nginx Setup

### 4.1 Install the Nginx Configuration

```bash
# Copy the Nginx config from the repository
cp /opt/creatrend/staging/nginx/creatrend.conf /etc/nginx/sites-available/creatrend.conf

# Enable it
ln -s /etc/nginx/sites-available/creatrend.conf /etc/nginx/sites-enabled/

# Remove the default site (if present)
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# If test passes, reload
systemctl reload nginx
```

### 4.2 Obtain SSL Certificates

```bash
# Production domain
certbot --nginx -d api.creatrend.com

# Staging domain
certbot --nginx -d staging-api.creatrend.com

# Verify auto-renewal
certbot renew --dry-run
```

### 4.3 Verify Nginx Routing

```bash
# Staging domain → staging backend (port 5001)
curl https://staging-api.creatrend.com/health
# Expected: {"status":"ok","environment":"staging",...}

# Production domain → production backend (port 5000)
curl https://api.creatrend.com/health
# Expected: {"status":"ok","environment":"production",...}
```

---

## Section 5 — Ongoing Deployment Commands

### 5.1 Staging Update Procedure

```bash
cd /opt/creatrend/staging

# Pull latest staging code
git fetch origin
git checkout master
git pull origin master

# Rebuild image (migrations run automatically on container start)
docker compose -p creatrend-staging build

# Rolling restart — down then up
docker compose -p creatrend-staging up -d

# Verify
docker compose -p creatrend-staging ps
curl http://127.0.0.1:5001/health
```

### 5.2 Production Update Procedure

```bash
cd /opt/creatrend/production

# Pull latest production code
git fetch origin
git checkout main
git pull origin main

# Rebuild image
docker compose -p creatrend-production build

# Rolling restart
docker compose -p creatrend-production up -d

# Verify
docker compose -p creatrend-production ps
curl http://127.0.0.1:5000/health
```

### 5.3 Reference Command Tables

#### Staging

| Action | Command |
|---|---|
| Status | `docker compose -p creatrend-staging ps` |
| Build | `docker compose -p creatrend-staging build` |
| Start | `docker compose -p creatrend-staging up -d` |
| Stop | `docker compose -p creatrend-staging down` |
| Restart | `docker compose -p creatrend-staging restart` |
| Logs (backend) | `docker compose -p creatrend-staging logs -f backend` |
| Logs (redis) | `docker compose -p creatrend-staging logs -f redis` |
| Shell (backend) | `docker exec -it creatrend-staging-backend sh` |
| Shell (redis) | `docker exec -it creatrend-staging-redis redis-cli` |
| Run migration | `docker compose -p creatrend-staging run --rm backend npx sequelize-cli db:migrate --env staging` |
| Rollback migration | `docker compose -p creatrend-staging run --rm backend npx sequelize-cli db:migrate:undo --env staging` |

#### Production

| Action | Command |
|---|---|
| Status | `docker compose -p creatrend-production ps` |
| Build | `docker compose -p creatrend-production build` |
| Start | `docker compose -p creatrend-production up -d` |
| Stop | `docker compose -p creatrend-production down` |
| Restart | `docker compose -p creatrend-production restart` |
| Logs (backend) | `docker compose -p creatrend-production logs -f backend` |
| Logs (redis) | `docker compose -p creatrend-production logs -f redis` |
| Shell (backend) | `docker exec -it creatrend-production-backend sh` |
| Shell (redis) | `docker exec -it creatrend-production-redis redis-cli` |
| Run migration | `docker compose -p creatrend-production run --rm backend npx sequelize-cli db:migrate --env production` |
| Rollback migration | `docker compose -p creatrend-production run --rm backend npx sequelize-cli db:migrate:undo --env production` |

---

## Section 6 — Migration Strategy

### Automatic Migrations (current behaviour)

Migrations run **automatically at every container startup** via `execSync` in `index.js`. This is safe for the current single-container-per-environment setup.

The migration command uses `NODE_ENV` to select the correct Sequelize config block from `config/config.js`:

```
NODE_ENV=staging    → config.js `staging` block → staging Neon DB
NODE_ENV=production → config.js `production` block → production Neon DB
```

**Failure behaviour:**
- If a migration fails, `db:migrate:undo` is attempted automatically to revert the failing migration.
- After rollback, the server continues startup (the error is logged but does not crash the process).
- You should monitor startup logs to detect migration failures: `docker compose -p creatrend-staging logs -f backend | grep -i migrat`

### Manual Migrations (override)

If you need to run migrations independently of a container restart:

```bash
# Staging
docker compose -p creatrend-staging run --rm backend \
  npx sequelize-cli db:migrate --env staging

# Production
docker compose -p creatrend-production run --rm backend \
  npx sequelize-cli db:migrate --env production
```

> [!IMPORTANT]
> Always run staging migrations against the staging database only.
> Always run production migrations against the production database only.
> The correct Neon DB is guaranteed by the `DB_*` env vars in the respective `.env` file.

---

## Section 7 — Environment Isolation Verification

### Verify Container Isolation

```bash
# List all Creatrend containers
docker ps --filter name=creatrend

# Expected output:
# creatrend-staging-backend
# creatrend-staging-redis
# creatrend-production-backend
# creatrend-production-redis
```

### Verify Network Isolation

```bash
# Staging containers cannot reach production Redis
docker exec creatrend-staging-backend \
  sh -c "wget -qO- http://creatrend-production-redis:6379 2>&1" || echo "CORRECTLY ISOLATED"

# Networks are separate
docker network ls | grep creatrend
# creatrend-staging_app_network
# creatrend-production_app_network
```

### Verify Volume Isolation

```bash
docker volume ls | grep creatrend
# creatrend-staging_redis_data
# creatrend-production_redis_data
```

### Verify Database Isolation

```bash
# Staging backend — should show staging Neon host
docker exec creatrend-staging-backend sh -c "echo \$DB_HOST"

# Production backend — should show production Neon host
docker exec creatrend-production-backend sh -c "echo \$DB_HOST"

# These two values MUST be different
```

### Verify Cloudinary Isolation

```bash
# Staging prefix
docker exec creatrend-staging-backend sh -c "echo \$CLOUDINARY_FOLDER_PREFIX"
# Expected: creatrend/staging

# Production prefix
docker exec creatrend-production-backend sh -c "echo \$CLOUDINARY_FOLDER_PREFIX"
# Expected: creatrend/production
```

---

## Section 8 — Monitoring and Debugging

### Health Checks

```bash
# Staging
curl http://127.0.0.1:5001/health
curl https://staging-api.creatrend.com/health

# Production
curl http://127.0.0.1:5000/health
curl https://api.creatrend.com/health
```

### Log Inspection

```bash
# Follow live logs
docker compose -p creatrend-staging logs -f backend

# Last 100 lines
docker compose -p creatrend-staging logs --tail=100 backend

# Filter for errors
docker compose -p creatrend-staging logs backend 2>&1 | grep -i error
```

### Redis Inspection

```bash
# Staging Redis — inspect keys
docker exec creatrend-staging-redis redis-cli keys '*'

# Check memory usage
docker exec creatrend-staging-redis redis-cli info memory | grep used_memory_human

# Flush staging Redis (caution — clears all presence/unread data)
docker exec creatrend-staging-redis redis-cli flushall
```

### Container Shell

```bash
# Enter backend container for debugging
docker exec -it creatrend-staging-backend sh

# Inside container: check environment variables (no secrets will be visible via this)
env | grep NODE_ENV
env | grep REDIS_URL
```

### Docker Resource Usage

```bash
docker stats creatrend-staging-backend creatrend-production-backend
```

---

## Section 9 — Security Notes

### Completed in this configuration

- [x] Containers run as non-root user (`node`, uid 1000)
- [x] Redis has no host port binding (internal Docker network only)
- [x] Backend ports bound to `127.0.0.1` only (Nginx is the public entry point)
- [x] `.env` files excluded from Git (`.gitignore` covers `.env` and `.env.*`)
- [x] Secrets never baked into Docker image (injected at runtime via env_file)
- [x] `no-new-privileges` security option set on backend container
- [x] Separate Cloudinary folder prefixes prevent media cross-contamination
- [x] SIGTERM handled by dumb-init + graceful shutdown code

### Remaining manual security actions

- [ ] **DNS**: Create A records for `api.creatrend.com` and `staging-api.creatrend.com` pointing to the VPS IP
- [ ] **SSL**: Run Certbot for both domains (commands in Section 4.2)
- [ ] **Firewall**: Confirm ports 5000, 5001, 6379 are NOT publicly accessible
- [ ] **SSH**: Disable password authentication, use key-only login
- [ ] **Secrets rotation**: Generate unique 64-byte random values for JWT secrets per environment
- [ ] **VPS patching**: Set up unattended-upgrades for security patches
- [ ] **Docker log rotation**: Already configured in Compose (50MB max, 5 files)
- [ ] **Backups**: Set up Neon DB automatic backups (managed by Neon)
- [ ] **Monitoring**: Consider Uptime Robot or similar for health endpoint monitoring
- [ ] **CORS production**: Confirm `CORS_ORIGIN` is set to the exact production frontend domain
- [ ] **Turnstile**: Set `TURNSTILE_ENABLED=true` and `TURNSTILE_FAIL_OPEN=false` in production

---

## Section 10 — Future Scaling Considerations

> [!NOTE]
> The current setup runs **one backend container per environment**. If production ever needs multiple replicas for load balancing, the following issues must be addressed:

### Cron job duplication

`socialProfileSync.cron.js` runs inside the backend process. With multiple replicas, the cron job would execute on every instance simultaneously, causing redundant API calls and potential data conflicts.

**Solution when scaling**: Use a distributed cron approach — either a dedicated worker container that runs cron jobs exclusively, or a distributed lock (e.g., `redlock` with Redis) to ensure only one instance executes the job at a time.

### Socket.IO scaling

The current setup already uses `@socket.io/redis-adapter`, which enables multi-instance Socket.IO via Redis pub/sub. Adding more backend replicas will work correctly for WebSocket broadcasting — no changes needed for the Socket.IO adapter itself.

**Required change**: Nginx load balancing must use `ip_hash` or sticky sessions (or Socket.IO's built-in routing key) to ensure WebSocket connections are routed consistently to the same backend instance during the HTTP upgrade handshake.

### Startup migrations with multiple replicas

With multiple replicas starting simultaneously, each instance would attempt to run migrations concurrently — causing race conditions in the migration history table.

**Solution when scaling**: Move migrations out of the startup code and into a dedicated init container or a pre-deployment step in the CI/CD pipeline. Only one migration process should run at a time.

### Rate limiting

`express-rate-limit` currently uses in-memory storage. With multiple replicas, rate limit counts would not be shared between instances (each instance tracks its own counts independently).

**Solution when scaling**: Switch to a Redis store for `express-rate-limit` (the `rate-limit-redis` package) so counts are shared across all replicas.
