# ---- build the web app
FROM node:22-alpine AS web
WORKDIR /app
COPY engine ./engine
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --no-audit --no-fund
COPY web ./web
RUN cd web && npm run build

# ---- server runtime (Node runs the TypeScript sources directly)
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund
COPY engine/src ./engine/src
COPY engine/package.json ./engine/
COPY server/src ./server/src
COPY server/migrations ./server/migrations
COPY --from=web /app/web/dist ./web/dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/src/main.ts"]
