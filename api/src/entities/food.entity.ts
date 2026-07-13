import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'food_std', comment: '内置食物库' })
@Index('ix_food_std_spell', ['spellCode'], { where: `del_flag = 'N'` })
@Index('ix_food_std_cat', ['catCode'], { where: `del_flag = 'N'` })
@Index('ix_food_std_name', ['foodName'], { where: `del_flag = 'N'` })
export class FoodStd extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 6 })
  id!: string;

  @Column({ name: 'food_name', type: 'varchar', length: 50, comment: '食物名称' })
  foodName!: string;

  @Column({ name: 'spell_code', type: 'varchar', length: 20, nullable: true, comment: '拼音码' })
  spellCode?: string;

  @Column({ name: 'cat_code', type: 'varchar', length: 2, comment: '分类字典 01-12' })
  catCode!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '别名 逗号分隔' })
  alias?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '品牌 预包装食品' })
  brand?: string;

  @Column({ name: 'unit_g', type: 'int2', default: 100, comment: '基准克数' })
  unitG!: number;

  @Column({ name: 'portion_g', type: 'int2', nullable: true, comment: '一份 = 多少克' })
  portionG?: number;

  @Column({ name: 'portion_desc', type: 'varchar', length: 30, nullable: true, comment: '一份的描述' })
  portionDesc?: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, comment: '卡路里' })
  kcal!: string;

  @Column({ name: 'carb_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  carbG!: string;

  @Column({ name: 'prot_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  protG!: string;

  @Column({ name: 'fat_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  fatG!: string;

  @Column({ name: 'fiber_g', type: 'decimal', precision: 6, scale: 2, nullable: true })
  fiberG?: string;

  @Column({ name: 'sugar_g', type: 'decimal', precision: 6, scale: 2, nullable: true })
  sugarG?: string;

  @Column({ name: 'sodium_mg', type: 'decimal', precision: 8, scale: 2, nullable: true })
  sodiumMg?: string;

  @Column({ name: 'cholesterol_mg', type: 'decimal', precision: 8, scale: 2, nullable: true })
  cholesterolMg?: string;

  @Column({ name: 'micro_json', type: 'jsonb', nullable: true, comment: '微量元素 钙铁锌+维生素' })
  microJson?: Record<string, unknown>;

  @Column({ name: 'low_cal_flag', type: 'varchar', length: 1, default: 'N', comment: '低卡标签 Y/N' })
  lowCalFlag!: string;

  @Column({ name: 'high_prot_flag', type: 'varchar', length: 1, default: 'N', comment: '高蛋白标签 Y/N' })
  highProtFlag!: string;

  @Column({ name: 'source_ref', type: 'varchar', length: 100, nullable: true, comment: '数据来源' })
  sourceRef?: string;

  @Column({ type: 'varchar', length: 1, default: 'A', comment: 'A 正常 D 已下架' })
  status!: string;
}

@Entity({ name: 'food_user', comment: '用户私人食物库' })
@Index('ix_food_user_uid', ['userId', 'useCount'], { where: `del_flag = 'N'` })
@Index('ix_food_user_spell', ['userId', 'spellCode'], { where: `del_flag = 'N'` })
export class FoodUser extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'food_name', type: 'varchar', length: 50 })
  foodName!: string;

  @Column({ name: 'spell_code', type: 'varchar', length: 20, nullable: true })
  spellCode?: string;

  @Column({ name: 'cat_code', type: 'varchar', length: 2, nullable: true })
  catCode?: string;

  @Column({ name: 'unit_g', type: 'int2', default: 100 })
  unitG!: number;

  @Column({ name: 'portion_g', type: 'int2', nullable: true })
  portionG?: number;

  @Column({ name: 'portion_desc', type: 'varchar', length: 30, nullable: true })
  portionDesc?: string;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  kcal!: string;

  @Column({ name: 'carb_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  carbG!: string;

  @Column({ name: 'prot_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  protG!: string;

  @Column({ name: 'fat_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  fatG!: string;

  @Column({ name: 'micro_json', type: 'jsonb', nullable: true })
  microJson?: Record<string, unknown>;

  @Column({ name: 'photo_key', type: 'varchar', length: 128, nullable: true, comment: '参考图 MinIO key' })
  photoKey?: string;

  @Column({ name: 'use_count', type: 'int4', default: 0, comment: '使用次数 排序用' })
  useCount!: number;
}
