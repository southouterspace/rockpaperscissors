# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (skip native module scripts - Bun has native SQLite)
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the React app
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies only (skip native module scripts)
RUN bun install --production --ignore-scripts

# Copy server code and shared types
COPY server ./server
COPY shared ./shared

# Copy built React app from builder
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/server/data

EXPOSE 3001

ENV NODE_ENV=production

CMD ["bun", "run", "start"]
