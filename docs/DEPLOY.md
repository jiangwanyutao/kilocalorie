# 千卡日记 · 部署指南（V1）

## 目标环境

- 内网 Ubuntu 22.04+（生产环境 · 4c/8G/48G）
- 已装：Docker 25+ · Docker Compose v2
- 已装：PostgreSQL 15+（含 pgvector 扩展）· Redis 7+ · MinIO（可选）
- 已备案：域名 · TLS 证书用 Let's Encrypt（certbot）
- frp/公网端口：Boss 定 · 腾讯云安全组放行

## 0 · 前置准备（一次）

### 0.1 安装宿主服务
```bash
sudo apt install postgresql-15 postgresql-15-pgvector
sudo apt install redis-server
# MinIO 参考官方 docs
```

### 0.2 初始化数据库
```bash
sudo -u postgres psql -c "CREATE USER kilocalorie WITH PASSWORD '强密码';"
sudo -u postgres psql -c "CREATE DATABASE kilocalorie OWNER kilocalorie;"
sudo -u postgres psql -d kilocalorie -c "CREATE EXTENSION pgvector;"
sudo -u postgres psql -d kilocalorie < scripts/init.sql
```

### 0.3 准备 TLS 证书
```bash
sudo mkdir -p /data/qianka/{tls,certbot,logs/nginx}
sudo certbot certonly --webroot -w /data/qianka/certbot -d qianka.example.cn
sudo ln -sf /etc/letsencrypt /data/qianka/tls
```

## 1 · 拉代码

```bash
sudo mkdir -p /opt/qianka && sudo chown $USER:$USER /opt/qianka
cd /opt/qianka
git clone <repo> diet-tracker
cd diet-tracker
```

## 2 · 填生产环境变量

```bash
cp docker/.env.prod.example docker/.env.prod
vim docker/.env.prod
# 逐项替换所有 REPLACE_WITH_*：
#   · DB_PWD / DATABASE_URL  → 步骤 0.2 里的密码
#   · JWT_SECRET             → openssl rand -hex 64
#   · MAIL_USER / MAIL_PASS  → QQ 邮箱账号 + SMTP 授权码
#   · DEEPSEEK_API_KEY       → DeepSeek 控制台
#   · DASHSCOPE_API_KEY      → 阿里云百炼控制台
#   · MINIO_*                → MinIO 后台
```

## 3 · 首次部署

```bash
./scripts/deploy.sh
```

脚本会：
1. 校验 `.env.prod` 存在 · 无 `REPLACE_WITH_` 残留
2. 简单探测宿主 5432/6379 端口
3. `docker compose build --pull`
4. `docker compose up -d --remove-orphans`
5. 等 api healthcheck 通过
6. 显示状态

首次约 3-5 分钟（拉 base 镜像 + 装依赖）。

## 4 · 更新版本

```bash
git pull
./scripts/deploy.sh                # 全量 build + up
./scripts/deploy.sh --skip-build   # 只 up · 不重 build
```

## 5 · 日常运维

| 需求 | 命令 |
|---|---|
| 看日志 | `./scripts/deploy.sh --logs` |
| 看单容器日志 | `docker logs -f qianka-api` |
| 进 api shell | `docker exec -it qianka-api sh` |
| 停止全部 | `./scripts/deploy.sh --down` |
| 只重启 api | `docker compose --env-file docker/.env.prod -f docker/docker-compose.yml restart api` |
| 检查状态 | `docker compose --env-file docker/.env.prod -f docker/docker-compose.yml ps` |
| nginx 重载配置 | `docker exec qianka-nginx nginx -s reload` |

## 6 · TLS 续签（每 60 天自动）

`crontab -e`：
```
0 3 * * 1 /usr/bin/certbot renew --quiet --webroot -w /data/qianka/certbot --post-hook "docker exec qianka-nginx nginx -s reload"
```

## 7 · 数据备份

```
0 2 * * * pg_dump -U kilocalorie kilocalorie | gzip > /data/qianka/backup/db-$(date +\%Y\%m\%d).sql.gz
0 3 * * * find /data/qianka/backup -name 'db-*.sql.gz' -mtime +30 -delete
```

## 8 · 故障排查

| 症状 | 排查 |
|---|---|
| `503 Service Unavailable` | `docker compose ps` 看 api 是否 unhealthy · `docker logs qianka-api` |
| `502 Bad Gateway` | api 起来但 nginx 连不上 · 检查两容器同 network（qianka-network） |
| api 起不来 | 多半 DATABASE_URL / REDIS_URL 错 · 或宿主 pg 未 listen 0.0.0.0（`postgresql.conf` 里 `listen_addresses = '*'` + `pg_hba.conf` 允许 `172.16.0.0/12`） |
| 上传 Apple Health zip 报 413 | nginx 已放开到 150m · 更大要再改 `client_max_body_size` |
| SSE 流式对话半路断 | 已关 `proxy_buffering` + `proxy_read_timeout 600s` · 更长要改主 conf |

## 9 · 卸载

```bash
./scripts/deploy.sh --down
docker rmi qianka/api:0.1.0 qianka/web:0.1.0
sudo -u postgres psql -c "DROP DATABASE kilocalorie;"
```
