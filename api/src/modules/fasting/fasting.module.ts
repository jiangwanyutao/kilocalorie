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
import { IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { FastSession } from '@/entities';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';

/** 支持的计划码 · 每个对应固定小时数 */
const PLAN_HOURS: Record<string, number> = {
  '14': 14,
  '16': 16,
  '18': 18,
};

class StartFastDto {
  @IsString() @IsIn(Object.keys(PLAN_HOURS)) planCode!: string;
  @IsOptional() @IsISO8601() startTime?: string;
}

class EndFastDto {
  @IsOptional() @IsString() @Length(0, 200) note?: string;
}

@Injectable()
export class FastingService {
  constructor(
    @InjectRepository(FastSession) private readonly repo: Repository<FastSession>,
    private readonly idGen: IdGeneratorService,
  ) {}

  private async findRunning(userId: string): Promise<FastSession | null> {
    return this.repo.findOne({
      where: { userId, status: 'R', delFlag: 'N' },
      order: { startTime: 'DESC' },
    });
  }

  async start(userId: string, dto: StartFastDto) {
    const running = await this.findRunning(userId);
    if (running) {
      throw new BadRequestException('已有一段进行中的断食 · 请先结束');
    }
    const start = dto.startTime ? new Date(dto.startTime) : new Date();
    if (Number.isNaN(start.getTime())) throw new BadRequestException('startTime 无效');
    const hours = PLAN_HOURS[dto.planCode];
    const planEnd = new Date(start.getTime() + hours * 3600_000);
    const id = await this.idGen.next('fast_session');
    const now = new Date();
    await this.repo.insert({
      id, userId,
      planCode: dto.planCode,
      startTime: start,
      planEndTime: planEnd,
      status: 'R',
      delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
    });
    return this.current(userId);
  }

  async end(userId: string, dto: EndFastDto = {}) {
    const running = await this.findRunning(userId);
    if (!running) throw new NotFoundException('没有进行中的断食');
    const now = new Date();
    const actualHours = (now.getTime() - new Date(running.startTime).getTime()) / 3600_000;
    const completed = now.getTime() >= new Date(running.planEndTime).getTime();
    await this.repo.update({ id: running.id }, {
      status: completed ? 'C' : 'A',
      endTime: now,
      actualHours: actualHours.toFixed(2),
      note: dto.note,
      updateTime: now,
      updateBy: userId,
    });
    return {
      id: running.id,
      status: completed ? 'C' : 'A',
      actualHours: +actualHours.toFixed(2),
      planHours: PLAN_HOURS[running.planCode],
      completed,
    };
  }

  async current(userId: string) {
    const running = await this.findRunning(userId);
    if (!running) return null;
    const now = new Date();
    const startMs = new Date(running.startTime).getTime();
    const endMs = new Date(running.planEndTime).getTime();
    const totalMs = endMs - startMs;
    const elapsedMs = Math.max(0, now.getTime() - startMs);
    const remainingMs = Math.max(0, endMs - now.getTime());
    const pct = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;
    return {
      id: running.id,
      planCode: running.planCode,
      planHours: PLAN_HOURS[running.planCode],
      startTime: running.startTime,
      planEndTime: running.planEndTime,
      elapsedMin: Math.floor(elapsedMs / 60_000),
      remainingMin: Math.floor(remainingMs / 60_000),
      pct,
      done: pct >= 100,
    };
  }

  async history(userId: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, days)));
    const list = await this.repo.find({
      where: { userId, delFlag: 'N', startTime: MoreThanOrEqual(since) },
      order: { startTime: 'DESC' },
      take: 100,
    });
    return list.map((f) => ({
      id: f.id,
      planCode: f.planCode,
      planHours: PLAN_HOURS[f.planCode] ?? null,
      startTime: f.startTime,
      endTime: f.endTime ?? null,
      status: f.status,
      actualHours: f.actualHours ? Number(f.actualHours) : null,
      note: f.note ?? null,
    }));
  }

  async del(userId: string, id: string) {
    const f = await this.repo.findOne({ where: { id, userId, delFlag: 'N' } });
    if (!f) throw new NotFoundException('记录不存在');
    if (f.status === 'R') throw new BadRequestException('进行中的会话请先结束再删除');
    const now = new Date();
    await this.repo.update({ id }, { delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now });
    return { success: true };
  }
}

@Controller('fasting')
@UseGuards(JwtAuthGuard)
export class FastingController {
  constructor(private readonly svc: FastingService) {}

  @Post('start')
  @HttpCode(200)
  start(@CurrentUser() u: AuthUser, @Body() dto: StartFastDto) {
    return this.svc.start(u.id, dto);
  }

  @Post('end')
  @HttpCode(200)
  end(@CurrentUser() u: AuthUser, @Body() dto: EndFastDto) {
    return this.svc.end(u.id, dto);
  }

  @Get('current')
  current(@CurrentUser() u: AuthUser) {
    return this.svc.current(u.id);
  }

  @Get('history')
  history(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    return this.svc.history(u.id, days ? Number(days) : 90);
  }

  @Delete(':id')
  del(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.del(u.id, id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([FastSession])],
  controllers: [FastingController],
  providers: [FastingService],
  exports: [FastingService],
})
export class FastingModule {}
