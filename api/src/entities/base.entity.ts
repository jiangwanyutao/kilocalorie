import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * HIS 通用字段基类
 * 使用 TypeORM PrimaryColumn（各子类自定义主键长度） + 本类提供的 7 个通用字段
 */
export abstract class BaseEntity {
  @CreateDateColumn({ name: 'create_time', type: 'timestamp', comment: '创建时间' })
  createTime!: Date;

  @Column({ name: 'create_by', type: 'varchar', length: 6, nullable: true, comment: '创建人 user_id' })
  createBy?: string;

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp', comment: '更新时间' })
  updateTime!: Date;

  @Column({ name: 'update_by', type: 'varchar', length: 6, nullable: true, comment: '更新人 user_id' })
  updateBy?: string;

  @Column({ name: 'del_flag', type: 'varchar', length: 1, default: 'N', comment: '删除标志 N 未删 Y 已删' })
  delFlag!: string;

  @Column({ name: 'delete_time', type: 'timestamp', nullable: true, comment: '删除时间' })
  deleteTime?: Date;

  @Column({ name: 'delete_by', type: 'varchar', length: 6, nullable: true, comment: '删除人 user_id' })
  deleteBy?: string;
}

/** 删除标志常量 */
export const DelFlag = {
  Active: 'N',
  Deleted: 'Y',
} as const;

/** 通用状态：账号 / 记录生命周期 */
export const CommonStatus = {
  Active: 'A',
  Disabled: 'D',
  Frozen: 'F',
} as const;

/** 字典类型（对应 sys_dict.dict_type） */
export const DictType = {
  MealType: 'meal_type',
  Gender: 'gender',
  ActivityLvl: 'activity_lvl',
  GoalType: 'goal_type',
  PersonaCode: 'persona_code',
  CatCode: 'cat_code',
  DrinkType: 'drink_type',
  PhotoType: 'photo_type',
  EntrySrc: 'entry_src',
  PlanCode: 'plan_code',
  UsageKind: 'usage_kind',
  MemType: 'mem_type',
} as const;

/** 主键长度约定（与 IdGeneratorService.TABLE_ID_LEN 对齐） */
export const TableIdLen = {
  sys_dict: 10,
  sys_login_log: 10,
  sys_op_log: 10,
  user_info: 6,
  user_auth: 6,
  user_session: 10,
  user_verify: 10,
  user_goal: 10,
  user_remind: 10,
  food_std: 6,
  food_user: 10,
  meal_entry: 12,
  meal_item: 14,
  meal_photo: 12,
  water_entry: 12,
  ex_type: 6,
  ex_entry: 12,
  body_weight: 10,
  body_measure: 10,
  body_steps: 12,
  body_sleep: 12,
  fast_session: 10,
  ai_conv: 12,
  ai_msg: 14,
  ai_usage: 12,
  ai_memory: 12,
  ai_memory_log: 14,
  ai_kb_doc: 10,
  ai_kb_chunk: 12,
  hlth_import: 10,
  sub_plan: 6,
  sub_order: 12,
  sub_member: 10,
} as const;

export type TableName = keyof typeof TableIdLen;
