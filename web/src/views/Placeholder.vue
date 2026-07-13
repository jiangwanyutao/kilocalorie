<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';

const route = useRoute();

const title = computed(() => (route.meta?.title as string) ?? '页面');
const path = computed(() => route.fullPath);
</script>

<template>
  <section class="wrap">
    <AppHeader :title="title" />
    <div class="body">
      <p class="eyebrow">即将开放</p>
      <h1 class="title">{{ title }}</h1>
      <p class="path num">{{ path }}</p>
      <p class="hint">
        这一屏还在编码中。W1 完成后逐步上线 32 屏功能，先跑通脚手架 · DB · PWA 壳。
      </p>
    </div>
  </section>
</template>

<style scoped>
.wrap {
  min-height: 100dvh;
  background: var(--color-surface);
  color: var(--color-on-surface);
}

.body {
  padding: var(--space-xl) var(--space-margin-mobile);
}

.eyebrow {
  font-size: var(--font-size-label);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 var(--space-sm);
}

.title {
  font-size: var(--font-size-hero);
  line-height: var(--line-height-hero);
  letter-spacing: var(--letter-spacing-hero);
  margin: 0 0 var(--space-md);
  color: var(--color-on-surface);
}

.path {
  font-family: var(--font-family-num);
  font-size: var(--font-size-caption);
  color: var(--color-on-surface-variant);
  background: var(--color-surface-container);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-default);
  display: inline-block;
  margin: 0 0 var(--space-lg);
}

.hint {
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-on-surface-variant);
  max-width: 30em;
}
</style>
