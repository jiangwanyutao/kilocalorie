<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  label?: string;
  hint?: string;
}
const props = withDefaults(defineProps<Props>(), {
  min: 0, max: 9999, step: 1, decimals: 0,
});
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const val = computed<number>({
  get: () => props.modelValue,
  set: (v: number) => emit('update:modelValue', clamp(v)),
});

function clamp(n: number): number {
  if (!Number.isFinite(n)) return props.min;
  const bounded = Math.min(Math.max(n, props.min), props.max);
  const factor = Math.pow(10, props.decimals);
  return Math.round(bounded * factor) / factor;
}

function bump(delta: number) { val.value = val.value + delta; }
function onBlur() { val.value = clamp(val.value); }
</script>

<template>
  <div class="stepper">
    <span v-if="label" class="s-label">{{ label }}</span>
    <div class="s-ctrl">
      <button type="button" class="s-btn" :disabled="val <= min" @click="bump(-step)" aria-label="减">－</button>
      <input
        class="s-val num"
        v-model.number="val"
        type="number"
        inputmode="decimal"
        :min="min"
        :max="max"
        :step="step"
        @blur="onBlur"
      />
      <button type="button" class="s-btn" :disabled="val >= max" @click="bump(step)" aria-label="加">＋</button>
    </div>
    <span v-if="hint" class="s-hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.stepper { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 8px 12px; background: var(--color-surface-container-low); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); }
.s-label { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-on-surface-variant); }
.s-ctrl { display: flex; align-items: center; gap: 4px; justify-content: center; }
.s-btn { width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--color-surface-container-lowest); color: var(--color-primary); font-size: 20px; font-weight: 300; border: 1px solid var(--color-outline-variant); }
.s-btn:active { background: var(--color-primary-fixed); transform: scale(0.94); }
.s-btn:disabled { opacity: .35; }
.s-val { flex: 1; min-width: 60px; max-width: 100px; height: 40px; padding: 0 12px; text-align: center; border: 1px solid var(--color-outline-variant); border-radius: var(--radius-md); background: var(--color-surface-container-lowest); font-size: var(--font-size-section); font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.s-val:focus { outline: none; border-color: var(--color-primary); }
.s-hint { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-family: var(--font-family-num); justify-self: end; white-space: nowrap; }
</style>
