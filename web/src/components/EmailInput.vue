<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  modelValue: string;
  autocomplete?: string;
}
const props = withDefaults(defineProps<Props>(), { autocomplete: 'email' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const SUFFIXES = [
  '@qq.com', '@163.com', '@126.com', '@foxmail.com',
  '@gmail.com', '@outlook.com', '@139.com', '@sina.com',
];

function parse(v: string) {
  const s = (v ?? '').trim();
  const at = s.indexOf('@');
  if (at < 0) return { local: s, sfx: '@qq.com', custom: '' };
  const local = s.slice(0, at);
  const suffix = s.slice(at);
  if (SUFFIXES.includes(suffix)) return { local, sfx: suffix, custom: '' };
  return { local, sfx: '__custom__', custom: suffix };
}

const parsed = parse(props.modelValue);
const localPart = ref(parsed.local);
const suffix = ref(parsed.sfx);
const customSuffix = ref(parsed.custom);

const fullEmail = computed(() => {
  const l = localPart.value.trim();
  if (!l) return '';
  const s = suffix.value === '__custom__' ? customSuffix.value.trim() : suffix.value;
  return l + s;
});

watch(fullEmail, (v) => emit('update:modelValue', v));

watch(
  () => props.modelValue,
  (v) => {
    if (v === fullEmail.value) return;
    const p = parse(v);
    localPart.value = p.local;
    suffix.value = p.sfx;
    customSuffix.value = p.custom;
  },
);
</script>

<template>
  <div class="email">
    <div class="email-row">
      <input
        v-model="localPart"
        :autocomplete="autocomplete"
        type="text"
        inputmode="email"
        required
        placeholder="用户名"
      />
      <select v-model="suffix" class="suffix" aria-label="邮箱后缀">
        <option v-for="s in SUFFIXES" :key="s" :value="s">{{ s }}</option>
        <option value="__custom__">自定义…</option>
      </select>
    </div>
    <input
      v-if="suffix === '__custom__'"
      v-model="customSuffix"
      type="text"
      class="custom-suffix"
      placeholder="@your-domain.com"
    />
    <p v-if="fullEmail" class="preview num">{{ fullEmail }}</p>
  </div>
</template>

<style scoped>
.email { display: flex; flex-direction: column; gap: 6px; }
.email-row { display: grid; grid-template-columns: 1fr 140px; gap: 8px; }
input { height: 52px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); color: var(--color-on-surface); }
input:focus { outline: none; border-color: var(--color-primary); }
.suffix { height: 52px; padding: 0 32px 0 12px; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); color: var(--color-on-surface); appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%23a53314' d='M6 8L0 0h12z'/></svg>"); background-repeat: no-repeat; background-position: right 12px center; }
.suffix:focus { outline: none; border-color: var(--color-primary); }
.preview { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-family: var(--font-family-num); word-break: break-all; }
</style>
