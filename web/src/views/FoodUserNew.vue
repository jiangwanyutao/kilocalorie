<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import { foodApi } from '@/api/food';

const router = useRouter();

interface Cat {
  code: string;
  name: string;
  icon: string;
}

const cats: readonly Cat[] = [
  { code: '01', name: '主食', icon: '🍚' },
  { code: '02', name: '肉蛋', icon: '🥩' },
  { code: '03', name: '海鲜', icon: '🦐' },
  { code: '04', name: '奶乳', icon: '🥛' },
  { code: '05', name: '蔬菜', icon: '🥬' },
  { code: '06', name: '水果', icon: '🍎' },
  { code: '07', name: '零食', icon: '🍪' },
  { code: '08', name: '饮料', icon: '🥤' },
  { code: '09', name: '调料', icon: '🧂' },
  { code: '10', name: '菜品', icon: '🍜' },
  { code: '11', name: '其他', icon: '🍽️' },
];

const foodName = ref('');
const kcal = ref<number | null>(null);
const portionG = ref<number | null>(100);
const portionDesc = ref('1 份');
const carbG = ref<number | null>(null);
const protG = ref<number | null>(null);
const fatG = ref<number | null>(null);
const catCode = ref<string>('11');

const submitting = ref(false);
const errMsg = ref('');

const macroKcal = computed<number>(() => {
  const c = Number(carbG.value) || 0;
  const p = Number(protG.value) || 0;
  const f = Number(fatG.value) || 0;
  return Math.round(c * 4 + p * 4 + f * 9);
});

const canSubmit = computed<boolean>(() => {
  return foodName.value.trim().length > 0
    && kcal.value != null && Number(kcal.value) > 0
    && !submitting.value;
});

async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  errMsg.value = '';
  submitting.value = true;
  try {
    await foodApi.createUserFood({
      foodName: foodName.value.trim(),
      kcal: Number(kcal.value),
      portionG: portionG.value != null ? Number(portionG.value) : undefined,
      portionDesc: portionDesc.value.trim() || undefined,
      carbG: carbG.value != null ? Number(carbG.value) : undefined,
      protG: protG.value != null ? Number(protG.value) : undefined,
      fatG: fatG.value != null ? Number(fatG.value) : undefined,
      catCode: catCode.value,
    });
    router.replace('/food/picker');
  } catch (e: unknown) {
    errMsg.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="添加私人食物" />
    <div class="body">
      <div class="hero">
        <div class="h-icon">🥣</div>
        <p class="h-title">写一条你的常吃</p>
        <p class="h-sub">私人食物只对你可见 · 下次一键选</p>
      </div>

      <div class="card">
        <p class="c-eyebrow">基本信息</p>

        <label class="fld">
          <span class="l-label">名称 <em>*</em></span>
          <input
            v-model="foodName"
            class="l-input"
            type="text"
            maxlength="50"
            placeholder="例如 · 妈妈的番茄蛋汤"
          />
        </label>

        <div class="fld">
          <span class="l-label">分类</span>
          <div class="cat-row">
            <button
              v-for="c in cats" :key="c.code"
              type="button" class="cat" :class="{ on: catCode === c.code }"
              @click="catCode = c.code"
            >
              <span class="cat-i">{{ c.icon }}</span>
              <span class="cat-n">{{ c.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <p class="c-eyebrow">份量 · 热量</p>

        <div class="row-2">
          <label class="fld">
            <span class="l-label">1 份 = 克数</span>
            <input
              v-model.number="portionG"
              class="l-input num" type="number" inputmode="numeric"
              min="1" max="9999" placeholder="100"
            />
          </label>
          <label class="fld">
            <span class="l-label">份量描述</span>
            <input
              v-model="portionDesc"
              class="l-input" type="text" maxlength="20"
              placeholder="1 碗 / 1 份 / 1 只"
            />
          </label>
        </div>

        <label class="fld">
          <span class="l-label">每份卡路里 <em>*</em></span>
          <div class="input-wrap">
            <input
              v-model.number="kcal"
              class="l-input num big" type="number" inputmode="decimal"
              min="0" max="9999" step="0.1" placeholder="0"
            />
            <span class="unit">kcal</span>
          </div>
        </label>
      </div>

      <div class="card">
        <p class="c-eyebrow">
          三大营养素
          <span v-if="macroKcal > 0" class="chk">
            按 4/4/9 折 · 约 <b class="num">{{ macroKcal }}</b> kcal
          </span>
        </p>

        <div class="row-3">
          <label class="fld">
            <span class="l-label">碳水 · g</span>
            <input
              v-model.number="carbG"
              class="l-input num" type="number" inputmode="decimal"
              min="0" max="999" step="0.1" placeholder="0"
            />
          </label>
          <label class="fld">
            <span class="l-label">蛋白 · g</span>
            <input
              v-model.number="protG"
              class="l-input num" type="number" inputmode="decimal"
              min="0" max="999" step="0.1" placeholder="0"
            />
          </label>
          <label class="fld">
            <span class="l-label">脂肪 · g</span>
            <input
              v-model.number="fatG"
              class="l-input num" type="number" inputmode="decimal"
              min="0" max="999" step="0.1" placeholder="0"
            />
          </label>
        </div>

        <p class="hint">留空也能保存 · 但填了 AI 建议才准</p>
      </div>

      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <button
        type="button"
        class="save"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ submitting ? '保存中…' : '保存到我的食物库' }}
      </button>
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
  display: flex; flex-direction: column; gap: 16px;
}

.hero {
  text-align: center; padding: 24px 20px 20px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 32px;
  box-shadow: 0 20px 40px -18px rgba(120, 90, 200, 0.22);
}
.h-icon {
  width: 72px; height: 72px; margin: 0 auto 10px;
  border-radius: 22px;
  background: linear-gradient(140deg, #fff4cc 0%, #ffe0d5 60%, #ffcf5a 100%);
  display: grid; place-items: center;
  font-size: 36px;
  box-shadow: 0 10px 24px -8px rgba(255, 180, 60, 0.55);
}
.h-title { margin: 0; font-size: 20px; font-weight: 700; }
.h-sub   { margin: 4px 0 0; font-size: 12.5px; color: var(--color-on-surface-variant); letter-spacing: 0.05em; }

.card {
  padding: 20px 18px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 28px;
  box-shadow: 0 16px 34px -22px rgba(120, 90, 200, 0.20);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.c-eyebrow {
  margin: 0 0 14px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-primary);
}
.chk {
  font-size: 11px; font-weight: 500; letter-spacing: 0.02em; text-transform: none;
  color: var(--color-on-surface-variant);
}
.chk b { color: var(--color-primary); font-weight: 600; }

.fld { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.fld:last-child { margin-bottom: 0; }
.l-label {
  font-size: 12px; color: var(--color-on-surface-variant); font-weight: 500;
  letter-spacing: 0.02em;
}
.l-label em {
  color: var(--color-primary); font-style: normal; margin-left: 3px; font-weight: 600;
}
.l-input {
  height: 44px; padding: 0 14px;
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
  border: 1px solid rgba(120, 90, 200, 0.14);
  border-radius: 14px;
  font-size: 14px;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.l-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(165, 51, 20, 0.10);
}
.l-input.num { font-family: var(--font-family-num); letter-spacing: 0.02em; }
.l-input.big { height: 52px; font-size: 22px; font-weight: 600; text-align: right; padding-right: 60px; }
.input-wrap { position: relative; }
.input-wrap .unit {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  font-size: 12px; color: var(--color-on-surface-variant); letter-spacing: 0.03em;
  pointer-events: none;
}

.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.row-2 .fld, .row-3 .fld { margin-bottom: 0; }

.cat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cat {
  padding: 10px 6px;
  background: var(--color-surface-container-lowest);
  border: 1px solid rgba(120, 90, 200, 0.10);
  border-radius: 16px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer;
  transition: all var(--duration-fast);
}
.cat.on {
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 0 8px 18px -6px rgba(165, 51, 20, 0.36);
  transform: translateY(-1px);
}
.cat-i { font-size: 20px; line-height: 1; }
.cat-n { font-size: 11px; letter-spacing: 0.03em; }

.hint {
  margin: 8px 0 0;
  font-size: 11px; letter-spacing: 0.04em;
  color: var(--color-outline);
}

.err {
  margin: 0; padding: 10px 14px;
  background: var(--color-error-container);
  color: var(--color-on-error-container);
  border-radius: 14px;
  font-size: 12.5px;
}

.save {
  height: 54px;
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  border: 0; border-radius: 20px;
  font-size: 15px; font-weight: 600; letter-spacing: 0.04em;
  box-shadow: 0 14px 32px -10px rgba(165, 51, 20, 0.36);
  transition: transform var(--duration-fast), opacity var(--duration-fast);
}
.save:active { transform: scale(0.98); }
.save:disabled { opacity: 0.5; box-shadow: none; }
</style>
