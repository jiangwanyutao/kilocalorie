# frpc 映射片段 · 千卡日记

在内网 Ubuntu 上编辑 `/etc/frp/frpc.toml`（root 拥有 · sudo vim）· **追加**下面这段：

```toml
[[proxies]]
name = "qianka"
type = "tcp"
localIP = "127.0.0.1"
localPort = 17180
remotePort = 17180
```

保存后：

```bash
docker restart frpc
```

## 需 Boss 配合

1. **腾讯云安全组** 放行公网入站 TCP `17180`
2. **frps 端** 一般无需重启（frps 会接收 frpc 的注册）

## 验证

```bash
# 从任意有公网的地方
curl -o /dev/null -w '%{http_code}\n' http://YOUR_FRPS_PUBLIC_IP:17180/health
# 期望：200
```

## 你自己的域名反代

假设你有域名 `qianka.your.tld` · 用 Nginx / Caddy 指向 `YOUR_FRPS_PUBLIC_IP:17180`：

### Nginx 反代示例
```nginx
server {
    listen 443 ssl http2;
    server_name qianka.your.tld;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # SSE 支持 · 与内网 nginx 参数一致
    client_max_body_size 150m;

    location / {
        proxy_pass http://YOUR_FRPS_PUBLIC_IP:17180;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
```

### Caddy 反代示例
```
qianka.your.tld {
    reverse_proxy YOUR_FRPS_PUBLIC_IP:17180 {
        transport http {
            read_timeout 600s
        }
    }
}
```

## 备选：17180 撞了

改 `docker/.env.prod` 里 `NGINX_PORT=17181`（或其他空闲高端口）· 然后：
```bash
cd /opt/qianka/diet-tracker
docker compose --env-file docker/.env.prod -f docker/docker-compose.yml up -d
```
frpc.toml 里 `localPort` 和 `remotePort` 同步改。
