import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'user_info', comment: '用户主表' })
@Index('uk_user_email', ['email'], { unique: true, where: `del_flag = 'N'` })
export class UserInfo extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 6, comment: '用户 ID (HIS 6 位)' })
  id!: string;

  @Column({ type: 'varchar', length: 30, comment: '昵称' })
  nickname!: string;

  @Column({ type: 'varchar', length: 80, comment: '登录邮箱' })
  email!: string;

  @Column({ name: 'avatar_key', type: 'varchar', length: 128, nullable: true, comment: '头像 MinIO object key' })
  avatarKey?: string;

  @Column({ type: 'varchar', length: 1, default: 'U', comment: '性别 M/F/U' })
  gender!: string;

  @Column({ name: 'birth_year', type: 'int2', nullable: true, comment: '出生年份' })
  birthYear?: number;

  @Column({ name: 'height_cm', type: 'decimal', precision: 5, scale: 1, nullable: true, comment: '身高 cm' })
  heightCm?: string;

  @Column({ name: 'activity_lvl', type: 'varchar', length: 1, default: '2', comment: '活动等级 1-5' })
  activityLvl!: string;

  @Column({ name: 'bmr_kcal', type: 'int2', nullable: true, comment: '缓存 BMR' })
  bmrKcal?: number;

  @Column({ name: 'tdee_kcal', type: 'int2', nullable: true, comment: '缓存 TDEE' })
  tdeeKcal?: number;

  @Column({ name: 'vip_lvl', type: 'varchar', length: 1, default: '0', comment: '会员等级 0 免费' })
  vipLvl!: string;

  @Column({ name: 'vip_expire', type: 'timestamp', nullable: true, comment: '会员过期' })
  vipExpire?: Date;

  @Column({ name: 'reg_ip', type: 'varchar', length: 45, nullable: true, comment: '注册 IP' })
  regIp?: string;

  @Column({ name: 'reg_ua', type: 'varchar', length: 200, nullable: true, comment: '注册 UA' })
  regUa?: string;

  @Column({ name: 'email_verified', type: 'varchar', length: 1, default: 'N', comment: '邮箱是否已验证 N/Y' })
  emailVerified!: string;

  @Column({ type: 'varchar', length: 1, default: 'A', comment: 'A 正常 D 已注销 F 冻结' })
  status!: string;

  @Column({ name: 'last_login', type: 'timestamp', nullable: true, comment: '最后登录时间' })
  lastLogin?: Date;
}

@Entity({ name: 'user_auth', comment: '用户密码认证' })
export class UserAuth extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 6, comment: '同 user_info.id' })
  id!: string;

  @Column({ name: 'pwd_hash', type: 'varchar', length: 80, comment: 'bcrypt hash' })
  pwdHash!: string;

  @Column({ name: 'pwd_ver', type: 'int2', default: 1, comment: '密码版本 改密后 +1 旧 token 失效' })
  pwdVer!: number;

  @Column({ name: 'pwd_reset_at', type: 'timestamp', nullable: true, comment: '最近一次改密时间' })
  pwdResetAt?: Date;
}

@Entity({ name: 'user_session', comment: '用户会话 JWT refresh token' })
@Index('uk_user_session_token', ['refreshToken'], { unique: true, where: `del_flag = 'N'` })
@Index('ix_user_session_user', ['userId'], { where: `del_flag = 'N'` })
export class UserSession extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'refresh_token', type: 'varchar', length: 64 })
  refreshToken!: string;

  @Column({ name: 'device_info', type: 'varchar', length: 200, nullable: true })
  deviceInfo?: string;

  @Column({ name: 'ip_addr', type: 'varchar', length: 45, nullable: true })
  ipAddr?: string;

  @Column({ name: 'expire_time', type: 'timestamp' })
  expireTime!: Date;

  @Column({ type: 'varchar', length: 1, default: 'N', comment: '是否吊销 N/Y' })
  revoked!: string;
}

@Entity({ name: 'user_verify', comment: '邮箱验证 / 密码重置' })
@Index('uk_user_verify_token', ['verifyToken'], { unique: true, where: `del_flag = 'N'` })
@Index('ix_user_verify_email', ['email', 'verifyType'], { where: `del_flag = 'N'` })
export class UserVerify extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6, nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 80 })
  email!: string;

  @Column({ name: 'verify_type', type: 'varchar', length: 1, comment: 'V 注册 R 密码重置 E 换绑' })
  verifyType!: string;

  @Column({ name: 'verify_token', type: 'varchar', length: 64 })
  verifyToken!: string;

  @Column({ name: 'used_flag', type: 'varchar', length: 1, default: 'N' })
  usedFlag!: string;

  @Column({ name: 'expire_time', type: 'timestamp' })
  expireTime!: Date;
}

@Entity({ name: 'user_goal', comment: '用户目标配置 带版本历史' })
@Index('ix_user_goal_user', ['userId', 'isCurrent'], { where: `del_flag = 'N'` })
export class UserGoal extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'goal_type', type: 'varchar', length: 2, comment: 'M/L1/L2/G1' })
  goalType!: string;

  @Column({ name: 'target_wt', type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '目标体重 kg' })
  targetWt?: string;

  @Column({ name: 'kcal_goal', type: 'int2', comment: '每日卡路里目标' })
  kcalGoal!: number;

  @Column({ name: 'carb_pct', type: 'int2', default: 50, comment: '碳水占比 %' })
  carbPct!: number;

  @Column({ name: 'prot_pct', type: 'int2', default: 25, comment: '蛋白占比 %' })
  protPct!: number;

  @Column({ name: 'fat_pct', type: 'int2', default: 25, comment: '脂肪占比 %' })
  fatPct!: number;

  @Column({ name: 'water_ml', type: 'int2', default: 2000, comment: '每日饮水目标 ml' })
  waterMl!: number;

  @Column({ name: 'is_current', type: 'varchar', length: 1, default: 'Y', comment: '是否当前生效 Y/N' })
  isCurrent!: string;

  @Column({ name: 'effective_at', type: 'timestamp' })
  effectiveAt!: Date;
}

@Entity({ name: 'user_remind', comment: '用户提醒配置' })
@Index('uk_user_remind_uk', ['userId', 'remindKind'], { unique: true, where: `del_flag = 'N'` })
export class UserRemind extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'remind_kind', type: 'varchar', length: 2, comment: 'B/L/D/W 饮水/F 断食' })
  remindKind!: string;

  @Column({ type: 'varchar', length: 1, default: 'Y', comment: '是否开启 Y/N' })
  enabled!: string;

  @Column({ name: 'remind_hour', type: 'int2', comment: '提醒小时 0-23' })
  remindHour!: number;

  @Column({ name: 'remind_min', type: 'int2', default: 0, comment: '提醒分钟 0-59' })
  remindMin!: number;

  @Column({ name: 'quiet_from', type: 'int2', nullable: true, comment: '静默起 小时' })
  quietFrom?: number;

  @Column({ name: 'quiet_to', type: 'int2', nullable: true, comment: '静默止 小时' })
  quietTo?: number;
}
