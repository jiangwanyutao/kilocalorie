<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue';

const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegistered(reg) {
    if (reg) {
      setInterval(() => { reg.update().catch(() => undefined); }, 30 * 60 * 1000);
    }
  },
});

async function applyUpdate() {
  await updateServiceWorker(true);
}

function dismiss() {
  needRefresh.value = false;
}
</script>

<template>
  <transition name="drop">
    <div v-if="needRefresh" class="upd-bar" role="alert" aria-live="polite">
      <div class="dot" aria-hidden="true"></div>
      <div class="txt">
        <p class="t-title">有新版本可以更新</p>
        <p class="t-sub">点右侧立即体验</p>
      </div>
      <button type="button" class="btn primary" @click="applyUpdate">立即更新</button>
      <button type="button" class="btn ghost" @click="dismiss" aria-label="稍后">×</button>
    </div>
  </transition>
</template>

<style scoped>
.upd-bar {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 300;
  width: min(calc(100% - 24px), 520px);
  display: grid;
  grid-template-columns: 8px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-primary-fixed);
  box-shadow: 0 12px 32px rgba(29, 25, 23, 0.16), 0 4px 12px rgba(165, 51, 20, 0.14);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(165, 51, 20, 0.15);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 4px rgba(165, 51, 20, 0.15); }
  50%      { transform: scale(1.2); box-shadow: 0 0 0 8px rgba(165, 51, 20, 0); }
}

.txt { min-width: 0; }
.t-title {
  margin: 0;
  font-size: var(--font-size-caption);
  font-weight: 600;
  color: var(--color-on-surface);
  line-height: 1.3;
}
.t-sub {
  margin: 2px 0 0;
  font-size: var(--font-size-label);
  letter-spacing: 0.03em;
  color: var(--color-on-surface-variant);
}

.btn {
  flex-shrink: 0;
  height: 36px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption);
  font-weight: 500;
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.btn.primary {
  padding: 0 14px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 0 4px 12px rgba(165, 51, 20, 0.28);
}
.btn.primary:active { transform: scale(0.96); }
.btn.ghost {
  width: 36px;
  padding: 0;
  background: transparent;
  color: var(--color-outline);
  font-size: 22px;
  line-height: 1;
}
.btn.ghost:active { color: var(--color-on-surface); }

.drop-enter-active, .drop-leave-active {
  transition: transform var(--duration-normal) var(--ease-out-expo), opacity var(--duration-normal);
}
.drop-enter-from, .drop-leave-to {
  transform: translate(-50%, -140%);
  opacity: 0;
}
</style>
