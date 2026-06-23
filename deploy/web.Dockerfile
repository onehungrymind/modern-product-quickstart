# Tracer web — build the Angular SPA, serve it from nginx, and proxy /api to the
# API container (resolved by service name on the Docker network).
# Build context = repo root:  docker build -f deploy/web.Dockerfile -t tracer-web .

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx nx build web --configuration=production --skip-nx-cache

FROM nginx:alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
