# syntax=docker/dockerfile:1.10
# adk-web-ui/Dockerfile. Build context = repo root (needs ../agents/*/metadata.json).
# docker build -f adk-web-ui/Dockerfile -t adk-web .
FROM node:22-slim AS deps
WORKDIR /repo/adk-web-ui
COPY adk-web-ui/package.json adk-web-ui/package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /repo
COPY --from=deps /repo/adk-web-ui/node_modules adk-web-ui/node_modules
COPY adk-web-ui adk-web-ui
COPY agents agents
WORKDIR /repo/adk-web-ui
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are inlined at build time; Railway passes service vars as build args.
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY
ARG NEXT_PUBLIC_GITHUB_URL
ARG NEXT_PUBLIC_LINKEDIN_URL
ARG NEXT_PUBLIC_PERSONAL_URL
ARG NEXT_PUBLIC_AGENTS_REPO_URL
ARG NEXT_PUBLIC_ADK_LIST_AGENTS_CLIENT_TIMEOUT_MS
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_COMMUNITY_WRITE_ENABLED
ARG SENTRY_ORG
ARG SENTRY_PROJECT
# next.config.ts headers() bakes these into the standalone build's routes manifest.
ARG CSP_ENFORCE
ARG CSP_REPORT_URI
# The build never touches a real database; it only needs DATABASE_URL to be set.
# Build-stage only; never copied into the runtime image.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build SKIP_ENV_VALIDATION=true
# On Railway, service variables are available as build secrets via --mount=type=secret,id=<NAME>.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/adk-web-ui/.next/standalone ./
COPY --from=build --chown=node:node /repo/adk-web-ui/.next/static ./adk-web-ui/.next/static
COPY --from=build --chown=node:node /repo/adk-web-ui/public ./adk-web-ui/public
USER node
EXPOSE 3000
CMD ["node", "adk-web-ui/server.js"]
