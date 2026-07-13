import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { BodySleep, BodySteps, BodyWeight, ExEntry, ExType, HlthImport, UserInfo } from '@/entities';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';

/** Apple Watch → 千卡日记内置运动类型的模糊映射 · 认不出走 000001 散步 */
function mapWorkoutToExTypeId(raw?: string): string {
  if (!raw) return '000001';
  const s = raw.toLowerCase();
  if (s.includes('run')) return '000003';           // 跑步
  if (s.includes('walk')) return '000001';          // 散步
  if (s.includes('cycl') || s.includes('bik')) return '000004';   // 骑行
  if (s.includes('swim')) return '000005';          // 游泳
  if (s.includes('jumprope') || s.includes('jump_rope') || s.includes('skip')) return '000006';  // 跳绳
  if (s.includes('yoga')) return '000007';          // 瑜伽
  if (s.includes('intensity') || s.includes('hiit')) return '000008';  // HIIT
  if (s.includes('strength') || s.includes('functional') || s.includes('crossfit') || s.includes('rowing')) return '000009';  // 力量训练
  if (s.includes('stair') || s.includes('climb')) return '000010';  // 爬楼梯
  if (s.includes('hik')) return '000011';           // 徒步
  if (s.includes('dance')) return '000012';         // 广场舞
  if (s.includes('elliptical')) return '000002';    // 慢跑 兜底
  return '000001';
}

class SampleDto {
  @IsString() @IsIn(['weight', 'steps', 'distance', 'activeKcal', 'workout', 'sleep']) type!: string;
  @IsNumber() value!: number;
  @IsOptional() @IsString() @Length(0, 10) unit?: string;
  @IsISO8601() date!: string;
  @IsOptional() @IsString() @Length(0, 30) source?: string;
  // Workout 用
  @IsOptional() @IsString() @Length(0, 60) activityType?: string;
  @IsOptional() @IsNumber() kcalBurned?: number;
  @IsOptional() @IsNumber() distanceM?: number;
  // Sleep · workout 时段
  @IsOptional() @IsISO8601() startTime?: string;
  @IsOptional() @IsISO8601() endTime?: string;
  // Sleep 分段
  @IsOptional() @IsNumber() deepMin?: number;
  @IsOptional() @IsNumber() remMin?: number;
  @IsOptional() @IsNumber() inBedMin?: number;
}

class IngestDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => SampleDto)
  samples!: SampleDto[];
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger('HealthService');

  constructor(
    @InjectRepository(HlthImport) private readonly importRepo: Repository<HlthImport>,
    @InjectRepository(BodyWeight) private readonly weightRepo: Repository<BodyWeight>,
    @InjectRepository(BodySteps) private readonly stepsRepo: Repository<BodySteps>,
    @InjectRepository(BodySleep) private readonly sleepRepo: Repository<BodySleep>,
    @InjectRepository(ExType) private readonly exTypeRepo: Repository<ExType>,
    @InjectRepository(ExEntry) private readonly exEntryRepo: Repository<ExEntry>,
    @InjectRepository(UserInfo) private readonly userRepo: Repository<UserInfo>,
    private readonly idGen: IdGeneratorService,
  ) {}

  private zero(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  private calcBmi(weightKg: number, heightCmStr?: string | null): number | null {
    if (!heightCmStr) return null;
    const h = Number(heightCmStr) / 100;
    if (!Number.isFinite(h) || h <= 0) return null;
    return +(weightKg / (h * h)).toFixed(2);
  }

  /** Shortcut / 其他外部工具 · 一批 samples 批量导入 */
  async ingest(userId: string, dto: IngestDto) {
    const importId = await this.idGen.next('hlth_import');
    const now = new Date();
    const times = dto.samples.map((s) => new Date(s.date).getTime()).filter((t) => !Number.isNaN(t));
    const startTime = times.length ? new Date(Math.min(...times)) : now;
    const endTime = times.length ? new Date(Math.max(...times)) : now;

    let weightCnt = 0;
    let stepsCnt = 0;
    let workoutCnt = 0;
    let sleepCnt = 0;
    const errors: string[] = [];

    const user = await this.userRepo.findOne({ where: { id: userId, delFlag: 'N' } });

    for (const s of dto.samples) {
      try {
        const t = new Date(s.date);
        if (Number.isNaN(t.getTime())) throw new BadRequestException('date 无效');
        if (s.type === 'weight') {
          if (s.value < 20 || s.value > 300) throw new BadRequestException('weight 超范围');
          const measDate = this.zero(t);
          const exists = await this.weightRepo.findOne({
            where: { userId, measDate, delFlag: 'N' },
          });
          if (exists && Math.abs(Number(exists.weightKg) - s.value) < 0.01) continue;
          const id = await this.idGen.next('body_weight');
          const bmi = this.calcBmi(s.value, user?.heightCm);
          await this.weightRepo.insert({
            id, userId, measTime: t, measDate,
            weightKg: s.value.toFixed(2),
            bmi: bmi != null ? bmi.toFixed(2) : (null as unknown as string),
            entrySrc: 'H', note: s.source ?? 'iOS Health',
            delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
          });
          weightCnt++;
        } else if (s.type === 'steps') {
          if (s.value < 0 || s.value > 100000) throw new BadRequestException('steps 超范围');
          const stepDate = this.zero(t);
          const exists = await this.stepsRepo.findOne({ where: { userId, stepDate, delFlag: 'N' } });
          if (exists) {
            await this.stepsRepo.update({ id: exists.id }, {
              stepCount: Math.round(s.value),
              entrySrc: 'H', updateTime: now, updateBy: userId,
            });
          } else {
            const id = await this.idGen.next('body_steps');
            await this.stepsRepo.insert({
              id, userId, stepDate, stepCount: Math.round(s.value),
              entrySrc: 'H',
              delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
            });
          }
          stepsCnt++;
        } else if (s.type === 'distance') {
          // 距离米 · 更新到当日 body_steps.distance_m · 无 row 则建
          if (s.value < 0 || s.value > 300_000) throw new BadRequestException('distance 超范围');
          const stepDate = this.zero(t);
          const exists = await this.stepsRepo.findOne({ where: { userId, stepDate, delFlag: 'N' } });
          if (exists) {
            await this.stepsRepo.update({ id: exists.id }, { distanceM: Math.round(s.value), updateTime: now, updateBy: userId });
          } else {
            const id = await this.idGen.next('body_steps');
            await this.stepsRepo.insert({
              id, userId, stepDate, stepCount: 0, distanceM: Math.round(s.value),
              entrySrc: 'H', delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
            });
          }
          stepsCnt++;
        } else if (s.type === 'activeKcal') {
          if (s.value < 0 || s.value > 20_000) throw new BadRequestException('activeKcal 超范围');
          const stepDate = this.zero(t);
          const exists = await this.stepsRepo.findOne({ where: { userId, stepDate, delFlag: 'N' } });
          if (exists) {
            await this.stepsRepo.update({ id: exists.id }, { kcalBurn: s.value.toFixed(2), updateTime: now, updateBy: userId });
          } else {
            const id = await this.idGen.next('body_steps');
            await this.stepsRepo.insert({
              id, userId, stepDate, stepCount: 0, kcalBurn: s.value.toFixed(2),
              entrySrc: 'H', delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
            });
          }
          stepsCnt++;
        } else if (s.type === 'workout') {
          const durationMin = Math.max(1, Math.min(1440, Math.round(s.value)));
          const typeId = mapWorkoutToExTypeId(s.activityType);
          const exType = await this.exTypeRepo.findOne({ where: { id: typeId, delFlag: 'N' } });
          if (!exType) throw new BadRequestException(`ex_type ${typeId} 不存在`);
          const exTime = s.startTime ? new Date(s.startTime) : t;
          const exDate = this.zero(exTime);
          // 去重：同用户 · 同 typeId · exTime 前后 3 分钟内视为同一次
          const win = 3 * 60_000;
          const dup = await this.exEntryRepo
            .createQueryBuilder('e')
            .where("e.user_id = :uid AND e.type_id = :tid AND e.del_flag = 'N'", { uid: userId, tid: typeId })
            .andWhere('e.ex_time BETWEEN :a AND :b', { a: new Date(exTime.getTime() - win), b: new Date(exTime.getTime() + win) })
            .getOne();
          if (dup) continue;
          const kcal = s.kcalBurned != null ? s.kcalBurned : Number(exType.metValue) * 60 * (durationMin / 60);
          const id = await this.idGen.next('ex_entry');
          await this.exEntryRepo.insert({
            id, userId,
            typeId: exType.id, typeName: exType.typeName,
            exDate, exTime, durationMin,
            weightKg: undefined,
            kcalBurn: kcal.toFixed(2),
            note: `来自 Apple Health · ${s.activityType ?? ''}`.slice(0, 200),
            delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
          });
          workoutCnt++;
        } else if (s.type === 'sleep') {
          const asleepMin = Math.max(1, Math.min(1440, Math.round(s.value)));
          // 归属：起床日 = 结束时间那天（Apple 睡眠"夜晚"通常横跨两天 · 挑醒来那天）
          const wake = s.endTime ? new Date(s.endTime) : t;
          const inBed = s.startTime ? new Date(s.startTime) : undefined;
          const sleepDate = this.zero(wake);
          const exists = await this.sleepRepo.findOne({ where: { userId, sleepDate, delFlag: 'N' } });
          if (exists) {
            await this.sleepRepo.update({ id: exists.id }, {
              asleepMin,
              inBedMin: s.inBedMin ?? exists.inBedMin,
              deepMin: s.deepMin ?? exists.deepMin,
              remMin: s.remMin ?? exists.remMin,
              inBedTime: inBed ?? exists.inBedTime,
              wakeTime: wake,
              entrySrc: 'H', updateTime: now, updateBy: userId,
            });
          } else {
            const id = await this.idGen.next('body_sleep');
            await this.sleepRepo.insert({
              id, userId, sleepDate,
              inBedTime: inBed, wakeTime: wake,
              asleepMin,
              inBedMin: s.inBedMin,
              deepMin: s.deepMin,
              remMin: s.remMin,
              entrySrc: 'H',
              delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
            });
          }
          sleepCnt++;
        }
      } catch (e) {
        errors.push(`${s.type} ${s.date}: ${(e as Error).message ?? 'err'}`);
      }
    }

    const total = weightCnt + stepsCnt + workoutCnt + sleepCnt;
    await this.importRepo.insert({
      id: importId, userId,
      fileKey: 'shortcut',
      fileSize: JSON.stringify(dto.samples).length,
      importStatus: errors.length && !total ? 'F' : 'S',
      weightCnt, stepsCnt, hrCnt: 0, workoutCnt, sleepCnt,
      errorMsg: errors.slice(0, 5).join(' | ').slice(0, 500) || undefined,
      startTime, endTime, finishTime: new Date(),
      delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
    } as Record<string, unknown>);

    this.logger.log(`ingest · user=${userId} weight=${weightCnt} steps=${stepsCnt} workout=${workoutCnt} sleep=${sleepCnt} errors=${errors.length}`);
    return {
      importId, weightCnt, stepsCnt, workoutCnt, sleepCnt,
      errorCount: errors.length,
      errors: errors.slice(0, 5),
    };
  }

  async history(userId: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, days)));
    return this.importRepo.find({
      where: { userId, delFlag: 'N', createTime: MoreThanOrEqual(since) },
      order: { createTime: 'DESC' },
      take: 100,
    });
  }
}

@Controller('health')
@UseGuards(JwtAuthGuard)
export class HealthController {
  constructor(private readonly svc: HealthService) {}

  @Post('samples')
  @HttpCode(200)
  ingest(@CurrentUser() u: AuthUser, @Body() dto: IngestDto) {
    return this.svc.ingest(u.id, dto);
  }

  @Get('imports')
  history(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.history(u.id, days ? Number(days) : 90);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([HlthImport, BodyWeight, BodySteps, BodySleep, ExType, ExEntry, UserInfo])],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
