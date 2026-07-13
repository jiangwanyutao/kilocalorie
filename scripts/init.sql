-- ============================================================
-- 千卡日记 · Qianka Diary · V1 数据库初始化
-- 目标库：kilocalorie (postgres 16.10 + pgvector 0.7.4)
-- 使用：psql -U kilocalorie -d kilocalorie -f scripts/init.sql
-- ============================================================

SET client_encoding = 'UTF8';
SET client_min_messages = warning;

CREATE EXTENSION IF NOT EXISTS vector;

-- ============ 08 · 系统 sys_* ============

DROP TABLE IF EXISTS sys_dict CASCADE;
CREATE TABLE sys_dict (
  id            varchar(10)  NOT NULL,
  dict_type     varchar(30)  NOT NULL,
  dict_code     varchar(10)  NOT NULL,
  dict_name     varchar(50)  NOT NULL,
  ext_val       varchar(50),
  sort_no       int2         NOT NULL DEFAULT 0,
  remark        varchar(200),
  del_flag      varchar(1)   NOT NULL DEFAULT 'N',
  create_time   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by     varchar(6),
  update_time   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by     varchar(6),
  delete_time   timestamp,
  delete_by     varchar(6),
  CONSTRAINT pk_sys_dict PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_sys_dict_type_code ON sys_dict(dict_type, dict_code) WHERE del_flag = 'N';
CREATE INDEX ix_sys_dict_type ON sys_dict(dict_type) WHERE del_flag = 'N';
COMMENT ON TABLE  sys_dict IS '系统字典表';

DROP TABLE IF EXISTS sys_login_log CASCADE;
CREATE TABLE sys_login_log (
  id            varchar(10)  NOT NULL,
  user_id       varchar(6),
  login_email   varchar(80),
  login_ip      varchar(45)  NOT NULL,
  login_ua      varchar(200),
  login_status  varchar(1)   NOT NULL,
  fail_reason   varchar(50),
  login_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_time   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by     varchar(6),
  update_time   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by     varchar(6),
  del_flag      varchar(1)   NOT NULL DEFAULT 'N',
  delete_time   timestamp,
  delete_by     varchar(6),
  CONSTRAINT pk_sys_login_log PRIMARY KEY (id)
);
CREATE INDEX ix_login_log_user ON sys_login_log(user_id, login_time DESC);
CREATE INDEX ix_login_log_time ON sys_login_log(login_time DESC);
COMMENT ON TABLE sys_login_log IS '登录日志 S 成功 F 失败 O 登出';

DROP TABLE IF EXISTS sys_op_log CASCADE;
CREATE TABLE sys_op_log (
  id            varchar(10)  NOT NULL,
  user_id       varchar(6)   NOT NULL,
  op_type       varchar(20)  NOT NULL,
  op_module     varchar(20),
  op_desc       varchar(200),
  op_ip         varchar(45),
  op_status     varchar(1)   NOT NULL,
  op_time       timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_time   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by     varchar(6),
  update_time   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by     varchar(6),
  del_flag      varchar(1)   NOT NULL DEFAULT 'N',
  delete_time   timestamp,
  delete_by     varchar(6),
  CONSTRAINT pk_sys_op_log PRIMARY KEY (id)
);
CREATE INDEX ix_op_log_user ON sys_op_log(user_id, op_time DESC);
COMMENT ON TABLE sys_op_log IS '敏感操作审计日志';

-- ============ 09 · 用户 user_* ============

DROP TABLE IF EXISTS user_info CASCADE;
CREATE TABLE user_info (
  id             varchar(6)   NOT NULL,
  nickname       varchar(30)  NOT NULL,
  email          varchar(80)  NOT NULL,
  avatar_key     varchar(128),
  gender         varchar(1)   NOT NULL DEFAULT 'U',
  birth_year     int2,
  height_cm      decimal(5,1),
  activity_lvl   varchar(1)   NOT NULL DEFAULT '2',
  bmr_kcal       int2,
  tdee_kcal      int2,
  vip_lvl        varchar(1)   NOT NULL DEFAULT '0',
  vip_expire     timestamp,
  reg_ip         varchar(45),
  reg_ua         varchar(200),
  email_verified varchar(1)   NOT NULL DEFAULT 'N',
  status         varchar(1)   NOT NULL DEFAULT 'A',
  last_login     timestamp,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_user_info PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_user_email ON user_info(email) WHERE del_flag = 'N';
COMMENT ON TABLE user_info IS '用户主表 gender M/F/U activity 1-5 status A/D/F';

DROP TABLE IF EXISTS user_auth CASCADE;
CREATE TABLE user_auth (
  id             varchar(6)   NOT NULL,
  pwd_hash       varchar(80)  NOT NULL,
  pwd_ver        int2         NOT NULL DEFAULT 1,
  pwd_reset_at   timestamp,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_user_auth PRIMARY KEY (id)
);
COMMENT ON TABLE user_auth IS '用户密码认证 bcrypt hash + pwd_ver 密码版本';

DROP TABLE IF EXISTS user_session CASCADE;
CREATE TABLE user_session (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  refresh_token  varchar(64)  NOT NULL,
  device_info    varchar(200),
  ip_addr        varchar(45),
  expire_time    timestamp    NOT NULL,
  revoked        varchar(1)   NOT NULL DEFAULT 'N',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_user_session PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_user_session_token ON user_session(refresh_token) WHERE del_flag = 'N';
CREATE INDEX ix_user_session_user ON user_session(user_id) WHERE del_flag = 'N';
COMMENT ON TABLE user_session IS '用户会话 JWT refresh token';

DROP TABLE IF EXISTS user_verify CASCADE;
CREATE TABLE user_verify (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6),
  email          varchar(80)  NOT NULL,
  verify_type    varchar(1)   NOT NULL,
  verify_token   varchar(64)  NOT NULL,
  used_flag      varchar(1)   NOT NULL DEFAULT 'N',
  expire_time    timestamp    NOT NULL,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_user_verify PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_user_verify_token ON user_verify(verify_token) WHERE del_flag = 'N';
CREATE INDEX ix_user_verify_email ON user_verify(email, verify_type) WHERE del_flag = 'N';
COMMENT ON TABLE user_verify IS '邮箱验证/密码重置 V 注册 R 重置 E 换绑';

DROP TABLE IF EXISTS user_goal CASCADE;
CREATE TABLE user_goal (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  goal_type      varchar(2)   NOT NULL,
  target_wt      decimal(5,2),
  kcal_goal      int2         NOT NULL,
  carb_pct       int2         NOT NULL DEFAULT 50,
  prot_pct       int2         NOT NULL DEFAULT 25,
  fat_pct        int2         NOT NULL DEFAULT 25,
  water_ml       int2         NOT NULL DEFAULT 2000,
  is_current     varchar(1)   NOT NULL DEFAULT 'Y',
  effective_at   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_user_goal PRIMARY KEY (id)
);
CREATE INDEX ix_user_goal_user ON user_goal(user_id, is_current) WHERE del_flag = 'N';
COMMENT ON TABLE user_goal IS '用户目标 M 维持 L1/L2 减脂 G1 增肌';

DROP TABLE IF EXISTS user_remind CASCADE;
CREATE TABLE user_remind (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  remind_kind    varchar(2)   NOT NULL,
  enabled        varchar(1)   NOT NULL DEFAULT 'Y',
  remind_hour    int2         NOT NULL,
  remind_min     int2         NOT NULL DEFAULT 0,
  quiet_from     int2,
  quiet_to       int2,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_user_remind PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_user_remind_uk ON user_remind(user_id, remind_kind) WHERE del_flag = 'N';
COMMENT ON TABLE user_remind IS '提醒配置 B/L/D/W 饮水 /F 断食';

-- ============ 10 · 食物 food_* ============

DROP TABLE IF EXISTS food_std CASCADE;
CREATE TABLE food_std (
  id             varchar(6)   NOT NULL,
  food_name      varchar(50)  NOT NULL,
  spell_code     varchar(20),
  cat_code       varchar(2)   NOT NULL,
  alias          varchar(100),
  brand          varchar(50),
  unit_g         int2         NOT NULL DEFAULT 100,
  portion_g      int2,
  portion_desc   varchar(30),
  kcal           decimal(6,2) NOT NULL,
  carb_g         decimal(6,2) NOT NULL DEFAULT 0,
  prot_g         decimal(6,2) NOT NULL DEFAULT 0,
  fat_g          decimal(6,2) NOT NULL DEFAULT 0,
  fiber_g        decimal(6,2),
  sugar_g        decimal(6,2),
  sodium_mg      decimal(8,2),
  cholesterol_mg decimal(8,2),
  micro_json     jsonb,
  low_cal_flag   varchar(1)   NOT NULL DEFAULT 'N',
  high_prot_flag varchar(1)   NOT NULL DEFAULT 'N',
  source_ref     varchar(100),
  status         varchar(1)   NOT NULL DEFAULT 'A',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_food_std PRIMARY KEY (id)
);
CREATE INDEX ix_food_std_spell ON food_std(spell_code) WHERE del_flag = 'N';
CREATE INDEX ix_food_std_cat ON food_std(cat_code) WHERE del_flag = 'N';
CREATE INDEX ix_food_std_name ON food_std(food_name) WHERE del_flag = 'N';
COMMENT ON TABLE food_std IS '内置食物库';

DROP TABLE IF EXISTS food_user CASCADE;
CREATE TABLE food_user (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  food_name      varchar(50)  NOT NULL,
  spell_code     varchar(20),
  cat_code       varchar(2),
  unit_g         int2         NOT NULL DEFAULT 100,
  portion_g      int2,
  portion_desc   varchar(30),
  kcal           decimal(6,2) NOT NULL,
  carb_g         decimal(6,2) NOT NULL DEFAULT 0,
  prot_g         decimal(6,2) NOT NULL DEFAULT 0,
  fat_g          decimal(6,2) NOT NULL DEFAULT 0,
  micro_json     jsonb,
  photo_key      varchar(128),
  use_count      int4         NOT NULL DEFAULT 0,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_food_user PRIMARY KEY (id)
);
CREATE INDEX ix_food_user_uid ON food_user(user_id, use_count DESC) WHERE del_flag = 'N';
CREATE INDEX ix_food_user_spell ON food_user(user_id, spell_code) WHERE del_flag = 'N';
COMMENT ON TABLE food_user IS '用户私人食物库';

-- ============ 11 · 饮食 meal_* ============

DROP TABLE IF EXISTS meal_entry CASCADE;
CREATE TABLE meal_entry (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  meal_date      timestamp    NOT NULL,
  meal_time      timestamp    NOT NULL,
  meal_type      varchar(1)   NOT NULL,
  entry_src      varchar(1)   NOT NULL DEFAULT 'M',
  total_kcal     decimal(7,2) NOT NULL DEFAULT 0,
  total_carb     decimal(6,2) NOT NULL DEFAULT 0,
  total_prot     decimal(6,2) NOT NULL DEFAULT 0,
  total_fat      decimal(6,2) NOT NULL DEFAULT 0,
  photo_id       varchar(12),
  note           varchar(200),
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_meal_entry PRIMARY KEY (id)
);
CREATE INDEX ix_meal_entry_user_date ON meal_entry(user_id, meal_date DESC) WHERE del_flag = 'N';
CREATE INDEX ix_meal_entry_time ON meal_entry(user_id, meal_time DESC) WHERE del_flag = 'N';
COMMENT ON TABLE meal_entry IS '就餐记录 meal_type B/L/D/S entry_src M/A/D/V';

DROP TABLE IF EXISTS meal_item CASCADE;
CREATE TABLE meal_item (
  id             varchar(14)  NOT NULL,
  entry_id       varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  food_id        varchar(10)  NOT NULL,
  food_src       varchar(1)   NOT NULL,
  food_name      varchar(50)  NOT NULL,
  portion_mode   varchar(1)   NOT NULL DEFAULT 'P',
  portion_qty    decimal(6,2) NOT NULL,
  actual_g       decimal(7,2) NOT NULL,
  kcal           decimal(7,2) NOT NULL,
  carb_g         decimal(6,2) NOT NULL DEFAULT 0,
  prot_g         decimal(6,2) NOT NULL DEFAULT 0,
  fat_g          decimal(6,2) NOT NULL DEFAULT 0,
  ai_confidence  decimal(3,2),
  sort_no        int2         NOT NULL DEFAULT 0,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_meal_item PRIMARY KEY (id)
);
CREATE INDEX ix_meal_item_entry ON meal_item(entry_id) WHERE del_flag = 'N';
CREATE INDEX ix_meal_item_user_food ON meal_item(user_id, food_id) WHERE del_flag = 'N';
COMMENT ON TABLE meal_item IS '就餐食物条目 food_src S 内置 U 私人 portion_mode P/G';

DROP TABLE IF EXISTS meal_photo CASCADE;
CREATE TABLE meal_photo (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  entry_id       varchar(12),
  photo_type     varchar(1)   NOT NULL,
  object_key     varchar(128) NOT NULL,
  bucket_name    varchar(30)  NOT NULL,
  mime_type      varchar(30)  NOT NULL,
  file_size      int4         NOT NULL,
  width_px       int2,
  height_px      int2,
  ai_provider    varchar(20),
  ai_raw         jsonb,
  ai_cost        decimal(10,4),
  recognize_time timestamp,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_meal_photo PRIMARY KEY (id)
);
CREATE INDEX ix_meal_photo_user ON meal_photo(user_id, create_time DESC) WHERE del_flag = 'N';
CREATE INDEX ix_meal_photo_entry ON meal_photo(entry_id) WHERE del_flag = 'N';
COMMENT ON TABLE meal_photo IS '饮食拍照原图 photo_type M 餐食 D 外卖截图';

-- ============ 12 · 饮水 water / 运动 ex / 体测 body ============

DROP TABLE IF EXISTS water_entry CASCADE;
CREATE TABLE water_entry (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  drink_time     timestamp    NOT NULL,
  drink_date     timestamp    NOT NULL,
  drink_type     varchar(1)   NOT NULL DEFAULT 'W',
  volume_ml      int2         NOT NULL,
  effective_ml   int2         NOT NULL,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_water_entry PRIMARY KEY (id)
);
CREATE INDEX ix_water_entry_user_date ON water_entry(user_id, drink_date DESC) WHERE del_flag = 'N';
COMMENT ON TABLE water_entry IS '饮水 W 白水 T 茶 C 咖啡 J 果汁 S 汤';

DROP TABLE IF EXISTS ex_type CASCADE;
CREATE TABLE ex_type (
  id             varchar(6)   NOT NULL,
  type_name      varchar(30)  NOT NULL,
  spell_code     varchar(20),
  category       varchar(1)   NOT NULL,
  met_value      decimal(4,2) NOT NULL,
  intensity      varchar(1)   NOT NULL,
  icon_key       varchar(30),
  status         varchar(1)   NOT NULL DEFAULT 'A',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ex_type PRIMARY KEY (id)
);
CREATE INDEX ix_ex_type_spell ON ex_type(spell_code) WHERE del_flag = 'N';
COMMENT ON TABLE ex_type IS '运动类型库 category A/S/F/M intensity L/M/H';

DROP TABLE IF EXISTS ex_entry CASCADE;
CREATE TABLE ex_entry (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  type_id        varchar(6)   NOT NULL,
  type_name      varchar(30)  NOT NULL,
  ex_date        timestamp    NOT NULL,
  ex_time        timestamp    NOT NULL,
  duration_min   int2         NOT NULL,
  weight_kg      decimal(5,2),
  kcal_burn      decimal(6,2) NOT NULL,
  note           varchar(200),
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ex_entry PRIMARY KEY (id)
);
CREATE INDEX ix_ex_entry_user_date ON ex_entry(user_id, ex_date DESC) WHERE del_flag = 'N';
COMMENT ON TABLE ex_entry IS '运动记录';

DROP TABLE IF EXISTS body_weight CASCADE;
CREATE TABLE body_weight (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  meas_time      timestamp    NOT NULL,
  meas_date      timestamp    NOT NULL,
  weight_kg      decimal(5,2) NOT NULL,
  bmi            decimal(4,2),
  entry_src      varchar(1)   NOT NULL DEFAULT 'M',
  note           varchar(100),
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_body_weight PRIMARY KEY (id)
);
CREATE INDEX ix_body_weight_user_date ON body_weight(user_id, meas_date DESC) WHERE del_flag = 'N';
COMMENT ON TABLE body_weight IS '体重记录 entry_src M 手动 H Apple Health';

DROP TABLE IF EXISTS body_measure CASCADE;
CREATE TABLE body_measure (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  meas_time      timestamp    NOT NULL,
  meas_date      timestamp    NOT NULL,
  waist_cm       decimal(4,1),
  hip_cm         decimal(4,1),
  chest_cm       decimal(4,1),
  thigh_cm       decimal(4,1),
  arm_cm         decimal(4,1),
  body_fat_pct   decimal(4,1),
  muscle_kg      decimal(5,2),
  water_pct      decimal(4,1),
  note           varchar(100),
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_body_measure PRIMARY KEY (id)
);
CREATE INDEX ix_body_measure_user_date ON body_measure(user_id, meas_date DESC) WHERE del_flag = 'N';
COMMENT ON TABLE body_measure IS '围度与体脂';

DROP TABLE IF EXISTS body_steps CASCADE;
CREATE TABLE body_steps (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  step_date      timestamp    NOT NULL,
  step_count     int4         NOT NULL,
  distance_m     int4,
  kcal_burn      decimal(6,2),
  entry_src      varchar(1)   NOT NULL DEFAULT 'H',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_body_steps PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_body_steps_uk ON body_steps(user_id, step_date) WHERE del_flag = 'N';
COMMENT ON TABLE body_steps IS '每日步数';

DROP TABLE IF EXISTS body_sleep CASCADE;
CREATE TABLE body_sleep (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  sleep_date     timestamp    NOT NULL,
  in_bed_time    timestamp,
  wake_time      timestamp,
  asleep_min     int2         NOT NULL,
  in_bed_min     int2,
  deep_min       int2,
  rem_min        int2,
  entry_src      varchar(1)   NOT NULL DEFAULT 'H',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_body_sleep PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_body_sleep_uk ON body_sleep(user_id, sleep_date) WHERE del_flag = 'N';
COMMENT ON TABLE body_sleep IS '每晚睡眠 主要由 Apple Health 灌入';

-- ============ 13 · fast / ai / hlth ============

DROP TABLE IF EXISTS fast_session CASCADE;
CREATE TABLE fast_session (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  plan_code      varchar(2)   NOT NULL,
  start_time     timestamp    NOT NULL,
  end_time       timestamp,
  plan_end_time  timestamp    NOT NULL,
  status         varchar(1)   NOT NULL DEFAULT 'R',
  actual_hours   decimal(4,2),
  note           varchar(200),
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_fast_session PRIMARY KEY (id)
);
CREATE INDEX ix_fast_session_user ON fast_session(user_id, start_time DESC) WHERE del_flag = 'N';
CREATE INDEX ix_fast_session_running ON fast_session(user_id) WHERE status = 'R' AND del_flag = 'N';
COMMENT ON TABLE fast_session IS '轻断食 plan 14/16/18/52 status R/C/A';

DROP TABLE IF EXISTS ai_conv CASCADE;
CREATE TABLE ai_conv (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  persona_code   varchar(1)   NOT NULL DEFAULT 'T',
  title          varchar(50),
  msg_count      int2         NOT NULL DEFAULT 0,
  last_msg_time  timestamp,
  status         varchar(1)   NOT NULL DEFAULT 'A',
  bg_key         varchar(128),
  avatar_key     varchar(128),
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ai_conv PRIMARY KEY (id)
);
CREATE INDEX ix_ai_conv_user ON ai_conv(user_id, last_msg_time DESC) WHERE del_flag = 'N';
COMMENT ON TABLE ai_conv IS 'AI 会话 persona T/D/F/N';

DROP TABLE IF EXISTS ai_msg CASCADE;
CREATE TABLE ai_msg (
  id             varchar(14)  NOT NULL,
  conv_id        varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  role           varchar(1)   NOT NULL,
  content        jsonb        NOT NULL,
  content_text   varchar(4000),
  token_in       int4,
  token_out      int4,
  cost           decimal(10,4),
  provider       varchar(20),
  model_name     varchar(30),
  msg_time       timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ai_msg PRIMARY KEY (id)
);
CREATE INDEX ix_ai_msg_conv ON ai_msg(conv_id, msg_time ASC) WHERE del_flag = 'N';
COMMENT ON TABLE ai_msg IS 'AI 消息 role U/A/S';

DROP TABLE IF EXISTS ai_usage CASCADE;
CREATE TABLE ai_usage (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  usage_date     timestamp    NOT NULL,
  usage_kind     varchar(2)   NOT NULL,
  used_count     int2         NOT NULL DEFAULT 0,
  quota_count    int2         NOT NULL,
  total_cost     decimal(10,4) NOT NULL DEFAULT 0,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ai_usage PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_ai_usage_uk ON ai_usage(user_id, usage_date, usage_kind) WHERE del_flag = 'N';
COMMENT ON TABLE ai_usage IS 'AI 用量额度 PH 拍照 CH 对话 DL 外卖';

DROP TABLE IF EXISTS ai_memory CASCADE;
CREATE TABLE ai_memory (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  mem_type       varchar(1)   NOT NULL,
  mem_content    varchar(500) NOT NULL,
  embedding      vector(1024),
  importance     int2         NOT NULL DEFAULT 5,
  version        int2         NOT NULL DEFAULT 1,
  source_msg_id  varchar(14),
  source_conv_id varchar(12),
  hit_count      int4         NOT NULL DEFAULT 0,
  last_hit_time  timestamp,
  expire_time    timestamp,
  status         varchar(1)   NOT NULL DEFAULT 'A',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ai_memory PRIMARY KEY (id)
);
CREATE INDEX ix_ai_memory_user ON ai_memory(user_id, importance DESC) WHERE del_flag = 'N' AND status = 'A';
CREATE INDEX ix_ai_memory_user_type ON ai_memory(user_id, mem_type) WHERE del_flag = 'N';
CREATE INDEX ix_ai_memory_vec ON ai_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
COMMENT ON TABLE ai_memory IS 'AI 长期记忆 mem_type F/P/G/H';

DROP TABLE IF EXISTS ai_memory_log CASCADE;
CREATE TABLE ai_memory_log (
  id             varchar(14)  NOT NULL,
  memory_id      varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  op_type        varchar(1)   NOT NULL,
  op_status      varchar(1)   NOT NULL DEFAULT 'A',
  old_content    varchar(500),
  new_content    varchar(500),
  old_type       varchar(1),
  new_type       varchar(1),
  old_importance int2,
  new_importance int2,
  version_from   int2,
  version_to     int2,
  op_reason      varchar(200),
  source_msg_id  varchar(14),
  confirm_time   timestamp,
  confirm_by     varchar(6),
  actor          varchar(1)   NOT NULL DEFAULT 'A',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ai_memory_log PRIMARY KEY (id)
);
CREATE INDEX ix_ai_memory_log_mem ON ai_memory_log(memory_id, create_time DESC) WHERE del_flag = 'N';
CREATE INDEX ix_ai_memory_log_pending ON ai_memory_log(user_id) WHERE op_status = 'P' AND del_flag = 'N';
COMMENT ON TABLE ai_memory_log IS 'AI 记忆变更历史 op_type C/U/D/O op_status A/P/R actor A/U';

DROP TABLE IF EXISTS ai_kb_doc CASCADE;
CREATE TABLE ai_kb_doc (
  id             varchar(10)  NOT NULL,
  doc_title      varchar(100) NOT NULL,
  doc_tag        varchar(100),
  source_type    varchar(2)   NOT NULL,
  source_key     varchar(128),
  content_hash   varchar(64),
  chunk_count    int4         NOT NULL DEFAULT 0,
  kb_status      varchar(1)   NOT NULL DEFAULT 'D',
  publish_time   timestamp,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ai_kb_doc PRIMARY KEY (id)
);
CREATE INDEX ix_ai_kb_doc_status ON ai_kb_doc(kb_status) WHERE del_flag = 'N';
CREATE UNIQUE INDEX uk_ai_kb_doc_hash ON ai_kb_doc(content_hash) WHERE del_flag = 'N';
COMMENT ON TABLE ai_kb_doc IS 'AI 知识库文档 source_type MD/PD/TX status D/P/A/X';

DROP TABLE IF EXISTS ai_kb_chunk CASCADE;
CREATE TABLE ai_kb_chunk (
  id             varchar(12)  NOT NULL,
  doc_id         varchar(10)  NOT NULL,
  chunk_idx      int4         NOT NULL,
  chunk_text     varchar(2000) NOT NULL,
  chunk_tokens   int2         NOT NULL,
  embedding      vector(1024),  -- 阶段 1 keyword 搜 · 阶段 2 embedding key 就位后回填并 NOT NULL
  meta_json      jsonb,
  hit_count      int4         NOT NULL DEFAULT 0,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_ai_kb_chunk PRIMARY KEY (id)
);
CREATE INDEX ix_ai_kb_chunk_doc ON ai_kb_chunk(doc_id, chunk_idx) WHERE del_flag = 'N';
CREATE INDEX ix_ai_kb_chunk_vec ON ai_kb_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
COMMENT ON TABLE ai_kb_chunk IS 'AI 知识库切片与向量';

DROP TABLE IF EXISTS hlth_import CASCADE;
CREATE TABLE hlth_import (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  file_key       varchar(128) NOT NULL,
  file_size      int4,
  file_hash      varchar(64),
  import_status  varchar(1)   NOT NULL DEFAULT 'P',
  weight_cnt     int4         NOT NULL DEFAULT 0,
  steps_cnt      int4         NOT NULL DEFAULT 0,
  hr_cnt         int4         NOT NULL DEFAULT 0,
  workout_cnt    int4         NOT NULL DEFAULT 0,
  sleep_cnt      int4         NOT NULL DEFAULT 0,
  error_msg      varchar(500),
  start_time     timestamp,
  end_time       timestamp,
  finish_time    timestamp,
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_hlth_import PRIMARY KEY (id)
);
CREATE INDEX ix_hlth_import_user ON hlth_import(user_id, create_time DESC) WHERE del_flag = 'N';
CREATE INDEX ix_hlth_import_hash ON hlth_import(user_id, file_hash) WHERE del_flag = 'N';
COMMENT ON TABLE hlth_import IS 'Apple Health XML 导入 status P/S/F';

-- ============ 14 · 订阅预留 sub_*（V1 不启用） ============

DROP TABLE IF EXISTS sub_plan CASCADE;
CREATE TABLE sub_plan (
  id             varchar(6)   NOT NULL,
  plan_name      varchar(30)  NOT NULL,
  plan_code      varchar(10)  NOT NULL,
  vip_lvl        varchar(1)   NOT NULL,
  duration_days  int2,
  price          decimal(10,4) NOT NULL,
  currency       varchar(3)   NOT NULL DEFAULT 'CNY',
  desc_text      varchar(200),
  status         varchar(1)   NOT NULL DEFAULT 'A',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_sub_plan PRIMARY KEY (id)
);
COMMENT ON TABLE sub_plan IS '订阅计划（V1 预留）';

DROP TABLE IF EXISTS sub_order CASCADE;
CREATE TABLE sub_order (
  id             varchar(12)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  plan_id        varchar(6)   NOT NULL,
  order_no       varchar(30)  NOT NULL,
  pay_channel    varchar(2),
  pay_amount     decimal(10,4) NOT NULL,
  pay_currency   varchar(3)   NOT NULL DEFAULT 'CNY',
  pay_status     varchar(1)   NOT NULL DEFAULT 'P',
  pay_time       timestamp,
  tx_id          varchar(64),
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_sub_order PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uk_sub_order_no ON sub_order(order_no) WHERE del_flag = 'N';
CREATE INDEX ix_sub_order_user ON sub_order(user_id, create_time DESC) WHERE del_flag = 'N';
COMMENT ON TABLE sub_order IS '订阅订单（V1 预留）pay_channel WX/AL/AP status P/S/F/R';

DROP TABLE IF EXISTS sub_member CASCADE;
CREATE TABLE sub_member (
  id             varchar(10)  NOT NULL,
  user_id        varchar(6)   NOT NULL,
  vip_lvl        varchar(1)   NOT NULL,
  start_time     timestamp    NOT NULL,
  expire_time    timestamp,
  order_id       varchar(12),
  status         varchar(1)   NOT NULL DEFAULT 'A',
  create_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  create_by      varchar(6),
  update_time    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by      varchar(6),
  del_flag       varchar(1)   NOT NULL DEFAULT 'N',
  delete_time    timestamp,
  delete_by      varchar(6),
  CONSTRAINT pk_sub_member PRIMARY KEY (id)
);
CREATE INDEX ix_sub_member_user ON sub_member(user_id, status) WHERE del_flag = 'N';
COMMENT ON TABLE sub_member IS '会员状态（V1 预留）status A/E/R';

-- ============ 字典 seed sys_dict ============

INSERT INTO sys_dict (id, dict_type, dict_code, dict_name, ext_val, sort_no) VALUES
('0000000001','meal_type','B','早餐',NULL,1),
('0000000002','meal_type','L','午餐',NULL,2),
('0000000003','meal_type','D','晚餐',NULL,3),
('0000000004','meal_type','S','加餐',NULL,4),
('0000000010','gender','M','男',NULL,1),
('0000000011','gender','F','女',NULL,2),
('0000000012','gender','U','保密',NULL,3),
('0000000020','activity_lvl','1','久坐','1.20',1),
('0000000021','activity_lvl','2','轻度','1.375',2),
('0000000022','activity_lvl','3','中度','1.55',3),
('0000000023','activity_lvl','4','高度','1.725',4),
('0000000024','activity_lvl','5','极高','1.90',5),
('0000000030','goal_type','M','维持','1.00',1),
('0000000031','goal_type','L1','温和减脂','0.85',2),
('0000000032','goal_type','L2','严格减脂','0.75',3),
('0000000033','goal_type','G1','增肌','1.10',4),
('0000000040','persona_code','T','陪伴搭子',NULL,1),
('0000000041','persona_code','D','严格教练',NULL,2),
('0000000042','persona_code','F','朋友',NULL,3),
('0000000043','persona_code','N','营养师',NULL,4),
('0000000050','cat_code','01','谷物',NULL,1),
('0000000051','cat_code','02','蔬菜',NULL,2),
('0000000052','cat_code','03','水果',NULL,3),
('0000000053','cat_code','04','肉类',NULL,4),
('0000000054','cat_code','05','水产',NULL,5),
('0000000055','cat_code','06','蛋类',NULL,6),
('0000000056','cat_code','07','奶及乳制品',NULL,7),
('0000000057','cat_code','08','豆及豆制品',NULL,8),
('0000000058','cat_code','09','坚果',NULL,9),
('0000000059','cat_code','10','油脂',NULL,10),
('0000000060','cat_code','11','菜肴',NULL,11),
('0000000061','cat_code','12','预包装',NULL,12),
('0000000070','drink_type','W','白水','1.00',1),
('0000000071','drink_type','T','茶','0.95',2),
('0000000072','drink_type','C','咖啡','0.80',3),
('0000000073','drink_type','J','果汁','0.70',4),
('0000000074','drink_type','S','汤','0.60',5),
('0000000080','photo_type','M','餐食',NULL,1),
('0000000081','photo_type','D','外卖截图',NULL,2),
('0000000090','entry_src','M','手动',NULL,1),
('0000000091','entry_src','A','AI 识别',NULL,2),
('0000000092','entry_src','D','外卖解析',NULL,3),
('0000000093','entry_src','V','语音',NULL,4),
('0000000100','plan_code','14','14:10',NULL,1),
('0000000101','plan_code','16','16:8',NULL,2),
('0000000102','plan_code','18','18:6',NULL,3),
('0000000103','plan_code','52','5:2',NULL,4),
('0000000110','usage_kind','PH','拍照识别',NULL,1),
('0000000111','usage_kind','CH','对话',NULL,2),
('0000000112','usage_kind','DL','外卖解析',NULL,3),
('0000000120','mem_type','F','事实',NULL,1),
('0000000121','mem_type','P','偏好',NULL,2),
('0000000122','mem_type','G','目标',NULL,3),
('0000000123','mem_type','H','习惯',NULL,4)
ON CONFLICT DO NOTHING;

-- ============ 运动库 seed ex_type（12 种）============

INSERT INTO ex_type (id, type_name, spell_code, category, met_value, intensity) VALUES
('000001','散步',    'sanbu',     'A', 3.0,'L'),
('000002','慢跑',    'manpao',    'A', 7.0,'M'),
('000003','跑步',    'paobu',     'A',10.0,'H'),
('000004','骑行',    'qixing',    'A', 6.0,'M'),
('000005','游泳',    'youyong',   'A', 8.0,'M'),
('000006','跳绳',    'tiaosheng', 'A',12.0,'H'),
('000007','瑜伽',    'yujia',     'F', 2.5,'L'),
('000008','HIIT',    'hiit',      'M',10.0,'H'),
('000009','力量训练','liliangxunlian','S',6.0,'M'),
('000010','爬楼梯',  'paloutu',   'A', 8.0,'H'),
('000011','徒步',    'tubu',      'A', 4.5,'M'),
('000012','广场舞',  'guangchangwu','A',4.0,'L')
ON CONFLICT DO NOTHING;
