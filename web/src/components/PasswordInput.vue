<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  modelValue: string;
  placeholder?: string;
  autocomplete?: string;
  required?: boolean;
  minlength?: number;
}
withDefaults(defineProps<Props>(), {
  placeholder: '至少 8 位',
  autocomplete: 'current-password',
  required: false,
});
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const show = ref(false);

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="pw-wrap">
    <input
      :type="show ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :minlength="minlength"
      @input="onInput"
    />
    <button
      type="button"
      class="eye"
      :aria-label="show ? '隐藏密码' : '显示密码'"
      :aria-pressed="show"
      @click="show = !show"
    >
      <svg v-if="!show" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.2 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.2-1.5M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M9.5 9.5a3 3 0 0 0 4.2 4.2M14.5 14.5a3 3 0 0 1-4.2-4.2" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.pw-wrap { position: relative; display: block; width: 100%; }
.pw-wrap input {
  width: 100%;
  padding-right: 44px;
}
.eye {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-on-surface-variant);
  transition: color var(--duration-fast), background var(--duration-fast);
}
.eye:hover { background: var(--color-surface-container); color: var(--color-on-surface); }
.eye:active { background: var(--color-surface-container-high); }
.eye[aria-pressed="true"] { color: var(--color-primary); }
</style>
