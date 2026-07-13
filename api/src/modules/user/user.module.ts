import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { DataSource, Repository } from 'typeorm';

import {
  AiConv,
  AiMemory,
  AiMemoryLog,
  AiMsg,
  BodyMeasure,
  BodyWeight,
  ExEntry,
  FastSession,
  MealEntry,
  MealItem,
  UserGoal,
  UserInfo,
  WaterEntry,
} from '@/entities';
import { IdGeneratorService } from '@/common/id-generator.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';

class UpdateProfileDto {
  @IsOptional() @IsString() @Length(2, 30) nickname?: string;
  @IsOptional() @IsString() @Length(1, 1) gender?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) birthYear?: number;
  @IsOptional() @IsInt() @Min(80) @Max(250) heightCm?: number;
  @IsOptional() @IsString() @Length(1, 1) activityLvl?: string;
  @IsOptional() @IsString() @Length(128, 128) avatarKey?: string;
}

class SetupDto {
  @IsString() @IsIn(['M', 'F', 'U']) gender!: string;
  @IsInt() @Min(1900) @Max(2100) birthYear!: number;
  @IsNumber() @Min(80) @Max(250) heightCm!: number;
  @IsNumber() @Min(20) @Max(300) currentWeightKg!: number;
  @IsString() @IsIn(['1', '2', '3', '4', '5']) activityLvl!: string;
  @IsString() @IsIn(['M', 'L1', 'L2', 'G1']) goalType!: string;
}

class UpdateGoalDto {
  @IsOptional() @IsString() @IsIn(['M', 'L1', 'L2', 'G1']) goalType?: string;
  @IsOptional() @IsInt() @Min(500) @Max(6000) kcalGoal?: number;
  @IsOptional() @IsInt() @Min(0) @Max(80) carbPct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(80) protPct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(80) fatPct?: number;
  @IsOptional() @IsInt() @Min(500) @Max(6000) waterMl?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(300) targetWt?: number;
}

/** Mifflin-St Jeor BMR + activity 系数 · 目标类型 factor */
const ACTIVITY_FACTOR: Record<string, number> = {
  '1': 1.2, '2': 1.375, '3': 1.55, '4': 1.725, '5': 1.9,
};
const GOAL_FACTOR: Record<string, number> = {
  M: 1.0, L1: 0.85, L2: 0.75, G1: 1.1,
};
const MACRO_PCT: Record<string, { c: number; p: number; f: number }> = {
  M: { c: 50, p: 25, f: 25 },
  L1: { c: 45, p: 30, f: 25 },
  L2: { c: 40, p: 35, f: 25 },
  G1: { c: 45, p: 30, f: 25 },
};

function calcBMR(gender: string, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'F' ? base - 161 : base + 5);
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserInfo) private readonly userRepo: Repository<UserInfo>,
    @InjectRepository(UserGoal) private readonly goalRepo: Repository<UserGoal>,
    private readonly ds: DataSource,
    private readonly idGen: IdGeneratorService,
  ) {}

  /**
   * 全量数据导出 · 用户可查/改/删 AI 记住的所有事情 · 合规刚需
   * 只包含 delFlag='N' 的记录 · 已软删的不带走
   */
  async exportAll(userId: string) {
    const w = { userId, delFlag: 'N' } as const;
    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    if (!user) throw new NotFoundException('用户不存在');

    const [goals, meals, mealItems, waters, exs, weights, measures, fasts, convs, msgs, memories, memLogs] = await Promise.all([
      this.ds.getRepository(UserGoal).find({ where: w, order: { effectiveAt: 'ASC' } }),
      this.ds.getRepository(MealEntry).find({ where: w, order: { mealTime: 'ASC' } }),
      this.ds.getRepository(MealItem).find({ where: w, order: { sortNo: 'ASC' } }),
      this.ds.getRepository(WaterEntry).find({ where: w, order: { drinkTime: 'ASC' } }),
      this.ds.getRepository(ExEntry).find({ where: w, order: { exTime: 'ASC' } }),
      this.ds.getRepository(BodyWeight).find({ where: w, order: { measTime: 'ASC' } }),
      this.ds.getRepository(BodyMeasure).find({ where: w, order: { measTime: 'ASC' } }),
      this.ds.getRepository(FastSession).find({ where: w, order: { startTime: 'ASC' } }),
      this.ds.getRepository(AiConv).find({ where: w, order: { lastMsgTime: 'ASC' } }),
      this.ds.getRepository(AiMsg).find({ where: w, order: { msgTime: 'ASC' } }),
      this.ds.getRepository(AiMemory).find({ where: w, order: { updateTime: 'ASC' } }),
      this.ds.getRepository(AiMemoryLog).find({ where: w, order: { createTime: 'ASC' } }),
    ]);

    return {
      _meta: {
        exportedAt: new Date().toISOString(),
        appVersion: '0.1.0',
        format: 'qianka-full-export/v1',
        userId,
        counts: {
          goals: goals.length,
          meals: meals.length,
          mealItems: mealItems.length,
          waters: waters.length,
          exercises: exs.length,
          weights: weights.length,
          measures: measures.length,
          fasts: fasts.length,
          conversations: convs.length,
          messages: msgs.length,
          memories: memories.length,
          memoryLogs: memLogs.length,
        },
      },
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        gender: user.gender,
        birthYear: user.birthYear,
        heightCm: user.heightCm,
        activityLvl: user.activityLvl,
        bmrKcal: user.bmrKcal,
        tdeeKcal: user.tdeeKcal,
        vipLvl: user.vipLvl,
        emailVerified: user.emailVerified,
        status: user.status,
        createTime: user.createTime,
      },
      goals,
      meals,
      mealItems,
      waters,
      exercises: exs,
      weights,
      measures,
      fasts,
      conversations: convs,
      messages: msgs,
      memories,
      memoryLogs: memLogs,
    };
  }

  async setup(userId: string, dto: SetupDto) {
    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    if (!user) throw new NotFoundException('用户不存在');

    const now = new Date();
    const age = now.getFullYear() - dto.birthYear;
    if (age < 10 || age > 100) throw new BadRequestException('年龄范围不合理');

    const bmr = calcBMR(dto.gender, dto.currentWeightKg, dto.heightCm, age);
    const tdee = Math.round(bmr * (ACTIVITY_FACTOR[dto.activityLvl] ?? 1.375));
    const kcalGoal = Math.round(tdee * (GOAL_FACTOR[dto.goalType] ?? 1.0));
    const macro = MACRO_PCT[dto.goalType];

    await this.ds.transaction(async (mgr) => {
      await mgr.update(UserInfo, { id: userId }, {
        gender: dto.gender,
        birthYear: dto.birthYear,
        heightCm: String(dto.heightCm),
        activityLvl: dto.activityLvl,
        bmrKcal: bmr,
        tdeeKcal: tdee,
        updateBy: userId,
        updateTime: now,
      });
      await mgr.update(UserGoal, { userId, isCurrent: 'Y' }, { isCurrent: 'N', updateTime: now });
      const goalId = await this.idGen.next('user_goal');
      await mgr.insert(UserGoal, {
        id: goalId,
        userId,
        goalType: dto.goalType,
        targetWt: null as unknown as string,
        kcalGoal,
        carbPct: macro.c,
        protPct: macro.p,
        fatPct: macro.f,
        waterMl: 2000,
        isCurrent: 'Y',
        effectiveAt: now,
        delFlag: 'N',
        createBy: userId,
        updateBy: userId,
        createTime: now,
        updateTime: now,
      });
    });

    return this.getMe(userId);
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    if (!user) throw new NotFoundException('用户不存在');

    const goal = await this.goalRepo.findOne({
      where: { userId, isCurrent: 'Y', delFlag: 'N' },
      order: { effectiveAt: 'DESC' },
    });

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarKey: user.avatarKey ?? null,
      gender: user.gender,
      birthYear: user.birthYear ?? null,
      heightCm: user.heightCm ?? null,
      activityLvl: user.activityLvl,
      bmrKcal: user.bmrKcal ?? null,
      tdeeKcal: user.tdeeKcal ?? null,
      vipLvl: user.vipLvl,
      emailVerified: user.emailVerified,
      status: user.status,
      lastLogin: user.lastLogin ?? null,
      goal: goal
        ? {
            id: goal.id,
            goalType: goal.goalType,
            targetWt: goal.targetWt ?? null,
            kcalGoal: goal.kcalGoal,
            carbPct: goal.carbPct,
            protPct: goal.protPct,
            fatPct: goal.fatPct,
            waterMl: goal.waterMl,
          }
        : null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    if (!user) throw new NotFoundException('用户不存在');

    const patch: Partial<UserInfo> = { updateBy: userId, updateTime: new Date() };
    if (dto.nickname !== undefined) patch.nickname = dto.nickname;
    if (dto.gender !== undefined) patch.gender = dto.gender;
    if (dto.birthYear !== undefined) patch.birthYear = dto.birthYear;
    if (dto.heightCm !== undefined) patch.heightCm = String(dto.heightCm);
    if (dto.activityLvl !== undefined) patch.activityLvl = dto.activityLvl;
    if (dto.avatarKey !== undefined) patch.avatarKey = dto.avatarKey;

    await this.userRepo.update({ id: userId }, patch);
    return this.getMe(userId);
  }

  async updateGoal(userId: string, dto: UpdateGoalDto) {
    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    if (!user) throw new NotFoundException('用户不存在');
    const current = await this.goalRepo.findOne({
      where: { userId, isCurrent: 'Y', delFlag: 'N' },
      order: { effectiveAt: 'DESC' },
    });
    if (!current) throw new BadRequestException('尚未 onboarding · 请先设置初始目标');

    // 宏营素比例三者之和须 ≤ 100
    const c = dto.carbPct ?? current.carbPct;
    const p = dto.protPct ?? current.protPct;
    const f = dto.fatPct ?? current.fatPct;
    if (c + p + f > 100) throw new BadRequestException('碳水/蛋白/脂肪比例之和不能超过 100');

    // 换 goalType · 无手动 kcal 时按用户当前 TDEE 重算
    let kcalGoal = dto.kcalGoal ?? current.kcalGoal;
    let carbPct = c;
    let protPct = p;
    let fatPct = f;
    const newGoalType = dto.goalType ?? current.goalType;
    if (dto.goalType && dto.goalType !== current.goalType && dto.kcalGoal == null) {
      const tdee = user.tdeeKcal ?? 0;
      if (tdee > 0) kcalGoal = Math.round(tdee * (GOAL_FACTOR[newGoalType] ?? 1.0));
      // 宏营素比例若用户没手改 · 也按新 goal 默认
      if (dto.carbPct == null && dto.protPct == null && dto.fatPct == null) {
        const macro = MACRO_PCT[newGoalType];
        carbPct = macro.c; protPct = macro.p; fatPct = macro.f;
      }
    }

    const now = new Date();
    await this.ds.transaction(async (mgr) => {
      await mgr.update(UserGoal, { userId, isCurrent: 'Y' }, { isCurrent: 'N', updateTime: now });
      const goalId = await this.idGen.next('user_goal');
      await mgr.insert(UserGoal, {
        id: goalId,
        userId,
        goalType: newGoalType,
        targetWt: dto.targetWt != null ? dto.targetWt.toFixed(2) : current.targetWt,
        kcalGoal,
        carbPct, protPct, fatPct,
        waterMl: dto.waterMl ?? current.waterMl,
        isCurrent: 'Y',
        effectiveAt: now,
        delFlag: 'N',
        createBy: userId,
        updateBy: userId,
        createTime: now,
        updateTime: now,
      });
    });

    return this.getMe(userId);
  }

  async softDelete(userId: string) {
    const now = new Date();
    await this.userRepo.update(
      { id: userId },
      { status: 'D', delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now },
    );
    return { success: true, scheduledPurgeAt: new Date(Date.now() + 30 * 86_400_000) };
  }
}

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly svc: UserService) {}

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.svc.getMe(u.id);
  }

  @Put('me')
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(u.id, dto);
  }

  @Delete('me')
  del(@CurrentUser() u: AuthUser) {
    return this.svc.softDelete(u.id);
  }

  @Get('export')
  export(@CurrentUser() u: AuthUser) {
    return this.svc.exportAll(u.id);
  }

  @Patch('goal')
  updateGoal(@CurrentUser() u: AuthUser, @Body() dto: UpdateGoalDto) {
    return this.svc.updateGoal(u.id, dto);
  }

  @Post('setup')
  @HttpCode(200)
  setup(@CurrentUser() u: AuthUser, @Body() dto: SetupDto) {
    return this.svc.setup(u.id, dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([UserInfo, UserGoal])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
