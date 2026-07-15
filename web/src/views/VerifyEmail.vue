<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '@/api/auth';
import { pickErrMsg } from '@/api/http';

const route = useRoute();
const router = useRouter();

const state = ref<'loading' | 'ok' | 'fail'>('loading');
const email = ref('');
const err = ref('');

onMounted(async () => {
  const t = (route.query.token as string) ?? '';
  if (!t) { state.value = 'fail'; err.value = '缺少验证参数'; return; }
  try {
    const r = await authApi.verify(t);
    email.value = r.email;
    state.value = 'ok';
    setTimeout(() => router.replace('/login'), 3_000);
  } catch (e) {
    state.value = 'fail';
    err.value = pickErrMsg(e, '验证失败');
  }
});
</script>

<template>
  <section class="wrap">
    <div class="center">
      <template v-if="state === 'loading'">
        <div class="spinner" aria-hidden="true"></div>
        <p class="hint">正在验证…</p>
      </template>
      <template v-else-if="state === 'ok'">
        <div class="mark ok">✓</div>
        <h1 class="title">邮箱已激活</h1>
        <p class="hint">{{ email }} 已完成验证 · 即将跳转登录</p>
      </template>
      <template v-else>
        <div class="mark bad">×</div>
        <h1 class="title">验证失败</h1>
        <p class="hint">{{ err }}</p>
        <button class="primary" @click="router.push('/register')">重新注册</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; display: grid; place-items: center; padding: var(--space-margin-mobile); background: var(--page-gradient); color: var(--color-on-surface); }
.center { display: grid; place-items: center; gap: var(--space-md); text-align: center; }
.mark { width: 72px; height: 72px; display: grid; place-items: center; border-radius: var(--radius-full); font-size: 40px; }
.mark.ok { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.mark.bad { background: var(--color-error-container); color: var(--color-on-error-container); }
.spinner { width: 40px; height: 40px; border: 3px solid var(--color-outline-variant); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.title { font-size: var(--font-size-title); line-height: var(--line-height-title); margin: 0; font-weight: 600; }
.hint { margin: 0; color: var(--color-on-surface-variant); font-size: var(--font-size-body); max-width: 28em; }
.primary { margin-top: var(--space-md); height: 52px; padding: 0 var(--space-xl); border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; }
</style>
