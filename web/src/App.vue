<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue';

const route = useRoute();
const router = useRouter();

type TabName = 'home' | 'log' | 'ai' | 'me';
type IconName = 'home' | 'log' | 'plus' | 'ai' | 'me';

interface Tab {
  name?: TabName;
  fab?: boolean;
  label: string;
  icon: IconName;
}

const tabs: readonly Tab[] = [
  { name: 'home', label: '首页',    icon: 'home' },
  { name: 'log',  label: '记录',    icon: 'log'  },
  { fab: true,    label: '',        icon: 'plus' },
  { name: 'ai',   label: 'AI 搭子', icon: 'ai'   },
  { name: 'me',   label: '我的',    icon: 'me'   },
];

const active = computed<string>(() => {
  const n = (route.name as string) ?? 'home';
  if (n === 'ai-chat' || n === 'ai-memory') return 'ai';
  return n;
});
const hideTabBar = computed<boolean>(() => route.meta?.hideTabBar === true);

/** 按当前时段选默认餐次 */
function pickMealByHour(h: number): 'B' | 'L' | 'D' | 'S' {
  if (h < 5)  return 'S';
  if (h < 10) return 'B';
  if (h < 14) return 'L';
  if (h < 17) return 'S';
  if (h < 22) return 'D';
  return 'S';
}

function onTab(t: Tab): void {
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

    <PwaInstallPrompt />

    <nav v-if="!hideTabBar" class="tabbar" aria-label="主导航">
      <button
        v-for="(t, i) in tabs"
        :key="i"
        :class="['tab', { active: active === t.name && !t.fab, floating: t.fab }]"
        :aria-label="t.fab ? '记一笔' : t.label"
        @click="onTab(t)"
      >
        <span class="ico" aria-hidden="true">
          <!-- 首页 · 房子 -->
          <svg v-if="t.icon === 'home'" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"
                  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <!-- 记录 · 笔记 -->
          <svg v-else-if="t.icon === 'log'" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 3v5h5M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <!-- FAB · 加号 -->
          <svg v-else-if="t.icon === 'plus'" viewBox="0 0 24 24" width="28" height="28" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          </svg>
          <!-- AI · sparkle -->
          <svg v-else-if="t.icon === 'ai'" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
                  stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
          <!-- 我的 · 人形 -->
          <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/>
            <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </span>
        <span v-if="t.label" class="label">{{ t.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
  background: var(--color-background);
}

/* ─── TabBar · 毛玻璃 + 悬浮 ─────────────── */
.tabbar {
  position: fixed;
  bottom: env(safe-area-inset-bottom);
  left: 12px;
  right: 12px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  height: 64px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 26px;
  box-shadow:
    0 20px 40px -12px rgba(120, 90, 200, 0.28),
    0 4px 12px -4px rgba(120, 90, 200, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  backdrop-filter: saturate(140%) blur(14px);
  -webkit-backdrop-filter: saturate(140%) blur(14px);
  z-index: 50;
}

/* iOS 系统柄区域 */
@supports (padding: max(0px)) {
  .tabbar { bottom: max(env(safe-area-inset-bottom), 8px); }
}

.tab {
  display: flex; flex-direction: column; align-items: center;
  gap: 2px;
  padding: 4px 0;
  background: transparent; border: 0;
  color: var(--color-outline);
  font-size: 10px;
  letter-spacing: 0.04em;
  transition: color var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
  cursor: pointer;
  position: relative;
}

.tab .ico {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 30px;
  border-radius: 15px;
  transition: background var(--duration-fast), color var(--duration-fast);
}

.tab.active {
  color: var(--color-primary);
  font-weight: 600;
}
.tab.active .ico {
  background: var(--color-primary-fixed);
}

.tab:not(.floating):active { transform: scale(0.94); }

/* ─── 中间悬浮 FAB ─────────────── */
.tab.floating {
  align-self: center;
  translate: 0 -22px;
  width: 60px; height: 60px;
  border-radius: 50%;
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  box-shadow:
    0 16px 30px -8px rgba(165, 51, 20, 0.44),
    0 4px 10px -2px rgba(165, 51, 20, 0.22),
    inset 0 -2px 4px rgba(0, 0, 0, 0.12),
    inset 0 2px 3px rgba(255, 255, 255, 0.30);
  border: 3px solid rgba(255, 255, 255, 0.86);
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.tab.floating .ico {
  width: 32px; height: 32px; background: transparent;
}
.tab.floating:active { transform: scale(0.94) translateY(-22px); }

/* 页面切换 · fade + 微 translateY · 给出 native 感 */
.fade-enter-active {
  transition:
    opacity 260ms var(--ease-out-expo),
    transform 260ms var(--ease-out-expo);
}
.fade-leave-active {
  transition:
    opacity 180ms var(--ease-out-expo),
    transform 180ms var(--ease-out-expo);
}
.fade-enter-from { opacity: 0; transform: translateY(8px); }
.fade-leave-to   { opacity: 0; transform: translateY(-6px); }
@media (prefers-reduced-motion: reduce) {
  .fade-enter-active, .fade-leave-active { transition: opacity 100ms linear; }
  .fade-enter-from, .fade-leave-to { transform: none; }
}
</style>
