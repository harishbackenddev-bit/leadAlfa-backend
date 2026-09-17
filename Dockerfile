# ─────────────────────────────────────────────────────────
# Creatrend Backend — Production Dockerfile
# Node 22 Alpine (matches local development version v22.x)
# ─────────────────────────────────────────────────────────

FROM node:22-alpine

# Install dumb-init for proper signal forwarding.
# Alpine's default PID 1 does not forward SIGTERM to child processes.
# dumb-init acts as a minimal init system, ensuring SIGTERM/SIGINT
# reach node correctly so graceful shutdown works.
RUN apk add --no-cache dumb-init

# Create a dedicated non-root user for runtime security.
# The official node image includes a 'node' user (uid 1000).
# We reuse it rather than creating a new one.
WORKDIR /app

# ── Dependency installation ──────────────────────────────
# Copy manifests first to exploit Docker layer caching.
# Subsequent builds only re-run npm ci when package files change.
COPY package.json package-lock.json ./

# npm ci: deterministic, uses exact lockfile versions.
# --omit=dev: excludes jest and cross-env (not needed at runtime).
# NOTE: sequelize-cli is intentionally in production dependencies because
# index.js invokes `npx sequelize-cli db:migrate` via execSync at startup.
RUN npm ci --omit=dev

# ── Application source ───────────────────────────────────
# .dockerignore controls what is excluded from this COPY.
# .env files, node_modules, test files, and dev artifacts are excluded.
COPY --chown=node:node . .

# Switch to non-root user for runtime
USER node

# Expose the application port (runtime value from PORT env var, default 8080)
EXPOSE 8080

# Use dumb-init as PID 1 so SIGTERM/SIGINT are forwarded correctly to node.
# Start using 'node index.js' directly (not npm start) to avoid npm's
# signal-swallowing wrapper.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
