# Bhargo in a container: for hosting that wants an image rather than a machine
# to look after. The books live on a mounted volume at /data, never inside the
# image, so a new version never touches them.

FROM node:20-bookworm-slim AS build
WORKDIR /app

# Build tools, in case the native database module has no prebuilt binary for
# this platform. Absent from the final image.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    BHARGO_DB=/data/bhargo.db

# Runs as a non-root user that owns only its own data.
RUN useradd --system --uid 1001 bhargo \
    && mkdir -p /data \
    && chown bhargo:bhargo /data

COPY --from=build --chown=bhargo:bhargo /app/.next/standalone ./
COPY --from=build --chown=bhargo:bhargo /app/.next/static ./.next/static
COPY --from=build --chown=bhargo:bhargo /app/public ./public
# The native module cannot be bundled, so it travels as it is.
COPY --from=build --chown=bhargo:bhargo /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build --chown=bhargo:bhargo /app/node_modules/bindings ./node_modules/bindings
COPY --from=build --chown=bhargo:bhargo /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

USER bhargo
VOLUME ["/data"]
EXPOSE 3000

# Answers unhealthy if the database stops taking a write, not merely if the
# process is alive.
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
