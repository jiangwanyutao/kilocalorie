<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { fastingApi, type FastingCurrent, type FastingHistoryItem, type PlanCode } from '@/api/fasting';
import { pickErrMsg } from '@/api/http';

const current = ref<FastingCurrent | null>(null);
const history = ref<FastingHistoryItem[]>([]);
const loading = ref(true);
const errMsg = ref('');
const ending = ref(false);
const starting = ref<PlanCode | null>(null);

const now = ref(Date.now());
let tickId: ReturnType<typeof setInterval> | null = null;

interface Plan {
  code: PlanCode;
  label: string;
  window: string;
  intensity: '温和' | '经典' | '进阶';
  hint: string;
}

const PLANS: Plan[] = [
  { code: '14', label: '14 : 10', window: '断 14h · 吃 10h', intensity: '温和', hint: '入门友好 · 早晚略拉长空腹' },
  { code: '16', label: '16 : 8',  window: '断 16h · 吃 8h',  intensity: '经典', hint: '最常见的 IF · 跳过一顿即可' },
  { code: '18', label: '18 : 6',  window: '断 18h · 吃 6h',  intensity: '进阶', hint: '效果更明显 · 需要适应' },
];

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    const [c, h] = await Promise.all([fastingApi.current(), fastingApi.history(90)]);
    current.value = c;
    history.value = h;
  } catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(async () => {
  await load();
  tickId = setInterval(() => { now.value = Date.now(); }, 30_000);
});
onUnmounted(() => { if (tickId) clearInterval(tickId); });

async function start(code: PlanCode) {
  starting.value = code;
  errMsg.value = '';
  try { current.value = await fastingApi.start(code); }
  catch (e) { errMsg.value = pickErrMsg(e, '开始失败'); }
  finally { starting.value = null; }
}

async function end() {
  if (!confirm('结束这段断食？')) return;
  ending.value = true;
  errMsg.value = '';
  try {
    const r = await fastingApi.end();
    const msg = r.completed
      ? `👏 达成 · 实际断食 ${r.actualHours} 小时`
      : `已结束 · 实际 ${r.actualHours} / ${r.planHours} 小时 · 差一点`;
    alert(msg);
    await load();
  } catch (e) { errMsg.value = pickErrMsg(e, '结束失败'); }
  finally { ending.value = false; }
}

async function delOne(id: string) {
  if (!confirm('删除这条记录？')) return;
  try { await fastingApi.del(id); await load(); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

const live = computed(() => {
  const c = current.value;
  if (!c) return null;
  const startMs = new Date(c.startTime).getTime();
  const endMs = new Date(c.planEndTime).getTime();
  const total = endMs - startMs;
  const elapsed = Math.max(0, now.value - startMs);
  const remaining = Math.max(0, endMs - now.value);
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
  const done = pct >= 100;
  return {
    elapsedH: Math.floor(elapsed / 3600_000),
    elapsedM: Math.floor((elapsed % 3600_000) / 60_000),
    remainingH: Math.floor(remaining / 3600_000),
    remainingM: Math.floor((remaining % 3600_000) / 60_000),
    pct,
    done,
  };
});

const RING_R = 92;
const RING_CIRC = 2 * Math.PI * RING_R;
const dashOffset = computed(() => RING_CIRC * (1 - (live.value?.pct ?? 0) / 100));

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusLabel(s: string): string {
  if (s === 'C') return '✓ 达成';
  if (s === 'A') return '中止';
  return '进行中';
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="轻断食" back-to="/" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section v-if="current && live" class="active">
        <div class="a-plan-chip">{{ current.planHours }} : {{ 24 - current.planHours }}</div>
        <div class="ring-wrap">
          <svg viewBox="0 0 220 220" class="ring">
            <defs>
              <linearGradient id="fastGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" :stop-color="live.done ? 'var(--color-secondary)' : 'var(--color-primary)'" />
                <stop offset="100%" :stop-color="live.done ? 'var(--color-tertiary)' : 'var(--color-primary-container)'" />
              </linearGradient>
            </defs>
            <circle cx="110" cy="110" :r="RING_R" class="track" />
            <circle
              cx="110" cy="110" :r="RING_R"
              class="fill"
              :stroke-dasharray="RING_CIRC"
              :stroke-dashoffset="dashOffset"
              stroke="url(#fastGrad)"
            />
          </svg>
          <div class="ring-txt">
            <p class="rl">已断食</p>
            <p class="rv num">
              {{ live.elapsedH }}<span class="rvu">h</span>
              {{ String(live.elapsedM).padStart(2, '0') }}<span class="rvu">m</span>
            </p>
            <p v-if="!live.done" class="rr num">剩 {{ live.remainingH }}h {{ live.remainingM }}m</p>
            <p v-else class="rr done">🎉 达成 · 可以结束</p>
          </div>
        </div>

        <p class="a-time num">
          {{ fmt(current.startTime) }} → {{ fmt(current.planEndTime) }}
        </p>

        <button type="button" class="btn end" :disabled="ending" @click="end">
          {{ ending ? '结束中…' : (live.done ? '完美结束' : '结束断食') }}
        </button>
      </section>

      <section v-else class="picker">
        <div class="p-hero">
          <div class="p-icon" aria-hidden="true">🌙</div>
          <h2 class="p-title">开始一段轻断食</h2>
          <p class="p-hint">选一个节奏 · 从现在开始计时</p>
        </div>

        <ul class="plans">
          <li v-for="p in PLANS" :key="p.code">
            <div class="plan-card">
              <div class="pc-head">
                <span class="pc-code">{{ p.label }}</span>
                <span class="pc-int" :class="'i-' + p.code">{{ p.intensity }}</span>
              </div>
              <p class="pc-window">{{ p.window }}</p>
              <p class="pc-hint">{{ p.hint }}</p>
              <button
                type="button"
                class="btn start"
                :disabled="starting !== null"
                @click="start(p.code)"
              >
                {{ starting === p.code ? '开始中…' : '开始 ' + p.label }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="history.length" class="log-card">
        <h3 class="log-title">历史 · <span class="num">{{ history.length }}</span></h3>
        <ul class="log-list">
          <li v-for="h in history" :key="h.id" class="log-row">
            <div class="lr-body">
              <p class="lr-t">
                <span class="num">{{ h.planCode }}:{{ 24 - (h.planHours ?? 16) }}</span>
                <span :class="['lr-st', 's-' + h.status]">{{ statusLabel(h.status) }}</span>
              </p>
              <p class="lr-sub num">
                {{ fmt(h.startTime) }}
                <template v-if="h.actualHours != null"> · 实际 {{ h.actualHours.toFixed(1) }}h</template>
              </p>
            </div>
            <button v-if="h.status !== 'R'" class="lr-del" @click="delOne(h.id)" aria-label="删除">×</button>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.active {
  display: flex; flex-direction: column; align-items: center; gap: 18px;
  padding: 22px 20px 24px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xl);
  box-shadow: 0 12px 32px rgba(29, 25, 23, 0.10), 0 2px 6px rgba(29, 25, 23, 0.04);
}
.a-plan-chip {
  padding: 4px 14px; border-radius: var(--radius-full);
  background: var(--color-primary-fixed); color: var(--color-primary);
  font-size: var(--font-size-caption); font-weight: 600; letter-spacing: 0.06em;
  font-family: var(--font-family-num);
}
.ring-wrap { position: relative; width: 240px; height: 240px; display: grid; place-items: center; }
.ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.track { fill: none; stroke: var(--color-surface-container-high); stroke-width: 14; }
.fill { fill: none; stroke-width: 14; stroke-linecap: round; transition: stroke-dashoffset var(--duration-slow) var(--ease-out-expo); }
.ring-txt { position: absolute; text-align: center; }
.rl { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.rv { margin: 6px 0 0; font-size: 42px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); display: flex; align-items: baseline; gap: 4px; justify-content: center; }
.rvu { font-size: 14px; font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); }
.rr { margin: 10px 0 0; font-size: var(--font-size-caption); color: var(--color-outline); }
.rr.done { color: var(--color-secondary); font-weight: 600; letter-spacing: 0.05em; }
.a-time { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.btn { height: 52px; padding: 0 32px; border-radius: var(--radius-md); font-size: var(--font-size-body); font-weight: 500; }
.btn:active { transform: scale(0.98); }
.btn:disabled { opacity: 0.5; }
.btn.end { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 8px 20px rgba(165, 51, 20, 0.32); width: 100%; }
.btn.start { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 4px 12px rgba(165, 51, 20, 0.24); width: 100%; margin-top: 10px; }

.picker { display: flex; flex-direction: column; gap: 14px; }
.p-hero { text-align: center; padding: 12px 20px 4px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.p-icon { width: 72px; height: 72px; display: grid; place-items: center; font-size: 36px; background: linear-gradient(140deg, var(--color-primary-container), var(--color-tertiary-container)); border-radius: 24px; box-shadow: 0 12px 28px rgba(165, 51, 20, 0.20); }
.p-title { margin: 4px 0 0; font-size: var(--font-size-section); font-weight: 600; }
.p-hint { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }

.plans { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.plan-card {
  padding: 16px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
}
.pc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.pc-code { font-size: 22px; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); letter-spacing: 0.02em; }
.pc-int { padding: 3px 10px; border-radius: var(--radius-full); font-size: var(--font-size-label); font-weight: 500; letter-spacing: 0.05em; }
.pc-int.i-14 { background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); }
.pc-int.i-16 { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.pc-int.i-18 { background: var(--color-error-container); color: var(--color-on-error-container); }
.pc-window { margin: 0; font-size: var(--font-size-body); font-weight: 500; color: var(--color-on-surface); font-family: var(--font-family-num); }
.pc-hint { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }

.log-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.log-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.log-title .num { color: var(--color-primary); font-weight: 600; }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.log-row:last-child { border-bottom: 0; }
.lr-t { margin: 0; font-size: var(--font-size-body); font-weight: 500; color: var(--color-on-surface); display: flex; align-items: center; gap: 8px; }
.lr-t .num { color: var(--color-primary); font-family: var(--font-family-num); }
.lr-st { padding: 2px 8px; border-radius: var(--radius-full); font-size: 10px; letter-spacing: 0.05em; }
.lr-st.s-C { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.lr-st.s-A { background: var(--color-surface-container-high); color: var(--color-on-surface-variant); }
.lr-st.s-R { background: var(--color-primary-container); color: var(--color-on-primary-container); }
.lr-sub { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.lr-del { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.lr-del:active { background: var(--color-error-container); color: var(--color-error); }
</style>
