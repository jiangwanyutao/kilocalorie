<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

onMounted(() => {
  auth.refreshMe().catch(() => undefined);
});

function logout() {
  auth.logout();
  router.replace('/welcome');
}
</script>

<template>
  <section class="wrap">
    <header class="head">
      <h1 class="title">我的</h1>
    </header>

    <div v-if="auth.user" class="card profile">
      <div class="avatar">{{ auth.user.nickname.slice(0, 1) }}</div>
      <div class="meta">
        <p class="nick">{{ auth.user.nickname }}</p>
        <p class="email num">{{ auth.user.email }}</p>
        <p class="id num">用户 ID · {{ auth.user.id }}</p>
      </div>
      <span class="chip" :class="auth.user.emailVerified === 'Y' ? 'ok' : 'warn'">
        {{ auth.user.emailVerified === 'Y' ? '已验证' : '未验证' }}
      </span>
    </div>

    <ul class="menu">
      <li class="item" @click="router.push('/goal')">
        <span>目标 · 卡路里 / 三大营养素</span><span class="arrow">›</span>
      </li>
      <li class="item" @click="router.push('/settings')">
        <span>设置 · 提醒 · 主题 · 清理</span><span class="arrow">›</span>
      </li>
      <li class="item" @click="router.push('/exercise/history')">
        <span>锻炼历史</span><span class="arrow">›</span>
      </li>
      <li class="item" @click="router.push('/body/steps')">
        <span>步数 · 距离 · 消耗</span><span class="arrow">›</span>
      </li>
      <li class="item" @click="router.push('/body/sleep')">
        <span>睡眠</span><span class="arrow">›</span>
      </li>
      <li class="item" @click="router.push('/health/import')">
        <span>Apple 健康数据导入</span><span class="arrow">›</span>
      </li>
      <li class="item" @click="router.push('/export')">
        <span>数据导出</span><span class="arrow">›</span>
      </li>
      <li class="item" @click="router.push('/about')">
        <span>关于千卡日记</span><span class="arrow">›</span>
      </li>
    </ul>

    <button class="ghost" @click="logout">退出登录</button>

    <p class="foot">AI 内容仅供参考 · 不构成医疗建议</p>
  </section>
</template>

<style scoped>
.wrap { padding: calc(env(safe-area-inset-top) + var(--space-md)) var(--space-margin-mobile) var(--space-xl); background: var(--color-surface); color: var(--color-on-surface); display: flex; flex-direction: column; gap: var(--space-lg); }
.head { padding: var(--space-sm) 0; }
.title { font-size: var(--font-size-title); line-height: var(--line-height-title); margin: 0; font-weight: 600; }
.card { background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); box-shadow: var(--shadow-paper); padding: var(--space-md); }
.profile { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: var(--space-md); }
.avatar { width: 56px; height: 56px; border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-on-primary); display: grid; place-items: center; font-size: 22px; font-weight: 600; }
.meta { min-width: 0; }
.nick { margin: 0 0 2px; font-size: var(--font-size-section); font-weight: 600; }
.email { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); word-break: break-all; }
.id { margin: 2px 0 0; font-size: var(--font-size-label); color: var(--color-outline); }
.chip { padding: 4px 10px; border-radius: var(--radius-full); font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); }
.chip.ok { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.chip.warn { background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); }
.menu { list-style: none; margin: 0; padding: 0; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-paper); }
.item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-md); border-bottom: 1px solid var(--color-surface-container-high); cursor: pointer; transition: background var(--duration-fast); }
.item:last-child { border-bottom: 0; }
.item:active { background: var(--color-surface-container); }
.arrow { color: var(--color-outline); font-size: 20px; }
.ghost { height: 56px; border-radius: var(--radius-md); background: transparent; color: var(--color-error); border: 1px solid var(--color-outline-variant); font-size: var(--font-size-body); }
.foot { text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); margin: 0; }
</style>
