import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * pgvector 说明：
 * embedding 字段在 DB 为 vector(1024)。TypeORM 无内建 vector 类型，
 * 这里用 columnType 'text' 兼容（synchronize: false 不会重建列）。
 * 写入时用 QueryBuilder + 参数 `[1,2,...]::vector` 显式转换。
 */

@Entity({ name: 'ai_conv', comment: 'AI 搭子会话' })
@Index('ix_ai_conv_user', ['userId', 'lastMsgTime'], { where: `del_flag = 'N'` })
export class AiConv extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'persona_code', type: 'varchar', length: 1, default: 'T', comment: 'T/D/F/N' })
  personaCode!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '会话标题 首条摘要' })
  title?: string;

  @Column({ name: 'msg_count', type: 'int2', default: 0 })
  msgCount!: number;

  @Column({ name: 'last_msg_time', type: 'timestamp', nullable: true })
  lastMsgTime?: Date;

  @Column({ type: 'varchar', length: 1, default: 'A', comment: 'A 活跃 C 归档' })
  status!: string;

  @Column({ name: 'bg_key', type: 'varchar', length: 128, nullable: true, comment: '聊天背景图 MinIO key' })
  bgKey?: string;

  @Column({ name: 'avatar_key', type: 'varchar', length: 128, nullable: true, comment: '搭子头像 MinIO key' })
  avatarKey?: string;
}

@Entity({ name: 'ai_msg', comment: 'AI 搭子消息' })
@Index('ix_ai_msg_conv', ['convId', 'msgTime'], { where: `del_flag = 'N'` })
export class AiMsg extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 14 })
  id!: string;

  @Column({ name: 'conv_id', type: 'varchar', length: 12 })
  convId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ type: 'varchar', length: 1, comment: 'U 用户 A 助手 S 系统' })
  role!: string;

  @Column({ type: 'jsonb', comment: '消息内容 支持多模态' })
  content!: Record<string, unknown>;

  @Column({ name: 'content_text', type: 'varchar', length: 4000, nullable: true, comment: '纯文本副本 搜索用' })
  contentText?: string;

  @Column({ name: 'token_in', type: 'int4', nullable: true })
  tokenIn?: number;

  @Column({ name: 'token_out', type: 'int4', nullable: true })
  tokenOut?: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cost?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'deepseek/qwen' })
  provider?: string;

  @Column({ name: 'model_name', type: 'varchar', length: 30, nullable: true })
  modelName?: string;

  @Column({ name: 'msg_time', type: 'timestamp' })
  msgTime!: Date;
}

@Entity({ name: 'ai_usage', comment: 'AI 用量额度' })
@Index('uk_ai_usage_uk', ['userId', 'usageDate', 'usageKind'], { unique: true, where: `del_flag = 'N'` })
export class AiUsage extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'usage_date', type: 'timestamp', comment: '用量当天 0 点' })
  usageDate!: Date;

  @Column({ name: 'usage_kind', type: 'varchar', length: 2, comment: 'PH 拍照 CH 对话 DL 外卖' })
  usageKind!: string;

  @Column({ name: 'used_count', type: 'int2', default: 0 })
  usedCount!: number;

  @Column({ name: 'quota_count', type: 'int2', comment: '当日配额' })
  quotaCount!: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCost!: string;
}

@Entity({ name: 'ai_memory', comment: 'AI 长期记忆 每用户独立' })
@Index('ix_ai_memory_user', ['userId', 'importance'], { where: `del_flag = 'N' AND status = 'A'` })
@Index('ix_ai_memory_user_type', ['userId', 'memType'], { where: `del_flag = 'N'` })
export class AiMemory extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'mem_type', type: 'varchar', length: 1, comment: 'F 事实 P 偏好 G 目标 H 习惯' })
  memType!: string;

  @Column({ name: 'mem_content', type: 'varchar', length: 500, comment: '记忆内容 自然语言' })
  memContent!: string;

  @Column({ type: 'text', nullable: true, comment: 'pgvector vector(1024)' })
  embedding?: string;

  @Column({ type: 'int2', default: 5, comment: '重要度 1-10' })
  importance!: number;

  @Column({ type: 'int2', default: 1, comment: '版本号 每次确认更新 +1' })
  version!: number;

  @Column({ name: 'source_msg_id', type: 'varchar', length: 14, nullable: true })
  sourceMsgId?: string;

  @Column({ name: 'source_conv_id', type: 'varchar', length: 12, nullable: true })
  sourceConvId?: string;

  @Column({ name: 'hit_count', type: 'int4', default: 0 })
  hitCount!: number;

  @Column({ name: 'last_hit_time', type: 'timestamp', nullable: true })
  lastHitTime?: Date;

  @Column({ name: 'expire_time', type: 'timestamp', nullable: true, comment: '过期时间 NULL 永久' })
  expireTime?: Date;

  @Column({ type: 'varchar', length: 1, default: 'A', comment: 'A 生效 O 已过时' })
  status!: string;
}

@Entity({ name: 'ai_memory_log', comment: 'AI 记忆变更历史' })
@Index('ix_ai_memory_log_mem', ['memoryId', 'createTime'], { where: `del_flag = 'N'` })
@Index('ix_ai_memory_log_pending', ['userId'], { where: `op_status = 'P' AND del_flag = 'N'` })
export class AiMemoryLog extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 14 })
  id!: string;

  @Column({ name: 'memory_id', type: 'varchar', length: 12 })
  memoryId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'op_type', type: 'varchar', length: 1, comment: 'C 创建 U 更新 D 删除 O 过时' })
  opType!: string;

  @Column({ name: 'op_status', type: 'varchar', length: 1, default: 'A', comment: 'A 已生效 P 待确认 R 拒绝' })
  opStatus!: string;

  @Column({ name: 'old_content', type: 'varchar', length: 500, nullable: true })
  oldContent?: string;

  @Column({ name: 'new_content', type: 'varchar', length: 500, nullable: true })
  newContent?: string;

  @Column({ name: 'old_type', type: 'varchar', length: 1, nullable: true })
  oldType?: string;

  @Column({ name: 'new_type', type: 'varchar', length: 1, nullable: true })
  newType?: string;

  @Column({ name: 'old_importance', type: 'int2', nullable: true })
  oldImportance?: number;

  @Column({ name: 'new_importance', type: 'int2', nullable: true })
  newImportance?: number;

  @Column({ name: 'version_from', type: 'int2', nullable: true })
  versionFrom?: number;

  @Column({ name: 'version_to', type: 'int2', nullable: true })
  versionTo?: number;

  @Column({ name: 'op_reason', type: 'varchar', length: 200, nullable: true, comment: 'AI 说明或用户手写' })
  opReason?: string;

  @Column({ name: 'source_msg_id', type: 'varchar', length: 14, nullable: true })
  sourceMsgId?: string;

  @Column({ name: 'confirm_time', type: 'timestamp', nullable: true })
  confirmTime?: Date;

  @Column({ name: 'confirm_by', type: 'varchar', length: 6, nullable: true })
  confirmBy?: string;

  @Column({ type: 'varchar', length: 1, default: 'A', comment: 'A Agent U 用户手动' })
  actor!: string;
}

@Entity({ name: 'ai_kb_doc', comment: 'AI 私域知识库文档' })
@Index('ix_ai_kb_doc_status', ['kbStatus'], { where: `del_flag = 'N'` })
@Index('uk_ai_kb_doc_hash', ['contentHash'], { unique: true, where: `del_flag = 'N'` })
export class AiKbDoc extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'doc_title', type: 'varchar', length: 100 })
  docTitle!: string;

  @Column({ name: 'doc_tag', type: 'varchar', length: 100, nullable: true })
  docTag?: string;

  @Column({ name: 'source_type', type: 'varchar', length: 2, comment: 'MD/PD/TX' })
  sourceType!: string;

  @Column({ name: 'source_key', type: 'varchar', length: 128, nullable: true })
  sourceKey?: string;

  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true, comment: 'SHA256 去重' })
  contentHash?: string;

  @Column({ name: 'chunk_count', type: 'int4', default: 0 })
  chunkCount!: number;

  @Column({ name: 'kb_status', type: 'varchar', length: 1, default: 'D', comment: 'D 草稿 P 处理中 A 上线 X 下线' })
  kbStatus!: string;

  @Column({ name: 'publish_time', type: 'timestamp', nullable: true })
  publishTime?: Date;
}

@Entity({ name: 'ai_kb_chunk', comment: 'AI 知识库切片与向量' })
@Index('ix_ai_kb_chunk_doc', ['docId', 'chunkIdx'], { where: `del_flag = 'N'` })
export class AiKbChunk extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'doc_id', type: 'varchar', length: 10 })
  docId!: string;

  @Column({ name: 'chunk_idx', type: 'int4' })
  chunkIdx!: number;

  @Column({ name: 'chunk_text', type: 'varchar', length: 2000 })
  chunkText!: string;

  @Column({ name: 'chunk_tokens', type: 'int2' })
  chunkTokens!: number;

  @Column({ type: 'text', comment: 'pgvector vector(1024)' })
  embedding!: string;

  @Column({ name: 'meta_json', type: 'jsonb', nullable: true })
  metaJson?: Record<string, unknown>;

  @Column({ name: 'hit_count', type: 'int4', default: 0, comment: '命中次数（热度）' })
  hitCount!: number;
}
