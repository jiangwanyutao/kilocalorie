<script setup lang="ts">
import { useRouter } from 'vue-router';

interface Props {
  title?: string;
  backTo?: string;
  hideBack?: boolean;
  backText?: string;
}
const props = withDefaults(defineProps<Props>(), { hideBack: false });

const router = useRouter();

function onBack() {
  if (props.backTo) { router.push(props.backTo); return; }
  if (window.history.length > 1) router.back();
  else router.push('/');
}
</script>

<template>
  <header class="app-header">
    <div class="bar">
      <button v-if="!hideBack" class="back" type="button" @click="onBack" aria-label="返回">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span v-if="backText" class="back-text">{{ backText }}</span>
      </button>
      <div v-else class="spacer" />
      <h1 v-if="title" class="title">{{ title }}</h1>
      <div class="right"><slot name="right" /></div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky; top: 0; z-index: 40;
  background: var(--color-surface);
  padding-top: env(safe-area-inset-top);
  backdrop-filter: saturate(140%) blur(8px);
  -webkit-backdrop-filter: saturate(140%) blur(8px);
}
.bar {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center;
  gap: var(--space-sm); height: 44px; padding: 0 var(--space-margin-mobile);
}
.back {
  display: inline-flex; align-items: center; gap: 4px;
  height: 36px; padding: 0 12px 0 10px;
  border-radius: var(--radius-full);
  background: var(--color-surface-container);
  color: var(--color-primary);
  font-size: var(--font-size-body); font-weight: 500;
  transition: background var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
  min-width: 40px;
}
.back:hover { background: var(--color-surface-container-high); }
.back:active { background: var(--color-surface-container-highest); transform: scale(0.96); }
.back svg { stroke: currentColor; display: block; }
.back-text { line-height: 1; }
.spacer { width: 40px; }
.title {
  margin: 0; text-align: center;
  font-size: var(--font-size-body); font-weight: 600;
  color: var(--color-on-surface);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.right { display: inline-flex; align-items: center; gap: 4px; min-width: 40px; justify-content: flex-end; }
</style>
