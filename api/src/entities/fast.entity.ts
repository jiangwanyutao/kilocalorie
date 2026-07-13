import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'fast_session', comment: '轻断食会话' })
@Index('ix_fast_session_user', ['userId', 'startTime'], { where: `del_flag = 'N'` })
@Index('ix_fast_session_running', ['userId'], { where: `status = 'R' AND del_flag = 'N'` })
export class FastSession extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'plan_code', type: 'varchar', length: 2, comment: '14/16/18/52' })
  planCode!: string;

  @Column({ name: 'start_time', type: 'timestamp', comment: '开始时间' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true, comment: '实际结束时间' })
  endTime?: Date;

  @Column({ name: 'plan_end_time', type: 'timestamp', comment: '计划结束时间' })
  planEndTime!: Date;

  @Column({ type: 'varchar', length: 1, default: 'R', comment: 'R 进行中 C 完成 A 中止' })
  status!: string;

  @Column({ name: 'actual_hours', type: 'decimal', precision: 4, scale: 2, nullable: true, comment: '实际断食小时数' })
  actualHours?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note?: string;
}
