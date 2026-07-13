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
  const stored = localStorage.getItem('qk.theme');
  const t = stored === 'dark' || stored === 'light' || stored === 'auto' ? stored : 'auto';
  const wantDark = t === 'dark' ||
    (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', wantDark ? 'dark' : 'light');
})();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
