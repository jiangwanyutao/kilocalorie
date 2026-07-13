<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import Stepper from '@/components/Stepper.vue';
import { waterApi, type WaterDay } from '@/api/water';
import { pickErrMsg } from '@/api/http';

const day = ref<WaterDay | null>(null);
const loading = ref(true);
const errMsg = ref('');
const customMl = ref(250);

const QUICK: { ml: number; label: string; icon: string }[] = [
  { ml: 100, label: '一小杯', icon: '🥃' },
  { ml: 250, label: '一杯',   icon: '🥛' },
  { ml: 500, label: '一大杯', icon: '🍶' },
  { ml: 330, label: '一罐',   icon: '🥤' },
];

const DRINKS: { code: 'W' | 'T' | 'C' | 'J' | 'S'; name: string; icon: string }[] = [
  { code: 'W', name: '白水', icon: '💧' },
  { code: 'T', name: '茶',   icon: '🍵' },
  { code: 'C', name: '咖啡', icon: '☕' },
  { code: 'J', name: '果汁', icon: '🧃' },
  { code: 'S', name: '汤',   icon: '🍲' },
];
const drinkType = ref<'W' | 'T' | 'C' | 'J' | 'S'>('W');

async function load() {
  loading.value = true;
  errMsg.value = '';
  try { day.value = await waterApi.day(); }
  catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

async function add(ml: number) {
  errMsg.value = '';
  try { day.value = await waterApi.add({ volumeMl: ml, drinkType: drinkType.value }); }
  catch (e) { errMsg.value = pickErrMsg(e, '添加失败'); }
}
async function delEntry(id: string) {
  if (!confirm('删除这条饮水记录？')) return;
  try { day.value = await waterApi.del(id); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

const fillPct = computed(() => (day.value?.pct ?? 0) / 100);
const fillY = computed(() => 100 - fillPct.value * 100);

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const drinkNameOf = (code: string) => DRINKS.find(d => d.code === code)?.name ?? '';
const drinkIconOf = (code: string) => DRINKS.find(d => d.code === code)?.icon ?? '💧';
</script>

<template>
  <section class="wrap">
    <AppHeader title="喝水" back-to="/" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section class="drop-card">
        <div class="drop-wrap">
          <svg viewBox="0 0 100 120" class="drop" aria-label="今日饮水进度">
            <defs>
              <clipPath id="dropClip">
                <path d="M50 5 C 50 5, 90 55, 90 85 A 40 40 0 1 1 10 85 C 10 55, 50 5, 50 5 Z"/>
              </clipPath>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#7fc8ff" />
                <stop offset="100%" stop-color="#4098d6" />
              </linearGradient>
            </defs>
            <path
              d="M50 5 C 50 5, 90 55, 90 85 A 40 40 0 1 1 10 85 C 10 55, 50 5, 50 5 Z"
              fill="#f0e6e2"
              stroke="var(--color-outline-variant)"
              stroke-width="1"
            />
            <rect
              x="0"
              :y="fillY"
              width="100"
              :height="100 - fillY + 20"
              fill="url(#waterGrad)"
              clip-path="url(#dropClip)"
            />
          </svg>
          <div class="drop-txt">
            <p class="d-pct num">{{ day?.pct ?? 0 }}%</p>
            <p class="d-ml num">{{ day?.effectiveMl ?? 0 }} / {{ day?.goalMl ?? 2000 }} ml</p>
          </div>
        </div>
        <p class="d-hint">
          <template v-if="day && day.remaining > 0">还差 <b class="num">{{ day.remaining }}</b> ml 达标 · 每次喝一杯就打卡</template>
          <template v-else-if="day">已完成今日目标 · 继续保持 · 好棒！</template>
        </p>
      </section>

      <section class="drink-row">
        <button
          v-for="d in DRINKS"
          :key="d.code"
          type="button"
          class="d-chip"
          :class="{ on: drinkType === d.code }"
          @click="drinkType = d.code"
        >
          <span class="dc-icon">{{ d.icon }}</span>
          <span class="dc-name">{{ d.name }}</span>
        </button>
      </section>

      <section class="quick-grid">
        <button v-for="q in QUICK" :key="q.ml" type="button" class="q-btn" @click="add(q.ml)">
          <span class="q-icon">{{ q.icon }}</span>
          <span class="q-ml num">+ {{ q.ml }}<span class="q-u"> ml</span></span>
          <span class="q-lbl">{{ q.label }}</span>
        </button>
      </section>

      <section class="custom-card">
        <div class="cc-head">
          <span class="cc-label">自定义</span>
          <span class="cc-hint">按 ml 快加</span>
        </div>
        <Stepper v-model="customMl" :min="10" :max="3000" :step="50" hint="ml" />
        <button type="button" class="primary" @click="add(customMl)">
          + 记录 {{ customMl }} ml {{ drinkNameOf(drinkType) }}
        </button>
      </section>

      <section v-if="day && day.entries.length" class="log-card">
        <h3 class="log-title">今日记录 · <span class="num">{{ day.entries.length }}</span> 笔</h3>
        <ul class="log-list">
          <li v-for="e in day.entries" :key="e.id" class="log-row">
            <span class="lr-icon">{{ drinkIconOf(e.drinkType) }}</span>
            <div class="lr-body">
              <p class="lr-name">{{ drinkNameOf(e.drinkType) }} · {{ e.volumeMl }} ml</p>
              <p class="lr-sub">等效 {{ e.effectiveMl }} ml · {{ fmt(e.drinkTime) }}</p>
            </div>
            <button class="lr-del" @click="delEntry(e.id)" aria-label="删除">×</button>
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

.drop-card { background: var(--color-surface-container-lowest); border-radius: var(--radius-xl); padding: 20px 16px 16px; box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08), 0 2px 6px rgba(29, 25, 23, 0.04); border: 1px solid var(--color-outline-variant); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.drop-wrap { position: relative; width: 180px; }
.drop { width: 100%; height: auto; display: block; filter: drop-shadow(0 6px 12px rgba(64, 152, 214, 0.18)); }
.drop-txt { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; pointer-events: none; }
.d-pct { margin: 0; font-size: 40px; line-height: 1; font-weight: 600; color: #ffffff; text-shadow: 0 2px 4px rgba(64, 152, 214, 0.4); }
.d-ml { margin: 4px 0 0; font-size: var(--font-size-caption); color: rgba(255, 255, 255, 0.92); text-shadow: 0 1px 2px rgba(64, 152, 214, 0.4); }
.d-hint { margin: 0; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.d-hint b { color: var(--color-primary); font-weight: 600; }

.drink-row { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; scrollbar-width: none; }
.drink-row::-webkit-scrollbar { display: none; }
.d-chip { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 14px; border-radius: var(--radius-full); background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); color: var(--color-on-surface-variant); transition: all var(--duration-fast); }
.d-chip.on { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 4px 12px rgba(165, 51, 20, 0.24); }
.dc-icon { font-size: 20px; line-height: 1; }
.dc-name { font-size: var(--font-size-label); letter-spacing: 0.05em; }

.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.q-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; border-radius: var(--radius-lg); background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); text-align: left; transition: transform var(--duration-fast); }
.q-btn:active { transform: scale(0.97); }
.q-icon { font-size: 24px; }
.q-ml { font-size: var(--font-size-section); font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.q-u { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); }
.q-lbl { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }

.custom-card { display: flex; flex-direction: column; gap: 12px; padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.cc-head { display: flex; justify-content: space-between; align-items: baseline; }
.cc-label { font-size: var(--font-size-caption); font-weight: 500; color: var(--color-on-surface); }
.cc-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.primary { height: 48px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }

.log-card { padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.log-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.log-title .num { color: var(--color-primary); font-weight: 600; }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.log-row:last-child { border-bottom: 0; }
.lr-icon { font-size: 20px; text-align: center; }
.lr-name { margin: 0; font-size: var(--font-size-body); color: var(--color-on-surface); }
.lr-sub { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.lr-del { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.lr-del:active { background: var(--color-error-container); color: var(--color-error); }
</style>
