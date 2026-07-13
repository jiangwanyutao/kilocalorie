import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'meal_entry', comment: '就餐记录' })
@Index('ix_meal_entry_user_date', ['userId', 'mealDate'], { where: `del_flag = 'N'` })
@Index('ix_meal_entry_time', ['userId', 'mealTime'], { where: `del_flag = 'N'` })
export class MealEntry extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'meal_date', type: 'timestamp', comment: '就餐当天 0 点' })
  mealDate!: Date;

  @Column({ name: 'meal_time', type: 'timestamp', comment: '实际就餐时间' })
  mealTime!: Date;

  @Column({ name: 'meal_type', type: 'varchar', length: 1, comment: 'B 早 L 中 D 晚 S 加餐' })
  mealType!: string;

  @Column({ name: 'entry_src', type: 'varchar', length: 1, default: 'M', comment: 'M 手动 A AI D 外卖 V 语音' })
  entrySrc!: string;

  @Column({ name: 'total_kcal', type: 'decimal', precision: 7, scale: 2, default: 0, comment: '该餐总卡（冗余）' })
  totalKcal!: string;

  @Column({ name: 'total_carb', type: 'decimal', precision: 6, scale: 2, default: 0 })
  totalCarb!: string;

  @Column({ name: 'total_prot', type: 'decimal', precision: 6, scale: 2, default: 0 })
  totalProt!: string;

  @Column({ name: 'total_fat', type: 'decimal', precision: 6, scale: 2, default: 0 })
  totalFat!: string;

  @Column({ name: 'photo_id', type: 'varchar', length: 12, nullable: true, comment: '关联 meal_photo.id' })
  photoId?: string;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '备注' })
  note?: string;
}

@Entity({ name: 'meal_item', comment: '就餐食物条目' })
@Index('ix_meal_item_entry', ['entryId'], { where: `del_flag = 'N'` })
@Index('ix_meal_item_user_food', ['userId', 'foodId'], { where: `del_flag = 'N'` })
export class MealItem extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 14 })
  id!: string;

  @Column({ name: 'entry_id', type: 'varchar', length: 12, comment: '所属 meal_entry.id' })
  entryId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6, comment: '冗余 便于按用户查询' })
  userId!: string;

  @Column({ name: 'food_id', type: 'varchar', length: 10, comment: '食物 ID 取 food_user 上限' })
  foodId!: string;

  @Column({ name: 'food_src', type: 'varchar', length: 1, comment: 'S 内置 U 私人' })
  foodSrc!: string;

  @Column({ name: 'food_name', type: 'varchar', length: 50, comment: '冗余食物名 防历史失效' })
  foodName!: string;

  @Column({ name: 'portion_mode', type: 'varchar', length: 1, default: 'P', comment: 'P 份 G 克' })
  portionMode!: string;

  @Column({ name: 'portion_qty', type: 'decimal', precision: 6, scale: 2, comment: '份量数值' })
  portionQty!: string;

  @Column({ name: 'actual_g', type: 'decimal', precision: 7, scale: 2, comment: '折算实际克数' })
  actualG!: string;

  @Column({ type: 'decimal', precision: 7, scale: 2 })
  kcal!: string;

  @Column({ name: 'carb_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  carbG!: string;

  @Column({ name: 'prot_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  protG!: string;

  @Column({ name: 'fat_g', type: 'decimal', precision: 6, scale: 2, default: 0 })
  fatG!: string;

  @Column({ name: 'ai_confidence', type: 'decimal', precision: 3, scale: 2, nullable: true, comment: 'AI 置信度 0-1' })
  aiConfidence?: string;

  @Column({ name: 'sort_no', type: 'int2', default: 0 })
  sortNo!: number;
}

@Entity({ name: 'meal_photo', comment: '饮食拍照原图' })
@Index('ix_meal_photo_user', ['userId', 'createTime'], { where: `del_flag = 'N'` })
@Index('ix_meal_photo_entry', ['entryId'], { where: `del_flag = 'N'` })
export class MealPhoto extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'entry_id', type: 'varchar', length: 12, nullable: true, comment: '关联 meal_entry.id' })
  entryId?: string;

  @Column({ name: 'photo_type', type: 'varchar', length: 1, comment: 'M 餐食 D 外卖截图' })
  photoType!: string;

  @Column({ name: 'object_key', type: 'varchar', length: 128, comment: 'MinIO object key' })
  objectKey!: string;

  @Column({ name: 'bucket_name', type: 'varchar', length: 30, comment: 'bucket 名' })
  bucketName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 30, comment: '内容类型' })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'int4', comment: '字节数' })
  fileSize!: number;

  @Column({ name: 'width_px', type: 'int2', nullable: true })
  widthPx?: number;

  @Column({ name: 'height_px', type: 'int2', nullable: true })
  heightPx?: number;

  @Column({ name: 'ai_provider', type: 'varchar', length: 20, nullable: true, comment: 'deepseek/qwen' })
  aiProvider?: string;

  @Column({ name: 'ai_raw', type: 'jsonb', nullable: true, comment: 'AI 原始返回' })
  aiRaw?: Record<string, unknown>;

  @Column({ name: 'ai_cost', type: 'decimal', precision: 10, scale: 4, nullable: true, comment: '本次识别费用' })
  aiCost?: string;

  @Column({ name: 'recognize_time', type: 'timestamp', nullable: true, comment: '识别完成时间' })
  recognizeTime?: Date;
}
