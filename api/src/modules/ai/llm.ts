import { Inject, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepSeekLlmProvider } from './deepseek.provider';

export interface AgentTurnOutput {
  reply: string;
  toolCalls: ToolCall[];
  memoryPropose?: MemoryProposal;
  /** provider 报告的 token 用量 · mock 返 undefined */
  usage?: { inTokens: number; outTokens: number };
}

export interface ToolCall {
  name: ToolName;
  args: Record<string, unknown>;
}

export type ToolName =
  | 'get_today_summary'
  | 'get_weight_history'
  | 'search_food'
  | 'log_food'
  | 'log_water'
  | 'log_weight'
  | 'log_exercise'
  | 'start_fasting'
  | 'end_fasting'
  | 'remember'
  | 'recall'
  | 'search_knowledge_base';

/** F 事实 · P 偏好 · G 目标 · H 习惯 */
export type MemType = 'F' | 'P' | 'G' | 'H';

export interface MemoryProposal {
  memType: MemType;
  memContent: string;
  importance?: number;
  reason?: string;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** role='tool' 必填 · 关联 assistant 上一步 tool_calls[i].id */
  toolCallId?: string;
  /** role='assistant' · LLM 决定调工具时会填这个数组 · 每个 id 对应下一步 tool 消息 */
  toolCalls?: ToolCallWithId[];
  /** role='tool' 时是被调的工具名 · 也用作 mock 里 formatToolResult 分派 */
  name?: string;
}

export interface ToolCallWithId {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/** 流式增量 · content 是文本片段 · 上层聚合即可 */
export interface StreamDelta {
  content?: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(messages: LlmMessage[]): Promise<AgentTurnOutput>;
  /** 可选 · 支持流式 · 未实现的 provider 会被上层降级为 chat + 一次性输出 */
  chatStream?(messages: LlmMessage[], onDelta: (d: StreamDelta) => void): Promise<AgentTurnOutput>;
}

/**
 * Mock · 规则引擎 · 无 Key 时保证 UX 走通
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('MockLlm');

  async chat(messages: LlmMessage[]): Promise<AgentTurnOutput> {
    await new Promise((r) => setTimeout(r, 400));
    const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const text = userMsg.trim();
    this.logger.log(`mock chat · user="${text.slice(0, 40)}" hist=${messages.length}`);

    // 第二轮 · 带 tool 结果 · 格式化输出
    const toolMsgs = messages.filter((m) => m.role === 'tool');
    if (toolMsgs.length > 0) {
      const last = toolMsgs[toolMsgs.length - 1];
      return { reply: this.formatToolResult(last.name ?? '', last.content), toolCalls: [] };
    }

    const T = text;

    if (/^(记住|帮我记|记一下)/.test(T)) {
      const claim = T.replace(/^(记住|帮我记|记一下)[，,、\s：:]*/, '').trim();
      const memType = this.guessMemType(claim);
      return {
        reply: `好，我记下了：「${claim}」· 已存"待确认" · 去 AI 记忆页面点一下就正式生效。`,
        toolCalls: [{ name: 'remember', args: { memContent: claim, memType, importance: 6 } }],
      };
    }

    if (/你记得|你还记得|我(的)?(目标|偏好|习惯)/.test(T)) {
      return {
        reply: '让我翻翻我记住的东西...',
        toolCalls: [{ name: 'recall', args: { query: T } }],
      };
    }

    if (/今天|今日|摄入|消耗|还能吃|剩多少|kcal|卡路里/.test(T)) {
      return {
        reply: '看看你今天的账。',
        toolCalls: [{ name: 'get_today_summary', args: {} }],
      };
    }

    if (/体重|变化|瘦了|胖了|减了/.test(T) && !/记录/.test(T)) {
      return {
        reply: '看看你最近的体重。',
        toolCalls: [{ name: 'get_weight_history', args: { days: 30 } }],
      };
    }

    const wm = T.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|公斤|千克)?/);
    if (wm && /(体重|记录|今天|kg)/.test(T) && Number(wm[1]) >= 20 && Number(wm[1]) <= 300) {
      return {
        reply: `帮你记 ${wm[1]} kg`,
        toolCalls: [{ name: 'log_weight', args: { weightKg: Number(wm[1]) } }],
      };
    }

    const water = T.match(/(\d+)\s*(?:ml|毫升)/);
    if (water && /(喝|水|茶|咖啡)/.test(T)) {
      const type = /茶/.test(T) ? 'T' : /咖啡/.test(T) ? 'C' : /果汁/.test(T) ? 'J' : 'W';
      return {
        reply: `记了 ${water[1]} ml`,
        toolCalls: [{ name: 'log_water', args: { volumeMl: Number(water[1]), drinkType: type } }],
      };
    }
    if (/(喝了一杯|来杯|来一杯)/.test(T)) {
      const type = /茶/.test(T) ? 'T' : /咖啡/.test(T) ? 'C' : /果汁/.test(T) ? 'J' : 'W';
      return {
        reply: '按 250 ml 记',
        toolCalls: [{ name: 'log_water', args: { volumeMl: 250, drinkType: type } }],
      };
    }

    if (/(查|多少卡|营养|热量)/.test(T)) {
      const q = T.replace(/查(一下)?|多少卡|营养|热量|[，,？?]/g, '').trim();
      if (q) {
        return {
          reply: `找找 ${q}`,
          toolCalls: [{ name: 'search_food', args: { query: q, limit: 5 } }],
        };
      }
    }

    return { reply: this.pickIdleReply(T), toolCalls: [] };
  }

  private guessMemType(claim: string): MemType {
    if (/(不吃|不喜欢|喜欢|爱|口味|偏好)/.test(claim)) return 'P';
    if (/(想|计划|目标|减到|增到)/.test(claim)) return 'G';
    if (/(每天|通常|习惯|一般)/.test(claim)) return 'H';
    return 'F';
  }

  private pickIdleReply(t: string): string {
    if (!t) return '在呢，说吧。';
    if (/(累|烦|不想|放弃)/.test(t)) return '别硬撑。放松一天不会前功尽弃，明天再拉回来就行。';
    if (/(饿|馋)/.test(t)) return '想吃啥？告诉我大概样子，我帮你估估卡。';
    if (/(睡|困)/.test(t)) return '早点睡。今天的账我明天再帮你复盘。';
    if (/(谢|感谢|thx)/i.test(t)) return '不客气，一起加油。';
    return '嗯，我在。直接说吧 · "记录 68.5 kg" / "喝了 250 ml 水" / "今天怎么样"。';
  }

  private formatToolResult(name: string, resultText: string): string {
    let data: unknown;
    try { data = JSON.parse(resultText); } catch { return resultText; }
    switch (name) {
      case 'get_today_summary': {
        const d = data as { consumed: number; burned: number; remaining: number; kcalGoal: number; waterMl: number; exMin: number };
        const parts: string[] = [`今天摄入 ${d.consumed} kcal`];
        if (d.burned > 0) parts.push(`运动消耗 ${d.burned} kcal`);
        if (d.kcalGoal > 0) parts.push(`目标 ${d.kcalGoal} kcal · 还剩 ${d.remaining}`);
        if (d.waterMl > 0) parts.push(`喝了 ${d.waterMl} ml 水`);
        if (d.exMin > 0) parts.push(`动了 ${d.exMin} 分钟`);
        return parts.join(' · ') + '。';
      }
      case 'get_weight_history': {
        const d = data as { latest: { weightKg: number } | null; delta30: number; count: number };
        if (!d.latest) return '还没记过体重呢，先来一笔？';
        const dir = d.delta30 > 0 ? `↑ ${d.delta30.toFixed(1)} kg` : d.delta30 < 0 ? `↓ ${Math.abs(d.delta30).toFixed(1)} kg` : '持平';
        return `最新 ${d.latest.weightKg.toFixed(1)} kg · 30 天 ${dir} · 共 ${d.count} 条记录。`;
      }
      case 'search_food': {
        const arr = data as { foodName: string; kcal: number; portionG: number; portionDesc?: string }[];
        if (!arr?.length) return '没找到匹配的食物，可以直接告诉我克数和卡路里。';
        return arr.slice(0, 3).map((f) => `${f.foodName} · ${f.portionDesc ?? '100 g'} ${Math.round(Number(f.kcal) * Number(f.portionG) / 100)} kcal`).join('\n');
      }
      case 'log_food':
      case 'log_water':
      case 'log_weight':
      case 'log_exercise':
        return '✓ 记好了';
      case 'remember':
        return '已存"待确认" · 去 AI 记忆页面点一下就生效。';
      case 'recall': {
        const arr = data as { memContent: string }[];
        if (!arr?.length) return '我目前还没记住关于你的事情。可以说 "记住 我不吃香菜" 让我记下来。';
        return arr.slice(0, 5).map((m) => `· ${m.memContent}`).join('\n');
      }
      default:
        return resultText;
    }
  }
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger('LlmService');
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {
    this.logger.log(`LLM provider = ${provider.name}`);
  }
  chat(messages: LlmMessage[]): Promise<AgentTurnOutput> {
    return this.provider.chat(messages);
  }
  async chatStream(messages: LlmMessage[], onDelta: (d: StreamDelta) => void): Promise<AgentTurnOutput> {
    if (this.provider.chatStream) return this.provider.chatStream(messages, onDelta);
    // 降级：一次性 · 尾部一片输出
    const out = await this.provider.chat(messages);
    if (out.reply) onDelta({ content: out.reply });
    return out;
  }
  name(): string { return this.provider.name; }
}

@Module({
  providers: [
    MockLlmProvider,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, MockLlmProvider],
      useFactory: (cfg: ConfigService, mock: MockLlmProvider): LlmProvider => {
        const key = cfg.get<string>('DEEPSEEK_API_KEY');
        const baseUrl = cfg.get<string>('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com';
        if (key) {
          Logger.log(`使用 DeepSeek provider · baseUrl=${baseUrl}`, 'LlmModule');
          return new DeepSeekLlmProvider(key, baseUrl);
        }
        Logger.log('未配置 DEEPSEEK_API_KEY · 使用规则引擎 mock', 'LlmModule');
        return mock;
      },
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
