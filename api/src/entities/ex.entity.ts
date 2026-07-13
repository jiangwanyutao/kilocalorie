import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'ex_type', comment: '运动类型库 MET 系数字典' })
@Index('ix_ex_type_spell', ['spellCode'], { where: `del_flag = 'N'` })
export class ExType extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 6 })
  id!: string;

  @Column({ name: 'type_name', type: 'varchar', length: 30 })
  typeName!: string;

  @Column({ name: 'spell_code', type: 'varchar', length: 20, nullable: true })
  spellCode?: string;

  @Column({ type: 'varchar', length: 1, comment: 'A 有氧 S 力量 F 柔韧 M 综合' })
  category!: string;

  @Column({ name: 'met_value', type: 'decimal', precision: 4, scale: 2, comment: 'MET 值' })
  metValue!: string;

  @Column({ type: 'varchar', length: 1, comment: 'L 低 M 中 H 高' })
  intensity!: string;

  @Column({ name: 'icon_key', type: 'varchar', length: 30, nullable: true })
  iconKey?: string;

  @Column({ type: 'varchar', length: 1, default: 'A' })
  status!: string;
}

@Entity({ name: 'ex_entry', comment: '运动记录' })
@Index('ix_ex_entry_user_date', ['userId', 'exDate'], { where: `del_flag = 'N'` })
export class ExEntry extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'type_id', type: 'varchar', length: 6, comment: 'ex_type.id' })
  typeId!: string;

  @Column({ name: 'type_name', type: 'varchar', length: 30, comment: '冗余名称' })
  typeName!: string;

  @Column({ name: 'ex_date', type: 'timestamp', comment: '当日 0 点' })
  exDate!: Date;

  @Column({ name: 'ex_time', type: 'timestamp', comment: '实际时间' })
  exTime!: Date;

  @Column({ name: 'duration_min', type: 'int2', comment: '时长 分钟' })
  durationMin!: number;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '冗余体重 估算用' })
  weightKg?: string;

  @Column({ name: 'kcal_burn', type: 'decimal', precision: 6, scale: 2, comment: '消耗卡路里' })
  kcalBurn!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note?: string;
}
