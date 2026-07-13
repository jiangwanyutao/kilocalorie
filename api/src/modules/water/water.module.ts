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
import { IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Between, Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';
import { WaterEntry, UserGoal } from '@/entities';

class CreateWaterDto {
  @IsInt() @Min(1) @Max(3000) volumeMl!: number;
  @IsOptional() @IsString() @IsIn(['W', 'T', 'C', 'J', 'S']) drinkType?: string;
  @IsOptional() @IsISO8601() drinkTime?: string;
}

const EFFECT_FACTOR: Record<string, number> = {
  W: 1.0, T: 0.95, C: 0.8, J: 0.7, S: 0.6,
};

@Injectable()
export class WaterService {
  constructor(
    @InjectRepository(WaterEntry) private readonly repo: Repository<WaterEntry>,
    @InjectRepository(UserGoal) private readonly goalRepo: Repository<UserGoal>,
    private readonly idGen: IdGeneratorService,
  ) {}

  private zero(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  async create(userId: string, dto: CreateWaterDto) {
    const drinkTime = dto.drinkTime ? new Date(dto.drinkTime) : new Date();
    if (Number.isNaN(drinkTime.getTime())) throw new BadRequestException('drinkTime 无效');
    const drinkDate = this.zero(drinkTime);
    const drinkType = dto.drinkType ?? 'W';
    const effective = Math.round(dto.volumeMl * (EFFECT_FACTOR[drinkType] ?? 1));
    const id = await this.idGen.next('water_entry');
    const now = new Date();
    await this.repo.insert({
      id, userId, drinkTime, drinkDate, drinkType,
      volumeMl: dto.volumeMl, effectiveMl: effective,
      delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
    });
    return this.day(userId);
  }

  async day(userId: string, dateStr?: string) {
    const base = dateStr ? new Date(dateStr) : new Date();
    const start = this.zero(base);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const entries = await this.repo.find({
      where: { userId, drinkDate: Between(start, end), delFlag: 'N' },
      order: { drinkTime: 'ASC' },
    });
    const totalMl = entries.reduce((s, e) => s + e.volumeMl, 0);
    const effectiveMl = entries.reduce((s, e) => s + e.effectiveMl, 0);
    const goal = await this.goalRepo.findOne({
      where: { userId, isCurrent: 'Y', delFlag: 'N' },
      order: { effectiveAt: 'DESC' },
    });
    const goalMl = goal?.waterMl ?? 2000;
    return {
      date: start.toISOString(),
      totalMl, effectiveMl, goalMl,
      pct: goalMl ? Math.min(100, Math.round((effectiveMl / goalMl) * 100)) : 0,
      remaining: Math.max(0, goalMl - effectiveMl),
      entries: entries.map((e) => ({
        id: e.id,
        drinkTime: e.drinkTime,
        drinkType: e.drinkType,
        volumeMl: e.volumeMl,
        effectiveMl: e.effectiveMl,
      })),
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

@Controller('water')
@UseGuards(JwtAuthGuard)
export class WaterController {
  constructor(private readonly svc: WaterService) {}

  @Post('entry')
  @HttpCode(200)
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateWaterDto) {
    return this.svc.create(u.id, dto);
  }

  @Get('day')
  day(@CurrentUser() u: AuthUser, @Query('date') date?: string) {
    return this.svc.day(u.id, date);
  }

  @Delete('entry/:id')
  del(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.del(u.id, id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([WaterEntry, UserGoal])],
  controllers: [WaterController],
  providers: [WaterService],
  exports: [WaterService],
})
export class WaterModule {}
