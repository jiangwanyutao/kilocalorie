<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { bodyApi, type SleepSummary } from '@/api/body';
import { pickErrMsg } from '@/api/http';

const summary = ref<SleepSummary | null>(null);
const loading = ref(true);
const errMsg = ref('');
const days = ref<30 | 90 | 365>(30);

async function load() {
  loading.value = true;
  errMsg.value = '';
  try { summary.value = await bodyApi.sleepSummary(days.value); }
  catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);
async function pickDays(d: 30 | 90 | 365) { days.value = d; await load(); }

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

const chart = computed(() => {
  const h = summary.value?.history ?? [];
  if (!h.length) return { bars: [] as { x: number; w: number; deep: number; rem: number; light: number; total: number }[] };
  const max = Math.max(...h.map((p) => p.asleepMin)) || 1;
  const W = 320, H = 130, pad = 4;
  const bw = Math.max(1, (W - pad * 2) / h.length - 1);
  return {
    bars: h.map((p, i) => {
      const scale = (H - pad * 2) / max;
      const deep = (p.deepMin ?? 0) * scale;
      const rem = (p.remMin ?? 0) * scale;
      const total = p.asleepMin * scale;
      const light = Math.max(0, total - deep - rem);
      const x = pad + i * (bw + 1);
      return { x, w: bw, deep, rem, light, total };
    }),
  };
});

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="睡眠" back-to="/" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <div class="range-row">
        <button v-for="d in [30, 90, 365] as const" :key="d"
                :class="['range', { on: days === d }]"
                @click="pickDays(d)">
          {{ d }} 天
        </button>
      </div>

      <section class="summary-card" v-if="summary">
        <p class="s-label">近 {{ days }} 天 · 每晚平均</p>
        <p class="s-val num">
          <template v-if="summary.avgAsleepMin > 0">{{ hm(summary.avgAsleepMin) }}</template>
          <template v-else>—</template>
        </p>
        <div class="s-splits">
          <div class="sp">
            <span class="dot d-deep"></span>
            <span class="sp-lbl">深睡</span>
            <span class="sp-val num">{{ hm(summary.avgDeepMin) }}</span>
          </div>
          <div class="sp">
            <span class="dot d-rem"></span>
            <span class="sp-lbl">REM</span>
            <span class="sp-val num">{{ hm(summary.avgRemMin) }}</span>
          </div>
          <div class="sp">
            <span class="dot d-light"></span>
            <span class="sp-lbl">浅睡/核心</span>
            <span class="sp-val num">{{ hm(Math.max(0, summary.avgAsleepMin - summary.avgDeepMin - summary.avgRemMin)) }}</span>
          </div>
        </div>
        <p class="s-sub num">共 {{ summary.count }} 晚记录</p>
      </section>

      <section class="chart-card" v-if="summary && chart.bars.length">
        <div class="c-head">
          <h3 class="c-title">分段走势</h3>
        </div>
        <svg viewBox="0 0 320 130" class="chart">
          <g v-for="(b, i) in chart.bars" :key="i">
            <rect :x="b.x" :y="130 - 4 - b.deep" :width="b.w" :height="b.deep" fill="var(--color-primary)" />
            <rect :x="b.x" :y="130 - 4 - b.deep - b.rem" :width="b.w" :height="b.rem" fill="var(--color-tertiary)" />
            <rect :x="b.x" :y="130 - 4 - b.total" :width="b.w" :height="b.light" fill="var(--color-secondary)" opacity="0.6" />
          </g>
        </svg>
        <div class="c-labels" v-if="summary.history.length">
          <span>{{ fmtDay(summary.history[0].date) }}</span>
          <span>{{ fmtDay(summary.history[summary.history.length - 1].date) }}</span>
        </div>
      </section>

      <section v-if="summary && summary.history.length" class="log-card">
        <h3 class="log-title">近期 · <span class="num">{{ summary.history.length }}</span></h3>
        <ul class="log-list">
          <li v-for="p in [...summary.history].reverse().slice(0, 30)" :key="p.id" class="log-row">
            <p class="lr-date num">{{ fmtDay(p.date) }}</p>
            <div class="lr-body">
              <p class="lr-main num"><b>{{ hm(p.asleepMin) }}</b></p>
              <p class="lr-sub num">
                <template v-if="p.deepMin != null">深 {{ hm(p.deepMin) }} · </template>
                <template v-if="p.remMin != null">REM {{ hm(p.remMin) }}</template>
                <template v-if="p.inBedMin"> · 在床 {{ hm(p.inBedMin) }}</template>
              </p>
            </div>
          </li>
        </ul>
      </section>

      <p v-else-if="!loading" class="empty">还没有数据 · 去 <router-link to="/health/import">Apple Health 导入</router-link></p>
    </div>
  </section>
</template>

<style scoped>
.wrap {
  min-height: 100dvh;
  background:
    radial-gradient(1000px 500px at 100% 0%, rgba(80, 60, 180, 0.15), transparent 60%),
    radial-gradient(800px 400px at 0% 30%, rgba(120, 90, 200, 0.08), transparent 60%),
    linear-gradient(180deg, #d8d4f2 0%, #e2ddf5 22%, #ecebff 50%, #f5f2ff 100%);
  color: var(--color-on-surface);
}
.body { padding: 12px 16px calc(env(safe-area-inset-bottom) + 100px); display: flex; flex-direction: column; gap: 14px; }
.err { margin: 0; padding: 10px 14px; background: var(--color-error-container); color: var(--color-on-error-container); border-radius: 14px; font-size: 12.5px; }

.range-row { display: flex; gap: 4px; padding: 4px; background: rgba(255, 255, 255, 0.72); border-radius: 999px; box-shadow: 0 8px 20px -12px rgba(80, 60, 180, 0.22); }
.range { flex: 1; padding: 10px 0; background: transparent; border: 0; color: var(--color-on-surface-variant); font-size: 12.5px; border-radius: 999px; transition: all var(--duration-fast); cursor: pointer; font-weight: 500; }
.range.on { background: linear-gradient(140deg, #6b46c1 0%, #4c2d99 100%); color: #fff; box-shadow: 0 6px 14px -4px rgba(80, 60, 180, 0.44); }

.summary-card {
  padding: 26px 22px 22px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 32px;
  box-shadow: 0 20px 40px -18px rgba(80, 60, 180, 0.26);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; flex-direction: column; gap: 10px;
}
.s-label { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #4c2d99; }
.s-val { margin: 0; font-size: 44px; line-height: 1; font-weight: 700; color: var(--color-on-surface); font-family: var(--font-family-num); letter-spacing: -0.01em; }
.s-sub { margin: 0; font-size: 12px; color: var(--color-on-surface-variant); }
.s-splits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 2px; }
.sp { display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: 16px; }
.sp:nth-child(1) { background: linear-gradient(155deg, #eeeaff 0%, rgba(255,255,255,0.85) 60%); }
.sp:nth-child(2) { background: linear-gradient(155deg, #ffe6d5 0%, rgba(255,255,255,0.85) 60%); }
.sp:nth-child(3) { background: linear-gradient(155deg, #dcefff 0%, rgba(255,255,255,0.85) 60%); }
.dot { width: 8px; height: 8px; border-radius: 50%; margin-bottom: 3px; }
.d-deep { background: #6b46c1; }
.d-rem { background: #ff8a4c; }
.d-light { background: #4098d6; }
.sp-lbl { font-size: 10.5px; letter-spacing: 0.03em; color: var(--color-on-surface-variant); }
.sp-val { font-size: 13px; font-weight: 700; color: var(--color-on-surface); font-family: var(--font-family-num); letter-spacing: 0.02em; }

.chart-card, .log-card {
  padding: 18px 16px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 26px;
  box-shadow: 0 16px 34px -22px rgba(80, 60, 180, 0.20);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.c-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.c-title { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.03em; }
.chart { width: 100%; height: auto; display: block; }
.c-labels { display: flex; justify-content: space-between; font-size: 10.5px; letter-spacing: 0.03em; color: var(--color-outline); font-family: var(--font-family-num); margin-top: 6px; }

.log-title { margin: 0 0 10px; font-size: 12px; color: var(--color-on-surface-variant); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.log-title .num { color: #4c2d99; font-weight: 700; font-family: var(--font-family-num); text-transform: none; }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: 56px 1fr; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(80, 60, 180, 0.08); }
.log-row:last-child { border-bottom: 0; }
.lr-date { margin: 0; font-size: 12px; color: var(--color-on-surface-variant); font-family: var(--font-family-num); font-weight: 600; letter-spacing: 0.02em; }
.lr-main { margin: 0; font-size: 13px; color: var(--color-on-surface); font-family: var(--font-family-num); }
.lr-main b { color: #4c2d99; font-weight: 700; }
.lr-sub { margin: 3px 0 0; font-size: 10.5px; letter-spacing: 0.03em; color: var(--color-outline); font-family: var(--font-family-num); }

.empty { margin: 0; padding: 40px 20px; text-align: center; font-size: 12.5px; color: var(--color-on-surface-variant); }
.empty a { color: #4c2d99; font-weight: 500; }
</style>
