import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';

import { IdGeneratorService } from '@/common/id-generator.service';
import { REDIS_CLIENT } from '@/common/redis.module';
import { AiConv, AiMemory, AiMemoryLog, AiMsg, AiUsage } from '@/entities';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.helpers';
import type { AuthUser } from '../auth/jwt.strategy';
import { BodyModule, BodyService } from '../body/body.module';
import { ExerciseModule, ExerciseService } from '../exercise/exercise.module';
import { FastingModule, FastingService } from '../fasting/fasting.module';
import { FoodModule, FoodService } from '../food/food.module';
import { KnowledgeModule, KnowledgeService } from '../knowledge/knowledge.module';
import { MealModule, MealService } from '../meal/meal.module';
import { WaterModule, WaterService } from '../water/water.module';
import {
  LlmModule,
  LlmService,
  type LlmMessage,
  type MemType,
  type MemoryProposal,
  type ToolCall,
  type ToolCallWithId,
  type ToolName,
} from './llm';

const REDIS_CTX_TTL = 24 * 60 * 60;
const REDIS_CTX_MAX = 40;
/** LLM 工具循环上限 · 防止无限调用 */
const MAX_TOOL_ITERS = 5;

export type StreamServerEvent =
  | { type: 'chunk'; text: string }
  | { type: 'tool'; name: ToolName }
  | { type: 'memory'; logId: string; content: string; memType: MemType };

/** 每日 AI 对话配额（次） · MVP 阶段先给宽 · 后续按付费墙分层 */
const DAILY_QUOTA_CH = 100;

/** DeepSeek deepseek-chat 定价 · ¥/token */
const COST_PER_IN_TOKEN = 0.000002;   // 2 ¥/M
const COST_PER_OUT_TOKEN = 0.000008;  // 8 ¥/M

class CreateConvDto {
  @IsOptional() @IsString() @IsIn(['T', 'D', 'F', 'N']) personaCode?: string;
}
class SendMsgDto {
  @IsString() @Length(1, 2000) content!: string;
}
class ConfirmMemoryDto {
  @IsString() @IsIn(['A', 'R']) action!: string;
}
class AddMemoryDto {
  @IsString() @Length(1, 500) memContent!: string;
  @IsString() @IsIn(['F', 'P', 'G', 'H']) memType!: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) importance?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(AiConv) private readonly convRepo: Repository<AiConv>,
    @InjectRepository(AiMsg) private readonly msgRepo: Repository<AiMsg>,
    @InjectRepository(AiMemory) private readonly memRepo: Repository<AiMemory>,
    @InjectRepository(AiMemoryLog) private readonly memLogRepo: Repository<AiMemoryLog>,
    @InjectRepository(AiUsage) private readonly usageRepo: Repository<AiUsage>,
    private readonly idGen: IdGeneratorService,
    private readonly llm: LlmService,
    private readonly meal: MealService,
    private readonly body: BodyService,
    private readonly food: FoodService,
    private readonly water: WaterService,
    private readonly exercise: ExerciseService,
    private readonly fasting: FastingService,
    private readonly kb: KnowledgeService,
  ) {}

  async createConv(userId: string, personaCode = 'T') {
    const id = await this.idGen.next('ai_conv');
    const now = new Date();
    await this.convRepo.insert({
      id, userId, personaCode,
      msgCount: 0, lastMsgTime: now,
      status: 'A',
      delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
    });
    return { id, userId, personaCode, msgCount: 0, lastMsgTime: now, status: 'A' };
  }

  async listConvs(userId: string) {
    return this.convRepo.find({
      where: { userId, delFlag: 'N' },
      order: { lastMsgTime: 'DESC' },
      take: 50,
    });
  }

  async getMessages(userId: string, convId: string) {
    const conv = await this.mustOwn(userId, convId);
    const rows = await this.msgRepo.find({
      where: { convId: conv.id, delFlag: 'N' },
      order: { msgTime: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.contentText ?? String((r.content as { text?: string }).text ?? ''),
      msgTime: r.msgTime,
    }));
  }

  async deleteConv(userId: string, convId: string) {
    const conv = await this.mustOwn(userId, convId);
    const now = new Date();
    await this.convRepo.update({ id: conv.id }, { delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now });
    await this.redis.del(this.ctxKey(conv.id)).catch(() => undefined);
    return { success: true };
  }

  private async mustOwn(userId: string, convId: string): Promise<AiConv> {
    const conv = await this.convRepo.findOne({ where: { id: convId, delFlag: 'N' } });
    if (!conv) throw new NotFoundException('会话不存在');
    if (conv.userId !== userId) throw new ForbiddenException('无权访问此会话');
    return conv;
  }

  /**
   * 流式发消息 · 每轮 LLM chatStream · 文本增量通过 onEvent 直传前端
   * 与 sendMessage 共享 90% 逻辑（工具循环 · 记忆 · 用量 · Redis 上下文）
   */
  async sendMessageStream(
    userId: string,
    convId: string,
    content: string,
    onEvent: (event: StreamServerEvent) => void,
  ): Promise<{ assistantMsgId: string; memoryPending: { logId: string; content: string; memType: MemType } | null }> {
    const conv = await this.mustOwn(userId, convId);
    await this.checkQuota(userId, 'CH');
    const now = new Date();

    const userMsgId = await this.idGen.next('ai_msg');
    await this.msgRepo.insert({
      id: userMsgId, convId: conv.id, userId,
      role: 'U', content: { text: content }, contentText: content.slice(0, 4000),
      msgTime: now, delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    });

    const stack: LlmMessage[] = [
      { role: 'system', content: this.systemPrompt(conv.personaCode) },
      ...await this.loadShortTerm(conv.id),
      { role: 'user', content },
    ];

    const allToolCalls: ToolCall[] = [];
    let finalReply = '';
    let memoryPending: { logId: string; content: string; memType: MemType } | null = null;
    let totalIn = 0;
    let totalOut = 0;

    for (let iter = 0; iter < MAX_TOOL_ITERS; iter++) {
      const turn = await this.llm.chatStream(stack, (delta) => {
        if (delta.content) onEvent({ type: 'chunk', text: delta.content });
      });
      totalIn += turn.usage?.inTokens ?? 0;
      totalOut += turn.usage?.outTokens ?? 0;
      if (turn.reply) finalReply = turn.reply;
      if (!turn.toolCalls?.length) break;

      const withIds: ToolCallWithId[] = turn.toolCalls.map((tc, i) => ({
        ...tc,
        id: `call_${iter}_${i}_${Date.now().toString(36)}`,
      }));
      stack.push({ role: 'assistant', content: turn.reply || '', toolCalls: withIds });

      for (const tc of withIds) {
        allToolCalls.push(tc);
        onEvent({ type: 'tool', name: tc.name });
        let result: string;
        try { result = await this.execTool(userId, tc); }
        catch (e) { result = JSON.stringify({ error: (e as Error).message ?? 'tool error' }); }
        stack.push({ role: 'tool', content: result, toolCallId: tc.id, name: tc.name });
      }
    }

    // 记忆提议
    const rememberCall = allToolCalls.find((t) => t.name === 'remember');
    if (rememberCall) {
      const propose: MemoryProposal = {
        memType: (rememberCall.args.memType as MemType) ?? 'F',
        memContent: String(rememberCall.args.memContent ?? '').slice(0, 500),
        importance: Number(rememberCall.args.importance ?? 6),
        reason: '会话中提出',
      };
      if (propose.memContent) {
        const p = await this.proposeMemory(userId, conv.id, userMsgId, propose);
        memoryPending = { logId: p.logId, content: propose.memContent, memType: propose.memType };
        onEvent({ type: 'memory', logId: p.logId, content: propose.memContent, memType: propose.memType });
      }
    }

    // 存 assistant 消息
    const asstMsgId = await this.idGen.next('ai_msg');
    const asstNow = new Date();
    await this.msgRepo.insert({
      id: asstMsgId, convId: conv.id, userId,
      role: 'A', content: { text: finalReply, tools: allToolCalls.map((t) => t.name) },
      contentText: finalReply.slice(0, 4000),
      provider: this.llm.name(), modelName: this.llm.name(),
      msgTime: asstNow, delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: asstNow, updateTime: asstNow,
    });

    await this.convRepo.update({ id: conv.id }, {
      msgCount: conv.msgCount + 2,
      lastMsgTime: asstNow,
      title: conv.title ?? content.slice(0, 40),
      updateTime: asstNow,
      updateBy: userId,
    });

    // Redis 短期 · fire-and-forget
    this.pushShortTerm(conv.id, { role: 'user', content });
    this.pushShortTerm(conv.id, { role: 'assistant', content: finalReply });

    // 用量记录 · fire-and-forget
    this.recordUsage(userId, 'CH', totalIn, totalOut).catch((e) => {
      this.logger.warn(`记 usage 失败：${(e as Error).message}`);
    });

    return { assistantMsgId: asstMsgId, memoryPending };
  }

  async sendMessage(userId: string, convId: string, content: string) {
    const conv = await this.mustOwn(userId, convId);

    // 0) 配额检查 · 阻止超出的请求
    await this.checkQuota(userId, 'CH');

    const now = new Date();

    // 1) 存用户消息
    const userMsgId = await this.idGen.next('ai_msg');
    await this.msgRepo.insert({
      id: userMsgId, convId: conv.id, userId,
      role: 'U', content: { text: content }, contentText: content.slice(0, 4000),
      msgTime: now, delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    });

    // 2) 构建 LLM 消息栈
    const stack: LlmMessage[] = [
      { role: 'system', content: this.systemPrompt(conv.personaCode) },
      ...await this.loadShortTerm(conv.id),
      { role: 'user', content },
    ];

    // 3) 工具循环 · LLM 决定何时收手（无 tool_calls 就退出）
    const toolResults: { name: ToolName; result: string }[] = [];
    const allToolCalls: ToolCall[] = [];
    let finalReply = '';
    let memoryPending: { logId: string; content: string; memType: MemType } | null = null;
    let totalIn = 0;
    let totalOut = 0;

    for (let iter = 0; iter < MAX_TOOL_ITERS; iter++) {
      const turn = await this.llm.chat(stack);
      totalIn += turn.usage?.inTokens ?? 0;
      totalOut += turn.usage?.outTokens ?? 0;
      finalReply = turn.reply || finalReply;
      if (!turn.toolCalls?.length) break;

      // 给工具调用打 id · 拼到 assistant 消息里 · 让下一轮 tool 消息能对得上
      const withIds: ToolCallWithId[] = turn.toolCalls.map((tc, i) => ({
        ...tc,
        id: `call_${iter}_${i}_${Date.now().toString(36)}`,
      }));

      stack.push({
        role: 'assistant',
        content: turn.reply || '',
        toolCalls: withIds,
      });

      for (const tc of withIds) {
        allToolCalls.push(tc);
        let result: string;
        try {
          result = await this.execTool(userId, tc);
        } catch (e) {
          result = JSON.stringify({ error: (e as Error).message ?? 'tool error' });
        }
        toolResults.push({ name: tc.name, result });
        stack.push({
          role: 'tool',
          content: result,
          toolCallId: tc.id,
          name: tc.name,
        });
      }
    }

    // 4) 记忆写入提议 · 循环里任一轮出现 remember 都要 propose
    const rememberCall = allToolCalls.find((t) => t.name === 'remember');
    if (rememberCall) {
      const propose: MemoryProposal = {
        memType: (rememberCall.args.memType as MemType) ?? 'F',
        memContent: String(rememberCall.args.memContent ?? '').slice(0, 500),
        importance: Number(rememberCall.args.importance ?? 6),
        reason: '会话中提出',
      };
      if (propose.memContent) {
        const p = await this.proposeMemory(userId, conv.id, userMsgId, propose);
        memoryPending = { logId: p.logId, content: propose.memContent, memType: propose.memType };
      }
    }

    // 6) 存 assistant 消息
    const asstMsgId = await this.idGen.next('ai_msg');
    const asstNow = new Date();
    await this.msgRepo.insert({
      id: asstMsgId, convId: conv.id, userId,
      role: 'A', content: { text: finalReply, tools: toolResults.map((t) => t.name) },
      contentText: finalReply.slice(0, 4000),
      provider: this.llm.name(), modelName: this.llm.name(),
      msgTime: asstNow, delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: asstNow, updateTime: asstNow,
    });

    // 7) 更 conv 汇总
    await this.convRepo.update({ id: conv.id }, {
      msgCount: conv.msgCount + 2,
      lastMsgTime: asstNow,
      title: conv.title ?? content.slice(0, 40),
      updateTime: asstNow,
      updateBy: userId,
    });

    // 8) Redis 短期上下文（fire-and-forget · 不 await）
    this.pushShortTerm(conv.id, { role: 'user', content });
    this.pushShortTerm(conv.id, { role: 'assistant', content: finalReply });

    // 9) 用量记录 · fire-and-forget · 别让统计影响响应
    this.recordUsage(userId, 'CH', totalIn, totalOut).catch((e) => {
      this.logger.warn(`记 usage 失败：${(e as Error).message}`);
    });

    return {
      reply: finalReply,
      toolCalls: toolResults.map((t) => t.name),
      memoryPending,
      assistantMsgId: asstMsgId,
    };
  }

  // ============ 用量与配额 ============

  private zeroDate(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  async checkQuota(userId: string, kind: 'CH' | 'PH' | 'DL') {
    const today = this.zeroDate(new Date());
    const row = await this.usageRepo.findOne({
      where: { userId, usageDate: today, usageKind: kind, delFlag: 'N' },
    });
    if (!row) return; // 今日还没记 · 直接放行
    if (row.usedCount >= row.quotaCount) {
      throw new HttpException(
        `今日 AI 对话额度已用完（${row.quotaCount} 次）· 明日 0 点重置`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordUsage(userId: string, kind: 'CH' | 'PH' | 'DL', inTokens: number, outTokens: number) {
    const today = this.zeroDate(new Date());
    const cost = inTokens * COST_PER_IN_TOKEN + outTokens * COST_PER_OUT_TOKEN;
    const now = new Date();
    const existing = await this.usageRepo.findOne({
      where: { userId, usageDate: today, usageKind: kind, delFlag: 'N' },
    });
    if (!existing) {
      const id = await this.idGen.next('ai_usage');
      const quota = kind === 'CH' ? DAILY_QUOTA_CH : 20;
      await this.usageRepo.insert({
        id, userId, usageDate: today, usageKind: kind,
        usedCount: 1, quotaCount: quota,
        totalCost: cost.toFixed(4),
        delFlag: 'N', createBy: userId, updateBy: userId, createTime: now, updateTime: now,
      });
      return;
    }
    const newCost = (Number(existing.totalCost) + cost).toFixed(4);
    await this.usageRepo.update({ id: existing.id }, {
      usedCount: existing.usedCount + 1,
      totalCost: newCost,
      updateTime: now,
      updateBy: userId,
    });
  }

  async getTodayUsage(userId: string) {
    const today = this.zeroDate(new Date());
    const rows = await this.usageRepo.find({
      where: { userId, usageDate: today, delFlag: 'N' },
    });
    const chat = rows.find((r) => r.usageKind === 'CH');
    return {
      chat: {
        used: chat?.usedCount ?? 0,
        quota: chat?.quotaCount ?? DAILY_QUOTA_CH,
        remaining: (chat?.quotaCount ?? DAILY_QUOTA_CH) - (chat?.usedCount ?? 0),
        totalCostYuan: chat ? +Number(chat.totalCost).toFixed(4) : 0,
      },
      provider: this.llm.name(),
    };
  }

  private async execTool(userId: string, call: ToolCall): Promise<string> {
    this.logger.log(`tool · ${call.name} args=${JSON.stringify(call.args).slice(0, 120)}`);
    switch (call.name) {
      case 'get_today_summary':
        return JSON.stringify(await this.meal.today(userId));
      case 'get_weight_history':
        return JSON.stringify(await this.body.summary(userId));
      case 'search_food': {
        const q = String(call.args.query ?? '');
        const limit = Number(call.args.limit ?? 10);
        return JSON.stringify(await this.food.search(q, undefined, limit));
      }
      case 'log_food': {
        const a = call.args;
        return JSON.stringify(await this.meal.createEntry(userId, {
          mealType: (a.mealType as string) ?? 'S',
          mealTime: (a.mealTime as string) ?? new Date().toISOString(),
          entrySrc: 'A',
          items: [{
            foodName: String(a.foodName ?? '未命名'),
            foodSrc: 'X',
            portionMode: 'G',
            portionQty: Number(a.actualG ?? 100),
            actualG: Number(a.actualG ?? 100),
            kcal: Number(a.kcal ?? 0),
            carbG: Number(a.carbG ?? 0),
            protG: Number(a.protG ?? 0),
            fatG: Number(a.fatG ?? 0),
          }],
        }));
      }
      case 'log_water':
        return JSON.stringify(await this.water.create(userId, {
          volumeMl: Number(call.args.volumeMl ?? 250),
          drinkType: (call.args.drinkType as string) ?? 'W',
        }));
      case 'log_weight':
        return JSON.stringify(await this.body.addWeight(userId, {
          weightKg: Number(call.args.weightKg ?? 0),
        }));
      case 'log_exercise':
        return JSON.stringify(await this.exercise.create(userId, {
          typeId: String(call.args.typeId ?? ''),
          durationMin: Number(call.args.durationMin ?? 30),
        }));
      case 'recall':
        return JSON.stringify(await this.recallForAgent(userId));
      case 'remember':
        // 这里返 pending · 真正 propose 由 sendMessage 处理
        return JSON.stringify({ pending: true, content: call.args.memContent });
      case 'start_fasting': {
        const planCode = String(call.args.planCode ?? '16');
        return JSON.stringify(await this.fasting.start(userId, { planCode }));
      }
      case 'end_fasting':
        return JSON.stringify(await this.fasting.end(userId, {}));
      case 'search_knowledge_base': {
        const q = String(call.args.query ?? '').trim();
        if (!q) return JSON.stringify([]);
        return JSON.stringify(await this.kb.search(q, 5));
      }
      default:
        return JSON.stringify({ error: `unknown tool: ${String(call.name)}` });
    }
  }

  async listMemories(userId: string) {
    const rows = await this.memRepo.find({
      where: { userId, delFlag: 'N', status: 'A' },
      order: { importance: 'DESC', updateTime: 'DESC' },
      take: 100,
    });
    return rows.map((m) => ({
      id: m.id,
      memType: m.memType,
      memContent: m.memContent,
      importance: m.importance,
      version: m.version,
      hitCount: m.hitCount,
      updateTime: m.updateTime,
    }));
  }

  async listPendingMemoryLogs(userId: string) {
    const rows = await this.memLogRepo.find({
      where: { userId, opStatus: 'P', delFlag: 'N' },
      order: { createTime: 'DESC' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      memoryId: r.memoryId,
      opType: r.opType,
      newContent: r.newContent,
      newType: r.newType,
      newImportance: r.newImportance,
      opReason: r.opReason,
      createTime: r.createTime,
    }));
  }

  async confirmMemoryLog(userId: string, logId: string, action: 'A' | 'R') {
    const log = await this.memLogRepo.findOne({ where: { id: logId, userId, delFlag: 'N' } });
    if (!log) throw new NotFoundException('记忆记录不存在');
    if (log.opStatus !== 'P') throw new ForbiddenException('该记录已处理');
    const now = new Date();
    if (action === 'A') {
      const mem = await this.memRepo.findOne({ where: { id: log.memoryId, delFlag: 'N' } });
      if (!mem) throw new NotFoundException('记忆主记录丢失');
      await this.memRepo.update({ id: log.memoryId }, {
        status: 'A',
        version: mem.version + 1,
        updateTime: now,
        updateBy: userId,
      });
    } else {
      await this.memRepo.update({ id: log.memoryId }, {
        delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now,
      });
    }
    await this.memLogRepo.update({ id: logId }, {
      opStatus: action, confirmTime: now, confirmBy: userId,
      versionTo: (log.versionFrom ?? 0) + (action === 'A' ? 1 : 0),
      updateTime: now, updateBy: userId,
    });
    return { success: true, action };
  }

  async addMemoryManual(userId: string, dto: AddMemoryDto) {
    const memId = await this.idGen.next('ai_memory');
    const now = new Date();
    await this.memRepo.insert({
      id: memId, userId,
      memType: dto.memType as MemType,
      memContent: dto.memContent,
      importance: dto.importance ?? 7,
      version: 1, hitCount: 0,
      status: 'A',
      delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    });
    const logId = await this.idGen.next('ai_memory_log');
    await this.memLogRepo.insert({
      id: logId, memoryId: memId, userId,
      opType: 'C', opStatus: 'A',
      newContent: dto.memContent, newType: dto.memType,
      newImportance: dto.importance ?? 7,
      versionFrom: 0, versionTo: 1,
      opReason: '用户手动添加', actor: 'U',
      confirmTime: now, confirmBy: userId,
      delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    });
    return { id: memId };
  }

  async deleteMemory(userId: string, memId: string) {
    const mem = await this.memRepo.findOne({ where: { id: memId, delFlag: 'N' } });
    if (!mem) throw new NotFoundException('记忆不存在');
    if (mem.userId !== userId) throw new ForbiddenException('无权删除');
    const now = new Date();
    await this.memRepo.update({ id: memId }, {
      delFlag: 'Y', deleteTime: now, deleteBy: userId, updateTime: now,
    });
    return { success: true };
  }

  private async proposeMemory(
    userId: string,
    convId: string,
    msgId: string,
    p: MemoryProposal,
  ): Promise<{ logId: string; memId: string }> {
    const memId = await this.idGen.next('ai_memory');
    const logId = await this.idGen.next('ai_memory_log');
    const now = new Date();
    await this.memRepo.insert({
      id: memId, userId,
      memType: p.memType,
      memContent: p.memContent,
      importance: p.importance ?? 6,
      version: 1, hitCount: 0,
      sourceMsgId: msgId, sourceConvId: convId,
      status: 'A',
      delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    });
    await this.memLogRepo.insert({
      id: logId, memoryId: memId, userId,
      opType: 'C', opStatus: 'P',
      newContent: p.memContent, newType: p.memType,
      newImportance: p.importance ?? 6,
      versionFrom: 0, versionTo: 1,
      opReason: p.reason ?? 'AI 建议记住',
      sourceMsgId: msgId,
      actor: 'A',
      delFlag: 'N', createBy: userId, updateBy: userId,
      createTime: now, updateTime: now,
    });
    return { logId, memId };
  }

  private async recallForAgent(userId: string): Promise<{ memContent: string; importance: number }[]> {
    const rows = await this.memRepo.find({
      where: { userId, delFlag: 'N', status: 'A' },
      order: { importance: 'DESC' },
      take: 5,
    });
    if (rows.length) {
      await this.memRepo.increment({ userId }, 'hitCount', 1).catch(() => undefined);
    }
    return rows.map((r) => ({ memContent: r.memContent, importance: r.importance }));
  }

  private ctxKey(convId: string): string { return `ctx:conv:${convId}`; }

  /** Redis 慢 · 读加 300ms 硬超时保护 · 超时降级到 DB 上下文（下一版本再实现） */
  private async loadShortTerm(convId: string): Promise<LlmMessage[]> {
    const raced = Promise.race([
      this.redis.lrange(this.ctxKey(convId), 0, -1),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 300)),
    ]);
    try {
      const raws = await raced;
      return raws.map((s) => JSON.parse(s) as LlmMessage);
    } catch { return []; }
  }

  /** Fire-and-forget · 不阻塞主流程 · Redis 网络糟就丢帧 */
  private pushShortTerm(convId: string, msg: LlmMessage): void {
    const key = this.ctxKey(convId);
    this.redis.rpush(key, JSON.stringify(msg))
      .then(() => this.redis.ltrim(key, -REDIS_CTX_MAX, -1))
      .then(() => this.redis.expire(key, REDIS_CTX_TTL))
      .catch(() => undefined);
  }

  private systemPrompt(personaCode: string): string {
    const persona: Record<string, string> = {
      T: '你是"温柔搭子" · 说话简短 · 直接 · 温暖 · 不说教。',
      D: '你是"严格教练" · 用干脆的话给建议 · 不废话。',
      F: '你是"闺蜜" · 语气轻松俏皮。',
      N: '你是"营养师" · 专业务实。',
    };
    const base = persona[personaCode] ?? persona.T;
    return `${base}
你在"千卡日记" App 里陪伴用户健康饮食。工具使用原则：
- 用户问"今天怎么样/摄入/消耗/体重" → 立刻调 get_today_summary 或 get_weight_history 拿真数据 · 不要凭空回答
- 用户说"记录/记一笔 68kg / 喝了 250 ml / 慢跑 30 分钟 / 吃了 X" → 立刻调对应 log_* 工具
- 用户说"记住 / 帮我记" 或 你察觉到用户的偏好/目标/习惯（比如"我不吃香菜/我想减到 60kg/我每天早上运动"）→ 立刻调 remember 工具 · UI 会弹卡让用户确认 · 你不要口头问"要不要记"
- 用户问"你记得我什么 / 关于我 / 我告诉过你" → 调 recall
- 用户问原理性/学习性问题（"什么是断食" / "减脂原理" / "宏营素怎么分" / "平台期怎么破" / "情绪化进食"）→ 先调 search_knowledge_base 拿千卡日记的私域内容 · 再用自己的话总结 · 让答案贴合本 App 的语气与建议
回复风格：简短 · 直接 · 带温度 · 少用长段 · 该调工具就调不用铺垫
免责：信息仅供参考 · 不构成医疗建议`;
  }
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly svc: AiService) {}

  @Post('conversations')
  @HttpCode(200)
  createConv(@CurrentUser() u: AuthUser, @Body() dto: CreateConvDto) {
    return this.svc.createConv(u.id, dto.personaCode);
  }

  @Get('conversations')
  listConvs(@CurrentUser() u: AuthUser) {
    return this.svc.listConvs(u.id);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.getMessages(u.id, id);
  }

  @Delete('conversations/:id')
  delConv(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteConv(u.id, id);
  }

  @Post('conversations/:id/message')
  @HttpCode(200)
  send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SendMsgDto) {
    return this.svc.sendMessage(u.id, id, dto.content);
  }

  @Post('conversations/:id/message-stream')
  async sendStream(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMsgDto,
    @Res() reply: FastifyReply,
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const write = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // 心跳 · 防止代理断长连
    const heartbeat = setInterval(() => reply.raw.write(': keepalive\n\n'), 15_000);
    try {
      const res = await this.svc.sendMessageStream(u.id, id, dto.content, (ev) => {
        if (ev.type === 'chunk') write('chunk', { text: ev.text });
        else if (ev.type === 'tool') write('tools', { names: [ev.name] });
        else if (ev.type === 'memory') write('memory', { logId: ev.logId, content: ev.content, memType: ev.memType });
      });
      write('done', { assistantMsgId: res.assistantMsgId });
    } catch (e) {
      write('error', { message: (e as Error).message ?? 'unknown error' });
    } finally {
      clearInterval(heartbeat);
      reply.raw.end();
    }
  }

  @Get('memory')
  memories(@CurrentUser() u: AuthUser) {
    return this.svc.listMemories(u.id);
  }

  @Get('memory/pending')
  pending(@CurrentUser() u: AuthUser) {
    return this.svc.listPendingMemoryLogs(u.id);
  }

  @Post('memory/log/:id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ConfirmMemoryDto) {
    return this.svc.confirmMemoryLog(u.id, id, dto.action as 'A' | 'R');
  }

  @Post('memory')
  @HttpCode(200)
  addMem(@CurrentUser() u: AuthUser, @Body() dto: AddMemoryDto) {
    return this.svc.addMemoryManual(u.id, dto);
  }

  @Delete('memory/:id')
  delMem(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteMemory(u.id, id);
  }

  @Get('usage/today')
  usage(@CurrentUser() u: AuthUser) {
    return this.svc.getTodayUsage(u.id);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([AiConv, AiMsg, AiMemory, AiMemoryLog, AiUsage]),
    LlmModule,
    MealModule,
    BodyModule,
    FoodModule,
    WaterModule,
    ExerciseModule,
    FastingModule,
    KnowledgeModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
