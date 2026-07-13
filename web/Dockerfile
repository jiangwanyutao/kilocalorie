# 千卡日记 · Web 生产镜像 · 多阶段：Vite build → Nginx serve
# build context 是项目根 (compose 里 context: ..)

FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY web/package.json ./
COPY web/pnpm-lock.yaml* ./
COPY web/tsconfig.json web/tsconfig.node.json web/vite.config.ts ./
COPY web/index.html ./
RUN pnpm install --prod=false

COPY web/src ./src
RUN pnpm build

FROM nginx:1.27-alpine AS runtime

RUN printf '%s\n' \
    'server {' \
    '  listen 80;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '' \
    '  gzip on;' \
    '  gzip_types text/plain text/css application/json application/javascript image/svg+xml application/wasm;' \
    '  gzip_min_length 1024;' \
    '' \
    '  location = /sw.js { add_header Cache-Control "no-cache"; try_files $uri =404; }' \
    '  location = /manifest.webmanifest { add_header Cache-Control "no-cache"; try_files $uri =404; }' \
    '  location = /registerSW.js { add_header Cache-Control "no-cache"; try_files $uri =404; }' \
    '' \
    '  location ~* \.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|avif|ico)$ {' \
    '    expires 1y;' \
    '    add_header Cache-Control "public, immutable";' \
    '    try_files $uri =404;' \
    '  }' \
    '' \
    '  location / {' \
    '    try_files $uri /index.html;' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
