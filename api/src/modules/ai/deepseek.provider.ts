import { Injectable, Logger } from '@nestjs/common';
import {
  type AgentTurnOutput,
  type LlmMessage,
  type LlmProvider,
  type StreamDelta,
  type ToolName,
} from './llm';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  name?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: { message: string; type?: string };
}

/** 12 工具的 OpenAI JSON Schema */
const TOOL_SCHEMAS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_today_summary',
      description: '查询用户今日饮食摄入 · 运动消耗 · 目标进度 · 水量。无参数。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_weight_history',
      description: '查询用户体重变化 · 返回最新体重 · 30 天差值 · 历史点数。',
      parameters: {
        type: 'object',
        properties: { days: { type: 'integer', description: '回看多少天 默认 30' } },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_food',
      description: '在食物库里搜索。返回 name, kcal per 100g, 参考份量。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '食物名或拼音' },
          limit: { type: 'integer', description: '返回条数 默认 10 max 20' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_food',
      description: '帮用户记一笔饮食。需要餐次、食物名、克数、kcal。',
      parameters: {
        type: 'object',
        properties: {
          mealType: { type: 'string', enum: ['B', 'L', 'D', 'S'], description: 'B 早 L 午 D 晚 S 加餐' },
          foodName: { type: 'string' },
          actualG: { type: 'number', description: '实际克数' },
          kcal: { type: 'number' },
          carbG: { type: 'number' },
          protG: { type: 'number' },
          fatG: { type: 'number' },
        },
        required: ['mealType', 'foodName', 'actualG', 'kcal'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_water',
      description: '记一笔喝水。用户没说饮品种类默认 W 白水。',
      parameters: {
        type: 'object',
        properties: {
          volumeMl: { type: 'integer', description: '毫升' },
          drinkType: { type: 'string', enum: ['W', 'T', 'C', 'J', 'S'], description: 'W 白水 T 茶 C 咖啡 J 果汁 S 汤' },
        },
        required: ['volumeMl'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_weight',
      description: '记一笔体重。',
      parameters: {
        type: 'object',
        properties: { weightKg: { type: 'number', description: 'kg' } },
        required: ['weightKg'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_exercise',
      description: '记一笔运动。typeId 是 6 位数字字符串（来自 ex_type 库）· 常见：000002 慢跑 · 000003 跑步 · 000004 骑行 · 000005 游泳 · 000006 跳绳 · 000007 瑜伽 · 000008 HIIT · 000009 力量训练。',
      parameters: {
        type: 'object',
        properties: {
          typeId: { type: 'string', description: '6 位字符串' },
          durationMin: { type: 'integer', description: '分钟' },
        },
        required: ['typeId', 'durationMin'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'remember',
      description: '把关于用户的一件事写入长期记忆。用户说"记住/帮我记/我告诉你" 或者你注意到用户透露的偏好/目标/习惯/事实 时立刻调用此工具 · 不要先问确认。UI 层会自动弹卡让用户选是否生效 · 你只管调。',
      parameters: {
        type: 'object',
        properties: {
          memContent: { type: 'string', description: '要记的事 · 用第一人称视角 · ≤500 字' },
          memType: { type: 'string', enum: ['F', 'P', 'G', 'H'], description: 'F 事实 P 偏好 G 目标 H 习惯' },
          importance: { type: 'integer', minimum: 1, maximum: 10, description: '默认 6' },
        },
        required: ['memContent', 'memType'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recall',
      description: '取回关于用户的记忆 · 按重要度排序 · 返 top 5。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '可选检索关键词' } },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_knowledge_base',
      description: '在千卡日记的私域营养/减脂/断食/运动/心理知识库中检索。当用户问原理性问题（"减脂原理" / "什么是断食" / "宏营素怎么分" / "平台期" / "情绪化进食"）时调用。返回若干段落 · 你用自己的话总结给用户。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '中文关键词 · 简洁' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'start_fasting',
      description: '开始一段轻断食。用户说"开始断食/我要断食了/16 小时不吃"就调。默认 16 小时。',
      parameters: {
        type: 'object',
        properties: {
          planCode: { type: 'string', enum: ['14', '16', '18'], description: '14 = 14:10 · 16 = 16:8 · 18 = 18:6 · 默认 16' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'end_fasting',
      description: '结束当前进行中的轻断食。用户说"断食结束/我开吃了"就调。返回是否达标（completed）和实际小时数。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

@Injectable()
export class DeepSeekLlmProvider implements LlmProvider {
  readonly name = 'deepseek';
  private readonly logger = new Logger('DeepSeekLlm');
  private readonly endpoint: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = 'https://api.deepseek.com',
  ) {
    this.endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }

  async chat(messages: LlmMessage[]): Promise<AgentTurnOutput> {
    const started = Date.now();
    const openai = messages.map((m) => this.toOpenAI(m));
    const body = {
      model: 'deepseek-chat',
      messages: openai,
      tools: TOOL_SCHEMAS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 800,
    };

    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.logger.error(`网络错误: ${(e as Error).message}`);
      return { reply: '连不上 DeepSeek 服务，稍后再试。', toolCalls: [] };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      return { reply: '模型暂时不可用，稍后再试。', toolCalls: [] };
    }

    let data: OpenAIResponse;
    try {
      data = (await res.json()) as OpenAIResponse;
    } catch (e) {
      this.logger.error(`响应解析失败: ${(e as Error).message}`);
      return { reply: '模型响应异常。', toolCalls: [] };
    }

    if (data.error) {
      this.logger.error(`api error: ${data.error.message}`);
      return { reply: `模型报错：${data.error.message}`, toolCalls: [] };
    }

    const choice = data.choices?.[0];
    if (!choice) {
      return { reply: '模型没有回复。', toolCalls: [] };
    }

    const msg = choice.message;
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const usage = data.usage;
    this.logger.log(
      `chat · ${elapsed}s · in=${usage?.prompt_tokens ?? 0} out=${usage?.completion_tokens ?? 0} · ` +
      `finish=${choice.finish_reason} · tools=${msg.tool_calls?.length ?? 0}`,
    );

    const usageOut = usage
      ? { inTokens: usage.prompt_tokens, outTokens: usage.completion_tokens }
      : undefined;
    if (msg.tool_calls?.length) {
      const toolCalls = msg.tool_calls.map((tc) => {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* keep {} */ }
        return { name: tc.function.name as ToolName, args };
      });
      return { reply: msg.content ?? '', toolCalls, usage: usageOut };
    }
    return { reply: msg.content ?? '', toolCalls: [], usage: usageOut };
  }

  async chatStream(messages: LlmMessage[], onDelta: (d: StreamDelta) => void): Promise<AgentTurnOutput> {
    const started = Date.now();
    const openai = messages.map((m) => this.toOpenAI(m));
    const body = {
      model: 'deepseek-chat',
      messages: openai,
      tools: TOOL_SCHEMAS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 800,
      stream: true,
      stream_options: { include_usage: true },
    };

    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.logger.error(`stream 网络错误: ${(e as Error).message}`);
      return { reply: '连不上 DeepSeek 服务，稍后再试。', toolCalls: [] };
    }
    if (!res.ok || !res.body) {
      const text = res.body ? await res.text().catch(() => '') : '';
      this.logger.error(`stream HTTP ${res.status}: ${text.slice(0, 300)}`);
      return { reply: '模型暂时不可用，稍后再试。', toolCalls: [] };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accContent = '';
    /** DeepSeek 流式 tool_calls 是分片的 · index 相同的合并起来 */
    const accTools = new Map<number, { id: string; name: string; args: string }>();
    let usage: { inTokens: number; outTokens: number } | undefined;
    let finishReason = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') { buffer = ''; break; }
        let chunk: {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string;
          }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };
        try { chunk = JSON.parse(payload); } catch { continue; }
        const choice = chunk.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          accContent += delta.content;
          onDelta({ content: delta.content });
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const i = tc.index ?? 0;
            const cur = accTools.get(i) ?? { id: '', name: '', args: '' };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            accTools.set(i, cur);
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (chunk.usage) {
          usage = { inTokens: chunk.usage.prompt_tokens, outTokens: chunk.usage.completion_tokens };
        }
      }
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const toolsOut = Array.from(accTools.values()).map((tc) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.args || '{}'); } catch { /* keep {} */ }
      return { name: tc.name as ToolName, args };
    });
    this.logger.log(
      `stream · ${elapsed}s · in=${usage?.inTokens ?? 0} out=${usage?.outTokens ?? 0} · ` +
      `finish=${finishReason} · tools=${toolsOut.length} · chars=${accContent.length}`,
    );
    return { reply: accContent, toolCalls: toolsOut, usage };
  }

  private toOpenAI(m: LlmMessage): OpenAIMessage {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.toolCallId, name: m.name };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  }
}
