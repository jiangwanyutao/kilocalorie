<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue';
import PwaUpdateBanner from '@/components/PwaUpdateBanner.vue';

const route = useRoute();
const router = useRouter();

type TabName = 'home' | 'log' | 'ai' | 'me';
interface Tab {
  name?: TabName;
  fab?: boolean;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { name: 'home', label: '首页', icon: '☰' },
  { name: 'log',  label: '记录', icon: '✎' },
  { fab: true,    label: '',     icon: '＋' },
  { name: 'ai',   label: 'AI 搭子', icon: '☾' },
  { name: 'me',   label: '我的', icon: '☺' },
];

const active = computed(() => {
  const n = (route.name as string) ?? 'home';
  if (n === 'ai-chat' || n === 'ai-memory') return 'ai';
  return n;
});
const hideTabBar = computed(() => route.meta?.hideTabBar === true);

/** 按当前时段选默认餐次 */
function pickMealByHour(h: number): 'B' | 'L' | 'D' | 'S' {
  if (h < 5)  return 'S';   // 深夜 · 夜宵
  if (h < 10) return 'B';   // 早
  if (h < 14) return 'L';   // 午
  if (h < 17) return 'S';   // 下午茶
  if (h < 22) return 'D';   // 晚
  return 'S';               // 夜宵
}

function onTab(t: Tab) {
  if (t.fab) {
    const type = pickMealByHour(new Date().getHours());
    router.push({ path: '/log', query: { type, open: '1' } });
    return;
  }
  if (t.name) router.push({ name: t.name });
}
</script>

<template>
  <div class="app-shell">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <PwaUpdateBanner />
    <PwaInstallPrompt />

    <nav v-if="!hideTabBar" class="tabbar" aria-label="主导航">
      <button
        v-for="(t, i) in tabs"
        :key="i"
        :class="['tab', { active: active === t.name && !t.fab, floating: t.fab }]"
        :aria-label="t.fab ? '记一笔' : t.label"
        @click="onTab(t)"
      >
        <span class="icon" aria-hidden="true">{{ t.icon }}</span>
        <span v-if="t.label" class="label">{{ t.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  padding-bottom: calc(72px + env(safe-area-inset-bottom));
  background: var(--color-background);
}

.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: end;
  height: calc(64px + env(safe-area-inset-bottom));
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: var(--color-surface-container-lowest);
  border-top: 1px solid var(--color-outline-variant);
  box-shadow: var(--shadow-paper);
  z-index: 50;
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label);
  letter-spacing: var(--letter-spacing-label);
  transition: color var(--duration-fast) var(--ease-out-expo);
}

.tab.active {
  color: var(--color-primary);
}

.tab .icon {
  font-size: 22px;
  line-height: 1;
}

.tab.floating {
  align-self: center;
  translate: 0 -18px;
  width: 60px;
  height: 60px;
  border-radius: var(--radius-full);
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  box-shadow:
    0 12px 24px rgba(165, 51, 20, 0.32),
    0 4px 10px rgba(165, 51, 20, 0.18),
    inset 0 -2px 4px rgba(0, 0, 0, 0.12),
    inset 0 2px 3px rgba(255, 255, 255, 0.28);
  border: 2px solid var(--color-surface-container-lowest);
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.tab.floating:active {
  transform: scale(0.94);
}

.tab.floating .icon {
  font-size: 30px;
  font-weight: 300;
  line-height: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out-expo);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
