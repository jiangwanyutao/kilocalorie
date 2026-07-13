import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'sys_dict', comment: '系统字典表' })
@Index('uk_sys_dict_type_code', ['dictType', 'dictCode'], { unique: true, where: `del_flag = 'N'` })
@Index('ix_sys_dict_type', ['dictType'], { where: `del_flag = 'N'` })
export class SysDict extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10, comment: '字典 ID' })
  id!: string;

  @Column({ name: 'dict_type', type: 'varchar', length: 30, comment: '字典类型 如 meal_type' })
  dictType!: string;

  @Column({ name: 'dict_code', type: 'varchar', length: 10, comment: '字典编码' })
  dictCode!: string;

  @Column({ name: 'dict_name', type: 'varchar', length: 50, comment: '字典名称' })
  dictName!: string;

  @Column({ name: 'ext_val', type: 'varchar', length: 50, nullable: true, comment: '扩展值 如活动系数 1.375' })
  extVal?: string;

  @Column({ name: 'sort_no', type: 'int2', default: 0, comment: '排序号' })
  sortNo!: number;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '备注' })
  remark?: string;
}

@Entity({ name: 'sys_login_log', comment: '登录日志' })
@Index('ix_login_log_user', ['userId', 'loginTime'])
@Index('ix_login_log_time', ['loginTime'])
export class SysLoginLog extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6, nullable: true, comment: '用户 ID 失败可能空' })
  userId?: string;

  @Column({ name: 'login_email', type: 'varchar', length: 80, nullable: true, comment: '登录邮箱' })
  loginEmail?: string;

  @Column({ name: 'login_ip', type: 'varchar', length: 45, comment: '登录 IP' })
  loginIp!: string;

  @Column({ name: 'login_ua', type: 'varchar', length: 200, nullable: true, comment: 'User-Agent' })
  loginUa?: string;

  @Column({ name: 'login_status', type: 'varchar', length: 1, comment: 'S 成功 F 失败 O 登出' })
  loginStatus!: string;

  @Column({ name: 'fail_reason', type: 'varchar', length: 50, nullable: true, comment: '失败原因' })
  failReason?: string;

  @Column({ name: 'login_time', type: 'timestamp', comment: '登录时间' })
  loginTime!: Date;
}

@Entity({ name: 'sys_op_log', comment: '敏感操作审计日志' })
@Index('ix_op_log_user', ['userId', 'opTime'])
export class SysOpLog extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 6, comment: '操作人 user_id' })
  userId!: string;

  @Column({ name: 'op_type', type: 'varchar', length: 20, comment: '类型 delete_account/export_data 等' })
  opType!: string;

  @Column({ name: 'op_module', type: 'varchar', length: 20, nullable: true, comment: '模块名' })
  opModule?: string;

  @Column({ name: 'op_desc', type: 'varchar', length: 200, nullable: true, comment: '描述' })
  opDesc?: string;

  @Column({ name: 'op_ip', type: 'varchar', length: 45, nullable: true, comment: 'IP' })
  opIp?: string;

  @Column({ name: 'op_status', type: 'varchar', length: 1, comment: 'S 成功 F 失败' })
  opStatus!: string;

  @Column({ name: 'op_time', type: 'timestamp', comment: '操作时间' })
  opTime!: Date;
}
