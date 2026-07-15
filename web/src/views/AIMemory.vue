<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { aiApi, type AiMemory, type MemType, type PendingMemoryLog } from '@/api/ai';
import { pickErrMsg } from '@/api/http';

const active = ref<AiMemory[]>([]);
const pending = ref<PendingMemoryLog[]>([]);
const loading = ref(true);
const errMsg = ref('');
const showAdd = ref(false);
const newContent = ref('');
const newType = ref<MemType>('F');
const newImp = ref(7);

const MEM_LABEL: Record<MemType, string> = { F: '事实', P: '偏好', G: '目标', H: '习惯' };
const MEM_ICON: Record<MemType, string> = { F: '📝', P: '💖', G: '🎯', H: '🔁' };

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    const [a, p] = await Promise.all([aiApi.listMemories(), aiApi.listPending()]);
    active.value = a;
    pending.value = p;
  } catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

async function resolve(logId: string, action: 'A' | 'R') {
  try { await aiApi.confirmMemory(logId, action); await load(); }
  catch (e) { errMsg.value = pickErrMsg(e, '处理失败'); }
}

async function delOne(id: string) {
  if (!confirm('删除这条记忆？删了之后 AI 就不知道了。')) return;
  try { await aiApi.deleteMemory(id); await load(); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

async function addManual() {
  const content = newContent.value.trim();
  if (!content) { errMsg.value = '写点什么再保存'; return; }
  try {
    await aiApi.addMemory(content, newType.value, newImp.value);
    newContent.value = '';
    showAdd.value = false;
    await load();
  } catch (e) { errMsg.value = pickErrMsg(e, '添加失败'); }
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="AI 记忆" back-to="/ai" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section v-if="pending.length" class="section">
        <h2 class="s-title">
          待确认 · <span class="num">{{ pending.length }}</span>
          <span class="s-hint">AI 建议记住</span>
        </h2>
        <ul class="cards">
          <li v-for="p in pending" :key="p.id" class="pend-card">
            <div class="pc-body">
              <span class="pc-icon" aria-hidden="true">{{ MEM_ICON[p.newType] }}</span>
              <div>
                <p class="pc-type">{{ MEM_LABEL[p.newType] }} · 建议</p>
                <p class="pc-content">{{ p.newContent }}</p>
                <p class="pc-reason">{{ p.opReason }}</p>
              </div>
            </div>
            <div class="pc-cta">
              <button class="p-btn reject" @click="resolve(p.id, 'R')">不用记</button>
              <button class="p-btn accept" @click="resolve(p.id, 'A')">好，记下</button>
            </div>
          </li>
        </ul>
      </section>

      <section class="section">
        <div class="s-head">
          <h2 class="s-title">
            已记住 · <span class="num">{{ active.length }}</span>
          </h2>
          <button class="add-btn" @click="showAdd = !showAdd" aria-label="手动添加">
            <template v-if="showAdd">×</template>
            <template v-else>+ 手动加</template>
          </button>
        </div>

        <section v-if="showAdd" class="add-card">
          <div class="type-row">
            <button
              v-for="k in (['F','P','G','H'] as MemType[])"
              :key="k"
              type="button"
              :class="['type-chip', { on: newType === k }]"
              @click="newType = k"
            >{{ MEM_ICON[k] }} {{ MEM_LABEL[k] }}</button>
          </div>
          <textarea v-model="newContent" placeholder="比如 我不吃香菜" maxlength="500" rows="2"></textarea>
          <div class="imp-row">
            <label>重要度</label>
            <input type="range" min="1" max="10" v-model.number="newImp" />
            <span class="num">{{ newImp }}</span>
          </div>
          <button class="primary" @click="addManual">保存</button>
        </section>

        <p v-if="!active.length && !loading && !showAdd" class="empty">
          还没有任何记忆 · 让 AI 聊几句 · 或者点右上 <b>+ 手动加</b>
        </p>

        <ul v-if="active.length" class="cards">
          <li v-for="m in active" :key="m.id" class="act-card" :class="'t-' + m.memType">
            <div class="ac-head">
              <span class="ac-icon" aria-hidden="true">{{ MEM_ICON[m.memType] }}</span>
              <span class="ac-type">{{ MEM_LABEL[m.memType] }}</span>
              <span class="ac-imp num">{{ m.importance }}<span class="ac-imp-s">/10</span></span>
              <button class="ac-del" @click="delOne(m.id)" aria-label="删除">×</button>
            </div>
            <p class="ac-content">{{ m.memContent }}</p>
            <p class="ac-meta num">v{{ m.version }} · 命中 {{ m.hitCount }} 次 · {{ fmt(m.updateTime) }}</p>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-lg); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.section { display: flex; flex-direction: column; gap: 10px; }
.s-head { display: flex; justify-content: space-between; align-items: baseline; }
.s-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.s-title .num { color: var(--color-primary); font-weight: 700; }
.s-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-weight: 400; }
.add-btn { padding: 6px 12px; border-radius: var(--radius-full); background: var(--color-primary-fixed); color: var(--color-primary); font-size: var(--font-size-caption); font-weight: 500; }
.add-btn:active { background: var(--color-primary-container); }

.cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }

.pend-card {
  padding: 14px;
  background: linear-gradient(140deg, var(--color-secondary-container) 0%, var(--color-tertiary-container) 100%);
  border-radius: var(--radius-lg);
  box-shadow: 0 6px 18px rgba(83, 101, 35, 0.15);
  display: flex; flex-direction: column; gap: 12px;
}
.pc-body { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start; }
.pc-icon { font-size: 22px; width: 40px; height: 40px; display: grid; place-items: center; background: var(--color-surface-container-lowest); border-radius: 14px; }
.pc-type { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-on-secondary-container); opacity: 0.85; }
.pc-content { margin: 3px 0 0; font-size: var(--font-size-body); font-weight: 600; color: var(--color-on-secondary-container); }
.pc-reason { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-secondary-container); opacity: 0.75; }
.pc-cta { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; }
.p-btn { height: 40px; border-radius: var(--radius-md); font-size: var(--font-size-caption); font-weight: 500; }
.p-btn.reject { background: transparent; color: var(--color-on-secondary-container); border: 1px solid rgba(29,25,23,0.15); }
.p-btn.accept { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 4px 12px rgba(165, 51, 20, 0.24); }
.p-btn:active { transform: scale(0.97); }

.add-card {
  padding: 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
  display: flex; flex-direction: column; gap: 12px;
}
.type-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.type-chip { padding: 8px 4px; border-radius: var(--radius-default); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); color: var(--color-on-surface); font-size: var(--font-size-caption); }
.type-chip.on { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 3px 8px rgba(165, 51, 20, 0.24); }
.add-card textarea {
  padding: 10px 12px; border-radius: var(--radius-md);
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
  font-size: var(--font-size-body); font-family: var(--font-family-sans);
  resize: vertical; min-height: 60px;
  color: var(--color-on-surface);
}
.add-card textarea:focus { outline: none; border-color: var(--color-primary); }
.imp-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.imp-row .num { color: var(--color-primary); font-weight: 600; min-width: 20px; text-align: right; }
.primary { height: 44px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }

.act-card {
  padding: 12px 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-left: 4px solid var(--color-outline);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
}
.act-card.t-F { border-left-color: var(--color-primary); }
.act-card.t-P { border-left-color: var(--color-tertiary); }
.act-card.t-G { border-left-color: var(--color-secondary); }
.act-card.t-H { border-left-color: var(--color-primary-container); }
.ac-head { display: grid; grid-template-columns: auto auto 1fr auto; gap: 8px; align-items: center; }
.ac-icon { font-size: 18px; }
.ac-type { font-size: var(--font-size-label); letter-spacing: 0.06em; color: var(--color-on-surface-variant); font-weight: 500; }
.ac-imp { font-size: var(--font-size-caption); font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); text-align: right; }
.ac-imp-s { font-size: 10px; font-weight: 400; color: var(--color-outline); }
.ac-del { width: 28px; height: 28px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 18px; }
.ac-del:active { background: var(--color-error-container); color: var(--color-error); }
.ac-content { margin: 6px 0 4px; font-size: var(--font-size-body); font-weight: 500; color: var(--color-on-surface); }
.ac-meta { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }

.empty { margin: 0; padding: 20px 0; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.empty b { color: var(--color-primary); }
</style>
