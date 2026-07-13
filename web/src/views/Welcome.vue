<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <section class="welcome">
    <div class="halo" aria-hidden="true"></div>

    <header class="brand">
      <span class="mark">千</span>
      <span class="name">千卡日记</span>
    </header>

    <div class="hero">
      <p class="eyebrow">Qianka Diary</p>
      <h1 class="title">
        每一餐<br />
        都值得<br />
        被认真写下。
      </h1>
      <p class="sub">
        写给自己的饮食日记 —— 不打分、不比赛，<br />
        只记录你和身体之间那些细小的对话。
      </p>
    </div>

    <div class="cta">
      <button class="primary" @click="router.push({ name: 'register' })">
        开始写第一页
      </button>
      <button class="ghost" @click="router.push({ name: 'login' })">
        我已有账号 · 登录
      </button>
      <p class="foot">V1 全免费 · AI 内容仅供参考 不构成医疗建议</p>
    </div>
  </section>
</template>

<style scoped>
.welcome {
  position: relative;
  min-height: 100dvh;
  padding: calc(env(safe-area-inset-top) + var(--space-xl)) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-xl));
  background: var(--color-surface);
  color: var(--color-on-surface);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--space-xl);
}

.halo {
  position: absolute;
  inset: -40% -30% auto auto;
  width: 90vw;
  height: 90vw;
  border-radius: 50%;
  background: radial-gradient(circle at center, var(--color-primary-fixed) 0%, transparent 65%);
  opacity: 0.7;
  filter: blur(4px);
  pointer-events: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  position: relative;
}

.mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 22px;
  font-weight: 600;
}

.name {
  font-size: var(--font-size-section);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.hero {
  position: relative;
  padding-top: var(--space-lg);
}

.eyebrow {
  font-size: var(--font-size-label);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 var(--space-md);
}

.title {
  font-size: 44px;
  line-height: 56px;
  letter-spacing: -0.02em;
  font-weight: 600;
  margin: 0 0 var(--space-lg);
  color: var(--color-on-surface);
  text-wrap: balance;
}

.sub {
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-on-surface-variant);
  max-width: 28em;
}

.cta {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  position: relative;
}

.primary,
.ghost {
  height: 56px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-body);
  font-weight: 500;
  transition: transform var(--duration-fast) var(--ease-out-expo);
}

.primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-card);
}

.primary:active {
  transform: scale(0.98);
}

.ghost {
  background: transparent;
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
}

.foot {
  margin: var(--space-sm) 0 0;
  text-align: center;
  font-size: var(--font-size-caption);
  color: var(--color-on-surface-variant);
}
</style>
