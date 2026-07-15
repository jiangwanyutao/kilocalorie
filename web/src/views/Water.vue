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
.wrap {
  min-height: 100dvh;
  background:
    radial-gradient(1000px 500px at 100% 0%, rgba(64, 152, 214, 0.10), transparent 60%),
    radial-gradient(800px 400px at 0% 30%, rgba(120, 90, 200, 0.06), transparent 60%),
    linear-gradient(180deg, #ecebff 0%, #dcefff 22%, #f5f2ff 50%, #fbf5f0 100%);
  color: var(--color-on-surface);
}
.body {
  padding: 12px 16px calc(env(safe-area-inset-bottom) + 100px);
  display: flex; flex-direction: column; gap: 14px;
}
.err {
  margin: 0; padding: 10px 14px;
  background: var(--color-error-container);
  color: var(--color-on-error-container);
  border-radius: 14px;
  font-size: 12.5px;
}

.drop-card {
  padding: 26px 20px 20px;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 32px;
  box-shadow: 0 20px 40px -18px rgba(64, 152, 214, 0.30);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.drop-wrap { position: relative; width: 180px; }
.drop { width: 100%; height: auto; display: block; filter: drop-shadow(0 10px 22px rgba(64, 152, 214, 0.28)); }
.drop-txt { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; pointer-events: none; }
.d-pct { margin: 0; font-size: 42px; line-height: 1; font-weight: 700; color: #ffffff; text-shadow: 0 2px 6px rgba(30, 80, 130, 0.5); letter-spacing: -0.01em; }
.d-ml { margin: 4px 0 0; font-size: 12px; color: rgba(255, 255, 255, 0.95); text-shadow: 0 1px 3px rgba(30, 80, 130, 0.5); letter-spacing: 0.03em; }
.d-hint { margin: 0; text-align: center; font-size: 12.5px; color: var(--color-on-surface-variant); letter-spacing: 0.03em; }
.d-hint b { color: #2b7bb8; font-weight: 700; font-family: var(--font-family-num); }

.drink-row { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; scrollbar-width: none; }
.drink-row::-webkit-scrollbar { display: none; }
.d-chip {
  flex: 0 0 auto;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 0;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all var(--duration-fast);
  box-shadow: 0 6px 16px -10px rgba(120, 90, 200, 0.18);
}
.d-chip.on {
  background: linear-gradient(140deg, #4098d6 0%, #2b7bb8 100%);
  color: #fff;
  box-shadow: 0 10px 22px -6px rgba(64, 152, 214, 0.44);
  transform: translateY(-1px);
}
.dc-icon { font-size: 20px; line-height: 1; }
.dc-name { font-size: 11px; letter-spacing: 0.03em; font-weight: 500; }

.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.q-btn {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 16px 14px;
  border: 0; border-radius: 22px;
  text-align: left; cursor: pointer;
  transition: transform var(--duration-fast);
  box-shadow: 0 12px 24px -18px rgba(120, 90, 200, 0.20);
}
.q-btn:nth-child(1) { background: linear-gradient(155deg, #eeeaff 0%, rgba(255, 255, 255, 0.88) 60%); }
.q-btn:nth-child(2) { background: linear-gradient(155deg, #dcefff 0%, rgba(255, 255, 255, 0.88) 60%); }
.q-btn:nth-child(3) { background: linear-gradient(155deg, #cce8ff 0%, rgba(255, 255, 255, 0.88) 60%); }
.q-btn:nth-child(4) { background: linear-gradient(155deg, #fff4cc 0%, rgba(255, 255, 255, 0.88) 60%); }
.q-btn:active { transform: translateY(1px); }
.q-icon { font-size: 24px; line-height: 1; }
.q-ml { font-size: 20px; font-weight: 700; color: #2b7bb8; font-family: var(--font-family-num); letter-spacing: -0.01em; }
.q-u { font-size: 11px; font-weight: 500; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); letter-spacing: 0.02em; }
.q-lbl { font-size: 11px; letter-spacing: 0.04em; color: var(--color-outline); }

.custom-card {
  display: flex; flex-direction: column; gap: 12px;
  padding: 18px 16px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 26px;
  box-shadow: 0 16px 34px -22px rgba(120, 90, 200, 0.20);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.cc-head { display: flex; justify-content: space-between; align-items: baseline; }
.cc-label { font-size: 12px; font-weight: 600; color: var(--color-on-surface); letter-spacing: 0.04em; }
.cc-hint { font-size: 10.5px; letter-spacing: 0.05em; color: var(--color-outline); }
.primary {
  height: 50px; border: 0; border-radius: 18px;
  background: linear-gradient(140deg, #4098d6 0%, #2b7bb8 100%);
  color: #fff; font-size: 14px; font-weight: 600; letter-spacing: 0.04em;
  box-shadow: 0 14px 30px -10px rgba(64, 152, 214, 0.44);
  cursor: pointer;
  transition: transform var(--duration-fast);
}
.primary:active { transform: scale(0.98); }

.log-card {
  padding: 18px 16px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 26px;
  box-shadow: 0 16px 34px -22px rgba(120, 90, 200, 0.20);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.log-title { margin: 0 0 10px; font-size: 12px; color: var(--color-on-surface-variant); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.log-title .num { color: #2b7bb8; font-weight: 700; text-transform: none; }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row {
  display: grid; grid-template-columns: 32px 1fr auto;
  align-items: center; gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(120, 90, 200, 0.08);
}
.log-row:last-child { border-bottom: 0; }
.lr-icon { font-size: 20px; text-align: center; }
.lr-name { margin: 0; font-size: 13.5px; color: var(--color-on-surface); font-weight: 500; }
.lr-sub { margin: 2px 0 0; font-size: 10.5px; letter-spacing: 0.03em; color: var(--color-outline); font-family: var(--font-family-num); }
.lr-del { width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: var(--color-outline); font-size: 20px; cursor: pointer; }
.lr-del:active { background: var(--color-error-container); color: var(--color-error); }
</style>
