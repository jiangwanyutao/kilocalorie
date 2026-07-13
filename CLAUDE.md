# 千卡日记 · 项目上下文（给 AI 助手）

## 项目概览

- **名称**：千卡日记（Qianka Diary）
- **形态**：H5 PWA · 加桌面即"轻应用"，不上架
- **定位**：开放注册饮食日记 · 通用饮食管理（减脂/增肌/日常兼容）
- **阶段**：V1 MVP（12–14 周单人开发）
- **付费**：V1 全免费，数据模型预留付费墙

## 技术栈（不要偏离）

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + Vite + Pinia + vue-router + vite-plugin-pwa + Dexie |
| 后端 | NestJS 10 + TypeORM + Fastify adapter |
| 数据库 | PostgreSQL 15+ 带 pgvector 扩展 |
| 缓存 | Redis 7+（会话/限流/ID 序列/AI 短期上下文） |
| 对象存储 | MinIO（S3 兼容） |
| 反代 | Nginx |
| 邮件 | QQ 邮箱 SMTP（`smtp.qq.com:465`），`MailProvider` 适配器 |
| AI 视觉 | DeepSeek V4 Vision（qwen-vl-plus 备胎），`VisionProvider` 适配器 |
| AI 对话 | DeepSeek Chat + **LangGraph.js Agent** + 12 Tools + 三层记忆 |
| Embedding | 阿里 text-embedding-v3（1024 维） |
| 部署 | Docker Compose · 复用宿主 PG/Redis/MinIO |

## 数据库规范（HIS 严格执行，勿破坏）

1. 字符串一律 `varchar(n)`，禁 `char`/`text`（大字段用 `jsonb`）
2. **主键字符串自增**（Redis INCR + 左补零）；每张表长度按预估：`user_info(6)`、`food_std(6)`、`food_user(10)`、`meal_entry(12)`、`meal_item(14)`、`ai_msg(14)` 等
3. 状态字段 `varchar(1)` 或 `varchar(2)`，禁 `boolean`
4. 时间字段一律 `timestamp`，禁 `date`/`time`
5. 金额/精度 `decimal(10,4)`
6. 无外键、无触发器；一致性靠代码
7. 唯一约束用唯一索引实现（带 `WHERE del_flag = 'N'` 部分索引）
8. 通用字段每张业务表都有：`create_time/create_by/update_time/update_by/del_flag/delete_time/delete_by`
9. 表名模块前缀（`sys_/user_/food_/meal_/water_/ex_/body_/fast_/ai_/hlth_/sub_`）
10. 字段中文注释必填（TypeORM `@Column({ comment: '…' })`）
11. 特定长度约定：`user_id varchar(6)` / `spell_code varchar(20)` / `object_key varchar(128)`

## 主键生成（服务：`IdGeneratorService`）

```typescript
async next(table: string, len: number): Promise<string> {
  const n = await this.redis.incr(`id:${table}`);
  const s = n.toString();
  if (s.length > len) throw new Error(`ID overflow for ${table}`);
  return s.padStart(len, '0');
}
```

Redis 崩溃回填：启动时 `SELECT max(id::int) FROM ${table}` 写回 Redis。

## AI Agent 三层记忆（核心差异化）

- **短期**：Redis List `ctx:conv:{conv_id}`，最近 20 轮，24h 过期
- **中期**：Postgres `ai_msg` 全量
- **长期**：Postgres + pgvector `ai_memory`，Agent 通过 `remember()` tool 主动写入

**12 个 Agent Tools**（分三组）：
- 读：`get_today_summary` / `get_weight_history` / `search_food`
- 写：`log_food` / `log_water` / `log_weight` / `log_exercise` / `start_fasting` / `end_fasting`（对话即操作）
- 记忆：`remember` / `recall` / `search_knowledge_base`

**记忆更新用户确认闭环**：Agent 提议改记忆 → 写 `ai_memory_log`（`op_status=P`）→ 前端弹变更卡 → 用户确认后 `version+1`。

## 服务器（部署目标）

- 主机：内网 Ubuntu（4 核 / 7.8G / 48G）· 具体 IP 见私人凭据文件
- SSH 及凭据详见 `D:\project\内网穿透服务器\CLAUDE.md`（含明文，勿外泄）
- **复用宿主服务**：PostgreSQL 5432、Redis 6379（用 DB 5 隔离）、MinIO
- **独立部署**：nginx + api + web 三个容器
- **frp 出口**：需 Boss 定公网端口 + 腾讯云安全组放行

## 视觉规范（Stitch 已定稿）

- **色板**：surface `#FFF8F5` / primary `#A53314` / primary-container `#C64B2A` / secondary（茶绿）`#536523` / tertiary（蜜金）`#7E5100`
- **字体**：PingFang SC + tabular-nums（数据）
- **圆角**：卡片 16px / 按钮 10px / Chip 999px
- **阴影**：极轻 `0 4px 12px rgba(29,25,23,0.04)`（"纸感"，不悬浮）
- **底部导航**：5 Tab · 首页/记录/中心 [+] 浮起/AI 搭子/我的
- 详细见 `design/stitch_/warm_diary_aesthetic/DESIGN.md`

## 合规刚需

- 用户可查/改/删 AI 记住的所有事情（记忆管理页）
- 用户可删账号，T+30 天物理删除
- 用户可导出全量 JSON
- AI 内容附免责："AI 内容仅供参考，不构成医疗建议"

## 关键待议（写代码时如遇到需先问用户）

- Slogan 三选一未定
- 域名未定
- QQ 邮箱账号 + 授权码 未提供
- DeepSeek + DashScope API Key 未提供
- 营养师团队内容时间线

## 参考文档（review 前必读）

- `docs/prd.html`
- `docs/architecture.html`
- `docs/ui-spec.html`
- `design/stitch_/warm_diary_aesthetic/DESIGN.md`
