import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'body_weight', comment: '体重记录' })
@Index('ix_body_weight_user_date', ['userId', 'measDate'], { where: `del_flag = 'N'` })
export class BodyWeight extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'meas_time', type: 'timestamp' })
  measTime!: Date;

  @Column({ name: 'meas_date', type: 'timestamp', comment: '当日 0 点' })
  measDate!: Date;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 5, scale: 2, comment: '体重 kg' })
  weightKg!: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, comment: 'BMI 后端算好存' })
  bmi?: string;

  @Column({ name: 'entry_src', type: 'varchar', length: 1, default: 'M', comment: 'M 手动 H Apple Health' })
  entrySrc!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  note?: string;
}

@Entity({ name: 'body_measure', comment: '围度与体脂记录' })
@Index('ix_body_measure_user_date', ['userId', 'measDate'], { where: `del_flag = 'N'` })
export class BodyMeasure extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'meas_time', type: 'timestamp' })
  measTime!: Date;

  @Column({ name: 'meas_date', type: 'timestamp' })
  measDate!: Date;

  @Column({ name: 'waist_cm', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '腰围' })
  waistCm?: string;

  @Column({ name: 'hip_cm', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '臀围' })
  hipCm?: string;

  @Column({ name: 'chest_cm', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '胸围' })
  chestCm?: string;

  @Column({ name: 'thigh_cm', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '大腿围' })
  thighCm?: string;

  @Column({ name: 'arm_cm', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '上臂围' })
  armCm?: string;

  @Column({ name: 'body_fat_pct', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '体脂率' })
  bodyFatPct?: string;

  @Column({ name: 'muscle_kg', type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '肌肉量' })
  muscleKg?: string;

  @Column({ name: 'water_pct', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '水分率' })
  waterPct?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  note?: string;
}

@Entity({ name: 'body_steps', comment: '每日步数 主要由 Apple Health 灌入' })
@Index('uk_body_steps_uk', ['userId', 'stepDate'], { unique: true, where: `del_flag = 'N'` })
export class BodySteps extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'step_date', type: 'timestamp', comment: '当日 0 点' })
  stepDate!: Date;

  @Column({ name: 'step_count', type: 'int4', comment: '步数' })
  stepCount!: number;

  @Column({ name: 'distance_m', type: 'int4', nullable: true, comment: '距离米' })
  distanceM?: number;

  @Column({ name: 'kcal_burn', type: 'decimal', precision: 6, scale: 2, nullable: true, comment: '消耗估算' })
  kcalBurn?: string;

  @Column({ name: 'entry_src', type: 'varchar', length: 1, default: 'H', comment: 'H Apple Health M 手动' })
  entrySrc!: string;
}

@Entity({ name: 'body_sleep', comment: '每晚睡眠 主要由 Apple Health 灌入' })
@Index('uk_body_sleep_uk', ['userId', 'sleepDate'], { unique: true, where: `del_flag = 'N'` })
export class BodySleep extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'sleep_date', type: 'timestamp', comment: '起床日 0 点 · 一晚归属于醒来那天' })
  sleepDate!: Date;

  @Column({ name: 'in_bed_time', type: 'timestamp', nullable: true, comment: '上床时间' })
  inBedTime?: Date;

  @Column({ name: 'wake_time', type: 'timestamp', nullable: true, comment: '起床时间' })
  wakeTime?: Date;

  @Column({ name: 'asleep_min', type: 'int2', comment: '实际睡眠时长 分钟' })
  asleepMin!: number;

  @Column({ name: 'in_bed_min', type: 'int2', nullable: true, comment: '在床总时长' })
  inBedMin?: number;

  @Column({ name: 'deep_min', type: 'int2', nullable: true })
  deepMin?: number;

  @Column({ name: 'rem_min', type: 'int2', nullable: true })
  remMin?: number;

  @Column({ name: 'entry_src', type: 'varchar', length: 1, default: 'H', comment: 'H Apple Health M 手动' })
  entrySrc!: string;
}
