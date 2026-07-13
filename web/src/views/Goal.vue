<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import Stepper from '@/components/Stepper.vue';
import { userApi, type MeResponse, type UpdateGoalPayload } from '@/api/user';
import { pickErrMsg } from '@/api/http';

const router = useRouter();
const me = ref<MeResponse | null>(null);
const loading = ref(true);
const errMsg = ref('');
const submitting = ref(false);

type GoalType = 'M' | 'L1' | 'L2' | 'G1';

interface GoalOption {
  code: GoalType;
  label: string;
  hint: string;
  factor: string;
}

const GOALS: GoalOption[] = [
  { code: 'M',  label: '维持体重', hint: '按 TDEE 吃 · 保持现状',    factor: '×1.00' },
  { code: 'L1', label: '温和减脂', hint: '轻微赤字 · 每周约 0.3 kg', factor: '×0.85' },
  { code: 'L2', label: '严格减脂', hint: '大赤字 · 每周约 0.5 kg',   factor: '×0.75' },
  { code: 'G1', label: '增肌',     hint: '轻微盈余 · 力量训练必备',  factor: '×1.10' },
];

const goalType = ref<GoalType>('M');
const kcalGoal = ref(2000);
const carbPct = ref(50);
const protPct = ref(25);
const fatPct = ref(25);
const waterMl = ref(2000);
const targetWt = ref<number | null>(null);

const original = ref<UpdateGoalPayload>({});

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    const m = await userApi.me();
    me.value = m;
    if (!m.goal) {
      router.replace('/onboarding');
      return;
    }
    goalType.value = m.goal.goalType as GoalType;
    kcalGoal.value = m.goal.kcalGoal;
    carbPct.value = m.goal.carbPct;
    protPct.value = m.goal.protPct;
    fatPct.value = m.goal.fatPct;
    waterMl.value = m.goal.waterMl;
    targetWt.value = m.goal.targetWt != null ? Number(m.goal.targetWt) : null;
    original.value = {
      goalType: goalType.value,
      kcalGoal: kcalGoal.value,
      carbPct: carbPct.value,
      protPct: protPct.value,
      fatPct: fatPct.value,
      waterMl: waterMl.value,
      targetWt: targetWt.value ?? undefined,
    };
  } catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

const macroSum = computed(() => carbPct.value + protPct.value + fatPct.value);
const macroOk = computed(() => macroSum.value <= 100);

const macroKcal = computed(() => {
  const c = Math.round(kcalGoal.value * carbPct.value / 100 / 4);
  const p = Math.round(kcalGoal.value * protPct.value / 100 / 4);
  const f = Math.round(kcalGoal.value * fatPct.value / 100 / 9);
  return { carbG: c, protG: p, fatG: f };
});

async function save() {
  if (!macroOk.value) { errMsg.value = `碳水+蛋白+脂肪合计 ${macroSum.value}% · 不能超过 100`; return; }
  submitting.value = true;
  errMsg.value = '';
  const patch: UpdateGoalPayload = {};
  if (goalType.value !== original.value.goalType) patch.goalType = goalType.value;
  if (kcalGoal.value !== original.value.kcalGoal) patch.kcalGoal = kcalGoal.value;
  if (carbPct.value !== original.value.carbPct) patch.carbPct = carbPct.value;
  if (protPct.value !== original.value.protPct) patch.protPct = protPct.value;
  if (fatPct.value !== original.value.fatPct) patch.fatPct = fatPct.value;
  if (waterMl.value !== original.value.waterMl) patch.waterMl = waterMl.value;
  if ((targetWt.value ?? undefined) !== original.value.targetWt) {
    if (targetWt.value != null) patch.targetWt = targetWt.value;
  }
  if (Object.keys(patch).length === 0) {
    router.push('/me');
    return;
  }
  try {
    await userApi.updateGoal(patch);
    router.push('/me');
  } catch (e) { errMsg.value = pickErrMsg(e, '保存失败'); }
  finally { submitting.value = false; }
}

function pickGoal(t: GoalType) {
  goalType.value = t;
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="编辑目标" back-to="/me" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section class="card">
        <h2 class="s-title">目标类型</h2>
        <p class="s-hint">切换后 · 卡路里目标会按 TDEE × 系数 自动重算 · 除非你在下面手动改</p>
        <ul class="goal-list">
          <li v-for="g in GOALS" :key="g.code">
            <button
              type="button"
              :class="['goal-card', { on: goalType === g.code }]"
              @click="pickGoal(g.code)"
            >
              <div class="gc-head">
                <span class="gc-label">{{ g.label }}</span>
                <span class="gc-factor num">{{ g.factor }}</span>
              </div>
              <p class="gc-hint">{{ g.hint }}</p>
            </button>
          </li>
        </ul>
      </section>

      <section class="card">
        <div class="row-head">
          <h2 class="s-title">卡路里目标</h2>
          <span class="s-hint">你的 TDEE ≈ <span class="num">{{ me?.tdeeKcal ?? '—' }}</span> kcal</span>
        </div>
        <Stepper v-model="kcalGoal" :min="500" :max="6000" :step="50" :decimals="0" hint="kcal" />
      </section>

      <section class="card">
        <div class="row-head">
          <h2 class="s-title">三大营养素比例</h2>
          <span :class="['sum-chip', { bad: !macroOk }]">
            合计 <span class="num">{{ macroSum }}</span>%
          </span>
        </div>
        <div class="macro">
          <label class="macro-row">
            <span class="m-name">碳水</span>
            <input v-model.number="carbPct" type="range" min="0" max="80" step="1" class="m-range" />
            <span class="m-val num">{{ carbPct }}% · {{ macroKcal.carbG }}g</span>
          </label>
          <label class="macro-row">
            <span class="m-name">蛋白</span>
            <input v-model.number="protPct" type="range" min="0" max="80" step="1" class="m-range" />
            <span class="m-val num">{{ protPct }}% · {{ macroKcal.protG }}g</span>
          </label>
          <label class="macro-row">
            <span class="m-name">脂肪</span>
            <input v-model.number="fatPct" type="range" min="0" max="80" step="1" class="m-range" />
            <span class="m-val num">{{ fatPct }}% · {{ macroKcal.fatG }}g</span>
          </label>
        </div>
      </section>

      <section class="card">
        <h2 class="s-title">每日水量</h2>
        <Stepper v-model="waterMl" :min="500" :max="6000" :step="100" :decimals="0" hint="ml" />
      </section>

      <section class="card">
        <div class="row-head">
          <h2 class="s-title">目标体重</h2>
          <button v-if="targetWt != null" type="button" class="link" @click="targetWt = null">清除</button>
        </div>
        <p v-if="targetWt == null" class="empty-hint">还没有设置目标体重 · <button class="link" @click="targetWt = 60">现在设一个</button></p>
        <Stepper v-if="targetWt != null" v-model="targetWt" :min="20" :max="300" :step="0.1" :decimals="1" hint="kg" />
      </section>

      <button type="button" class="primary" :disabled="submitting || !macroOk" @click="save">
        {{ submitting ? '保存中…' : '保存目标' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 120px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.card {
  padding: 14px 16px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
  display: flex; flex-direction: column; gap: 10px;
}
.s-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.s-hint { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.s-hint .num { color: var(--color-primary); font-weight: 500; }
.row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }

.goal-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.goal-card {
  width: 100%; padding: 12px 14px; text-align: left;
  border-radius: var(--radius-default);
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
  display: flex; flex-direction: column; gap: 4px;
  transition: all var(--duration-fast) var(--ease-out-expo);
}
.goal-card:active { transform: scale(0.98); }
.goal-card.on {
  border-color: var(--color-primary);
  background: var(--color-primary-fixed);
  box-shadow: 0 4px 12px rgba(165, 51, 20, 0.15);
}
.gc-head { display: flex; justify-content: space-between; align-items: baseline; }
.gc-label { font-size: var(--font-size-body); font-weight: 600; color: var(--color-on-surface); }
.goal-card.on .gc-label { color: var(--color-primary); }
.gc-factor { font-size: var(--font-size-label); letter-spacing: 0.06em; color: var(--color-outline); font-family: var(--font-family-num); }
.gc-hint { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-surface-variant); line-height: 1.4; }

.sum-chip { padding: 3px 10px; border-radius: var(--radius-full); background: var(--color-secondary-container); color: var(--color-on-secondary-container); font-size: var(--font-size-label); letter-spacing: 0.05em; font-weight: 500; }
.sum-chip .num { font-weight: 700; font-family: var(--font-family-num); }
.sum-chip.bad { background: var(--color-error-container); color: var(--color-on-error-container); }

.macro { display: flex; flex-direction: column; gap: 8px; }
.macro-row { display: grid; grid-template-columns: 40px 1fr 110px; align-items: center; gap: 8px; }
.m-name { font-size: var(--font-size-caption); font-weight: 500; color: var(--color-on-surface); }
.m-range {
  width: 100%; height: 24px; appearance: none; background: transparent; padding: 0; margin: 0;
}
.m-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: var(--color-surface-container-high); }
.m-range::-webkit-slider-thumb {
  appearance: none; margin-top: -8px;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--color-primary); border: 3px solid var(--color-surface-container-lowest);
  box-shadow: 0 2px 6px rgba(165, 51, 20, 0.35);
}
.m-range::-moz-range-track { height: 6px; border-radius: 3px; background: var(--color-surface-container-high); }
.m-range::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: var(--color-primary); border: 3px solid var(--color-surface-container-lowest); box-shadow: 0 2px 6px rgba(165, 51, 20, 0.35); }
.m-val { text-align: right; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-surface); font-family: var(--font-family-num); }

.empty-hint { margin: 0; font-size: var(--font-size-caption); color: var(--color-outline); text-align: center; padding: 8px 0; }
.link { background: transparent; color: var(--color-primary); font-size: var(--font-size-caption); text-decoration: underline; padding: 0; }

.primary { height: 52px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: 0 8px 20px rgba(165, 51, 20, 0.28); }
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: 0.5; box-shadow: none; }
</style>
