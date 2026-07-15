<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { userApi, type MeResponse } from '@/api/user';
import { mealApi, type DayKcal } from '@/api/meal';
import { bodyApi, type WeightSummary } from '@/api/body';
import { exerciseApi, type ExerciseSummary } from '@/api/exercise';

type Range = 7 | 30;

const range = ref<Range>(7);
const loading = ref(true);
const me = ref<MeResponse | null>(null);
const dayKcal = ref<DayKcal[]>([]);
const wt = ref<WeightSummary | null>(null);
const ex = ref<ExerciseSummary | null>(null);

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function load(): Promise<void> {
  loading.value = true;
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - (range.value - 1));
  try {
    const [m, dk, w, e] = await Promise.all([
      userApi.me(),
      mealApi.days(ymd(from), ymd(to)),
      bodyApi.summary().catch(() => null),
      exerciseApi.summary(range.value).catch(() => null),
    ]);
    me.value = m;
    dayKcal.value = dk;
    wt.value = w;
    ex.value = e;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(range, load);

const kcalGoal = computed<number>(() => {
  return me.value?.goal?.kcalGoal ?? me.value?.tdeeKcal ?? 2200;
});

const avgKcal = computed<number>(() => {
  const nz = dayKcal.value.filter((d) => d.kcal > 0);
  if (!nz.length) return 0;
  const sum = nz.reduce((s, d) => s + d.kcal, 0);
  return Math.round(sum / nz.length);
});

const daysLogged = computed<number>(() => dayKcal.value.filter((d) => d.kcal > 0).length);

const totalBurned = computed<number>(() => {
  return dayKcal.value.reduce((s, d) => s + d.burned + d.active, 0);
});

const inGoalPct = computed<number>(() => {
  const nz = dayKcal.value.filter((d) => d.kcal > 0);
  if (!nz.length) return 0;
  const ok = nz.filter((d) => d.kcal <= kcalGoal.value).length;
  return Math.round((ok / nz.length) * 100);
});

const kcalPath = computed<string>(() => {
  if (!dayKcal.value.length) return '';
  const w = 320, h = 110, pad = 8;
  const max = Math.max(kcalGoal.value * 1.2, ...dayKcal.value.map((d) => d.kcal));
  const n = dayKcal.value.length;
  return dayKcal.value.map((d, i) => {
    const x = pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
    const y = h - pad - (d.kcal / max) * (h - 2 * pad);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
});

const goalLineY = computed<number>(() => {
  if (!dayKcal.value.length) return 55;
  const h = 110, pad = 8;
  const max = Math.max(kcalGoal.value * 1.2, ...dayKcal.value.map((d) => d.kcal));
  return h - pad - (kcalGoal.value / max) * (h - 2 * pad);
});

const wtSeries = computed(() => {
  if (!wt.value?.history?.length) return [];
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - (range.value - 1));
  return wt.value.history
    .filter((p) => new Date(p.measTime) >= from && new Date(p.measTime) <= to)
    .sort((a, b) => a.measTime.localeCompare(b.measTime));
});

const wtPath = computed<string>(() => {
  const s = wtSeries.value;
  if (s.length < 2) return '';
  const w = 320, h = 90, pad = 8;
  const vals = s.map((p) => p.weightKg);
  const min = Math.min(...vals) - 0.3;
  const max = Math.max(...vals) + 0.3;
  const span = Math.max(0.6, max - min);
  return s.map((p, i) => {
    const x = pad + (i * (w - 2 * pad)) / (s.length - 1);
    const y = h - pad - ((p.weightKg - min) / span) * (h - 2 * pad);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
});

const wtDelta = computed<number>(() => {
  const s = wtSeries.value;
  if (s.length < 2) return 0;
  return +(s[s.length - 1].weightKg - s[0].weightKg).toFixed(1);
});

const wtLatest = computed<number | null>(() => {
  const s = wtSeries.value;
  return s.length ? s[s.length - 1].weightKg : (wt.value?.latest?.weightKg ?? null);
});

const goalChipTone = computed<string>(() => {
  if (inGoalPct.value >= 70) return 'ok';
  if (inGoalPct.value >= 40) return 'mid';
  return 'warn';
});
</script>

<template>
  <section class="wrap">
    <AppHeader title="统计" />
    <div class="body">
      <div class="tabs">
        <button
          type="button" class="tab" :class="{ on: range === 7 }"
          @click="range = 7"
        >近 7 天</button>
        <button
          type="button" class="tab" :class="{ on: range === 30 }"
          @click="range = 30"
        >近 30 天</button>
      </div>

      <div class="hero">
        <p class="h-eyebrow">日均摄入</p>
        <p class="h-num num">
          {{ loading ? '—' : avgKcal }}<span class="h-unit"> kcal</span>
        </p>
        <p class="h-sub">
          目标 <b class="num">{{ kcalGoal }}</b> kcal ·
          <span :class="['chip', goalChipTone]">{{ inGoalPct }}% 达标</span>
        </p>
        <div class="h-foot">
          <div class="hf">
            <span class="hf-l">记录天数</span>
            <span class="hf-v num">{{ daysLogged }}/{{ range }}</span>
          </div>
          <div class="hf">
            <span class="hf-l">总消耗</span>
            <span class="hf-v num">{{ Math.round(totalBurned) }} kcal</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="c-head">
          <p class="c-title">卡路里摄入</p>
          <span class="c-hint">虚线 = 目标</span>
        </div>
        <div v-if="dayKcal.length" class="chart">
          <svg viewBox="0 0 320 110" preserveAspectRatio="none" class="svg">
            <defs>
              <linearGradient id="kcalG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#A53314" stop-opacity="0.28" />
                <stop offset="100%" stop-color="#A53314" stop-opacity="0" />
              </linearGradient>
            </defs>
            <line
              :x1="8" :x2="312" :y1="goalLineY" :y2="goalLineY"
              stroke="#7E5100" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"
            />
            <path
              :d="kcalPath + ` L 312 110 L 8 110 Z`"
              fill="url(#kcalG)"
            />
            <path
              :d="kcalPath"
              fill="none" stroke="#A53314" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
        </div>
        <p v-else class="empty">还没数据 · 去 <router-link to="/food/picker" class="lk">记一笔</router-link></p>
      </div>

      <div class="card">
        <div class="c-head">
          <p class="c-title">体重变化</p>
          <span v-if="wtLatest != null" class="c-hint">
            最新 <b class="num">{{ wtLatest }}</b> kg
            <span v-if="wtDelta !== 0" class="delta num" :class="wtDelta < 0 ? 'down' : 'up'">
              {{ wtDelta > 0 ? '+' : '' }}{{ wtDelta }}
            </span>
          </span>
        </div>
        <div v-if="wtSeries.length >= 2" class="chart">
          <svg viewBox="0 0 320 90" preserveAspectRatio="none" class="svg">
            <defs>
              <linearGradient id="wtG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#7E5100" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#7E5100" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path
              :d="wtPath + ` L 312 90 L 8 90 Z`"
              fill="url(#wtG)"
            />
            <path
              :d="wtPath"
              fill="none" stroke="#7E5100" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
        </div>
        <p v-else class="empty">
          <router-link to="/body/weight" class="lk">称一下 →</router-link>
        </p>
      </div>

      <div class="card ex">
        <div class="c-head">
          <p class="c-title">运动</p>
          <router-link to="/exercise/history" class="c-hint lk">全部 →</router-link>
        </div>
        <div class="ex-row">
          <div class="ex-cell">
            <span class="e-l">次数</span>
            <span class="e-v num">{{ ex?.count ?? 0 }}</span>
          </div>
          <div class="ex-cell">
            <span class="e-l">总时长</span>
            <span class="e-v num">{{ ex?.totalMin ?? 0 }}<em>分</em></span>
          </div>
          <div class="ex-cell">
            <span class="e-l">总消耗</span>
            <span class="e-v num">{{ ex?.totalKcal ?? 0 }}<em>kcal</em></span>
          </div>
        </div>
      </div>

      <p class="foot">数据仅统计已记录部分 · 空白日会跳过</p>
    </div>
  </section>
</template>

<style scoped>
.wrap {
  min-height: 100dvh;
  background:
    radial-gradient(1000px 500px at 100% 0%, rgba(198, 75, 42, 0.06), transparent 60%),
    radial-gradient(800px 400px at 0% 30%, rgba(83, 101, 35, 0.05), transparent 60%),
    linear-gradient(180deg, #ecebff 0%, #f5f2ff 22%, #fbf5f0 50%, #fff8f5 100%);
  color: var(--color-on-surface);
}
.body {
  padding: 12px 16px calc(env(safe-area-inset-bottom) + 100px);
  display: flex; flex-direction: column; gap: 14px;
}

.tabs {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  box-shadow: 0 8px 20px -12px rgba(120, 90, 200, 0.20);
}
.tab {
  padding: 10px 0;
  background: transparent; border: 0; border-radius: 999px;
  color: var(--color-on-surface-variant);
  font-size: 13px; font-weight: 500; letter-spacing: 0.04em;
  transition: all var(--duration-fast);
  cursor: pointer;
}
.tab.on {
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  box-shadow: 0 6px 14px -4px rgba(165, 51, 20, 0.36);
}

.hero {
  padding: 26px 22px 20px;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 32px;
  box-shadow: 0 20px 40px -18px rgba(120, 90, 200, 0.22);
}
.h-eyebrow {
  margin: 0; font-size: 11px; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-primary);
}
.h-num {
  margin: 8px 0 4px; font-size: 46px; font-weight: 700;
  color: var(--color-on-surface);
  font-family: var(--font-family-num);
  letter-spacing: -0.01em; line-height: 1;
}
.h-unit { font-size: 15px; font-weight: 500; color: var(--color-on-surface-variant); letter-spacing: 0.04em; }
.h-sub  { margin: 4px 0 0; font-size: 12.5px; color: var(--color-on-surface-variant); }
.h-sub b { color: var(--color-on-surface); font-weight: 600; }

.chip {
  display: inline-block; margin-left: 6px;
  padding: 2px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 500; letter-spacing: 0.03em;
}
.chip.ok   { background: #e6f5d5; color: #4a7a1a; }
.chip.mid  { background: #fff4cc; color: #7e5100; }
.chip.warn { background: #ffe0d5; color: #a53314; }

.h-foot {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-top: 18px; padding-top: 16px;
  border-top: 1px solid rgba(120, 90, 200, 0.08);
}
.hf { display: flex; flex-direction: column; gap: 3px; }
.hf-l { font-size: 11px; color: var(--color-outline); letter-spacing: 0.04em; }
.hf-v { font-size: 16px; font-weight: 600; color: var(--color-on-surface); font-family: var(--font-family-num); }

.card {
  padding: 20px 18px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 28px;
  box-shadow: 0 16px 34px -22px rgba(120, 90, 200, 0.20);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.c-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.c-title {
  margin: 0; font-size: 13px; font-weight: 600;
  letter-spacing: 0.06em; color: var(--color-on-surface);
}
.c-hint { font-size: 11px; color: var(--color-on-surface-variant); letter-spacing: 0.03em; }
.c-hint b { color: var(--color-on-surface); font-weight: 600; }
.delta { margin-left: 6px; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 600; }
.delta.down { background: #e6f5d5; color: #4a7a1a; }
.delta.up   { background: #ffe0d5; color: #a53314; }

.chart { width: 100%; height: auto; overflow: hidden; border-radius: 12px; }
.svg { display: block; width: 100%; height: auto; }

.empty {
  margin: 6px 0 0; padding: 22px 0;
  text-align: center;
  font-size: 12.5px; color: var(--color-outline);
}
.lk { color: var(--color-primary); text-decoration: none; font-weight: 500; }

.ex-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ex-cell {
  padding: 14px 10px;
  background: linear-gradient(155deg, #eeeaff 0%, rgba(255, 255, 255, 0.85) 60%);
  border-radius: 18px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.ex-cell:nth-child(2) { background: linear-gradient(155deg, #fff4cc 0%, rgba(255, 255, 255, 0.85) 60%); }
.ex-cell:nth-child(3) { background: linear-gradient(155deg, #ffe0d5 0%, rgba(255, 255, 255, 0.85) 60%); }
.e-l { font-size: 11px; color: var(--color-outline); letter-spacing: 0.04em; }
.e-v {
  font-size: 22px; font-weight: 700; color: var(--color-on-surface);
  font-family: var(--font-family-num); letter-spacing: 0.02em;
  display: inline-flex; align-items: baseline; gap: 2px;
}
.e-v em { font-size: 10px; font-weight: 500; color: var(--color-on-surface-variant); font-style: normal; margin-left: 2px; }

.foot { text-align: center; margin: 8px 0 0; font-size: 11px; color: var(--color-outline); letter-spacing: 0.04em; }
</style>
