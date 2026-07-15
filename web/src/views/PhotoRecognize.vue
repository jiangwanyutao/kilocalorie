<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import { mealApi, type VisionItem, type CreateItemPayload } from '@/api/meal';
import { pickErrMsg } from '@/api/http';

type MealType = 'B' | 'L' | 'D' | 'S';
const MEAL_NAME: Record<MealType, string> = { B: '早餐', L: '午餐', D: '晚餐', S: '加餐' };
const VALID: readonly MealType[] = ['B', 'L', 'D', 'S'] as const;

const route = useRoute();
const router = useRouter();

const qType = (typeof route.query.type === 'string' ? route.query.type : 'L') as MealType;
const mealType = ref<MealType>(VALID.includes(qType) ? qType : 'L');

const dataUrl = ref('');
const mimeType = ref('image/jpeg');
const items = ref<(VisionItem & { keep: boolean })[]>([]);
const provider = ref('');
const stage = ref<'pick' | 'analyzing' | 'review' | 'saving'>('pick');
const errMsg = ref('');

const fileInput = ref<HTMLInputElement | null>(null);

function pickFile() { fileInput.value?.click(); }

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    errMsg.value = '请选择图片文件';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    errMsg.value = '图片超过 15 MB · 请压缩后再传';
    return;
  }
  errMsg.value = '';
  const reader = new FileReader();
  reader.onload = () => {
    dataUrl.value = reader.result as string;
    mimeType.value = file.type;
    input.value = '';
    analyze();
  };
  reader.readAsDataURL(file);
}

async function analyze() {
  if (!dataUrl.value) return;
  stage.value = 'analyzing';
  errMsg.value = '';
  try {
    const r = await mealApi.analyzePhoto(dataUrl.value, mimeType.value);
    provider.value = r.provider;
    items.value = r.items.map((it) => ({ ...it, keep: true }));
    stage.value = 'review';
  } catch (e) {
    errMsg.value = pickErrMsg(e, '识别失败 · 请重试');
    stage.value = 'pick';
  }
}

function reshoot() {
  dataUrl.value = '';
  items.value = [];
  provider.value = '';
  stage.value = 'pick';
  errMsg.value = '';
}

function updateItem<K extends keyof (VisionItem & { keep: boolean })>(
  idx: number,
  key: K,
  val: (VisionItem & { keep: boolean })[K],
) {
  items.value[idx] = { ...items.value[idx], [key]: val };
}

const kept = computed(() => items.value.filter((it) => it.keep));
const totalKcal = computed(() => kept.value.reduce((s, it) => s + Number(it.kcal), 0));
const totalG = computed(() => kept.value.reduce((s, it) => s + Number(it.portionG), 0));

async function save() {
  if (!kept.value.length) {
    errMsg.value = '至少保留一项';
    return;
  }
  stage.value = 'saving';
  errMsg.value = '';
  try {
    const payload: CreateItemPayload[] = kept.value.map((it) => ({
      foodName: it.foodName,
      foodSrc: 'X',
      portionMode: 'G',
      portionQty: Number(it.portionG),
      actualG: Number(it.portionG),
      kcal: Number(it.kcal),
      carbG: Number(it.carbG),
      protG: Number(it.protG),
      fatG: Number(it.fatG),
    }));
    await mealApi.createEntry({
      mealType: mealType.value,
      mealTime: new Date().toISOString(),
      entrySrc: 'V',
      items: payload,
    });
    router.replace({ path: '/log' });
  } catch (e) {
    errMsg.value = pickErrMsg(e, '保存失败');
    stage.value = 'review';
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="拍照识别" back-to="/log" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <div class="meal-row" role="tablist">
        <button
          v-for="k in VALID"
          :key="k"
          type="button"
          role="tab"
          :class="['meal-chip', { on: mealType === k }]"
          :aria-selected="mealType === k"
          @click="mealType = k"
        >{{ MEAL_NAME[k] }}</button>
      </div>

      <section v-if="stage === 'pick'" class="pick-card">
        <div class="pk-hero" aria-hidden="true">
          <div class="pk-rays"></div>
          <div class="pk-icon">📷</div>
        </div>
        <h2 class="pk-title">对着餐盘 · 拍一张</h2>
        <p class="pk-hint">AI 会认出食物并估算营养 · 你还能改</p>
        <button type="button" class="primary big" @click="pickFile">
          选图片 · 拍照
        </button>
        <p class="pk-tip">提示：一张图里含所有菜 · 光线充足更准</p>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          @change="onFile"
        />
      </section>

      <section v-else-if="stage === 'analyzing'" class="loading-card">
        <img :src="dataUrl" alt="预览" class="preview" />
        <div class="lc-body">
          <div class="spinner" aria-hidden="true"></div>
          <p class="lc-txt">AI 正在识别 · 通常 1-3 秒</p>
        </div>
      </section>

      <section v-else class="review">
        <div class="rv-summary">
          <img :src="dataUrl" alt="识别图" class="preview small" />
          <div class="rv-tot">
            <p class="rv-label">识别到 <span class="num">{{ items.length }}</span> 项</p>
            <p class="rv-kcal num">{{ totalKcal }}<span class="rv-u"> kcal</span></p>
            <p class="rv-sub num">合计 {{ totalG }} g · {{ MEAL_NAME[mealType] }} · <em>{{ provider }}</em></p>
          </div>
        </div>

        <ul class="items">
          <li v-for="(it, i) in items" :key="i" :class="['item', { off: !it.keep }]">
            <div class="it-head">
              <label class="it-chk">
                <input
                  type="checkbox"
                  :checked="it.keep"
                  @change="(e) => updateItem(i, 'keep', (e.target as HTMLInputElement).checked)"
                />
                <span class="chk-box" aria-hidden="true"></span>
              </label>
              <input
                class="it-name"
                type="text"
                :value="it.foodName"
                @input="(e) => updateItem(i, 'foodName', (e.target as HTMLInputElement).value)"
                :disabled="!it.keep"
                maxlength="50"
              />
              <span :class="['conf', it.confidence >= 0.9 ? 'high' : it.confidence >= 0.75 ? 'mid' : 'low']">
                {{ Math.round(it.confidence * 100) }}%
              </span>
            </div>
            <div class="it-fields" v-if="it.keep">
              <label class="field">
                <span class="fl">克数</span>
                <input type="number" min="1" max="9999" :value="it.portionG"
                       @input="(e) => updateItem(i, 'portionG', Number((e.target as HTMLInputElement).value))" />
              </label>
              <label class="field">
                <span class="fl">kcal</span>
                <input type="number" min="0" max="9999" :value="it.kcal"
                       @input="(e) => updateItem(i, 'kcal', Number((e.target as HTMLInputElement).value))" />
              </label>
              <label class="field">
                <span class="fl">碳水 g</span>
                <input type="number" min="0" max="999" step="0.1" :value="it.carbG"
                       @input="(e) => updateItem(i, 'carbG', Number((e.target as HTMLInputElement).value))" />
              </label>
              <label class="field">
                <span class="fl">蛋白 g</span>
                <input type="number" min="0" max="999" step="0.1" :value="it.protG"
                       @input="(e) => updateItem(i, 'protG', Number((e.target as HTMLInputElement).value))" />
              </label>
              <label class="field">
                <span class="fl">脂肪 g</span>
                <input type="number" min="0" max="999" step="0.1" :value="it.fatG"
                       @input="(e) => updateItem(i, 'fatG', Number((e.target as HTMLInputElement).value))" />
              </label>
            </div>
          </li>
        </ul>

        <div class="rv-cta">
          <button type="button" class="ghost" @click="reshoot" :disabled="stage === 'saving'">重拍</button>
          <button type="button" class="primary" @click="save" :disabled="stage === 'saving' || !kept.length">
            {{ stage === 'saving' ? '保存中…' : `保存 ${kept.length} 项` }}
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

/* Meal row */
.meal-row { display: flex; gap: 6px; padding: 4px; background: var(--color-surface-container); border-radius: var(--radius-full); }
.meal-chip { flex: 1; padding: 8px 0; background: transparent; color: var(--color-on-surface-variant); font-size: var(--font-size-caption); font-weight: 500; border-radius: var(--radius-full); transition: all var(--duration-fast); }
.meal-chip.on { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 3px 8px rgba(165, 51, 20, 0.24); }

/* Pick */
.pick-card {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 32px 20px 28px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08), 0 2px 6px rgba(29, 25, 23, 0.04);
  text-align: center;
}
.pk-hero { position: relative; width: 96px; height: 96px; display: grid; place-items: center; margin-bottom: 4px; }
.pk-icon {
  position: relative; z-index: 2;
  width: 84px; height: 84px; display: grid; place-items: center;
  font-size: 40px;
  background: linear-gradient(140deg, var(--color-primary-container) 0%, var(--color-tertiary-container) 100%);
  border-radius: 28px;
  box-shadow: 0 12px 28px rgba(165, 51, 20, 0.22), inset 0 -2px 4px rgba(0,0,0,0.06);
}
.pk-rays {
  position: absolute; inset: -12px;
  background: radial-gradient(circle, var(--color-primary-fixed) 0%, transparent 65%);
  z-index: 1;
}
.pk-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; letter-spacing: 0.02em; }
.pk-hint { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); max-width: 22em; }
.pk-tip { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.primary { height: 48px; padding: 0 24px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: 0.5; box-shadow: none; }
.primary.big { height: 56px; padding: 0 32px; font-size: 17px; box-shadow: 0 8px 20px rgba(165, 51, 20, 0.32); }
.ghost { height: 48px; padding: 0 20px; border-radius: var(--radius-md); background: transparent; color: var(--color-on-surface-variant); border: 1px solid var(--color-outline-variant); font-size: var(--font-size-body); }

/* Analyzing */
.loading-card {
  padding: 16px;
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-outline-variant);
  box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08);
  display: flex; flex-direction: column; gap: 14px;
}
.preview { width: 100%; border-radius: var(--radius-lg); object-fit: cover; aspect-ratio: 4 / 3; }
.preview.small { width: 96px; height: 96px; aspect-ratio: 1; flex: 0 0 auto; }
.lc-body { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 12px 0; }
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--color-surface-container-high);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.lc-txt { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }

/* Review */
.review { display: flex; flex-direction: column; gap: 12px; }
.rv-summary {
  display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center;
  padding: 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08), 0 2px 6px rgba(29, 25, 23, 0.04);
}
.rv-label { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.rv-label .num { color: var(--color-primary); font-weight: 600; }
.rv-kcal { margin: 4px 0 2px; font-size: 34px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.rv-u { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); margin-left: 3px; }
.rv-sub { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.rv-sub em { font-style: normal; padding: 1px 6px; background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); border-radius: var(--radius-full); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; margin-left: 4px; }

.items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.item {
  padding: 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
  transition: opacity var(--duration-fast);
}
.item.off { opacity: 0.5; }
.it-head { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; }
.it-chk input { display: none; }
.chk-box {
  width: 22px; height: 22px; display: block;
  border-radius: 7px;
  border: 2px solid var(--color-outline);
  background: transparent;
  position: relative;
  transition: all var(--duration-fast);
}
.it-chk input:checked + .chk-box {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.it-chk input:checked + .chk-box::after {
  content: '';
  position: absolute;
  left: 5px; top: 1px;
  width: 7px; height: 12px;
  border: solid var(--color-on-primary);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.it-name {
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-default);
  background: transparent;
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-on-surface);
}
.it-name:focus { outline: none; border-color: var(--color-primary); background: var(--color-surface-container-lowest); }
.it-name:disabled { color: var(--color-outline); }
.conf { padding: 3px 8px; border-radius: var(--radius-full); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; font-family: var(--font-family-num); }
.conf.high { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.conf.mid  { background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); }
.conf.low  { background: var(--color-error-container); color: var(--color-on-error-container); }
.it-fields { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 10px; }
.field { display: flex; flex-direction: column; gap: 2px; }
.fl { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-outline); }
.field input {
  height: 36px; padding: 0 6px;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-default);
  background: var(--color-surface-container-lowest);
  font-family: var(--font-family-num);
  font-size: 13px;
  text-align: center;
  min-width: 0;
}
.field input:focus { outline: none; border-color: var(--color-primary); }

.rv-cta { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-top: 4px; position: sticky; bottom: 12px; }
</style>
