/** entities barrel · 32 张业务表 · 严格对齐 scripts/init.sql */

export * from './base.entity';
export * from './sys.entity';
export * from './user.entity';
export * from './food.entity';
export * from './meal.entity';
export * from './water.entity';
export * from './ex.entity';
export * from './body.entity';
export * from './fast.entity';
export * from './ai.entity';
export * from './hlth.entity';
export * from './sub.entity';

import { SysDict, SysLoginLog, SysOpLog } from './sys.entity';
import { UserInfo, UserAuth, UserSession, UserVerify, UserGoal, UserRemind } from './user.entity';
import { FoodStd, FoodUser, FoodFavorite } from './food.entity';
import { MealEntry, MealItem, MealPhoto } from './meal.entity';
import { WaterEntry } from './water.entity';
import { ExType, ExEntry } from './ex.entity';
import { BodyWeight, BodyMeasure, BodySteps, BodySleep } from './body.entity';
import { FastSession } from './fast.entity';
import { AiConv, AiMsg, AiUsage, AiMemory, AiMemoryLog, AiKbDoc, AiKbChunk } from './ai.entity';
import { HlthImport } from './hlth.entity';
import { SubPlan, SubOrder, SubMember } from './sub.entity';

/** 32 张业务表 · 供 TypeOrmModule.forRoot({ entities }) 兜底使用 */
export const ALL_ENTITIES = [
  SysDict, SysLoginLog, SysOpLog,
  UserInfo, UserAuth, UserSession, UserVerify, UserGoal, UserRemind,
  FoodStd, FoodUser, FoodFavorite,
  MealEntry, MealItem, MealPhoto,
  WaterEntry,
  ExType, ExEntry,
  BodyWeight, BodyMeasure, BodySteps, BodySleep,
  FastSession,
  AiConv, AiMsg, AiUsage, AiMemory, AiMemoryLog, AiKbDoc, AiKbChunk,
  HlthImport,
  SubPlan, SubOrder, SubMember,
];
