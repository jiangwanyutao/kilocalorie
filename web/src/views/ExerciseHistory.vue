<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { exerciseApi, type ExerciseSummary } from '@/api/exercise';
import { pickErrMsg } from '@/api/http';

const summary = ref<ExerciseSummary | null>(null);
const loading = ref(true);
const errMsg = ref('');
const days = ref<30 | 90 | 365>(30);

async function load() {
  loading.value = true;
  errMsg.value = '';
  try { summary.value = await exerciseApi.summary(days.value); }
  catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);
async function pickDays(d: 30 | 90 | 365) { days.value = d; await load(); }

const byTypeSorted = computed(() => {
  if (!summary.value?.byType) return [];
  return Object.entries(summary.value.byType)
    .map(([name, s]) => ({ name, ...s, kcal: Math.round(s.totalKcal) }))
    .sort((a, b) => b.totalMin - a.totalMin);
});

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const typeColors: Record<string, string> = {
  '力量训练': 'var(--color-primary)',
  '跑步': 'var(--color-error)',
  '慢跑': 'var(--color-tertiary)',
  '骑行': 'var(--color-secondary)',
  '游泳': 'var(--color-primary-container)',
  '瑜伽': 'var(--color-tertiary-container)',
  '散步': 'var(--color-outline)',
  'HIIT': 'var(--color-error)',
};
function typeColor(name: string): string {
  return typeColors[name] ?? 'var(--color-primary)';
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="锻炼历史" back-to="/exercise" />

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
            <template v-if="summary.count > 0">{{ summary.count }}</template>
            <template v-else>—</template>
            <span class="s-u">次锻炼</span>
          </p>
          <p class="s-sub num">
            <template v-if="summary.count > 0">共 {{ hm(summary.totalMin) }} · 消耗 {{ summary.totalKcal.toLocaleString() }} kcal</template>
            <template v-else>还没有记录</template>
          </p>
        </div>
      </section>

      <section v-if="byTypeSorted.length" class="type-card">
        <h3 class="tc-title">按类型 · <span class="num">{{ byTypeSorted.length }}</span> 类</h3>
        <ul class="type-list">
          <li v-for="t in byTypeSorted" :key="t.name" class="type-row">
            <div class="tr-head">
              <span class="tr-dot" :style="{ background: typeColor(t.name) }"></span>
              <span class="tr-name">{{ t.name }}</span>
              <span class="tr-cnt num">{{ t.count }} 次</span>
            </div>
            <div class="tr-bar-track">
              <div class="tr-bar" :style="{ width: (t.totalMin / summary!.totalMin * 100) + '%', background: typeColor(t.name) }"></div>
            </div>
            <p class="tr-meta num">{{ hm(t.totalMin) }} · {{ t.kcal.toLocaleString() }} kcal</p>
          </li>
        </ul>
      </section>

      <section v-if="summary && summary.history.length" class="log-card">
        <h3 class="log-title">时间线 · <span class="num">{{ summary.history.length }}</span></h3>
        <ul class="log-list">
          <li v-for="e in summary.history.slice(0, 50)" :key="e.id" class="log-row">
            <span class="lr-dot" :style="{ background: typeColor(e.typeName) }"></span>
            <div class="lr-body">
              <p class="lr-name">
                {{ e.typeName }}
                <span class="lr-dur num">· {{ hm(e.durationMin) }}</span>
              </p>
              <p class="lr-meta num">
                {{ fmt(e.exTime) }} · <b>{{ Math.round(e.kcalBurn) }}</b> kcal
              </p>
            </div>
          </li>
        </ul>
      </section>

      <p v-else-if="!loading" class="empty">还没有锻炼数据 · 去 <router-link to="/exercise">Exercise 主页</router-link> 或 <router-link to="/health/import">Apple 健康导入</router-link></p>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.range-row { display: flex; gap: 6px; padding: 4px; background: var(--color-surface-container); border-radius: var(--radius-full); }
.range { flex: 1; padding: 8px 0; background: transparent; color: var(--color-on-surface-variant); font-size: var(--font-size-caption); border-radius: var(--radius-full); transition: all var(--duration-fast); }
.range.on { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 3px 8px rgba(165, 51, 20, 0.24); font-weight: 500; }

.summary-card { padding: 20px; background: var(--color-surface-container-lowest); border-radius: var(--radius-xl); border: 1px solid var(--color-outline-variant); box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08); }
.s-label { margin: 0 0 4px; font-size: var(--font-size-label); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.s-val { margin: 0; font-size: 40px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.s-u { margin-left: 8px; font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); }
.s-sub { margin: 8px 0 0; font-size: var(--font-size-caption); color: var(--color-outline); }

.type-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.tc-title { margin: 0 0 10px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.tc-title .num { color: var(--color-primary); font-weight: 700; font-family: var(--font-family-num); }
.type-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.type-row { display: flex; flex-direction: column; gap: 4px; }
.tr-head { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; }
.tr-dot { width: 10px; height: 10px; border-radius: 50%; }
.tr-name { font-size: var(--font-size-caption); font-weight: 500; color: var(--color-on-surface); }
.tr-cnt { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.tr-bar-track { height: 6px; background: var(--color-surface-container-high); border-radius: 3px; overflow: hidden; }
.tr-bar { height: 100%; border-radius: 3px; transition: width var(--duration-slow) var(--ease-out-expo); }
.tr-meta { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }

.log-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.log-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.log-title .num { color: var(--color-primary); font-weight: 600; font-family: var(--font-family-num); }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: 12px 1fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.log-row:last-child { border-bottom: 0; }
.lr-dot { width: 8px; height: 8px; border-radius: 50%; }
.lr-name { margin: 0; font-size: var(--font-size-caption); font-weight: 500; color: var(--color-on-surface); }
.lr-dur { color: var(--color-outline); font-weight: 400; }
.lr-meta { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.lr-meta b { color: var(--color-primary); font-weight: 600; }

.empty { margin: 0; padding: 40px 20px; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.empty a { color: var(--color-primary); }
</style>
