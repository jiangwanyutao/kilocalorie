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
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsISO8601, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';
import { BodyMeasure, BodySleep, BodySteps, BodyWeight, UserGoal, UserInfo } from '@/entities';

class CreateWeightDto {
  @IsNumber() @Min(20) @Max(300) weightKg!: number;
  @IsOptional() @IsISO8601() measTime?: string;
  @IsOptional() @IsString() @Length(0, 100) note?: string;
}

class CreateMeasureDto {
  @IsOptional() @IsNumber() @Min(30) @Max(200) waistCm?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(200) hipCm?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(200) chestCm?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(150) thighCm?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(80)  armCm?: number;
  @IsOptional() @IsNumber() @Min(3)  @Max(70)  bodyFatPct?: number;
  @IsOptional() @IsISO8601() measTime?: string;
  @IsOptional() @IsString() @Length(0, 100) note?: string;
}

/** BodyMeasure 6 个可选维度 · 前端映射用 */
const MEASURE_DIMS = ['waistCm', 'hipCm', 'chestCm', 'thighCm', 'armCm', 'bodyFatPct'] as const;
type MeasureDim = typeof MEASURE_DIMS[number];

@Injectable()
export class BodyService {
  constructor(
    @InjectRepository(BodyWeight) private readonly repo: Repository<BodyWeight>,
    @InjectRepository(BodyMeasure) private readonly measRepo: Repository<BodyMeasure>,
    @InjectRepository(BodySteps) private readonly stepsRepo: Repository<BodySteps>,
    @InjectRepository(BodySleep) private readonly sleepRepo: Repository<BodySleep>,
    @InjectRepository(UserInfo) private readonly userRepo: Repository<UserInfo>,
    @InjectRepository(UserGoal) private readonly goalRepo: Repository<UserGoal>,
    private readonly idGen: IdGeneratorService,
  ) {}

  // ============ 步数历史（Apple Health 灌进来的）============
  async stepsHistory(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, days)));
    const rows = await this.stepsRepo.find({
      where: { userId, delFlag: 'N', stepDate: MoreThanOrEqual(this.zero(since)) },
      order: { stepDate: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.stepDate,
      stepCount: r.stepCount,
      distanceM: r.distanceM ?? null,
      kcalBurn: r.kcalBurn != null ? Number(r.kcalBurn) : null,
    }));
  }

  async stepsSummary(userId: string, days = 30) {
    const list = await this.stepsHistory(userId, days);
    if (!list.length) return { count: 0, avgSteps: 0, maxSteps: 0, totalDistanceKm: 0, totalKcal: 0, latest: null, history: [] };
    const totalSteps = list.reduce((s, x) => s + x.stepCount, 0);
    const totalDist = list.reduce((s, x) => s + (x.distanceM ?? 0), 0);
    const totalKcal = list.reduce((s, x) => s + (x.kcalBurn ?? 0), 0);
    return {
      count: list.length,
      avgSteps: Math.round(totalSteps / list.length),
      maxSteps: Math.max(...list.map((x) => x.stepCount)),
      totalDistanceKm: +(totalDist / 1000).toFixed(1),
      totalKcal: Math.round(totalKcal),
      latest: list[list.length - 1],
      history: list,
    };
  }

  // ============ 睡眠历史 ============
  async sleepHistory(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, days)));
    const rows = await this.sleepRepo.find({
      where: { userId, delFlag: 'N', sleepDate: MoreThanOrEqual(this.zero(since)) },
      order: { sleepDate: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.sleepDate,
      asleepMin: r.asleepMin,
      inBedMin: r.inBedMin ?? null,
      deepMin: r.deepMin ?? null,
      remMin: r.remMin ?? null,
    }));
  }

  async sleepSummary(userId: string, days = 30) {
    const list = await this.sleepHistory(userId, days);
    if (!list.length) return { count: 0, avgAsleepMin: 0, avgDeepMin: 0, avgRemMin: 0, latest: null, history: [] };
    const totalAsleep = list.reduce((s, x) => s + x.asleepMin, 0);
    const deepVals = list.filter((x) => x.deepMin != null).map((x) => x.deepMin!);
    const remVals = list.filter((x) => x.remMin != null).map((x) => x.remMin!);
    return {
      count: list.length,
      avgAsleepMin: Math.round(totalAsleep / list.length),
      avgDeepMin: deepVals.length ? Math.round(deepVals.reduce((a, b) => a + b, 0) / deepVals.length) : 0,
      avgRemMin: remVals.length ? Math.round(remVals.reduce((a, b) => a + b, 0) / remVals.length) : 0,
      latest: list[list.length - 1],
      history: list,
    };
  }

  private zero(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  private calcBmi(weightKg: number, heightCmStr?: string | null): number | null {
    if (!heightCmStr) return null;
    const h = Number(heightCmStr) / 100;
    if (!Number.isFinite(h) || h <= 0) return null;
    return +(weightKg / (h * h)).toFixed(2);
  }

  async addWeight(userId: string, dto: CreateWeightDto) {
    const measTime = dto.measTime ? new Date(dto.measTime) : new Date();
    if (Number.isNaN(measTime.getTime())) throw new BadRequestException('measTime 无效');
    const measDate = this.zero(measTime);
    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    const bmi = this.calcBmi(dto.weightKg, user?.heightCm);
    const id = await this.idGen.next('body_weight');
    const now = new Date();
    await this.repo.insert({
      id, userId, measTime, measDate,
      weightKg: dto.weightKg.toFixed(2),
      bmi: bmi != null ? bmi.toFixed(2) : (null as unknown as string),
      entrySrc: 'M', note: dto.note,
      delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
    });
    return this.summary(userId);
  }

  async history(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, days)));
    const list = await this.repo.find({
      where: { userId, delFlag: 'N', measDate: MoreThanOrEqual(this.zero(since)) },
      order: { measTime: 'ASC' },
    });
    return list.map((w) => ({
      id: w.id,
      measTime: w.measTime,
      weightKg: Number(w.weightKg),
      bmi: w.bmi != null ? Number(w.bmi) : null,
      note: w.note ?? null,
    }));
  }

  async summary(userId: string) {
    const hist = await this.history(userId, 30);
    const latest = hist.length ? hist[hist.length - 1] : null;
    const first = hist.length ? hist[0] : null;
    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });
    const goal = await this.goalRepo.findOne({
      where: { userId, isCurrent: 'Y', delFlag: 'N' },
      order: { effectiveAt: 'DESC' },
    });
    return {
      latest,
      first,
      delta30: latest && first ? +(latest.weightKg - first.weightKg).toFixed(2) : 0,
      count: hist.length,
      history: hist,
      targetWt: goal?.targetWt != null ? Number(goal.targetWt) : null,
      heightCm: user?.heightCm != null ? Number(user.heightCm) : null,
    };
  }

  async del(userId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, userId, delFlag: 'N' } });
    if (!e) throw new NotFoundException('记录不存在');
    const now = new Date();
    await this.repo.update({ id }, { delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now });
    return this.summary(userId);
  }

  // ============ 围度记录 ============

  async addMeasure(userId: string, dto: CreateMeasureDto) {
    const hasAny = MEASURE_DIMS.some((k) => dto[k] != null);
    if (!hasAny) throw new BadRequestException('至少填一项');
    const measTime = dto.measTime ? new Date(dto.measTime) : new Date();
    if (Number.isNaN(measTime.getTime())) throw new BadRequestException('measTime 无效');
    const measDate = this.zero(measTime);
    const id = await this.idGen.next('body_measure');
    const now = new Date();
    await this.measRepo.insert({
      id, userId, measTime, measDate,
      waistCm:  dto.waistCm  != null ? dto.waistCm.toFixed(1)  : (null as unknown as string),
      hipCm:    dto.hipCm    != null ? dto.hipCm.toFixed(1)    : (null as unknown as string),
      chestCm:  dto.chestCm  != null ? dto.chestCm.toFixed(1)  : (null as unknown as string),
      thighCm:  dto.thighCm  != null ? dto.thighCm.toFixed(1)  : (null as unknown as string),
      armCm:    dto.armCm    != null ? dto.armCm.toFixed(1)    : (null as unknown as string),
      bodyFatPct: dto.bodyFatPct != null ? dto.bodyFatPct.toFixed(1) : (null as unknown as string),
      note: dto.note,
      delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
    });
    return this.measureSummary(userId);
  }

  async measureHistory(userId: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(730, days)));
    const list = await this.measRepo.find({
      where: { userId, delFlag: 'N', measDate: MoreThanOrEqual(this.zero(since)) },
      order: { measTime: 'ASC' },
    });
    return list.map((m) => ({
      id: m.id,
      measTime: m.measTime,
      waistCm:    m.waistCm    != null ? Number(m.waistCm)    : null,
      hipCm:      m.hipCm      != null ? Number(m.hipCm)      : null,
      chestCm:    m.chestCm    != null ? Number(m.chestCm)    : null,
      thighCm:    m.thighCm    != null ? Number(m.thighCm)    : null,
      armCm:      m.armCm      != null ? Number(m.armCm)      : null,
      bodyFatPct: m.bodyFatPct != null ? Number(m.bodyFatPct) : null,
      note: m.note ?? null,
    }));
  }

  async measureSummary(userId: string) {
    const hist = await this.measureHistory(userId, 90);
    const latest: Record<MeasureDim, { value: number; measTime: Date } | null> = {
      waistCm: null, hipCm: null, chestCm: null, thighCm: null, armCm: null, bodyFatPct: null,
    };
    const first: Record<MeasureDim, number | null> = {
      waistCm: null, hipCm: null, chestCm: null, thighCm: null, armCm: null, bodyFatPct: null,
    };
    for (const k of MEASURE_DIMS) {
      for (const p of hist) {
        if (p[k] != null && first[k] == null) first[k] = p[k];
      }
      for (let i = hist.length - 1; i >= 0; i--) {
        const p = hist[i];
        if (p[k] != null) { latest[k] = { value: p[k] as number, measTime: p.measTime }; break; }
      }
    }
    const delta90: Record<MeasureDim, number> = {
      waistCm: 0, hipCm: 0, chestCm: 0, thighCm: 0, armCm: 0, bodyFatPct: 0,
    };
    for (const k of MEASURE_DIMS) {
      if (latest[k] != null && first[k] != null) {
        delta90[k] = +(latest[k]!.value - first[k]!).toFixed(1);
      }
    }
    return {
      latest, first, delta90,
      count: hist.length,
      history: hist,
    };
  }

  async delMeasure(userId: string, id: string) {
    const e = await this.measRepo.findOne({ where: { id, userId, delFlag: 'N' } });
    if (!e) throw new NotFoundException('记录不存在');
    const now = new Date();
    await this.measRepo.update({ id }, { delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now });
    return this.measureSummary(userId);
  }
}

@Controller('body')
@UseGuards(JwtAuthGuard)
export class BodyController {
  constructor(private readonly svc: BodyService) {}

  @Post('weight')
  @HttpCode(200)
  addWeight(@CurrentUser() u: AuthUser, @Body() dto: CreateWeightDto) {
    return this.svc.addWeight(u.id, dto);
  }

  @Get('weight/summary')
  summary(@CurrentUser() u: AuthUser) {
    return this.svc.summary(u.id);
  }

  @Get('weight/history')
  history(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.history(u.id, days ? Number(days) : 30);
  }

  @Delete('weight/:id')
  del(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.del(u.id, id);
  }

  @Post('measure')
  @HttpCode(200)
  addMeasure(@CurrentUser() u: AuthUser, @Body() dto: CreateMeasureDto) {
    return this.svc.addMeasure(u.id, dto);
  }

  @Get('measure/summary')
  measureSummary(@CurrentUser() u: AuthUser) {
    return this.svc.measureSummary(u.id);
  }

  @Get('measure/history')
  measureHistory(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.measureHistory(u.id, days ? Number(days) : 90);
  }

  @Delete('measure/:id')
  delMeasure(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.delMeasure(u.id, id);
  }

  @Get('steps/summary')
  stepsSummary(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.stepsSummary(u.id, days ? Number(days) : 30);
  }

  @Get('steps/history')
  stepsHistory(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.stepsHistory(u.id, days ? Number(days) : 30);
  }

  @Get('sleep/summary')
  sleepSummary(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.sleepSummary(u.id, days ? Number(days) : 30);
  }

  @Get('sleep/history')
  sleepHistory(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.sleepHistory(u.id, days ? Number(days) : 30);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([BodyWeight, BodyMeasure, BodySteps, BodySleep, UserInfo, UserGoal])],
  controllers: [BodyController],
  providers: [BodyService],
  exports: [BodyService],
})
export class BodyModule {}
