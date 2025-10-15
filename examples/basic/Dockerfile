# Multi-stage build for tsdev basic example

# Stage 1: Base image with pnpm
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Stage 2: Install all dependencies (including dev)
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/adapters/package.json ./packages/adapters/
COPY examples/basic/package.json ./examples/basic/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Stage 3: Build packages
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy source files for packages
COPY packages/core ./packages/core
COPY packages/adapters ./packages/adapters

# Build core packages
RUN pnpm --filter @tsdev/core build
RUN pnpm --filter @tsdev/adapters build

# Copy application source
COPY examples/basic ./examples/basic

# Stage 4: Production dependencies only
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/adapters/package.json ./packages/adapters/
COPY examples/basic/package.json ./examples/basic/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Stage 5: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy built packages
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/
COPY --from=build /app/packages/adapters/dist ./packages/adapters/dist
COPY --from=build /app/packages/adapters/package.json ./packages/adapters/

# Copy application
COPY --from=build /app/examples/basic/src ./src
COPY --from=build /app/examples/basic/package.json ./

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/procedures', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "--import", "tsx/esm", "src/apps/http.ts"]
