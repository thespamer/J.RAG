# Build stage
FROM node:16-alpine as builder

# Install only essential build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm install -g react-scripts@5.0.1

# Copy source code and build
COPY . .
RUN npm run build

# Development stage
FROM node:16-alpine

WORKDIR /app

# Install only runtime dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm install -g react-scripts@5.0.1

# Copy source code for development
COPY . .

# Environment variables for optimization
ENV NODE_ENV=development \
    GENERATE_SOURCEMAP=false \
    DISABLE_ESLINT_PLUGIN=true

# Expose port
EXPOSE 3000

# Start development server with optimizations
CMD ["npm", "start"]
