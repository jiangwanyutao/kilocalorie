<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

interface Props {
  modelValue: number | string;
  values: (number | string)[];
  label?: string;
  unit?: string;
  itemHeight?: number;
  visibleCount?: number;
  formatFn?: (v: number | string) => string;
}
const props = withDefaults(defineProps<Props>(), {
  itemHeight: 44,
  visibleCount: 5,
});
const emit = defineEmits<{ 'update:modelValue': [value: number | string] }>();

const listEl = ref<HTMLUListElement | null>(null);
const scrollingByUser = ref(false);
const scrollTimer = ref<number | null>(null);

const padCount = computed(() => Math.floor(props.visibleCount / 2));
const containerHeight = computed(() => props.itemHeight * props.visibleCount);
const highlightTop = computed(() => (containerHeight.value - props.itemHeight) / 2);

function indexOfValue(v: number | string): number {
  const i = props.values.indexOf(v);
  return i < 0 ? 0 : i;
}

watch(() => props.modelValue, (v) => {
  if (scrollingByUser.value) return;
  const idx = indexOfValue(v);
  scrollToIndex(idx, false);
});

function scrollToIndex(idx: number, smooth: boolean) {
  const el = listEl.value;
  if (!el) return;
  el.scrollTo({ top: idx * props.itemHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function onScroll() {
  const el = listEl.value;
  if (!el) return;
  scrollingByUser.value = true;
  if (scrollTimer.value) window.clearTimeout(scrollTimer.value);
  scrollTimer.value = window.setTimeout(() => {
    const idx = Math.round(el.scrollTop / props.itemHeight);
    const clamped = Math.max(0, Math.min(props.values.length - 1, idx));
    if (Math.abs(el.scrollTop - clamped * props.itemHeight) > 1) {
      scrollToIndex(clamped, false);
    }
    const v = props.values[clamped];
    if (v !== props.modelValue) emit('update:modelValue', v);
    scrollingByUser.value = false;
  }, 140) as unknown as number;
}

function pickIdx(idx: number) {
  emit('update:modelValue', props.values[idx]);
  scrollToIndex(idx, true);
}

const centerIdx = computed(() => indexOfValue(props.modelValue));
function isCenter(idx: number): boolean { return idx === centerIdx.value; }
function distance(idx: number): number { return Math.abs(idx - centerIdx.value); }

function format(v: number | string): string {
  return props.formatFn ? props.formatFn(v) : String(v);
}

onMounted(async () => {
  await nextTick();
  scrollToIndex(indexOfValue(props.modelValue), false);
});
</script>

<template>
  <div class="wp" :style="{ height: containerHeight + 'px' }">
    <ul
      ref="listEl"
      class="wp-list"
      :style="{ '--h': itemHeight + 'px' }"
      @scroll="onScroll"
    >
      <li v-for="i in padCount" :key="'top-' + i" class="wp-item pad" aria-hidden="true"></li>
      <li
        v-for="(v, idx) in values"
        :key="idx"
        class="wp-item"
        :class="{
          center: isCenter(idx),
          d1: distance(idx) === 1,
          d2: distance(idx) === 2,
          d3: distance(idx) >= 3,
        }"
        @click="pickIdx(idx)"
      >{{ format(v) }}</li>
      <li v-for="i in padCount" :key="'bot-' + i" class="wp-item pad" aria-hidden="true"></li>
    </ul>

    <div class="wp-highlight" :style="{ top: highlightTop + 'px', height: itemHeight + 'px' }" aria-hidden="true"></div>
    <div class="wp-mask top" :style="{ height: highlightTop + 'px' }" aria-hidden="true"></div>
    <div class="wp-mask bottom" :style="{ height: highlightTop + 'px' }" aria-hidden="true"></div>

    <p v-if="unit" class="wp-unit" :style="{ top: highlightTop + itemHeight / 2 + 'px' }" aria-hidden="true">{{ unit }}</p>
  </div>
</template>

<style scoped>
.wp {
  position: relative;
  border-radius: var(--radius-md);
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  overflow: hidden;
  touch-action: pan-y;
}

.wp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.wp-list::-webkit-scrollbar { display: none; }

.wp-item {
  height: var(--h);
  display: grid;
  place-items: center;
  scroll-snap-align: center;
  font-family: var(--font-family-num);
  font-size: 22px;
  color: var(--color-outline);
  transition: color var(--duration-fast) var(--ease-out-expo),
              font-size var(--duration-fast) var(--ease-out-expo),
              opacity var(--duration-fast) var(--ease-out-expo);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.wp-item.pad { pointer-events: none; }
.wp-item.d1 { color: var(--color-on-surface-variant); font-size: 20px; opacity: 0.8; }
.wp-item.d2 { color: var(--color-outline); font-size: 18px; opacity: 0.55; }
.wp-item.d3 { color: var(--color-outline-variant); font-size: 16px; opacity: 0.35; }
.wp-item.center {
  color: var(--color-primary);
  font-size: 26px;
  font-weight: 600;
  opacity: 1;
}

.wp-highlight {
  position: absolute;
  left: 8px;
  right: 8px;
  border-top: 1px solid var(--color-primary-fixed);
  border-bottom: 1px solid var(--color-primary-fixed);
  pointer-events: none;
  border-radius: 4px;
}

.wp-mask {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 1;
}
.wp-mask.top {
  top: 0;
  background: linear-gradient(to bottom,
    var(--color-surface-container-lowest) 0%,
    color-mix(in srgb, var(--color-surface-container-lowest) 60%, transparent) 60%,
    transparent 100%);
}
.wp-mask.bottom {
  bottom: 0;
  background: linear-gradient(to top,
    var(--color-surface-container-lowest) 0%,
    color-mix(in srgb, var(--color-surface-container-lowest) 60%, transparent) 60%,
    transparent 100%);
}

.wp-unit {
  position: absolute;
  right: 16px;
  transform: translateY(-50%);
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--color-on-surface-variant);
  font-family: var(--font-family-sans);
  pointer-events: none;
}
</style>
