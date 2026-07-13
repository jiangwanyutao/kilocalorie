<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import Stepper from '@/components/Stepper.vue';
import {
  bodyApi,
  MEASURE_DIMS,
  type MeasureDim,
  type MeasureSummary,
  type AddMeasurePayload,
} from '@/api/body';
import { pickErrMsg } from '@/api/http';

const summary = ref<MeasureSummary | null>(null);
const loading = ref(true);
const errMsg = ref('');

interface DimSpec {
  key: MeasureDim;
  name: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

const DIMS: DimSpec[] = [
  { key: 'waistCm',    name: '腰围',   unit: 'cm', min: 30, max: 200, step: 0.5, decimals: 1 },
  { key: 'hipCm',      name: '臀围',   unit: 'cm', min: 30, max: 200, step: 0.5, decimals: 1 },
  { key: 'chestCm',    name: '胸围',   unit: 'cm', min: 30, max: 200, step: 0.5, decimals: 1 },
  { key: 'thighCm',    name: '大腿围', unit: 'cm', min: 20, max: 150, step: 0.5, decimals: 1 },
  { key: 'armCm',      name: '臂围',   unit: 'cm', min: 10, max: 80,  step: 0.5, decimals: 1 },
  { key: 'bodyFatPct', name: '体脂率', unit: '%',  min: 3,  max: 70,  step: 0.1, decimals: 1 },
];

// 每维是否启用输入 + 当前值（多字段各自 mutate · reactive 天然合适）
const enabled = reactive<Record<MeasureDim, boolean>>({
  waistCm: false, hipCm: false, chestCm: false, thighCm: false, armCm: false, bodyFatPct: false,
});
const values = reactive<Record<MeasureDim, number>>({
  waistCm: 75, hipCm: 92, chestCm: 88, thighCm: 55, armCm: 28, bodyFatPct: 22,
});

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    summary.value = await bodyApi.measureSummary();
    for (const d of DIMS) {
      const l = summary.value.latest[d.key];
      if (l) values[d.key] = l.value;
    }
  } catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

const enabledCount = computed(() => MEASURE_DIMS.filter((k) => enabled[k]).length);

async function submit() {
  if (enabledCount.value === 0) {
    errMsg.value = '请勾选至少一个维度';
    return;
  }
  errMsg.value = '';
  const payload: AddMeasurePayload = {};
  for (const d of DIMS) {
    if (enabled[d.key]) payload[d.key] = values[d.key];
  }
  try {
    summary.value = await bodyApi.addMeasure(payload);
    for (const k of MEASURE_DIMS) enabled[k] = false;
  } catch (e) { errMsg.value = pickErrMsg(e, '添加失败'); }
}

async function delOne(id: string) {
  if (!confirm('删除这条记录？')) return;
  try { summary.value = await bodyApi.delMeasure(id); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

function fmt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtRow(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function nameOf(k: MeasureDim): string {
  return DIMS.find((d) => d.key === k)?.name ?? k;
}
function unitOf(k: MeasureDim): string {
  return DIMS.find((d) => d.key === k)?.unit ?? '';
}

function deltaArrow(v: number): '▲' | '▼' | '―' {
  if (v > 0) return '▲';
  if (v < 0) return '▼';
  return '―';
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="围度" back-to="/" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <!-- 最新 6 卡 -->
      <section class="latest-grid">
        <div v-for="d in DIMS" :key="d.key" class="dim-cell">
          <p class="dc-name">{{ d.name }}</p>
          <p class="dc-v num">
            <template v-if="summary?.latest[d.key]">
              {{ summary.latest[d.key]!.value.toFixed(1) }}
            </template>
            <template v-else>—</template>
            <span class="dc-u">{{ d.unit }}</span>
          </p>
          <p class="dc-sub">
            <template v-if="summary?.latest[d.key]">
              <span
                v-if="summary.delta90[d.key] !== 0"
                :class="['dc-chip', summary.delta90[d.key] > 0 ? 'up' : 'down']"
              >
                {{ deltaArrow(summary.delta90[d.key]) }}
                <span class="num">{{ Math.abs(summary.delta90[d.key]).toFixed(1) }}</span>
              </span>
              <span class="dc-time">{{ fmt(summary.latest[d.key]!.measTime) }}</span>
            </template>
            <template v-else>还没记录</template>
          </p>
        </div>
      </section>

      <!-- 添加卡 -->
      <section class="add-card">
        <div class="a-head">
          <p class="a-title">记录围度</p>
          <p class="a-hint">勾选要记的项 · 至少 1 项</p>
        </div>

        <ul class="dim-list">
          <li v-for="d in DIMS" :key="d.key" :class="['dim-row', { on: enabled[d.key] }]">
            <label class="dim-check">
              <input type="checkbox" v-model="enabled[d.key]" />
              <span class="cb-box" aria-hidden="true"></span>
              <span class="cb-txt">{{ d.name }}</span>
            </label>
            <div v-if="enabled[d.key]" class="dim-stepper">
              <Stepper
                v-model="values[d.key]"
                :min="d.min"
                :max="d.max"
                :step="d.step"
                :decimals="d.decimals"
                :hint="d.unit"
              />
            </div>
          </li>
        </ul>

        <button type="button" class="primary" :disabled="enabledCount === 0" @click="submit">
          + 记录 <span class="num">{{ enabledCount }}</span> 项
        </button>
      </section>

      <!-- 历史列表 -->
      <section v-if="summary && summary.history.length" class="log-card">
        <h3 class="log-title">
          历史 · <span class="num">{{ summary.count }}</span> 条
        </h3>
        <ul class="log-list">
          <li v-for="p in [...summary.history].reverse()" :key="p.id" class="log-row">
            <div class="lr-body">
              <p class="lr-time num">{{ fmtRow(p.measTime) }}</p>
              <div class="lr-chips">
                <span v-for="k in MEASURE_DIMS" :key="k">
                  <span v-if="p[k] != null" class="lr-chip">
                    {{ nameOf(k) }}
                    <b class="num">{{ p[k]!.toFixed(1) }}</b>
                    <em>{{ unitOf(k) }}</em>
                  </span>
                </span>
              </div>
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

/* Latest 6 grid */
.latest-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.dim-cell {
  padding: 12px 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06), 0 1px 3px rgba(29, 25, 23, 0.04);
}
.dc-name { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.dc-v { margin: 4px 0 4px; font-size: 24px; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); line-height: 1; }
.dc-u { margin-left: 3px; font-size: 11px; font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); }
.dc-sub { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dc-chip { display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px; border-radius: var(--radius-full); font-size: 10px; font-weight: 500; }
.dc-chip.up   { background: var(--color-error-container); color: var(--color-on-error-container); }
.dc-chip.down { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.dc-time { color: var(--color-outline); }

/* Add card */
.add-card {
  padding: 16px;
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-outline-variant);
  box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08), 0 2px 6px rgba(29, 25, 23, 0.04);
  display: flex; flex-direction: column; gap: 12px;
}
.a-head { display: flex; justify-content: space-between; align-items: baseline; }
.a-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.a-hint { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }

.dim-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.dim-row {
  padding: 10px 12px;
  border-radius: var(--radius-default);
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
  transition: border-color var(--duration-fast), background var(--duration-fast);
}
.dim-row.on {
  border-color: var(--color-primary);
  background: var(--color-primary-fixed);
}
.dim-check {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
}
.dim-check input { display: none; }
.cb-box {
  width: 20px; height: 20px;
  border-radius: 6px;
  border: 2px solid var(--color-outline);
  background: transparent;
  position: relative;
  flex: 0 0 auto;
  transition: all var(--duration-fast);
}
.dim-row.on .cb-box {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.dim-row.on .cb-box::after {
  content: '';
  position: absolute;
  left: 5px; top: 1px;
  width: 6px; height: 10px;
  border: solid var(--color-on-primary);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.cb-txt { font-size: var(--font-size-body); font-weight: 500; color: var(--color-on-surface); }
.dim-stepper { margin-top: 10px; }

.primary {
  height: 48px; border-radius: var(--radius-md);
  background: var(--color-primary); color: var(--color-on-primary);
  font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card);
}
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: 0.5; box-shadow: none; }

/* Log */
.log-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.log-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.log-title .num { color: var(--color-primary); font-weight: 600; }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; padding: 10px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.log-row:last-child { border-bottom: 0; }
.lr-time { margin: 0 0 6px; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.lr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.lr-chip {
  display: inline-flex; align-items: baseline; gap: 3px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-container);
  color: var(--color-on-surface);
  font-size: var(--font-size-label);
  letter-spacing: 0.05em;
}
.lr-chip b { font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.lr-chip em { font-size: 9px; font-style: normal; color: var(--color-outline); font-family: var(--font-family-sans); }
.lr-del { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.lr-del:active { background: var(--color-error-container); color: var(--color-error); }
</style>
