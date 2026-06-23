# Tracer API — multi-stage. The build bundles the @tracer/* workspace libs into
# main.js (see apps/api/webpack.config.js); the runtime stage installs only the
# externalized node_modules from the generated package.json. The container
# self-migrates on boot (migrationsRun + explicit migration classes), so a fresh
# database needs no separate migration step.
# Build context = repo root:  docker build -f deploy/api.Dockerfile -t tracer-api .

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
# typecheck first so TypeScript project references (e.g. @tracer/common-models)
# emit their declarations to dist/out-tsc, which the webpack tsc build consumes.
RUN npx nx typecheck api --skip-nx-cache && npx nx build api --skip-nx-cache

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY .npmrc ./
# The generated package.json lists the externalized runtime deps + the entry "main".
COPY --from=builder /app/dist/apps/api/ ./
# `pg` is loaded dynamically by TypeORM at runtime, so generatePackageJson can't
# see it — install the Postgres driver explicitly.
RUN npm install --omit=dev --no-audit --no-fund \
 && npm install --no-audit --no-fund pg@^8.22.0 \
 && npm cache clean --force
EXPOSE 3000
# Run as the non-root node user.
USER node
CMD ["node", "main.js"]
