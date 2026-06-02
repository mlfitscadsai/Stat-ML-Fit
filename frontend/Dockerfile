# Build stage
FROM node:18-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
# Browser build uses onnxruntime-web WASM; skip onnxruntime-node postinstall download.
RUN npm ci --ignore-scripts

COPY . .
RUN npm run prebuild && npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built files from build stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
