# Production-Ready Dockerfile for API Server
# Multi-stage build: Build stage + Runtime stage
# This creates a SMALL, efficient container

# Stage 1: Build stage
FROM node:18-alpine as builder
WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Runtime stage
FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies (smaller image)
RUN npm ci --only=production

# Copy compiled code from builder stage
COPY --from=builder /app/dist ./dist

# Copy environment file
COPY .env .

# Expose port
EXPOSE 3000

# Health check: Verify API is responding
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/matches/1', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the API server
CMD ["node", "dist/index.js"]
