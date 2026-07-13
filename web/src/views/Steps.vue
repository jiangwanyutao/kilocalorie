<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { bodyApi, type StepsSummary } from '@/api/body';
import { pickErrMsg } from '@/api/http';

const summary = ref<StepsSummary | null>(null);
const loading = ref(true);
const errMsg = ref('');
const days = ref<30 | 90 | 365>(30);

async function load() {
  loading.value = true;
  errMsg.value = '';
  try { summary.value = await bodyApi.stepsSummary(days.value); }
  catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);
async function pickDays(d: 30 | 90 | 365) { days.value = d; await load(); }

const chart = computed(() => {
  const h = summary.value?.history ?? [];
  if (!h.length) return { bars: [] as { x: number; w: number; y: number; h: number; steps: number }[] };
  const max = Math.max(...h.map((p) => p.stepCount)) || 1;
  const W = 320, H = 120, pad = 4;
  const bw = Math.max(1, (W - pad * 2) / h.length - 1);
  return {
    bars: h.map((p, i) => {
      const barH = Math.max(1, (p.stepCount / max) * (H - pad * 2));
      return {
        x: pad + i * (bw + 1),
        w: bw,
        y: H - pad - barH,
        h: barH,
        steps: p.stepCount,
      };
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
    <AppHeader title="步数 · 距离 · 消耗" back-to="/" />

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
        <div class="s-main">
          <p class="s-label">近 {{ days }} 天</p>
          <p class="s-val num">
            <template v-if="summary.avgSteps > 0">{{ summary.avgSteps.toLocaleString() }}</template>
            <template v-else>—</template>
            <span class="s-u">步 / 天</span>
          </p>
          <p class="s-sub num">
            共 {{ summary.count }} 天记录 · 峰值 {{ summary.maxSteps.toLocaleString() }} 步
          </p>
        </div>
        <div class="s-side">
          <div class="s-stat">
            <p class="ss-k num">{{ summary.totalDistanceKm.toFixed(1) }}</p>
            <p class="ss-v">总距离 km</p>
          </div>
          <div class="s-stat">
            <p class="ss-k num">{{ summary.totalKcal.toLocaleString() }}</p>
            <p class="ss-v">总消耗 kcal</p>
          </div>
        </div>
      </section>

      <section class="chart-card" v-if="summary && chart.bars.length">
        <div class="c-head">
          <h3 class="c-title">走势</h3>
          <span class="c-hint num">{{ summary.count }} 条</span>
        </div>
        <svg viewBox="0 0 320 120" class="chart">
          <rect v-for="(b, i) in chart.bars" :key="i"
                :x="b.x" :y="b.y" :width="b.w" :height="b.h"
                fill="var(--color-primary)" opacity="0.75"
                :aria-label="b.steps + ' 步'" />
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
              <p class="lr-main num">
                <b>{{ p.stepCount.toLocaleString() }}</b> 步
                <template v-if="p.distanceM"> · {{ (p.distanceM / 1000).toFixed(1) }} km</template>
                <template v-if="p.kcalBurn"> · {{ Math.round(p.kcalBurn) }} kcal</template>
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
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.range-row { display: flex; gap: 6px; padding: 4px; background: var(--color-surface-container); border-radius: var(--radius-full); }
.range { flex: 1; padding: 8px 0; background: transparent; color: var(--color-on-surface-variant); font-size: var(--font-size-caption); border-radius: var(--radius-full); transition: all var(--duration-fast); }
.range.on { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 3px 8px rgba(165, 51, 20, 0.24); font-weight: 500; }

.summary-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 16px; padding: 20px; background: var(--color-surface-container-lowest); border-radius: var(--radius-xl); border: 1px solid var(--color-outline-variant); box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08), 0 2px 6px rgba(29, 25, 23, 0.04); }
.s-label { margin: 0 0 4px; font-size: var(--font-size-label); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.s-val { margin: 0; font-size: 34px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.s-u { margin-left: 6px; font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); }
.s-sub { margin: 8px 0 0; font-size: var(--font-size-caption); color: var(--color-outline); }
.s-side { display: flex; flex-direction: column; gap: 12px; }
.s-stat { text-align: right; }
.ss-k { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-surface); font-family: var(--font-family-num); }
.ss-v { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }

.chart-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.c-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.c-title { margin: 0; font-size: var(--font-size-body); font-weight: 600; }
.c-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.chart { width: 100%; height: auto; display: block; }
.c-labels { display: flex; justify-content: space-between; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); margin-top: 4px; }

.log-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.log-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.log-title .num { color: var(--color-primary); font-weight: 600; font-family: var(--font-family-num); }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: 56px 1fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.log-row:last-child { border-bottom: 0; }
.lr-date { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-family: var(--font-family-num); font-weight: 500; }
.lr-main { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface); font-family: var(--font-family-num); }
.lr-main b { color: var(--color-primary); font-weight: 600; }

.empty { margin: 0; padding: 40px 20px; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.empty a { color: var(--color-primary); }
</style>
