<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import Stepper from '@/components/Stepper.vue';
import { bodyApi, type WeightSummary } from '@/api/body';
import { pickErrMsg } from '@/api/http';

const summary = ref<WeightSummary | null>(null);
const loading = ref(true);
const errMsg = ref('');
const newKg = ref(65);

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    summary.value = await bodyApi.summary();
    if (summary.value.latest) newKg.value = summary.value.latest.weightKg;
  } catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

async function add() {
  errMsg.value = '';
  try { summary.value = await bodyApi.addWeight({ weightKg: newKg.value }); }
  catch (e) { errMsg.value = pickErrMsg(e, '添加失败'); }
}
async function delOne(id: string) {
  if (!confirm('删除这条体重记录？')) return;
  try { summary.value = await bodyApi.delWeight(id); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

const latest = computed(() => summary.value?.latest);
const delta = computed(() => summary.value?.delta30 ?? 0);
const deltaLabel = computed(() => {
  const d = delta.value;
  if (d === 0) return '与 30 天前持平';
  return d > 0 ? `+${d.toFixed(1)} kg` : `${d.toFixed(1)} kg`;
});
const deltaClass = computed(() => (delta.value === 0 ? 'flat' : delta.value > 0 ? 'up' : 'down'));

const chart = computed(() => {
  const h = summary.value?.history ?? [];
  if (h.length < 2) return { points: '', dots: [] as { x: number; y: number; kg: number }[] };
  const kgs = h.map((p) => p.weightKg);
  const min = Math.min(...kgs), max = Math.max(...kgs);
  const range = max - min || 1;
  const W = 300, H = 100, pad = 8;
  const dots = h.map((p, i) => {
    const x = pad + (i / (h.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (p.weightKg - min) / range) * (H - pad * 2);
    return { x, y, kg: p.weightKg };
  });
  const points = dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
  return { points, dots };
});

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function bmiLabel(bmi: number | null): string {
  if (bmi == null) return '—';
  if (bmi < 18.5) return '偏瘦';
  if (bmi < 24) return '正常';
  if (bmi < 28) return '偏胖';
  return '肥胖';
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="体重" back-to="/" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section class="latest-card">
        <div class="l-main">
          <p class="l-label">最新体重</p>
          <p class="l-value num">
            <template v-if="latest">{{ latest.weightKg.toFixed(1) }}</template>
            <template v-else>—</template>
            <span class="l-unit"> kg</span>
          </p>
          <p class="l-delta" :class="deltaClass" v-if="summary && summary.count > 1">
            <span class="d-arrow" aria-hidden="true">
              <template v-if="delta > 0">▲</template>
              <template v-else-if="delta < 0">▼</template>
              <template v-else>―</template>
            </span>
            <span class="num">{{ deltaLabel }}</span>
          </p>
          <p class="l-delta flat" v-else>记录一笔开始跟踪</p>
        </div>
        <div class="l-side">
          <div class="l-stat">
            <p class="ls-k num">
              <template v-if="latest?.bmi != null">{{ latest.bmi.toFixed(1) }}</template>
              <template v-else>—</template>
            </p>
            <p class="ls-v">BMI · {{ bmiLabel(latest?.bmi ?? null) }}</p>
          </div>
          <div class="l-stat">
            <p class="ls-k num">
              <template v-if="summary?.targetWt != null">{{ summary.targetWt.toFixed(1) }}</template>
              <template v-else>—</template>
            </p>
            <p class="ls-v">目标 kg</p>
          </div>
        </div>
      </section>

      <section class="chart-card">
        <div class="c-head">
          <h3 class="c-title">近 30 天</h3>
          <span class="c-hint num">{{ summary?.count ?? 0 }} 条记录</span>
        </div>
        <svg viewBox="0 0 300 100" class="chart" v-if="chart.points">
          <defs>
            <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.28" />
              <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <polyline :points="`8,92 ${chart.points} 292,92`" fill="url(#wgrad)" stroke="none" />
          <polyline :points="chart.points" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <circle v-for="(d, i) in chart.dots" :key="i" :cx="d.x" :cy="d.y" r="3.5" fill="var(--color-surface-container-lowest)" stroke="var(--color-primary)" stroke-width="2" />
        </svg>
        <p v-else class="c-empty">还没有历史数据 · 记录 2 次以上就会画出折线</p>
      </section>

      <section class="add-card">
        <div class="a-head">
          <span class="a-label">记录体重</span>
          <span class="a-hint">拖动或输入</span>
        </div>
        <Stepper v-model="newKg" :min="20" :max="300" :step="0.1" :decimals="1" hint="kg" />
        <button type="button" class="primary" @click="add">
          + 记录 {{ newKg.toFixed(1) }} kg
        </button>
      </section>

      <section v-if="summary && summary.history.length" class="log-card">
        <h3 class="log-title">历史 · <span class="num">{{ summary.count }}</span> 条</h3>
        <ul class="log-list">
          <li v-for="p in [...summary.history].reverse()" :key="p.id" class="log-row">
            <div class="lr-body">
              <p class="lr-kg num">{{ p.weightKg.toFixed(1) }} <em>kg</em></p>
              <p class="lr-sub">
                {{ fmt(p.measTime) }}
                <span v-if="p.bmi != null"> · BMI {{ p.bmi.toFixed(1) }}</span>
              </p>
            </div>
            <button class="lr-del" @click="delOne(p.id)" aria-label="删除">×</button>
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

.latest-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 16px; padding: 20px; background: var(--color-surface-container-lowest); border-radius: var(--radius-xl); border: 1px solid var(--color-outline-variant); box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08), 0 2px 6px rgba(29, 25, 23, 0.04); }
.l-label { margin: 0 0 4px; font-size: var(--font-size-label); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.l-value { margin: 0; font-size: 46px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.l-unit { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); margin-left: 4px; }
.l-delta { margin: 6px 0 0; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: var(--radius-full); font-size: var(--font-size-caption); font-weight: 500; }
.l-delta.up   { background: var(--color-error-container); color: var(--color-on-error-container); }
.l-delta.down { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.l-delta.flat { background: var(--color-surface-container); color: var(--color-on-surface-variant); }
.d-arrow { font-size: 10px; }
.l-side { display: flex; flex-direction: column; gap: 10px; }
.l-stat { text-align: right; }
.ls-k { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-surface); }
.ls-v { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }

.chart-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.c-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.c-title { margin: 0; font-size: var(--font-size-body); font-weight: 600; }
.c-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.chart { width: 100%; height: auto; display: block; }
.c-empty { margin: 8px 0 0; text-align: center; font-size: var(--font-size-caption); color: var(--color-outline); }

.add-card { display: flex; flex-direction: column; gap: 12px; padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.a-head { display: flex; justify-content: space-between; align-items: baseline; }
.a-label { font-size: var(--font-size-caption); font-weight: 500; color: var(--color-on-surface); }
.a-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.primary { height: 48px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }

.log-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.log-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.log-title .num { color: var(--color-primary); font-weight: 600; }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.log-row:last-child { border-bottom: 0; }
.lr-kg { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-surface); font-family: var(--font-family-num); }
.lr-kg em { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-style: normal; margin-left: 2px; font-family: var(--font-family-sans); }
.lr-sub { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.lr-del { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.lr-del:active { background: var(--color-error-container); color: var(--color-error); }
</style>
