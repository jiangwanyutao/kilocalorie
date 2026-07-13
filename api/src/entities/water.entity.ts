import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'water_entry', comment: '饮水记录' })
@Index('ix_water_entry_user_date', ['userId', 'drinkDate'], { where: `del_flag = 'N'` })
export class WaterEntry extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'drink_time', type: 'timestamp', comment: '饮水时间' })
  drinkTime!: Date;

  @Column({ name: 'drink_date', type: 'timestamp', comment: '当日 0 点 汇总用' })
  drinkDate!: Date;

  @Column({ name: 'drink_type', type: 'varchar', length: 1, default: 'W', comment: 'W 白水 T 茶 C 咖啡 J 果汁 S 汤' })
  drinkType!: string;

  @Column({ name: 'volume_ml', type: 'int2', comment: '实际饮用毫升' })
  volumeMl!: number;

  @Column({ name: 'effective_ml', type: 'int2', comment: '折算等效饮水毫升' })
  effectiveMl!: number;
}
