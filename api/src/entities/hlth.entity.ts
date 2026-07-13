import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'hlth_import', comment: 'Apple Health XML 导入历史' })
@Index('ix_hlth_import_user', ['userId', 'createTime'], { where: `del_flag = 'N'` })
@Index('ix_hlth_import_hash', ['userId', 'fileHash'], { where: `del_flag = 'N'` })
export class HlthImport extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6 })
  userId!: string;

  @Column({ name: 'file_key', type: 'varchar', length: 128, comment: '上传 ZIP 的 MinIO key' })
  fileKey!: string;

  @Column({ name: 'file_size', type: 'int4', nullable: true })
  fileSize?: number;

  @Column({ name: 'file_hash', type: 'varchar', length: 64, nullable: true, comment: 'SHA256 去重用' })
  fileHash?: string;

  @Column({ name: 'import_status', type: 'varchar', length: 1, default: 'P', comment: 'P 进行中 S 成功 F 失败' })
  importStatus!: string;

  @Column({ name: 'weight_cnt', type: 'int4', default: 0 })
  weightCnt!: number;

  @Column({ name: 'steps_cnt', type: 'int4', default: 0 })
  stepsCnt!: number;

  @Column({ name: 'hr_cnt', type: 'int4', default: 0 })
  hrCnt!: number;

  @Column({ name: 'workout_cnt', type: 'int4', default: 0 })
  workoutCnt!: number;

  @Column({ name: 'sleep_cnt', type: 'int4', default: 0 })
  sleepCnt!: number;

  @Column({ name: 'error_msg', type: 'varchar', length: 500, nullable: true })
  errorMsg?: string;

  @Column({ name: 'start_time', type: 'timestamp', nullable: true, comment: '数据时间范围起' })
  startTime?: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true, comment: '数据时间范围止' })
  endTime?: Date;

  @Column({ name: 'finish_time', type: 'timestamp', nullable: true, comment: '完成时间' })
  finishTime?: Date;
}
