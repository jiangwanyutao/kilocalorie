#!/usr/bin/env bash
# 千卡日记 · 一键部署（服务器上运行）
# 用法：
#   ./scripts/deploy.sh              # build + up 全流程
#   ./scripts/deploy.sh --skip-build # 只拉起 · 不重 build（快速重启）
#   ./scripts/deploy.sh --down       # 全部停 · 清网络
#   ./scripts/deploy.sh --logs       # 跟着看日志

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker/docker-compose.yml"
ENV_FILE="docker/.env.prod"

# ─── 前置检查 ──────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ 缺少 $ENV_FILE"
  echo "→ cp docker/.env.prod.example $ENV_FILE"
  echo "→ 编辑 · 替换所有 REPLACE_WITH_*"
  exit 1
fi

# 检查明显未替换
if grep -qE 'REPLACE_WITH_' "$ENV_FILE"; then
  echo "✗ $ENV_FILE 还有 REPLACE_WITH_ 占位符 · 请先填充"
  grep -nE 'REPLACE_WITH_' "$ENV_FILE" | head -5
  exit 1
fi

# 检查宿主 PG 端口（非阻塞 · 只提醒）
if command -v nc >/dev/null 2>&1; then
  if ! nc -z -w2 127.0.0.1 5432 2>/dev/null; then
    echo "⚠ 127.0.0.1:5432 未监听 · 请确认 PostgreSQL 是否运行"
  fi
  if ! nc -z -w2 127.0.0.1 6379 2>/dev/null; then
    echo "⚠ 127.0.0.1:6379 未监听 · 请确认 Redis 是否运行"
  fi
fi

# ─── 命令解析 ──────────────────────────────
case "${1:-up}" in
  --down)
    echo "→ 停止并移除容器"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down
    exit 0
    ;;
  --logs)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs -f --tail=100
    exit 0
    ;;
  --skip-build)
    SKIP_BUILD=1
    ;;
  up|"")
    SKIP_BUILD=0
    ;;
  *)
    echo "未知参数：$1"
    echo "用法：$0 [up|--skip-build|--down|--logs]"
    exit 1
    ;;
esac

# ─── 显示当前配置 ──────────────────────────────
DOMAIN=$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2)
IMAGE_TAG=$(grep -E '^IMAGE_TAG=' "$ENV_FILE" | cut -d= -f2)
echo "═══ 千卡日记 · 部署 ═══"
echo "  域名：${DOMAIN}"
echo "  镜像：${IMAGE_TAG}"
echo "════════════════════"

# ─── 构建 ──────────────────────────────
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "→ 构建镜像"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --pull
fi

# ─── 启动 ──────────────────────────────
echo "→ 拉起服务"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

# ─── 健康检查 ──────────────────────────────
echo "→ 等待 api 就绪（最多 60 秒）"
for i in {1..30}; do
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps api | grep -q '(healthy)'; then
    echo "✓ api 健康"
    break
  fi
  sleep 2
done

echo "→ 当前状态"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

# ─── 提示 ──────────────────────────────
cat <<EOF

════════════════════════════════════
  下一步：
  · 访问：https://${DOMAIN}/
  · 日志：./scripts/deploy.sh --logs
  · TLS：确保 /data/qianka/tls/live/${DOMAIN}/fullchain.pem 存在
  · 停止：./scripts/deploy.sh --down
════════════════════════════════════
EOF
