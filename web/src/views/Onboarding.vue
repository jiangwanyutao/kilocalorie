<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import { userApi, type SetupPayload, type MeResponse } from '@/api/user';
import { useAuthStore } from '@/stores/auth';
import { pickErrMsg } from '@/api/http';

const router = useRouter();
const auth = useAuthStore();

const step = ref<1 | 2 | 3>(1);
const submitting = ref(false);
const errMsg = ref('');
const result = ref<MeResponse | null>(null);

const gender = ref<'M' | 'F' | 'U'>('U');
const birthYear = ref<number>(new Date().getFullYear() - 25);
const heightCm = ref<number>(170);
const currentWeightKg = ref<number>(65);
const activityLvl = ref<'1' | '2' | '3' | '4' | '5'>('2');
const goalType = ref<'M' | 'L1' | 'L2' | 'G1'>('L1');

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = CURRENT_YEAR - 100;
const YEAR_MAX = CURRENT_YEAR - 10;
const HEIGHT_MIN = 100;
const HEIGHT_MAX = 220;
const WEIGHT_MIN = 30;
const WEIGHT_MAX = 200;

const age = computed(() => CURRENT_YEAR - birthYear.value);

function pct(v: number, min: number, max: number): string {
  return `${((v - min) / (max - min)) * 100}%`;
}
const yearPct = computed(() => pct(birthYear.value, YEAR_MIN, YEAR_MAX));
const heightPct = computed(() => pct(heightCm.value, HEIGHT_MIN, HEIGHT_MAX));
const weightPct = computed(() => pct(currentWeightKg.value, WEIGHT_MIN, WEIGHT_MAX));

const ACTIVITY = [
  { v: '1', label: '久坐 · 基本无运动' },
  { v: '2', label: '轻度 · 每周 1-2 次' },
  { v: '3', label: '中度 · 每周 3-5 次' },
  { v: '4', label: '高度 · 每周 6-7 次' },
  { v: '5', label: '极高 · 每天高强度 + 体力工作' },
] as const;

const GOAL = [
  { v: 'M', label: '维持体重', tag: '按 TDEE' },
  { v: 'L1', label: '温和减脂', tag: '-15%' },
  { v: 'L2', label: '严格减脂', tag: '-25%' },
  { v: 'G1', label: '增肌', tag: '+10%' },
] as const;

const canNext1 = computed(
  () =>
    gender.value !== 'U' &&
    birthYear.value >= 1900 &&
    heightCm.value >= 80 && heightCm.value <= 250 &&
    currentWeightKg.value >= 20 && currentWeightKg.value <= 300,
);

function next() {
  errMsg.value = '';
  if (step.value === 1 && canNext1.value) step.value = 2;
  else if (step.value === 2) submit();
}

function prev() {
  errMsg.value = '';
  if (step.value === 2) step.value = 1;
  else if (step.value === 3) step.value = 2;
}

async function submit() {
  submitting.value = true;
  errMsg.value = '';
  try {
    const payload: SetupPayload = {
      gender: gender.value,
      birthYear: birthYear.value,
      heightCm: heightCm.value,
      currentWeightKg: currentWeightKg.value,
      activityLvl: activityLvl.value,
      goalType: goalType.value,
    };
    const r = await userApi.setup(payload);
    result.value = r;
    step.value = 3;
    await auth.refreshMe();
  } catch (e) {
    errMsg.value = pickErrMsg(e, '保存失败');
  } finally {
    submitting.value = false;
  }
}

function finish() {
  router.replace('/');
}
</script>

<template>
  <section class="wrap">
    <AppHeader
      :title="`步骤 ${step} / 3`"
      :back-to="step === 1 ? '/welcome' : undefined"
      :hide-back="step === 3"
    />

    <div class="body">
      <div v-if="step === 1">
        <div class="hero">
          <p class="eyebrow">让搭子先认识你</p>
          <h1 class="title">你的身体基础</h1>
        </div>
        <div class="fields">
          <div class="field">
            <span class="lbl">性别</span>
            <div class="chips">
              <button
                v-for="g in [{v:'M',label:'男'},{v:'F',label:'女'}]"
                :key="g.v"
                type="button"
                class="chip"
                :class="{ on: gender === g.v }"
                @click="gender = g.v as 'M' | 'F'"
              >{{ g.label }}</button>
            </div>
          </div>
          <div class="field">
            <div class="rowlbl">
              <span class="lbl">出生年份</span>
              <span class="value num">{{ birthYear }}<span class="unit"> · {{ age }} 岁</span></span>
            </div>
            <input
              class="slider"
              type="range"
              v-model.number="birthYear"
              :min="YEAR_MIN"
              :max="YEAR_MAX"
              step="1"
              aria-label="出生年份"
              :style="{ '--pct': yearPct }"
            />
            <div class="scale">
              <span>{{ YEAR_MIN }}</span>
              <span>{{ YEAR_MAX }}</span>
            </div>
          </div>
          <div class="field">
            <div class="rowlbl">
              <span class="lbl">身高</span>
              <span class="value num">{{ heightCm }}<span class="unit"> cm</span></span>
            </div>
            <input
              class="slider"
              type="range"
              v-model.number="heightCm"
              :min="HEIGHT_MIN"
              :max="HEIGHT_MAX"
              step="1"
              aria-label="身高"
              :style="{ '--pct': heightPct }"
            />
            <div class="scale">
              <span>{{ HEIGHT_MIN }}</span>
              <span>{{ HEIGHT_MAX }}</span>
            </div>
          </div>
          <div class="field">
            <div class="rowlbl">
              <span class="lbl">当前体重</span>
              <span class="value num">{{ currentWeightKg }}<span class="unit"> kg</span></span>
            </div>
            <input
              class="slider"
              type="range"
              v-model.number="currentWeightKg"
              :min="WEIGHT_MIN"
              :max="WEIGHT_MAX"
              step="1"
              aria-label="当前体重"
              :style="{ '--pct': weightPct }"
            />
            <div class="scale">
              <span>{{ WEIGHT_MIN }}</span>
              <span>{{ WEIGHT_MAX }}</span>
            </div>
          </div>
        </div>
        <button class="primary" :disabled="!canNext1" @click="next">下一步</button>
      </div>

      <div v-else-if="step === 2">
        <div class="hero">
          <p class="eyebrow">告诉搭子想去哪</p>
          <h1 class="title">你的目标</h1>
        </div>
        <div class="fields">
          <div class="field">
            <span class="lbl">目标类型</span>
            <div class="grid2">
              <button
                v-for="g in GOAL"
                :key="g.v"
                type="button"
                class="card-btn"
                :class="{ on: goalType === g.v }"
                @click="goalType = g.v as typeof goalType"
              >
                <span class="c-label">{{ g.label }}</span>
                <span class="c-tag num">{{ g.tag }}</span>
              </button>
            </div>
          </div>
          <div class="field">
            <span class="lbl">活动等级</span>
            <div class="stack">
              <button
                v-for="a in ACTIVITY"
                :key="a.v"
                type="button"
                class="row-btn"
                :class="{ on: activityLvl === a.v }"
                @click="activityLvl = a.v as typeof activityLvl"
              >{{ a.label }}</button>
            </div>
          </div>
        </div>
        <p v-if="errMsg" class="err">{{ errMsg }}</p>
        <div class="cta">
          <button class="ghost" @click="prev">上一步</button>
          <button class="primary" :disabled="submitting" @click="submit">
            {{ submitting ? '计算中…' : '完成 · 生成目标' }}
          </button>
        </div>
      </div>

      <div v-else-if="step === 3 && result">
        <div class="hero center">
          <div class="mark">✓</div>
          <h1 class="title">目标已生成</h1>
          <p class="sub">这是根据你的信息推荐的每日目标 · 可以随时在"我的 → 目标"里调整</p>
        </div>
        <div class="result">
          <div class="big">
            <span class="k num">{{ result.goal?.kcalGoal ?? '—' }}</span>
            <span class="v">kcal / 天</span>
          </div>
          <div class="grid3">
            <div class="stat">
              <p class="stk num">{{ result.bmrKcal ?? '—' }}</p>
              <p class="stv">基础代谢</p>
            </div>
            <div class="stat sep">
              <p class="stk num">{{ result.tdeeKcal ?? '—' }}</p>
              <p class="stv">总消耗 TDEE</p>
            </div>
            <div class="stat">
              <p class="stk num">{{ result.goal?.waterMl ?? 2000 }}<span class="unit">ml</span></p>
              <p class="stv">每日饮水</p>
            </div>
          </div>
          <div class="macro">
            <div class="m carbs" :style="{ flex: result.goal?.carbPct }">碳水 {{ result.goal?.carbPct }}%</div>
            <div class="m prot"  :style="{ flex: result.goal?.protPct }">蛋白 {{ result.goal?.protPct }}%</div>
            <div class="m fat"   :style="{ flex: result.goal?.fatPct }">脂肪 {{ result.goal?.fatPct }}%</div>
          </div>
        </div>
        <button class="primary" @click="finish">开始写日记</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
.body { padding: 0 var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-xl)); }
.hero { padding: var(--space-md) 0 var(--space-lg); }
.hero.center { text-align: center; padding-top: var(--space-xl); }
.eyebrow { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-primary); margin: 0 0 var(--space-sm); }
.title { font-size: var(--font-size-hero); line-height: var(--line-height-hero); letter-spacing: var(--letter-spacing-hero); font-weight: 600; margin: 0; }
.sub { margin: var(--space-md) auto 0; color: var(--color-on-surface-variant); max-width: 28em; font-size: var(--font-size-body); }
.mark { width: 72px; height: 72px; margin: 0 auto var(--space-md); display: grid; place-items: center; border-radius: var(--radius-full); background: var(--color-secondary-container); color: var(--color-on-secondary-container); font-size: 40px; }
.fields { display: flex; flex-direction: column; gap: var(--space-md); margin-bottom: var(--space-lg); }
.field { display: flex; flex-direction: column; gap: var(--space-xs); }
.lbl { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-on-surface-variant); }
input { height: 52px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); color: var(--color-on-surface); font-family: var(--font-family-num); }
input:focus { outline: none; border-color: var(--color-primary); }

/* Slider */
.rowlbl { display: flex; justify-content: space-between; align-items: baseline; }
.value { font-size: 32px; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); line-height: 1; }
.value .unit { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); margin-left: 4px; }
.scale { display: flex; justify-content: space-between; font-size: var(--font-size-label); color: var(--color-outline); font-family: var(--font-family-num); margin-top: 2px; }
.slider {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 40px; padding: 0; margin: 0;
  background: transparent; border: 0; border-radius: 0;
  font-family: inherit;
}
.slider:focus { outline: none; }
.slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) var(--pct, 50%), var(--color-outline-variant) var(--pct, 50%), var(--color-outline-variant) 100%);
}
.slider::-moz-range-track { height: 6px; border-radius: 3px; background: var(--color-outline-variant); }
.slider::-moz-range-progress { height: 6px; border-radius: 3px; background: var(--color-primary); }
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--color-primary);
  border: 3px solid var(--color-surface-container-lowest);
  box-shadow: 0 2px 6px rgba(29, 25, 23, 0.18);
  margin-top: -11px;
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.slider::-moz-range-thumb {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--color-primary);
  border: 3px solid var(--color-surface-container-lowest);
  box-shadow: 0 2px 6px rgba(29, 25, 23, 0.18);
}
.slider:active::-webkit-slider-thumb { transform: scale(1.15); }
.chips { display: flex; gap: 8px; }
.chip { flex: 1; height: 52px; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); color: var(--color-on-surface-variant); transition: all var(--duration-fast); }
.chip.on { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.card-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 14px; height: 66px; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); color: var(--color-on-surface); text-align: left; transition: all var(--duration-fast); }
.card-btn.on { border-color: var(--color-primary); background: var(--color-primary-fixed); color: var(--color-on-primary-fixed); }
.card-btn .c-label { font-size: var(--font-size-body); font-weight: 500; }
.card-btn .c-tag { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-primary); }
.card-btn.on .c-tag { color: var(--color-on-primary-fixed-variant); }
.stack { display: flex; flex-direction: column; gap: 6px; }
.row-btn { text-align: left; padding: 14px var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); color: var(--color-on-surface); font-size: var(--font-size-body); }
.row-btn.on { border-color: var(--color-primary); background: var(--color-primary-fixed); color: var(--color-on-primary-fixed); }
.err { margin: 0 0 var(--space-md); padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }
.primary { width: 100%; height: 56px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: .5; }
.cta { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-top: var(--space-md); }
.ghost { height: 56px; border-radius: var(--radius-md); background: transparent; color: var(--color-on-surface-variant); border: 1px solid var(--color-outline-variant); }
.result { background: var(--color-surface-container-lowest); border-radius: var(--radius-xl); box-shadow: var(--shadow-paper); padding: var(--space-lg); margin-bottom: var(--space-lg); }
.big { text-align: center; padding-bottom: var(--space-md); border-bottom: 1px solid var(--color-outline-variant); margin-bottom: var(--space-md); }
.big .k { font-size: 56px; line-height: 1; font-weight: 600; color: var(--color-primary); display: block; }
.big .v { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: var(--space-md); }
.stat { text-align: center; }
.stat.sep { border-left: 1px solid var(--color-outline-variant); border-right: 1px solid var(--color-outline-variant); }
.stk { margin: 0; font-size: var(--font-size-section); font-weight: 600; }
.stk .unit { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); margin-left: 2px; }
.stv { margin: 2px 0 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.macro { display: flex; height: 40px; border-radius: var(--radius-full); overflow: hidden; }
.m { display: grid; place-items: center; font-size: var(--font-size-caption); color: white; font-weight: 500; }
.m.carbs { background: var(--color-secondary); }
.m.prot { background: var(--color-primary); }
.m.fat { background: var(--color-tertiary); }
</style>
