# ========================================================
# Production Multi-Stage Dockerfile for Sentinel Core
# ========================================================

# --- Stage 1: Frontend Build ---
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
# Build frontend with production optimizations
RUN npm run build

# --- Stage 2: Server & Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for server
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

WORKDIR /app
# Copy server source
COPY server/ ./server/
# Copy built client from stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Create uploads directory and set permissions
RUN mkdir -p ./server/uploads/policies && chown -R node:node /app

USER node
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "server/server.js"]
