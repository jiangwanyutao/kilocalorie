# 千卡日记 · API 生产镜像 · 多阶段构建
# build context 是项目根 (compose 里 context: ..)

FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY api/package.json ./
COPY api/pnpm-lock.yaml* ./
COPY api/tsconfig.json api/nest-cli.json ./
RUN pnpm install --prod=false

COPY api/src ./src
RUN pnpm build

RUN pnpm prune --prod

FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache wget tini

ENV NODE_ENV=production
ENV PORT=7100

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 7100

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
