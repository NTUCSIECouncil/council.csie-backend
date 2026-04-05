FROM node:24.14.1-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build

WORKDIR /app

ENV NODE_ENV=production

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY package.json ./
COPY .husky/install.mjs .husky/install.mjs
RUN pnpm install --offline --frozen-lockfile

COPY src/ ./src
COPY tsconfig.json ./

RUN pnpm run build

RUN pnpm prune --prod

FROM base AS runner

WORKDIR /app

COPY openapi ./openapi
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/var && chown -R node:node /app/var
ENV NODE_ENV=production

USER node
CMD [ "node", "dist/index.mjs" ]
