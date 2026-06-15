# =============================================================================
# BuzzTrack — Multi-stage Dockerfile
# =============================================================================

# ---- Stage 1: Install JS deps ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    cp -r node_modules /prod_modules && \
    npm ci

# ---- Stage 2: Build frontend (Vite) ----
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx vite build --outDir dist

# ---- Stage 3: Build backend (esbuild) ----
FROM node:22-bookworm-slim AS backend-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx esbuild server.ts --bundle --platform=node --format=cjs \
    --packages=external --sourcemap --outfile=dist/server.cjs

# ---- Stage 4: Production image ----
FROM node:22-bookworm-slim AS production
LABEL org.opencontainers.image.title="BuzzTrack"
LABEL org.opencontainers.image.description="Multi-platform disinformation & buzzer detection tool"
LABEL org.opencontainers.image.source="https://github.com/yuurhakids-blip/buzztrack"

# Install Python 3 + pip for scrapers
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production node_modules (no devDeps)
COPY --from=deps /prod_modules ./node_modules

# Copy built artifacts
COPY --from=frontend-build /app/dist ./dist
COPY --from=backend-build /app/dist/server.cjs ./dist/server.cjs
COPY --from=backend-build /app/dist/server.cjs.map ./dist/server.cjs.map

# Copy scrapers + install Python deps
COPY scrapers/ ./scrapers/
RUN python3 -m venv /venv && \
    /venv/bin/pip install --no-cache-dir -r scrapers/requirements.txt

# Copy data directory (for runtime persistence — override with volume)
COPY data/ ./data/

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    API_PORT=3001 \
    PYTHON_PATH=/venv/bin/python3 \
    DISABLE_HMR=true

EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:$API_PORT/api/campaigns', r => {process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
