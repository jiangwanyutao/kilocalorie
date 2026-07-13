import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';
import { BodyWeight, ExEntry, ExType } from '@/entities';

class CreateExDto {
  @IsString() @Length(1, 6) typeId!: string;
  @IsInt() @Min(1) @Max(1440) durationMin!: number;
  @IsOptional() @IsISO8601() exTime?: string;
  @IsOptional() @IsString() @Length(0, 200) note?: string;
}

interface SeedType {
  id: string; name: string; spell: string; cat: string; met: number; intensity: string; icon: string;
}

/** MET 值参考 2011 Compendium of Physical Activities · 精选 12 项常见运动 */
const SEED: SeedType[] = [
  { id: '000001', name: '散步',     spell: 'sanbu',          cat: 'A', met: 3.0,  intensity: 'L', icon: '🚶' },
  { id: '000002', name: '慢跑',     spell: 'manpao',         cat: 'A', met: 7.0,  intensity: 'M', icon: '🏃' },
  { id: '000003', name: '跑步',     spell: 'paobu',          cat: 'A', met: 9.8,  intensity: 'H', icon: '💨' },
  { id: '000004', name: '骑行',     spell: 'qixing',         cat: 'A', met: 8.0,  intensity: 'M', icon: '🚴' },
  { id: '000005', name: '游泳',     spell: 'youyong',        cat: 'A', met: 6.0,  intensity: 'M', icon: '🏊' },
  { id: '000006', name: '跳绳',     spell: 'tiaosheng',      cat: 'A', met: 12.3, intensity: 'H', icon: '🪢' },
  { id: '000007', name: '瑜伽',     spell: 'yujia',          cat: 'F', met: 2.5,  intensity: 'L', icon: '🧘' },
  { id: '000008', name: 'HIIT',    spell: 'hiit',           cat: 'M', met: 8.0,  intensity: 'H', icon: '⚡' },
  { id: '000009', name: '力量训练', spell: 'liliangxunlian', cat: 'S', met: 6.0,  intensity: 'H', icon: '💪' },
  { id: '000010', name: '爬楼梯',   spell: 'paloutui',       cat: 'A', met: 8.8,  intensity: 'M', icon: '🪜' },
  { id: '000011', name: '徒步',     spell: 'tubu',           cat: 'A', met: 6.0,  intensity: 'M', icon: '🥾' },
  { id: '000012', name: '广场舞',   spell: 'guangchangwu',   cat: 'A', met: 4.5,  intensity: 'M', icon: '💃' },
];

const DEFAULT_WEIGHT_KG = 60;

@Injectable()
export class ExerciseService implements OnModuleInit {
  private readonly logger = new Logger('ExerciseService');

  constructor(
    @InjectRepository(ExType) private readonly typeRepo: Repository<ExType>,
    @InjectRepository(ExEntry) private readonly repo: Repository<ExEntry>,
    @InjectRepository(BodyWeight) private readonly bodyRepo: Repository<BodyWeight>,
    private readonly idGen: IdGeneratorService,
  ) {}

  onModuleInit(): void {
    setImmediate(() => {
      this.seedIfEmpty().catch((e: unknown) => {
        this.logger.warn(`ex_type seed 失败：${(e as Error).message}`);
      });
    });
  }

  private async seedIfEmpty(): Promise<void> {
    const count = await this.typeRepo.count({ where: { delFlag: 'N' } });
    if (count > 0) {
      this.logger.log(`ex_type 已有 ${count} 条 · 跳过 seed`);
      return;
    }
    this.logger.log(`ex_type 为空 · 开始 seed ${SEED.length} 条常见运动...`);
    const now = new Date();
    const rows = SEED.map((s) => ({
      id: s.id,
      typeName: s.name,
      spellCode: s.spell,
      category: s.cat,
      metValue: s.met.toFixed(2),
      intensity: s.intensity,
      iconKey: s.icon,
      status: 'A',
      delFlag: 'N',
      createBy: '000000',
      updateBy: '000000',
      createTime: now,
      updateTime: now,
    }));
    await this.typeRepo.insert(rows);
    this.logger.log(`ex_type seed 完成 · 插入 ${rows.length} 条`);
  }

  private zero(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  private async pickWeight(userId: string): Promise<number> {
    const latest = await this.bodyRepo.findOne({
      where: { userId, delFlag: 'N' },
      order: { measTime: 'DESC' },
    });
    if (latest?.weightKg) {
      const w = Number(latest.weightKg);
      if (Number.isFinite(w) && w > 0) return w;
    }
    return DEFAULT_WEIGHT_KG;
  }

  async listTypes() {
    const list = await this.typeRepo.find({
      where: { delFlag: 'N', status: 'A' },
      order: { category: 'ASC', metValue: 'ASC' },
    });
    return list.map((t) => ({
      id: t.id,
      name: t.typeName,
      spell: t.spellCode ?? '',
      category: t.category,
      met: Number(t.metValue),
      intensity: t.intensity,
      icon: t.iconKey ?? '',
    }));
  }

  async create(userId: string, dto: CreateExDto) {
    const type = await this.typeRepo.findOne({ where: { id: dto.typeId, delFlag: 'N' } });
    if (!type) throw new NotFoundException('运动类型不存在');
    const exTime = dto.exTime ? new Date(dto.exTime) : new Date();
    if (Number.isNaN(exTime.getTime())) throw new BadRequestException('exTime 无效');
    const exDate = this.zero(exTime);
    const weightKg = await this.pickWeight(userId);
    const met = Number(type.metValue);
    const hours = dto.durationMin / 60;
    const kcal = +(met * weightKg * hours).toFixed(2);
    const id = await this.idGen.next('ex_entry');
    const now = new Date();
    await this.repo.insert({
      id, userId, typeId: type.id, typeName: type.typeName,
      exDate, exTime, durationMin: dto.durationMin,
      weightKg: weightKg.toFixed(2),
      kcalBurn: kcal.toFixed(2),
      note: dto.note,
      delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
    });
    return this.day(userId);
  }

  async day(userId: string, dateStr?: string) {
    const base = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(base.getTime())) throw new BadRequestException('date 无效');
    const start = this.zero(base);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const entries = await this.repo.find({
      where: { userId, exDate: Between(start, end), delFlag: 'N' },
      order: { exTime: 'ASC' },
    });
    const totalMin = entries.reduce((s, e) => s + e.durationMin, 0);
    const totalKcal = entries.reduce((s, e) => s + Number(e.kcalBurn), 0);
    return {
      date: start.toISOString(),
      totalMin,
      totalKcal: Math.round(totalKcal),
      entries: entries.map((e) => ({
        id: e.id,
        typeId: e.typeId,
        typeName: e.typeName,
        exTime: e.exTime,
        durationMin: e.durationMin,
        kcalBurn: Number(e.kcalBurn),
      })),
    };
  }

  async history(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, days)));
    const rows = await this.repo.find({
      where: { userId, delFlag: 'N', exDate: MoreThanOrEqual(this.zero(since)) },
      order: { exTime: 'DESC' },
    });
    return rows.map((e) => ({
      id: e.id,
      typeId: e.typeId,
      typeName: e.typeName,
      exTime: e.exTime,
      durationMin: e.durationMin,
      kcalBurn: Number(e.kcalBurn),
      note: e.note ?? null,
    }));
  }

  async summary(userId: string, days = 30) {
    const list = await this.history(userId, days);
    if (!list.length) return { count: 0, totalMin: 0, totalKcal: 0, byType: {} as Record<string, { count: number; totalMin: number; totalKcal: number }>, history: [] };
    const totalMin = list.reduce((s, e) => s + e.durationMin, 0);
    const totalKcal = list.reduce((s, e) => s + e.kcalBurn, 0);
    const byType: Record<string, { count: number; totalMin: number; totalKcal: number }> = {};
    for (const e of list) {
      const k = e.typeName;
      byType[k] = byType[k] ?? { count: 0, totalMin: 0, totalKcal: 0 };
      byType[k].count++;
      byType[k].totalMin += e.durationMin;
      byType[k].totalKcal += e.kcalBurn;
    }
    return {
      count: list.length,
      totalMin,
      totalKcal: Math.round(totalKcal),
      byType,
      history: list,
    };
  }

  async del(userId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, userId, delFlag: 'N' } });
    if (!e) throw new NotFoundException('记录不存在');
    const now = new Date();
    await this.repo.update({ id }, { delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now });
    return this.day(userId);
  }
}

@Controller('exercise')
@UseGuards(JwtAuthGuard)
export class ExerciseController {
  constructor(private readonly svc: ExerciseService) {}

  @Get('types')
  types() {
    return this.svc.listTypes();
  }

  @Post('entry')
  @HttpCode(200)
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateExDto) {
    return this.svc.create(u.id, dto);
  }

  @Get('day')
  day(@CurrentUser() u: AuthUser, @Query('date') date?: string) {
    return this.svc.day(u.id, date);
  }

  @Get('history')
  history(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.history(u.id, days ? Number(days) : 30);
  }

  @Get('summary')
  summary(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.summary(u.id, days ? Number(days) : 30);
  }

  @Delete('entry/:id')
  del(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.del(u.id, id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ExType, ExEntry, BodyWeight])],
  controllers: [ExerciseController],
  providers: [ExerciseService],
  exports: [ExerciseService],
})
export class ExerciseModule {}
