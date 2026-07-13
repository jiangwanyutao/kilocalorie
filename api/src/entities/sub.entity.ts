import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

/** 订阅相关（V1 预留，付费墙上线时启用） */

@Entity({ name: 'sub_plan', comment: '订阅计划（V1 预留）' })
export class SubPlan extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 6 })
  id!: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 30, comment: '月度/年度/终身' })
  planName!: string;

  @Column({ name: 'plan_code', type: 'varchar', length: 10, comment: 'monthly/yearly/lifetime' })
  planCode!: string;

  @Column({ name: 'vip_lvl', type: 'varchar', length: 1, comment: '1/2/3' })
  vipLvl!: string;

  @Column({ name: 'duration_days', type: 'int2', nullable: true, comment: '时长 终身空' })
  durationDays?: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  price!: string;

  @Column({ type: 'varchar', length: 3, default: 'CNY' })
  currency!: string;

  @Column({ name: 'desc_text', type: 'varchar', length: 200, nullable: true })
  descText?: string;

  @Column({ type: 'varchar', length: 1, default: 'A' })
  status!: string;
}

@Entity({ name: 'sub_order', comment: '订阅订单（V1 预留）' })
@Index('uk_sub_order_no', ['orderNo'], { unique: true, where: `del_flag = 'N'` })
@Index('ix_sub_order_user', ['userId', 'createTime'], { where: `del_flag = 'N'` })
export class SubOrder extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'plan_id', type: 'varchar', length: 6 })
  planId!: string;

  @Column({ name: 'order_no', type: 'varchar', length: 30, comment: '对外订单号' })
  orderNo!: string;

  @Column({ name: 'pay_channel', type: 'varchar', length: 2, nullable: true, comment: 'WX/AL/AP' })
  payChannel?: string;

  @Column({ name: 'pay_amount', type: 'decimal', precision: 10, scale: 4 })
  payAmount!: string;

  @Column({ name: 'pay_currency', type: 'varchar', length: 3, default: 'CNY' })
  payCurrency!: string;

  @Column({ name: 'pay_status', type: 'varchar', length: 1, default: 'P', comment: 'P 待付 S 成功 F 失败 R 退款' })
  payStatus!: string;

  @Column({ name: 'pay_time', type: 'timestamp', nullable: true })
  payTime?: Date;

  @Column({ name: 'tx_id', type: 'varchar', length: 64, nullable: true, comment: '三方交易号' })
  txId?: string;
}

@Entity({ name: 'sub_member', comment: '会员生效状态（V1 预留）' })
@Index('ix_sub_member_user', ['userId', 'status'], { where: `del_flag = 'N'` })
export class SubMember extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'vip_lvl', type: 'varchar', length: 1, comment: '1/2/3' })
  vipLvl!: string;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime!: Date;

  @Column({ name: 'expire_time', type: 'timestamp', nullable: true, comment: '终身空' })
  expireTime?: Date;

  @Column({ name: 'order_id', type: 'varchar', length: 12, nullable: true, comment: '来源订单' })
  orderId?: string;

  @Column({ type: 'varchar', length: 1, default: 'A', comment: 'A 生效 E 过期 R 退款' })
  status!: string;
}
