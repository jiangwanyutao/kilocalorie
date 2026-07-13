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
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Between, DataSource, In, Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';
import { VisionModule, VisionService, type VisionResult } from '../vision/vision.module';
import { BodyMeasure, BodySteps, BodyWeight, ExEntry, MealEntry, MealItem, UserGoal, WaterEntry } from '@/entities';

class MealItemDto {
  @IsString() @Length(1, 50) foodName!: string;
  @IsOptional() @IsString() @Length(1, 10) foodId?: string;
  @IsString() @IsIn(['S', 'U', 'X']) foodSrc!: string;
  @IsString() @IsIn(['P', 'G']) portionMode!: string;
  @IsNumber() @Min(0.01) @Max(999) portionQty!: number;
  @IsNumber() @Min(1) @Max(9999) actualG!: number;
  @IsNumber() @Min(0) @Max(9999) kcal!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999) carbG?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999) protG?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999) fatG?: number;
}

class CreateMealDto {
  @IsString() @IsIn(['B', 'L', 'D', 'S']) mealType!: string;
  @IsISO8601() mealTime!: string;
  @IsOptional() @IsString() @IsIn(['M', 'A', 'D', 'V']) entrySrc?: string;
  @IsOptional() @IsString() @Length(0, 200) note?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MealItemDto)
  items!: MealItemDto[];
}

class AnalyzePhotoDto {
  @IsString() @Length(64, 22_000_000) imageBase64!: string;
  @IsOptional() @IsString() @Length(3, 30) mimeType?: string;
}

@Injectable()
export class MealService {
  constructor(
    @InjectRepository(MealEntry) private readonly entryRepo: Repository<MealEntry>,
    @InjectRepository(MealItem) private readonly itemRepo: Repository<MealItem>,
    @InjectRepository(UserGoal) private readonly goalRepo: Repository<UserGoal>,
    @InjectRepository(WaterEntry) private readonly waterRepo: Repository<WaterEntry>,
    @InjectRepository(ExEntry) private readonly exRepo: Repository<ExEntry>,
    @InjectRepository(BodyWeight) private readonly bodyRepo: Repository<BodyWeight>,
    @InjectRepository(BodyMeasure) private readonly measRepo: Repository<BodyMeasure>,
    @InjectRepository(BodySteps) private readonly stepsRepo: Repository<BodySteps>,
    private readonly idGen: IdGeneratorService,
    private readonly ds: DataSource,
    private readonly vision: VisionService,
  ) {}

  analyzePhoto(imageBase64: string, mimeType?: string): Promise<VisionResult> {
    // 去掉 data URL 前缀（前端可能带过来）· 仅传纯 base64 给 provider
    const raw = imageBase64.startsWith('data:')
      ? imageBase64.slice(imageBase64.indexOf(',') + 1)
      : imageBase64;
    return this.vision.recognize(raw, mimeType ?? 'image/jpeg');
  }

  private zeroTime(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  async createEntry(userId: string, dto: CreateMealDto) {
    const mealTime = new Date(dto.mealTime);
    if (Number.isNaN(mealTime.getTime())) throw new BadRequestException('mealTime 无效');
    const mealDate = this.zeroTime(mealTime);

    let totKcal = 0, totC = 0, totP = 0, totF = 0;
    for (const it of dto.items) {
      totKcal += Number(it.kcal ?? 0);
      totC += Number(it.carbG ?? 0);
      totP += Number(it.protG ?? 0);
      totF += Number(it.fatG ?? 0);
    }

    const entryId = await this.idGen.next('meal_entry');
    const itemIds = await this.idGen.nextBatch('meal_item', dto.items.length);
    const now = new Date();

    await this.ds.transaction(async (mgr) => {
      await mgr.insert(MealEntry, {
        id: entryId,
        userId,
        mealDate,
        mealTime,
        mealType: dto.mealType,
        entrySrc: dto.entrySrc ?? 'M',
        totalKcal: totKcal.toFixed(2),
        totalCarb: totC.toFixed(2),
        totalProt: totP.toFixed(2),
        totalFat: totF.toFixed(2),
        note: dto.note,
        delFlag: 'N',
        createBy: userId,
        updateBy: userId,
        createTime: now,
        updateTime: now,
      });

      const rows = dto.items.map((it, i) => ({
        id: itemIds[i],
        entryId,
        userId,
        foodId: it.foodId ?? '0000000000',
        foodSrc: it.foodSrc,
        foodName: it.foodName,
        portionMode: it.portionMode,
        portionQty: Number(it.portionQty).toFixed(2),
        actualG: Number(it.actualG).toFixed(2),
        kcal: Number(it.kcal).toFixed(2),
        carbG: (it.carbG ?? 0).toFixed(2),
        protG: (it.protG ?? 0).toFixed(2),
        fatG: (it.fatG ?? 0).toFixed(2),
        sortNo: i,
        delFlag: 'N',
        createBy: userId,
        updateBy: userId,
        createTime: now,
        updateTime: now,
      }));
      await mgr.insert(MealItem, rows);
    });

    return this.getEntry(userId, entryId);
  }

  async getEntry(userId: string, entryId: string) {
    const e = await this.entryRepo.findOne({ where: { id: entryId, userId, delFlag: 'N' } });
    if (!e) throw new NotFoundException('记录不存在');
    const items = await this.itemRepo.find({
      where: { entryId, delFlag: 'N' },
      order: { sortNo: 'ASC' },
    });
    return { ...e, items };
  }

  async getDay(userId: string, dateStr?: string) {
    const base = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(base.getTime())) throw new BadRequestException('date 无效');
    const start = this.zeroTime(base);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const entries = await this.entryRepo.find({
      where: { userId, mealDate: Between(start, end), delFlag: 'N' },
      order: { mealTime: 'ASC' },
    });
    if (!entries.length) return { date: start.toISOString(), entries: [], byType: {} as Record<string, number> };

    const items = await this.itemRepo.find({
      where: { entryId: In(entries.map((e) => e.id)), delFlag: 'N' },
      order: { sortNo: 'ASC' },
    });
    const grouped = new Map<string, MealItem[]>();
    for (const it of items) {
      const arr = grouped.get(it.entryId) ?? [];
      arr.push(it);
      grouped.set(it.entryId, arr);
    }

    const withItems = entries.map((e) => ({ ...e, items: grouped.get(e.id) ?? [] }));
    const byType: Record<string, number> = {};
    for (const e of entries) {
      byType[e.mealType] = (byType[e.mealType] ?? 0) + Number(e.totalKcal);
    }
    return { date: start.toISOString(), entries: withItems, byType };
  }

  async deleteEntry(userId: string, entryId: string) {
    const e = await this.entryRepo.findOne({ where: { id: entryId, userId, delFlag: 'N' } });
    if (!e) throw new NotFoundException('记录不存在');
    const now = new Date();
    await this.ds.transaction(async (mgr) => {
      await mgr.update(MealEntry, { id: entryId }, {
        delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now,
      });
      await mgr.update(MealItem, { entryId }, {
        delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now,
      });
    });
    return { success: true };
  }

  async getDays(userId: string, fromStr?: string, toStr?: string) {
    const now = new Date();
    const to = toStr ? new Date(toStr) : now;
    const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from/to 无效');
    }
    const fromZ = this.zeroTime(from);
    const toZ = new Date(this.zeroTime(to)); toZ.setDate(toZ.getDate() + 1);
    const isoKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const [entries, exs, steps] = await Promise.all([
      this.entryRepo.find({
        where: { userId, mealDate: Between(fromZ, toZ), delFlag: 'N' },
        select: ['mealDate', 'totalKcal'],
      }),
      this.exRepo.find({
        where: { userId, exDate: Between(fromZ, toZ), delFlag: 'N' },
        select: ['exDate', 'kcalBurn'],
      }),
      this.stepsRepo.find({
        where: { userId, stepDate: Between(fromZ, toZ), delFlag: 'N' },
        select: ['stepDate', 'kcalBurn'],
      }),
    ]);

    const foodMap = new Map<string, number>();
    for (const e of entries) {
      const k = isoKey(new Date(e.mealDate));
      foodMap.set(k, (foodMap.get(k) ?? 0) + Number(e.totalKcal));
    }
    const burnMap = new Map<string, number>();
    for (const e of exs) {
      const k = isoKey(new Date(e.exDate));
      burnMap.set(k, (burnMap.get(k) ?? 0) + Number(e.kcalBurn));
    }
    const activeMap = new Map<string, number>();
    for (const s of steps) {
      if (!s.kcalBurn) continue;
      const k = isoKey(new Date(s.stepDate));
      activeMap.set(k, (activeMap.get(k) ?? 0) + Number(s.kcalBurn));
    }

    const allDates = new Set<string>([...foodMap.keys(), ...burnMap.keys(), ...activeMap.keys()]);
    return Array.from(allDates)
      .sort()
      .map((date) => ({
        date,
        kcal: Math.round(foodMap.get(date) ?? 0),
        burned: Math.round(burnMap.get(date) ?? 0),
        active: Math.round(activeMap.get(date) ?? 0),
      }));
  }

  async today(userId: string) {
    const day = await this.getDay(userId);
    let consumed = 0, c = 0, p = 0, f = 0;
    for (const e of day.entries) {
      consumed += Number(e.totalKcal);
      c += Number(e.totalCarb);
      p += Number(e.totalProt);
      f += Number(e.totalFat);
    }
    const goal = await this.goalRepo.findOne({
      where: { userId, isCurrent: 'Y', delFlag: 'N' },
      order: { effectiveAt: 'DESC' },
    });
    const kcalGoal = goal?.kcalGoal ?? 0;
    // 汇总今日饮水
    const now = new Date();
    const start = this.zeroTime(now);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const waters = await this.waterRepo.find({
      where: { userId, drinkDate: Between(start, end), delFlag: 'N' },
    });
    const waterMl = waters.reduce((s, e) => s + e.effectiveMl, 0);
    const waterGoal = goal?.waterMl ?? 2000;
    const exs = await this.exRepo.find({
      where: { userId, exDate: Between(start, end), delFlag: 'N' },
    });
    const burned = Math.round(exs.reduce((s, e) => s + Number(e.kcalBurn), 0));
    const exMin = exs.reduce((s, e) => s + e.durationMin, 0);
    const latestBody = await this.bodyRepo.findOne({
      where: { userId, delFlag: 'N' },
      order: { measTime: 'DESC' },
    });
    const latestWeightKg = latestBody?.weightKg ? Number(latestBody.weightKg) : null;
    const latestWeightAt = latestBody?.measTime ? latestBody.measTime.toISOString() : null;
    const latestMeas = await this.measRepo.findOne({
      where: { userId, delFlag: 'N' },
      order: { measTime: 'DESC' },
    });
    const latestWaistCm = latestMeas?.waistCm != null ? Number(latestMeas.waistCm) : null;
    // Apple Health · 今日活动能量 + 步数
    const todaySteps = await this.stepsRepo.findOne({
      where: { userId, stepDate: start, delFlag: 'N' },
    });
    const activeKcalToday = todaySteps?.kcalBurn ? Math.round(Number(todaySteps.kcalBurn)) : 0;
    const stepsToday = todaySteps?.stepCount ?? 0;
    const burnedTotal = burned + activeKcalToday;
    return {
      date: day.date,
      kcalGoal,
      consumed: Math.round(consumed),
      burned,
      activeKcalToday,
      stepsToday,
      remaining: Math.max(0, kcalGoal - Math.round(consumed) + burnedTotal),
      pct: kcalGoal ? Math.min(100, Math.round((consumed / kcalGoal) * 100)) : 0,
      byType: day.byType,
      macros: { carbG: +c.toFixed(1), protG: +p.toFixed(1), fatG: +f.toFixed(1) },
      entryCount: day.entries.length,
      waterMl,
      waterGoal,
      waterPct: waterGoal ? Math.min(100, Math.round((waterMl / waterGoal) * 100)) : 0,
      exMin,
      latestWeightKg,
      latestWeightAt,
      latestWaistCm,
    };
  }
}

@Controller('meal')
@UseGuards(JwtAuthGuard)
export class MealController {
  constructor(private readonly svc: MealService) {}

  @Post('entry')
  @HttpCode(200)
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateMealDto) {
    return this.svc.createEntry(u.id, dto);
  }

  @Get('day')
  day(@CurrentUser() u: AuthUser, @Query('date') date?: string) {
    return this.svc.getDay(u.id, date);
  }

  @Get('days')
  days(@CurrentUser() u: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getDays(u.id, from, to);
  }

  @Delete('entry/:id')
  del(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteEntry(u.id, id);
  }

  @Post('photo/analyze')
  @HttpCode(200)
  analyzePhoto(@Body() dto: AnalyzePhotoDto) {
    return this.svc.analyzePhoto(dto.imageBase64, dto.mimeType);
  }
}

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly svc: MealService) {}

  @Get('today')
  today(@CurrentUser() u: AuthUser) {
    return this.svc.today(u.id);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([MealEntry, MealItem, UserGoal, WaterEntry, ExEntry, BodyWeight, BodyMeasure, BodySteps]),
    VisionModule,
  ],
  controllers: [MealController, StatsController],
  providers: [MealService],
  exports: [MealService],
})
export class MealModule {}
