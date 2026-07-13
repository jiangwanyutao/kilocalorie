<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

const DISMISS_KEY = 'qk.pwa.dismissed';
const NEVER_KEY = 'qk.pwa.never';
const RE_SHOW_DAYS = 3;

const visible = ref(false);
const platform = ref<Platform>('unknown');
const deferredPrompt = ref<BIPEvent | null>(null);
const installing = ref(false);

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/mobile/.test(ua)) return 'unknown';
  return 'desktop';
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = navigator as unknown as { standalone?: boolean };
  return nav.standalone === true;
}

function shouldShow(): boolean {
  if (isStandalone()) return false;
  if (localStorage.getItem(NEVER_KEY) === 'Y') return false;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (dismissed) {
    const ago = Date.now() - Number(dismissed);
    if (ago < RE_SHOW_DAYS * 86400_000) return false;
  }
  return true;
}

function onBIP(e: Event) {
  e.preventDefault();
  deferredPrompt.value = e as BIPEvent;
}

async function install() {
  if (!deferredPrompt.value) return;
  installing.value = true;
  try {
    await deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    if (outcome === 'accepted') {
      visible.value = false;
      deferredPrompt.value = null;
    }
  } finally {
    installing.value = false;
  }
}

function dismissLater() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  visible.value = false;
}

function dismissForever() {
  localStorage.setItem(NEVER_KEY, 'Y');
  visible.value = false;
}

onMounted(() => {
  platform.value = detectPlatform();
  window.addEventListener('beforeinstallprompt', onBIP);
  if (shouldShow()) {
    setTimeout(() => { visible.value = true; }, 3000);
  }
});
onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBIP);
});

const title = computed(() => {
  switch (platform.value) {
    case 'ios': return '加到桌面 · 像原生 App';
    case 'android': return '一键加到桌面';
    default: return '加到桌面 · 像原生 App';
  }
});
const canOneClick = computed(() => deferredPrompt.value != null);
</script>

<template>
  <transition name="popin">
    <div v-if="visible" class="pwa-mask" @click.self="dismissLater">
      <div class="pwa-sheet" role="dialog" aria-modal="true" aria-labelledby="pwa-title">
        <div class="handle" aria-hidden="true"></div>

        <div class="hero">
          <div class="icon-wrap" aria-hidden="true">
            <div class="icon-shine"></div>
            <span class="icon-glyph">🥗</span>
          </div>
          <div class="hero-txt">
            <h3 id="pwa-title" class="title">{{ title }}</h3>
            <p class="sub">离线可用 · 无红点打扰 · 打开更快</p>
          </div>
        </div>

        <div class="steps">
          <template v-if="platform === 'ios'">
            <div class="step">
              <span class="step-num">1</span>
              <div class="step-body">
                <p class="step-title">点<b>右下角</b>
                  <span class="ios-dots" aria-hidden="true">•••</span>
                  <b>更多</b>
                </p>
                <p class="step-hint">Safari 底部工具栏右下</p>
              </div>
            </div>
            <div class="step">
              <span class="step-num">2</span>
              <div class="step-body">
                <p class="step-title">点
                  <svg class="ios-share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M12 3l0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
                    <path d="M8 7l4-4 4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M5 12v8h14v-8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <b>共享</b>
                </p>
              </div>
            </div>
            <div class="step">
              <span class="step-num">3</span>
              <div class="step-body">
                <p class="step-title">滑一下 · 点 <b>查看更多</b></p>
              </div>
            </div>
            <div class="step">
              <span class="step-num">4</span>
              <div class="step-body">
                <p class="step-title">找 <b>添加到主屏幕</b> <span class="ios-add">+</span></p>
                <p class="step-hint">右上角 <b>添加</b> · 完成 · 桌面出现"千卡"图标</p>
              </div>
            </div>
            <p class="ios-old-hint">iOS 25 及更早：分享按钮在 Safari 底部菜单中间</p>
          </template>

          <template v-else-if="canOneClick">
            <p class="one-click-hint">点下面按钮 · 浏览器会弹窗确认 · 一步搞定</p>
          </template>

          <template v-else-if="platform === 'android'">
            <div class="step">
              <span class="step-num">1</span>
              <div class="step-body">
                <p class="step-title">点右上 <b>⋮</b> 菜单</p>
              </div>
            </div>
            <div class="step">
              <span class="step-num">2</span>
              <div class="step-body">
                <p class="step-title">选 <b>添加到主屏幕</b> / <b>安装应用</b></p>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="step">
              <span class="step-num">1</span>
              <div class="step-body">
                <p class="step-title">地址栏右侧 · 找 <b>⊕ 安装</b> 按钮</p>
                <p class="step-hint">Chrome / Edge 才有 · Firefox / Safari 无</p>
              </div>
            </div>
          </template>
        </div>

        <div class="cta">
          <button
            v-if="canOneClick"
            type="button"
            class="primary"
            :disabled="installing"
            @click="install"
          >
            {{ installing ? '安装中…' : '添加到桌面' }}
          </button>
          <button type="button" class="ghost" @click="dismissLater">稍后再说</button>
        </div>

        <button type="button" class="never" @click="dismissForever">不再提示</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.pwa-mask {
  position: fixed;
  inset: 0;
  background: rgba(29, 25, 23, 0.5);
  display: grid;
  align-items: end;
  z-index: 200;
  padding: env(safe-area-inset-top) 0 0;
}

.pwa-sheet {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 8px var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-md));
  box-shadow: 0 -12px 40px rgba(29, 25, 23, 0.24);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 90vh;
  overflow-y: auto;
}

.handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-outline-variant);
  margin: 0 auto 4px;
}

.hero {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 14px;
  align-items: center;
  padding: 4px 4px 8px;
}
.icon-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 12px 24px rgba(165, 51, 20, 0.28);
  animation: bob 2.4s ease-in-out infinite;
}
.icon-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%);
  animation: shine 2.6s ease-in-out infinite;
}
.icon-glyph { position: relative; font-size: 40px; line-height: 1; }
@keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes shine { 0% { transform: translateX(-100%); } 60% { transform: translateX(100%); } 100% { transform: translateX(100%); } }

.hero-txt .title {
  margin: 0;
  font-size: var(--font-size-section);
  font-weight: 600;
  color: var(--color-on-surface);
  letter-spacing: -0.01em;
}
.hero-txt .sub {
  margin: 4px 0 0;
  font-size: var(--font-size-caption);
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

.steps { display: flex; flex-direction: column; gap: 10px; padding: 4px; }
.step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface-container);
  border: 1px solid var(--color-outline-variant);
  animation: slidein 0.4s var(--ease-out-expo) both;
}
.step:nth-child(2) { animation-delay: 0.08s; }
.step:nth-child(3) { animation-delay: 0.16s; }
.step:nth-child(4) { animation-delay: 0.24s; }
@keyframes slidein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-on-primary);
  display: grid;
  place-items: center;
  font-size: var(--font-size-caption);
  font-weight: 600;
  font-family: var(--font-family-num);
}
.step-body { min-width: 0; }
.step-title {
  margin: 0;
  font-size: var(--font-size-caption);
  line-height: 1.55;
  color: var(--color-on-surface);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.step-title b { color: var(--color-primary); font-weight: 600; }
.step-hint {
  margin: 2px 0 0;
  font-size: var(--font-size-label);
  letter-spacing: 0.03em;
  color: var(--color-outline);
}

.ios-share {
  display: inline-block;
  color: var(--color-primary);
  vertical-align: middle;
  margin: 0 2px;
}
.ios-add {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-weight: 600;
  font-size: 14px;
  vertical-align: middle;
}
.ios-dots {
  display: inline-grid;
  place-items: center;
  min-width: 32px;
  height: 20px;
  padding: 0 4px;
  border-radius: 6px;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
  vertical-align: middle;
  margin: 0 2px;
}
.ios-old-hint {
  margin: 4px 4px 0;
  padding: 8px 12px;
  background: var(--color-surface-container);
  border-left: 3px solid var(--color-outline);
  border-radius: 0 8px 8px 0;
  font-size: var(--font-size-label);
  letter-spacing: 0.03em;
  color: var(--color-outline);
  line-height: 1.5;
}

.one-click-hint {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  font-size: var(--font-size-caption);
  line-height: 1.55;
  text-align: center;
}

.cta { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 4px; }
.cta:has(.primary) { grid-template-columns: 2fr 1fr; }
.primary {
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-body);
  font-weight: 500;
  box-shadow: 0 8px 20px rgba(165, 51, 20, 0.32);
}
.primary:disabled { opacity: 0.5; box-shadow: none; }
.primary:active:not(:disabled) { transform: scale(0.98); }
.ghost {
  height: 52px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-outline-variant);
  font-size: var(--font-size-caption);
}
.never {
  align-self: center;
  padding: 6px 14px;
  background: transparent;
  color: var(--color-outline);
  font-size: var(--font-size-label);
  letter-spacing: 0.03em;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.popin-enter-active .pwa-sheet, .popin-leave-active .pwa-sheet {
  transition: transform var(--duration-normal) var(--ease-out-expo);
}
.popin-enter-from .pwa-sheet, .popin-leave-to .pwa-sheet {
  transform: translateY(100%);
}
.popin-enter-active, .popin-leave-active {
  transition: opacity var(--duration-normal);
}
.popin-enter-from, .popin-leave-to { opacity: 0; }
</style>
