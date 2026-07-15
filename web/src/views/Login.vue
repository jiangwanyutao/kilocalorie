<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { pickErrMsg } from '@/api/http';
import AppHeader from '@/components/AppHeader.vue';
import EmailInput from '@/components/EmailInput.vue';
import PasswordInput from '@/components/PasswordInput.vue';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const submitting = ref(false);
const errMsg = ref('');

async function submit() {
  errMsg.value = '';
  if (!email.value.includes('@')) {
    errMsg.value = '请填写完整邮箱';
    return;
  }
  submitting.value = true;
  try {
    await auth.login(email.value, password.value);
    router.replace('/');
  } catch (e) {
    errMsg.value = pickErrMsg(e, '登录失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="登录" back-to="/welcome" />

    <div class="body">
    <div class="hero">
      <p class="eyebrow">欢迎回来</p>
      <h1 class="title">继续写下一页</h1>
    </div>

    <div class="form">
      <div class="field">
        <span class="lbl">邮箱</span>
        <EmailInput v-model="email" autocomplete="email" />
      </div>
      <label class="field">
        <span class="lbl">密码</span>
        <PasswordInput v-model="password" autocomplete="current-password" required placeholder="至少 8 位" />
      </label>
      <p v-if="errMsg" class="err">{{ errMsg }}</p>
      <button type="button" class="primary" :disabled="submitting" @click="submit">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
      <div class="foot">
        <router-link to="/forgot">忘记密码</router-link>
        <span class="dot">·</span>
        <router-link to="/register">注册新账号</router-link>
      </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: 0 var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-xl)); display: flex; flex-direction: column; gap: var(--space-lg); }
.hero { padding-top: var(--space-md); }
.eyebrow { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-primary); margin: 0 0 var(--space-sm); }
.title { font-size: var(--font-size-hero); line-height: var(--line-height-hero); letter-spacing: var(--letter-spacing-hero); font-weight: 600; margin: 0; }
.form { display: flex; flex-direction: column; gap: var(--space-md); }
.field { display: flex; flex-direction: column; gap: var(--space-xs); }
.lbl { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-on-surface-variant); }
input { height: 52px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); color: var(--color-on-surface); transition: border-color var(--duration-fast) var(--ease-out-expo); }
input:focus { outline: none; border-color: var(--color-primary); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }
.primary { height: 56px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); transition: transform var(--duration-fast) var(--ease-out-expo); }
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: .5; }
.foot { display: flex; justify-content: center; align-items: center; gap: var(--space-sm); margin-top: var(--space-sm); font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.foot a { color: var(--color-primary); text-decoration: none; }
.foot .dot { color: var(--color-outline-variant); }
</style>
