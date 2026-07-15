<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import Stepper from '@/components/Stepper.vue';
import { exerciseApi, type ExerciseDay, type ExerciseType } from '@/api/exercise';
import { pickErrMsg } from '@/api/http';

const types = ref<ExerciseType[]>([]);
const day = ref<ExerciseDay | null>(null);
const loading = ref(true);
const errMsg = ref('');
const cat = ref<'ALL' | 'A' | 'S' | 'F' | 'M'>('ALL');
const selected = ref<ExerciseType | null>(null);
const duration = ref(30);
const manualKcal = ref<number | null>(null);

/** 估算体重 · 后端会用真实最新体重覆盖 · 这里只作预览 */
const PREVIEW_WEIGHT = 60;

const CATS: { code: 'ALL' | 'A' | 'S' | 'F' | 'M'; name: string }[] = [
  { code: 'ALL', name: '全部' },
  { code: 'A',   name: '有氧' },
  { code: 'S',   name: '力量' },
  { code: 'F',   name: '柔韧' },
  { code: 'M',   name: '综合' },
];

const INTENSITY_LABEL: Record<string, string> = { L: '低强度', M: '中强度', H: '高强度' };

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    const [t, d] = await Promise.all([exerciseApi.types(), exerciseApi.day()]);
    types.value = t;
    day.value = d;
  } catch (e) {
    errMsg.value = pickErrMsg(e, '加载失败');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const filtered = computed(() =>
  cat.value === 'ALL' ? types.value : types.value.filter((t) => t.category === cat.value),
);

function estimateKcal(met: number, min: number): number {
  return Math.round(met * PREVIEW_WEIGHT * (min / 60));
}

function pick(t: ExerciseType) {
  selected.value = t;
  if (duration.value < 5) duration.value = 30;
  manualKcal.value = null;
}
function cancel() {
  selected.value = null;
  manualKcal.value = null;
}

const previewKcal = computed(() =>
  selected.value ? estimateKcal(selected.value.met, duration.value) : 0,
);

async function submit() {
  if (!selected.value) return;
  errMsg.value = '';
  try {
    day.value = await exerciseApi.add({
      typeId: selected.value.id,
      durationMin: duration.value,
      kcalBurn: manualKcal.value != null && manualKcal.value >= 0 ? Number(manualKcal.value) : undefined,
    });
    selected.value = null;
    manualKcal.value = null;
  } catch (e) {
    errMsg.value = pickErrMsg(e, '添加失败');
  }
}
async function delOne(id: string) {
  if (!confirm('删除这条运动记录？')) return;
  try { day.value = await exerciseApi.del(id); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="运动" back-to="/" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <!-- 今日消耗大数字 -->
      <section class="hero">
        <div class="hero-main">
          <p class="hero-label">今日消耗</p>
          <p class="hero-value num">
            <template v-if="day">{{ day.totalKcal }}</template>
            <template v-else>0</template>
            <span class="hero-unit">kcal</span>
          </p>
          <p class="hero-sub num" v-if="day && day.totalMin > 0">
            {{ day.totalMin }} 分钟 · {{ day.entries.length }} 次
          </p>
          <p class="hero-sub muted" v-else>还没有运动 · 挑一项开始</p>
        </div>
        <div class="hero-badge" aria-hidden="true">🔥</div>
      </section>

      <!-- 分类 tab 条 -->
      <div class="cat-row" role="tablist">
        <button v-for="c in CATS" :key="c.code" type="button" role="tab"
                :class="['cat', { on: cat === c.code }]"
                :aria-selected="cat === c.code"
                @click="cat = c.code">{{ c.name }}</button>
      </div>

      <!-- 选中卡：正在记录 -->
      <section v-if="selected" class="rec-card" :class="['int-' + selected.intensity]">
        <div class="rec-head">
          <div class="rec-icon" aria-hidden="true">{{ selected.icon }}</div>
          <div class="rec-txt">
            <p class="rec-name">{{ selected.name }}</p>
            <p class="rec-meta num">MET {{ selected.met.toFixed(1) }} · {{ INTENSITY_LABEL[selected.intensity] }}</p>
          </div>
          <button type="button" class="rec-close" @click="cancel" aria-label="取消">×</button>
        </div>
        <Stepper v-model="duration" :min="1" :max="600" :step="5" :decimals="0" label="时长" hint="分钟" />
        <label class="manual-kcal">
          <span class="mk-lbl">卡路里（可选 · 留空自动算）</span>
          <input
            v-model.number="manualKcal"
            type="number" min="0" max="9999" inputmode="numeric"
            :placeholder="`自动 ≈ ${previewKcal} kcal`"
          />
        </label>
        <p class="rec-est num">
          ≈ {{ manualKcal != null && manualKcal >= 0 ? manualKcal : previewKcal }} <em>kcal</em>
          <span class="rec-est-hint">
            {{ manualKcal != null && manualKcal >= 0 ? '手动 · Watch/器械显示的值' : '按 60 kg 估算 · 实际按你最新体重' }}
          </span>
        </p>
        <button type="button" class="primary" @click="submit">
          + 记录 {{ duration }} 分钟
        </button>
      </section>

      <!-- 运动库 -->
      <section class="lib">
        <h3 class="lib-title">
          运动库
          <span class="lib-hint num">{{ filtered.length }} 项</span>
        </h3>
        <p v-if="loading" class="muted center">加载中...</p>
        <p v-else-if="!filtered.length" class="muted center">该分类暂无运动</p>
        <ul v-else class="lib-grid">
          <li v-for="t in filtered" :key="t.id">
            <button type="button"
                    :class="['lib-card', 'int-' + t.intensity, { on: selected?.id === t.id }]"
                    @click="pick(t)">
              <span class="lib-icon" aria-hidden="true">{{ t.icon }}</span>
              <span class="lib-name">{{ t.name }}</span>
              <span class="lib-met num">MET · {{ t.met.toFixed(1) }}</span>
              <span class="lib-int">{{ INTENSITY_LABEL[t.intensity] }}</span>
            </button>
          </li>
        </ul>
      </section>

      <!-- 今日记录 -->
      <section v-if="day && day.entries.length" class="log-card">
        <h3 class="log-title">今日 · <span class="num">{{ day.entries.length }}</span> 条</h3>
        <ul class="log-list">
          <li v-for="e in [...day.entries].reverse()" :key="e.id" class="log-row">
            <div class="lr-icon" aria-hidden="true">
              {{ types.find((t) => t.id === e.typeId)?.icon ?? '🏃' }}
            </div>
            <div class="lr-body">
              <p class="lr-title">
                {{ e.typeName }} · <span class="num">{{ e.durationMin }} min</span>
              </p>
              <p class="lr-sub num">{{ fmt(e.exTime) }} · 消耗 {{ Math.round(e.kcalBurn) }} kcal</p>
            </div>
            <button class="lr-del" @click="delOne(e.id)" aria-label="删除">×</button>
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
    radial-gradient(1000px 500px at 100% 0%, rgba(255, 138, 76, 0.14), transparent 60%),
    radial-gradient(800px 400px at 0% 30%, rgba(120, 90, 200, 0.06), transparent 60%),
    linear-gradient(180deg, #ffe6d5 0%, #ffedd8 22%, #f5f2ff 50%, #fbf5f0 100%);
  color: var(--color-on-surface);
}
.body { padding: 12px 16px calc(env(safe-area-inset-bottom) + 100px); display: flex; flex-direction: column; gap: 14px; }
.err { margin: 0; padding: 10px 14px; background: var(--color-error-container); color: var(--color-on-error-container); border-radius: 14px; font-size: 12.5px; }
.muted { color: var(--color-on-surface-variant); }
.center { text-align: center; padding: var(--space-lg) 0; }

/* Hero */
.hero {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 24px 22px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 32px;
  box-shadow: 0 20px 40px -18px rgba(255, 138, 76, 0.24);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.hero-label { margin: 0 0 4px; font-size: var(--font-size-label); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.hero-value { margin: 0; font-size: 46px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.hero-unit { margin-left: 6px; font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); }
.hero-sub { margin: 8px 0 0; font-size: var(--font-size-caption); color: var(--color-on-surface); }
.hero-sub.muted { color: var(--color-on-surface-variant); }
.hero-badge {
  width: 56px; height: 56px; display: grid; place-items: center;
  background: linear-gradient(140deg, var(--color-primary-container), var(--color-tertiary-container));
  border-radius: 22px; font-size: 26px;
  box-shadow: 0 6px 14px rgba(165, 51, 20, 0.18);
}

/* Category row */
.cat-row {
  display: flex; gap: 8px; overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.cat-row::-webkit-scrollbar { display: none; }
.cat {
  flex: 0 0 auto; padding: 9px 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 0;
  border-radius: 999px;
  color: var(--color-on-surface-variant);
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast);
  box-shadow: 0 6px 14px -10px rgba(120, 90, 200, 0.18);
}
.cat.on {
  background: linear-gradient(140deg, #ff8a4c 0%, #ff5722 100%);
  color: #fff;
  box-shadow: 0 8px 18px -6px rgba(255, 87, 34, 0.44);
  transform: translateY(-1px);
}

/* Recording card */
.rec-card {
  padding: 20px 18px;
  background: rgba(255, 255, 255, 0.86);
  border-radius: 24px;
  border-left: 4px solid #ff8a4c;
  box-shadow: 0 16px 34px -18px rgba(255, 138, 76, 0.28);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex; flex-direction: column; gap: 12px;
}
.rec-card.int-L { border-left-color: var(--color-tertiary); }
.rec-card.int-M { border-left-color: var(--color-primary); }
.rec-card.int-H { border-left-color: var(--color-error); }
.rec-head { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; }
.rec-icon { width: 44px; height: 44px; display: grid; place-items: center; font-size: 26px; background: var(--color-surface-container); border-radius: 14px; }
.rec-name { margin: 0; font-size: var(--font-size-body); font-weight: 600; color: var(--color-on-surface); }
.rec-meta { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.rec-close { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.manual-kcal { display: flex; flex-direction: column; gap: 4px; }
.mk-lbl { font-size: var(--font-size-label); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.manual-kcal input { height: 44px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); font-family: var(--font-family-num); color: var(--color-on-surface); }
.manual-kcal input:focus { outline: none; border-color: var(--color-primary); }
.rec-est { margin: 4px 0; font-size: 30px; font-weight: 600; color: var(--color-primary); line-height: 1; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.rec-est em { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-style: normal; font-family: var(--font-family-sans); }
.rec-est-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-weight: 400; font-family: var(--font-family-sans); }
.primary { height: 50px; border: 0; border-radius: 18px; background: linear-gradient(140deg, #ff8a4c 0%, #ff5722 100%); color: #fff; font-size: 14px; font-weight: 600; letter-spacing: 0.04em; box-shadow: 0 14px 30px -10px rgba(255, 87, 34, 0.44); cursor: pointer; transition: transform var(--duration-fast); }
.primary:active { transform: scale(0.98); }

/* Library grid */
.lib { display: flex; flex-direction: column; gap: 10px; }
.lib-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); display: flex; justify-content: space-between; align-items: baseline; }
.lib-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-weight: 400; }
.lib-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.lib-card {
  width: 100%; padding: 14px 14px;
  background: rgba(255, 255, 255, 0.82);
  border: 0;
  border-radius: 20px;
  display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 2px 10px;
  align-items: center;
  text-align: left;
  box-shadow: 0 10px 22px -16px rgba(255, 138, 76, 0.22);
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s;
}
.lib-card:active { transform: scale(0.98); }
.lib-card.on {
  border-color: var(--color-primary);
  box-shadow: 0 8px 20px rgba(165, 51, 20, 0.15);
  background: var(--color-primary-container);
}
.lib-icon { grid-row: 1 / 3; font-size: 24px; width: 38px; height: 38px; display: grid; place-items: center; background: var(--color-surface-container); border-radius: 12px; }
.lib-card.on .lib-icon { background: var(--color-surface-container-lowest); }
.lib-name { font-size: var(--font-size-body); font-weight: 600; color: var(--color-on-surface); }
.lib-met { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); grid-column: 2; }
.lib-int {
  font-size: 9px; padding: 2px 6px; border-radius: var(--radius-full);
  justify-self: end; align-self: start;
  background: var(--color-surface-container); color: var(--color-on-surface-variant);
  grid-column: 2; grid-row: 1;
  letter-spacing: 0.05em;
}
.lib-card.int-L .lib-int { background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); }
.lib-card.int-M .lib-int { background: var(--color-primary-container); color: var(--color-on-primary-container); }
.lib-card.int-H .lib-int { background: var(--color-error-container); color: var(--color-on-error-container); }

/* Log */
.log-card {
  padding: 18px 16px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 26px;
  box-shadow: 0 16px 34px -22px rgba(255, 138, 76, 0.22);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.log-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.log-title .num { color: var(--color-primary); font-weight: 600; }
.log-list { list-style: none; margin: 0; padding: 0; }
.log-row { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.log-row:last-child { border-bottom: 0; }
.lr-icon { width: 36px; height: 36px; display: grid; place-items: center; font-size: 20px; background: var(--color-surface-container); border-radius: 12px; }
.lr-title { margin: 0; font-size: var(--font-size-caption); font-weight: 500; color: var(--color-on-surface); }
.lr-sub { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.lr-del { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.lr-del:active { background: var(--color-error-container); color: var(--color-error); }
</style>
