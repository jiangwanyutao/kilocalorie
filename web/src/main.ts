import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './styles/tokens.css';

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
