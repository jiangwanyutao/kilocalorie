# 千卡日记 · Qianka Diary

> 面向大众的开放注册饮食日记 PWA。
> 前端：Vue 3 + Vite + PWA · 后端：NestJS + TypeORM + PostgreSQL + pgvector + MinIO · AI：DeepSeek + LangGraph.js

## 快速开始

### 1. 环境要求

- Node.js ≥ 20
- pnpm ≥ 9（用 `corepack enable && corepack prepare pnpm@9.15.0 --activate`）
- Docker + Docker Compose（部署时用）
- 访问 PostgreSQL 15+ 带 pgvector 扩展 · Redis 7+ · MinIO（S3 兼容）

### 2. 装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填真实密钥
```

### 4. 初始化数据库

```bash
# 在能访问 Postgres 的机器上（本地或服务器）
pnpm db:init

# 灌 2000 条中国食物成分表
pnpm db:seed:foods
```

### 5. 本地开发

```bash
pnpm dev          # 同时起 api + web
# 或分开
pnpm dev:api      # 后端 http://localhost:7100
pnpm dev:web      # 前端 http://localhost:7110
```

### 6. 部署（Docker Compose）

```bash
# 在服务器上
pnpm docker:up
```

## 目录结构

```
diet-tracker/
├── api/                NestJS 后端
│   ├── src/
│   │   ├── modules/    业务模块（user / food / meal / ai / …）
│   │   ├── entities/   TypeORM 32 张表实体
│   │   ├── common/     Guards / Interceptors / Pipes
│   │   └── config/     配置
│   └── package.json
├── web/                Vue 3 前端
│   ├── src/
│   │   ├── views/      32 屏路由页
│   │   ├── components/ 24 个原子组件
│   │   ├── stores/     Pinia stores
│   │   ├── router/     路由
│   │   └── styles/     Design tokens
│   └── package.json
├── docker/             部署配置
│   ├── docker-compose.yml
│   └── nginx/
├── scripts/            初始化 / 种子 / 部署脚本
│   ├── init.sql        建库 + pgvector + 字典
│   └── seed-food-std.sh
├── docs/               产品文档
│   ├── prd.html
│   ├── architecture.html
│   └── ui-spec.html
├── design/             UI 稿（Stitch 生成）
│   └── stitch_/
└── CLAUDE.md           项目上下文（给 AI 助手）
```

## 文档

- **PRD**：`docs/prd.html` — 产品需求
- **架构 & Schema**：`docs/architecture.html` — 部署拓扑 + 32 张表 DDL + AI Agent 三层记忆
- **UI Spec**：`docs/ui-spec.html` — 32 屏视觉规范 + Stitch Prompt
- **设计稿**：`design/stitch_/` — Stitch 生成的实际 UI 图

## 部署架构

服务器：内网 Ubuntu 24.04 LTS（4 核 / 7.8G / 48G）
- **独立容器**：pg(pgvector) + redis + api(NestJS) + web(nginx serve Vite build) + nginx(反代)
- **复用宿主**：MinIO
- **公网出口**：frp 隧道 · 域名反代到内网 web
- 详见 `docs/DEPLOY.md`

## License

私有 · 内部使用
