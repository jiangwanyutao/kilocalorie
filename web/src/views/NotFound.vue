<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function goHome(): void { router.replace('/'); }
function goBack(): void {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}
</script>

<template>
  <section class="wrap">
    <div class="body">
      <div class="badge">
        <span class="num">404</span>
      </div>
      <p class="title">这一页走丢了</p>
      <p class="sub">链接可能已过期 · 或还没做出来</p>

      <div class="actions">
        <button type="button" class="btn primary" @click="goHome">回首页</button>
        <button type="button" class="btn ghost" @click="goBack">返回上一页</button>
      </div>

      <p class="quote">
        "写不下去也没关系 · 明天这一页留白就好。"
      </p>
    </div>
  </section>
</template>

<style scoped>
.wrap {
  min-height: 100dvh;
  background:
    radial-gradient(1000px 500px at 100% 0%, rgba(198, 75, 42, 0.08), transparent 60%),
    radial-gradient(800px 400px at 0% 30%, rgba(83, 101, 35, 0.06), transparent 60%),
    linear-gradient(180deg, #ecebff 0%, #f5f2ff 22%, #fbf5f0 50%, #fff8f5 100%);
  display: grid; place-items: center;
  padding: env(safe-area-inset-top) 20px env(safe-area-inset-bottom);
}
.body {
  max-width: 360px; width: 100%;
  text-align: center;
  padding: 44px 24px 36px;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 32px;
  box-shadow: 0 24px 48px -20px rgba(120, 90, 200, 0.28);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.badge {
  width: 132px; height: 132px; margin: 0 auto 20px;
  border-radius: 40px;
  background: linear-gradient(140deg, #fff4cc 0%, #ffe0d5 60%, #ffcf5a 100%);
  display: grid; place-items: center;
  box-shadow: 0 20px 40px -12px rgba(255, 180, 60, 0.5);
}
.badge .num {
  font-size: 44px; font-weight: 700; letter-spacing: 0.02em;
  color: #7E5100;
  font-family: var(--font-family-num);
}
.title {
  margin: 0 0 6px; font-size: 22px; font-weight: 700;
  color: var(--color-on-surface);
}
.sub {
  margin: 0 0 24px; font-size: 13px; letter-spacing: 0.03em;
  color: var(--color-on-surface-variant);
}
.actions { display: flex; flex-direction: column; gap: 10px; }
.btn {
  height: 50px; border: 0; border-radius: 18px;
  font-size: 14.5px; font-weight: 600; letter-spacing: 0.04em;
  transition: transform var(--duration-fast), opacity var(--duration-fast);
  cursor: pointer;
}
.btn:active { transform: scale(0.98); }
.btn.primary {
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  box-shadow: 0 12px 28px -8px rgba(165, 51, 20, 0.36);
}
.btn.ghost {
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1px solid rgba(120, 90, 200, 0.16);
}
.quote {
  margin: 26px 0 0; padding-top: 20px;
  border-top: 1px solid rgba(120, 90, 200, 0.08);
  font-size: 12px; letter-spacing: 0.05em; line-height: 1.7;
  color: var(--color-outline);
  font-style: italic;
}
</style>
