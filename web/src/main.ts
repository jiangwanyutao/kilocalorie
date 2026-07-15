import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './styles/tokens.css';

// 一次性 kill-switch · 老用户浏览器里如果有旧 SW · register 新的（kill-switch）替换
// 新用户没有 SW · 这段直接返回 · 不注册
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length > 0) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }).catch(() => undefined);
}

(function bootstrapTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const readMode = (): 'auto' | 'light' | 'dark' => {
    const s = localStorage.getItem('qk.theme');
    return s === 'dark' || s === 'light' || s === 'auto' ? s : 'auto';
  };
  const apply = (): void => {
    const t = readMode();
    const wantDark = t === 'dark' || (t === 'auto' && mq.matches);
    document.documentElement.setAttribute('data-theme', wantDark ? 'dark' : 'light');
  };
  apply();
  mq.addEventListener?.('change', () => { if (readMode() === 'auto') apply(); });
  window.addEventListener('storage', (e) => { if (e.key === 'qk.theme') apply(); });
})();

/**
 * 键盘弹起时 · 让聚焦的 input/textarea 滚到视口中间
 * 移动端浏览器不会自动做这件事 · 键盘常把输入框挡住
 * 延时 260ms 等软键盘展开动画结束再滚 · 避免抢位
 */
(function bindInputScrollIntoView() {
  const isInputEl = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  };
  document.addEventListener('focusin', (e) => {
    if (!isInputEl(e.target)) return;
    const el = e.target as HTMLElement;
    setTimeout(() => {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      catch { /* 老浏览器无 scrollIntoView options · 静默 */ }
    }, 260);
  });
})();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
