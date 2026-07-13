<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import { aiApi, type AiConv, type AiMsgDto, type MemType } from '@/api/ai';
import { pickErrMsg } from '@/api/http';

const route = useRoute();
const router = useRouter();

interface Bubble {
  key: string;
  role: 'U' | 'A' | 'M';
  content: string;
  time?: string;
  tools?: string[];
  memoryPending?: { logId: string; content: string; memType: MemType } | null;
  memoryResolved?: 'A' | 'R';
}

const bubbles = ref<Bubble[]>([]);
const input = ref('');
const sending = ref(false);
const errMsg = ref('');
const loading = ref(true);
const listEl = ref<HTMLElement | null>(null);
const convId = ref<string>('');
const convTitle = ref<string>('AI 搭子');
const sheetOpen = ref(false);
const convList = ref<AiConv[]>([]);

const suggestions = [
  '今天怎么样？',
  '记录 68.5 kg',
  '喝了 250 ml 水',
  '记住 我不吃香菜',
  '你记得我什么',
];

async function scrollToEnd() {
  await nextTick();
  const el = listEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function ensureConv() {
  const paramId = String(route.params.convId ?? '');
  if (paramId && paramId !== 'new') {
    convId.value = paramId;
    return;
  }
  const conv = await aiApi.createConv('T');
  convId.value = conv.id;
  router.replace({ name: 'ai-chat', params: { convId: conv.id } });
}

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    await ensureConv();
    const msgs = await aiApi.getMessages(convId.value);
    bubbles.value = msgs.map(msgToBubble);
    const firstUserMsg = msgs.find((m) => m.role === 'U');
    convTitle.value = firstUserMsg ? firstUserMsg.content.slice(0, 12) : 'AI 搭子';
    await scrollToEnd();
  } catch (e) {
    errMsg.value = pickErrMsg(e, '加载失败');
  } finally {
    loading.value = false;
  }
}

async function openSheet() {
  sheetOpen.value = true;
  try { convList.value = await aiApi.listConvs(); }
  catch { /* silent */ }
}
function closeSheet() { sheetOpen.value = false; }

async function switchTo(id: string) {
  closeSheet();
  if (id === convId.value) return;
  router.replace({ name: 'ai-chat', params: { convId: id } });
}

async function startNew() {
  closeSheet();
  const conv = await aiApi.createConv('T');
  router.replace({ name: 'ai-chat', params: { convId: conv.id } });
}

async function delConv(id: string) {
  if (!confirm('删除这条会话？')) return;
  try {
    await aiApi.deleteConv(id);
    if (id === convId.value) {
      const remaining = await aiApi.listConvs();
      if (remaining.length) {
        router.replace({ name: 'ai-chat', params: { convId: remaining[0].id } });
      } else {
        const conv = await aiApi.createConv('T');
        router.replace({ name: 'ai-chat', params: { convId: conv.id } });
      }
    } else {
      convList.value = await aiApi.listConvs();
    }
  } catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

function fmtRel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return '刚刚';
  if (diff < 60) return `${diff} 分`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)} 时`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function msgToBubble(m: AiMsgDto): Bubble {
  return {
    key: m.id,
    role: m.role === 'A' ? 'A' : 'U',
    content: m.content,
    time: m.msgTime,
  };
}

onMounted(load);

async function send(text?: string) {
  const content = (text ?? input.value).trim();
  if (!content || sending.value || !convId.value) return;
  sending.value = true;
  errMsg.value = '';
  input.value = '';

  const userBubble: Bubble = { key: `u-${Date.now()}`, role: 'U', content, time: new Date().toISOString() };
  bubbles.value.push(userBubble);
  const pendingKey = `pending-${Date.now()}`;
  const pendingBubble: Bubble = { key: pendingKey, role: 'A', content: '', time: new Date().toISOString() };
  bubbles.value.push(pendingBubble);
  await scrollToEnd();

  const pendingIdx = () => bubbles.value.findIndex((b) => b.key === pendingKey);

  try {
    let scrolledForFirstChunk = false;
    await aiApi.sendStream(convId.value, content, {
      onTools: (names) => {
        const i = pendingIdx();
        if (i !== -1) bubbles.value[i] = { ...bubbles.value[i], tools: names };
      },
      onMemory: (m) => {
        bubbles.value.push({
          key: `mem-${m.logId}`,
          role: 'M',
          content: m.content,
          memoryPending: m,
        });
      },
      onChunk: (chunk) => {
        const i = pendingIdx();
        if (i !== -1) {
          bubbles.value[i] = { ...bubbles.value[i], content: bubbles.value[i].content + chunk };
        }
        if (!scrolledForFirstChunk) { scrolledForFirstChunk = true; scrollToEnd(); }
      },
      onDone: (payload) => {
        const i = pendingIdx();
        if (i !== -1) {
          bubbles.value[i] = { ...bubbles.value[i], key: payload.assistantMsgId };
        }
        scrollToEnd();
      },
      onError: (msg) => {
        errMsg.value = msg;
      },
    });
  } catch (e) {
    bubbles.value = bubbles.value.filter((b) => b.key !== pendingKey);
    errMsg.value = pickErrMsg(e, '发送失败');
  } finally {
    sending.value = false;
    // 空的 pending 泡（比如出错）清掉
    const i = pendingIdx();
    if (i !== -1 && !bubbles.value[i].content) bubbles.value.splice(i, 1);
  }
}

async function resolveMemory(bubble: Bubble, action: 'A' | 'R') {
  const p = bubble.memoryPending;
  if (!p) return;
  try {
    await aiApi.confirmMemory(p.logId, action);
    bubble.memoryResolved = action;
  } catch (e) {
    errMsg.value = pickErrMsg(e, '处理失败');
  }
}

const hasMsg = computed(() => bubbles.value.length > 0);

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

let composing: boolean = false;
function onCompStart() { composing = true; }
function onCompEnd() { composing = false; }
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Enter') return;
  if (e.shiftKey) return;
  if (composing) return;
  e.preventDefault();
  send();
}

watch(() => route.params.convId, (v) => {
  if (v && v !== convId.value && v !== 'new') load();
});
</script>

<template>
  <section class="wrap">
    <AppHeader :title="convTitle" back-to="/">
      <template #right>
        <button type="button" class="hd-btn" @click="router.push('/kb')" aria-label="知识库">📚</button>
        <button type="button" class="hd-btn" @click="router.push('/ai/memory')" aria-label="记忆">🧠</button>
        <button type="button" class="hd-btn" @click="openSheet" aria-label="历史">☰</button>
      </template>
    </AppHeader>

    <p v-if="errMsg" class="err">{{ errMsg }}</p>

    <div class="stream" ref="listEl">
      <template v-if="hasMsg">
        <div v-for="b in bubbles" :key="b.key" :class="['row', 'r-' + b.role]">
          <div v-if="b.role === 'M'" class="mem-card" :class="{ done: !!b.memoryResolved }">
            <div class="mem-head">
              <span class="mem-icon" aria-hidden="true">🧠</span>
              <div>
                <p class="mem-title">想记住这件事</p>
                <p class="mem-content">{{ b.content }}</p>
              </div>
            </div>
            <div v-if="!b.memoryResolved" class="mem-cta">
              <button type="button" class="mem-btn reject" @click="resolveMemory(b, 'R')">不用记</button>
              <button type="button" class="mem-btn accept" @click="resolveMemory(b, 'A')">好，记下</button>
            </div>
            <p v-else class="mem-status">
              <template v-if="b.memoryResolved === 'A'">✓ 已记住</template>
              <template v-else>× 已忽略</template>
            </p>
          </div>

          <div v-else class="bubble" :class="'b-' + b.role">
            <p class="text">{{ b.content }}</p>
            <div v-if="b.tools?.length" class="tool-chips">
              <span v-for="t in b.tools" :key="t" class="tool-chip">🔧 {{ t }}</span>
            </div>
            <p class="time" v-if="b.time">{{ fmtTime(b.time) }}</p>
          </div>
        </div>
      </template>

      <div v-else-if="!loading" class="empty">
        <div class="e-mark" aria-hidden="true">☾</div>
        <h2 class="e-title">开始聊吧</h2>
        <p class="e-hint">我可以查你今日饮食 · 帮你记食物/水/体重/运动 · 记住你告诉我的偏好</p>
        <div class="e-sugs">
          <button v-for="s in suggestions" :key="s" class="e-chip" @click="send(s)">
            {{ s }}
          </button>
        </div>
      </div>
    </div>

    <div class="input-bar">
      <input
        v-model="input"
        type="text"
        placeholder="说点什么..."
        :disabled="sending"
        @compositionstart="onCompStart"
        @compositionend="onCompEnd"
        @keydown="onKey"
      />
      <button type="button" class="send" @click="send()" :disabled="sending || !input.trim()">
        <template v-if="sending">…</template>
        <template v-else>发</template>
      </button>
    </div>

    <!-- 历史 sheet -->
    <transition name="sheet">
      <div v-if="sheetOpen" class="hs-mask" @click.self="closeSheet">
        <div class="hs-sheet">
          <div class="hs-handle"></div>
          <div class="hs-head">
            <h3 class="hs-title">会话历史</h3>
            <button class="hs-new" @click="startNew">+ 开新对话</button>
          </div>
          <ul v-if="convList.length" class="hs-list">
            <li v-for="c in convList" :key="c.id" :class="['hs-row', { on: c.id === convId }]">
              <button class="hs-body" @click="switchTo(c.id)">
                <p class="hs-t">{{ c.title || '新对话' }}</p>
                <p class="hs-meta num">{{ c.msgCount }} 条 · {{ fmtRel(c.lastMsgTime) }}</p>
              </button>
              <button class="hs-del" @click="delConv(c.id)" aria-label="删除">×</button>
            </li>
          </ul>
          <p v-else class="hs-empty">还没有其他会话</p>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.wrap {
  min-height: 100dvh; display: flex; flex-direction: column;
  background: var(--color-surface); color: var(--color-on-surface);
}
.err { margin: 8px var(--space-margin-mobile); padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.stream {
  flex: 1; overflow-y: auto;
  padding: var(--space-md) var(--space-margin-mobile) 120px;
  display: flex; flex-direction: column; gap: 10px;
  background: radial-gradient(ellipse at 30% -20%, var(--color-primary-fixed) 0%, transparent 45%), var(--color-surface);
}
.row { display: flex; }
.r-U { justify-content: flex-end; }
.r-A { justify-content: flex-start; }
.r-M { justify-content: center; }

.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 18px;
  position: relative;
  line-height: 1.4;
}
.bubble .text { margin: 0; font-size: var(--font-size-body); white-space: pre-wrap; word-break: break-word; }
.b-U {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-bottom-right-radius: 6px;
  box-shadow: 0 4px 12px rgba(165, 51, 20, 0.24);
}
.b-A {
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
  border-bottom-left-radius: 6px;
  box-shadow: 0 2px 6px rgba(29, 25, 23, 0.04);
}
.time { margin: 4px 0 0; font-size: 10px; letter-spacing: 0.05em; color: rgba(255,255,255,0.65); font-family: var(--font-family-num); }
.b-A .time { color: var(--color-outline); }
.tool-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.tool-chip {
  padding: 1px 6px; border-radius: var(--radius-full);
  background: var(--color-tertiary-container);
  color: var(--color-on-tertiary-container);
  font-size: 9px; letter-spacing: 0.05em; font-weight: 500;
}
.b-A .tool-chip { background: var(--color-primary-fixed); color: var(--color-primary); }

.mem-card {
  width: 92%; max-width: 480px;
  padding: 14px 16px;
  background: linear-gradient(140deg, var(--color-secondary-container) 0%, var(--color-tertiary-container) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(29, 25, 23, 0.08);
  box-shadow: 0 8px 24px rgba(83, 101, 35, 0.15), 0 2px 6px rgba(29, 25, 23, 0.04);
  display: flex; flex-direction: column; gap: 12px;
  transition: opacity var(--duration-normal);
}
.mem-card.done { opacity: 0.65; }
.mem-head { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; }
.mem-icon { width: 40px; height: 40px; display: grid; place-items: center; font-size: 22px; background: var(--color-surface-container-lowest); border-radius: 14px; }
.mem-title { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-on-secondary-container); opacity: 0.85; }
.mem-content { margin: 4px 0 0; font-size: var(--font-size-body); font-weight: 600; color: var(--color-on-secondary-container); }
.mem-cta { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; }
.mem-btn { height: 40px; border-radius: var(--radius-md); font-size: var(--font-size-caption); font-weight: 500; }
.mem-btn.reject { background: transparent; color: var(--color-on-secondary-container); border: 1px solid rgba(29,25,23,0.15); }
.mem-btn.accept { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 4px 12px rgba(165, 51, 20, 0.24); }
.mem-btn:active { transform: scale(0.97); }
.mem-status { margin: 0; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-secondary-container); }

.empty { padding: 60px 24px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.e-mark { width: 88px; height: 88px; display: grid; place-items: center; font-size: 44px; background: linear-gradient(140deg, var(--color-primary-container), var(--color-tertiary-container)); border-radius: 30px; box-shadow: 0 12px 28px rgba(165, 51, 20, 0.22); }
.e-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; }
.e-hint { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); max-width: 24em; line-height: 1.5; }
.e-sugs { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
.e-chip { padding: 8px 14px; border-radius: var(--radius-full); background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); color: var(--color-on-surface); font-size: var(--font-size-caption); box-shadow: 0 2px 6px rgba(29, 25, 23, 0.04); }
.e-chip:active { background: var(--color-primary-fixed); }

.input-bar {
  position: fixed; left: 0; right: 0;
  bottom: 0;
  padding: 10px var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 12px);
  background: var(--color-surface-container-lowest);
  border-top: 1px solid var(--color-outline-variant);
  display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
  z-index: 50;
}
.input-bar input {
  height: 44px; padding: 0 var(--space-md);
  border-radius: var(--radius-full);
  background: var(--color-surface-container);
  border: 1px solid transparent;
  font-size: var(--font-size-body);
  color: var(--color-on-surface);
}
.input-bar input:focus { outline: none; border-color: var(--color-primary); background: var(--color-surface-container-lowest); }
.send {
  width: 60px; height: 44px;
  border-radius: var(--radius-full);
  background: var(--color-primary); color: var(--color-on-primary);
  font-size: var(--font-size-body); font-weight: 500;
  box-shadow: 0 4px 12px rgba(165, 51, 20, 0.28);
}
.send:disabled { opacity: 0.4; box-shadow: none; }
.send:active:not(:disabled) { transform: scale(0.94); }

/* Header right buttons */
.hd-btn { width: 36px; height: 36px; border-radius: var(--radius-full); background: var(--color-surface-container); font-size: 16px; display: grid; place-items: center; color: var(--color-on-surface); }
.hd-btn:active { background: var(--color-surface-container-high); transform: scale(0.94); }

/* History sheet */
.hs-mask { position: fixed; inset: 0; background: rgba(29,25,23,0.4); display: grid; align-items: end; z-index: 100; }
.hs-sheet {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 8px var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-lg));
  box-shadow: 0 -12px 32px rgba(29,25,23,0.14);
  max-height: 75vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--space-md);
}
.hs-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--color-outline-variant); margin: 0 auto; }
.hs-head { display: flex; justify-content: space-between; align-items: baseline; }
.hs-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; }
.hs-new { padding: 8px 14px; border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-caption); font-weight: 500; box-shadow: 0 4px 10px rgba(165, 51, 20, 0.28); }
.hs-new:active { transform: scale(0.96); }
.hs-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-row { display: grid; grid-template-columns: 1fr auto; align-items: center; border-radius: var(--radius-default); padding: 0 6px; transition: background var(--duration-fast); }
.hs-row.on { background: var(--color-primary-fixed); }
.hs-body { padding: 12px 6px; background: transparent; text-align: left; }
.hs-t { margin: 0; font-size: var(--font-size-body); font-weight: 500; color: var(--color-on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.hs-row.on .hs-t { color: var(--color-primary); font-weight: 600; }
.hs-meta { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.hs-del { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.hs-del:active { background: var(--color-error-container); color: var(--color-error); }
.hs-empty { margin: 0; padding: 20px 0; text-align: center; color: var(--color-on-surface-variant); font-size: var(--font-size-caption); }

.sheet-enter-active .hs-sheet, .sheet-leave-active .hs-sheet { transition: transform var(--duration-normal) var(--ease-out-expo); }
.sheet-enter-from .hs-sheet, .sheet-leave-to .hs-sheet { transform: translateY(100%); }
.sheet-enter-active, .sheet-leave-active { transition: opacity var(--duration-normal); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
