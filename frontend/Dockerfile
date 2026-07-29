# # Build stage
# FROM node:20-alpine AS builder

# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install dependencies
# RUN npm ci

# # Copy source code
# COPY . .

# # Build the app
# RUN npm run build

# # Production stage
# FROM nginx:alpine

# # Copy built files to nginx
# COPY --from=builder /app/dist /usr/share/nginx/html

# # Copy nginx configuration
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# # Expose port 80
# EXPOSE 80

# # Start nginx
# CMD ["nginx", "-g", "daemon off;"]

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (creates fresh Linux-compatible node_modules)
RUN npm ci

# Copy source code (node_modules is ignored by .dockerignore)
COPY . .

# Ensure vite has execute permissions (safety fix for Windows hosts)
RUN chmod +x node_modules/.bin/vite

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]