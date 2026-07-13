import { http, KEY } from './http';

export type MemType = 'F' | 'P' | 'G' | 'H';
export type PersonaCode = 'T' | 'D' | 'F' | 'N';

export interface AiConv {
  id: string;
  userId: string;
  personaCode: PersonaCode;
  title?: string | null;
  msgCount: number;
  lastMsgTime: string;
  status: string;
}

export interface AiMsgDto {
  id: string;
  role: 'U' | 'A' | 'S';
  content: string;
  msgTime: string;
}

export interface SendReply {
  reply: string;
  toolCalls: string[];
  memoryPending: { logId: string; content: string; memType: MemType } | null;
  assistantMsgId: string;
}

export interface AiMemory {
  id: string;
  memType: MemType;
  memContent: string;
  importance: number;
  version: number;
  hitCount: number;
  updateTime: string;
}

export interface PendingMemoryLog {
  id: string;
  memoryId: string;
  opType: string;
  newContent: string;
  newType: MemType;
  newImportance: number;
  opReason: string;
  createTime: string;
}

export interface KbDoc {
  id: string;
  docTitle: string;
  docTag?: string | null;
  sourceType: string;
  chunkCount: number;
  kbStatus: string;
  publishTime?: string | null;
  createTime: string;
}

export interface KbChunk {
  id: string;
  docId: string;
  chunkIdx: number;
  chunkText: string;
  docTitle: string;
  docTag: string | null;
}

export const kbApi = {
  list: () => http.get<KbDoc[]>('/kb/docs').then((r) => r.data),
  create: (title: string, text: string, tag?: string) =>
    http.post<{ id: string; chunkCount: number }>('/kb/docs', { title, text, tag, sourceType: 'TX' }).then((r) => r.data),
  del: (id: string) => http.delete<{ success: true }>(`/kb/docs/${id}`).then((r) => r.data),
  search: (q: string, limit = 5) =>
    http.get<KbChunk[]>('/kb/search', { params: { q, limit: String(limit) } }).then((r) => r.data),
};

export const aiApi = {
  createConv: (personaCode: PersonaCode = 'T') =>
    http.post<AiConv>('/ai/conversations', { personaCode }).then((r) => r.data),
  listConvs: () => http.get<AiConv[]>('/ai/conversations').then((r) => r.data),
  deleteConv: (id: string) => http.delete<{ success: true }>(`/ai/conversations/${id}`).then((r) => r.data),
  getMessages: (id: string) =>
    http.get<AiMsgDto[]>(`/ai/conversations/${id}/messages`).then((r) => r.data),
  send: (id: string, content: string) =>
    http.post<SendReply>(`/ai/conversations/${id}/message`, { content }).then((r) => r.data),

  /**
   * SSE 流式 · 事件：
   * · tools · 服务端调过的工具名清单
   * · memory · 记忆待确认卡
   * · chunk · 增量文本
   * · done · 结束 · 携带 assistantMsgId
   * · error · 报错
   */
  async sendStream(
    id: string,
    content: string,
    on: {
      onChunk?: (text: string) => void;
      onTools?: (names: string[]) => void;
      onMemory?: (m: { logId: string; content: string; memType: MemType }) => void;
      onDone?: (payload: { assistantMsgId: string }) => void;
      onError?: (msg: string) => void;
    },
  ): Promise<void> {
    const base = (http.defaults.baseURL ?? '/api').replace(/\/$/, '');
    const token = localStorage.getItem(KEY.access);
    const res = await fetch(`${base}/ai/conversations/${id}/message-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });
    if (!res.ok || !res.body) {
      on.onError?.(`HTTP ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // 按 SSE 双 \n 边界解析
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = 'message';
        let data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) event = line.slice(7);
          else if (line.startsWith('data: ')) data += line.slice(6);
        }
        if (!data) continue;
        let parsed: unknown;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (event === 'chunk') on.onChunk?.((parsed as { text: string }).text);
        else if (event === 'tools') on.onTools?.((parsed as { names: string[] }).names);
        else if (event === 'memory') on.onMemory?.(parsed as { logId: string; content: string; memType: MemType });
        else if (event === 'done') on.onDone?.(parsed as { assistantMsgId: string });
        else if (event === 'error') on.onError?.((parsed as { message: string }).message);
      }
    }
  },

  listMemories: () => http.get<AiMemory[]>('/ai/memory').then((r) => r.data),
  listPending: () => http.get<PendingMemoryLog[]>('/ai/memory/pending').then((r) => r.data),
  confirmMemory: (logId: string, action: 'A' | 'R') =>
    http.post<{ success: true; action: string }>(`/ai/memory/log/${logId}/confirm`, { action }).then((r) => r.data),
  addMemory: (memContent: string, memType: MemType, importance = 7) =>
    http.post<{ id: string }>('/ai/memory', { memContent, memType, importance }).then((r) => r.data),
  deleteMemory: (id: string) => http.delete<{ success: true }>(`/ai/memory/${id}`).then((r) => r.data),
};
