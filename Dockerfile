# Frontend Dockerfile for Uniqube 3D (React + Vite)
# Multi-stage: build with Node, serve with Nginx

FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime image with Nginx
FROM nginx:alpine

# Copy nginx config (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
