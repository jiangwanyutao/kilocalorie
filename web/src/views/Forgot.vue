<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@/api/auth';
import { pickErrMsg } from '@/api/http';
import AppHeader from '@/components/AppHeader.vue';

const router = useRouter();

const email = ref('');
const submitting = ref(false);
const errMsg = ref('');
const done = ref(false);

async function submit() {
  errMsg.value = '';
  submitting.value = true;
  try {
    await authApi.forgot(email.value.trim());
    done.value = true;
  } catch (e) {
    errMsg.value = pickErrMsg(e, '提交失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="找回密码" back-to="/login" />

    <div class="body">
    <div v-if="!done">
      <div class="hero">
        <p class="eyebrow">找回密码</p>
        <h1 class="title">输入注册邮箱</h1>
      </div>
      <div class="form">
        <label class="field">
          <span class="lbl">邮箱</span>
          <input v-model="email" type="email" autocomplete="email" required placeholder="you@example.com" />
        </label>
        <p v-if="errMsg" class="err">{{ errMsg }}</p>
        <button type="button" class="primary" :disabled="submitting" @click="submit">
          {{ submitting ? '发送中…' : '发送重置邮件' }}
        </button>
      </div>
    </div>

    <div v-else class="done">
      <div class="mark">✓</div>
      <h1 class="title">已发送</h1>
      <p class="hint">
        如果 <strong>{{ email }}</strong> 是注册邮箱，你会收到一封重置邮件。<br />
        链接 30 分钟内有效。
      </p>
      <button class="primary" @click="router.push('/login')">回到登录</button>
    </div>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: 0 var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-xl)); }
.hero { padding: var(--space-md) 0 var(--space-lg); }
.eyebrow { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-primary); margin: 0 0 var(--space-sm); }
.title { font-size: var(--font-size-hero); line-height: var(--line-height-hero); letter-spacing: var(--letter-spacing-hero); margin: 0; font-weight: 600; }
.form { display: flex; flex-direction: column; gap: var(--space-md); }
.field { display: flex; flex-direction: column; gap: var(--space-xs); }
.lbl { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-on-surface-variant); }
input { height: 52px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); }
input:focus { outline: none; border-color: var(--color-primary); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }
.primary { height: 56px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: .5; }
.done { display: grid; place-items: center; gap: var(--space-md); padding-top: 20vh; text-align: center; }
.mark { width: 72px; height: 72px; display: grid; place-items: center; border-radius: var(--radius-full); background: var(--color-secondary-container); color: var(--color-on-secondary-container); font-size: 40px; }
.done .title { font-size: var(--font-size-title); line-height: var(--line-height-title); }
.hint { margin: 0; color: var(--color-on-surface-variant); max-width: 28em; }
.done .primary { max-width: 280px; width: 100%; margin-top: var(--space-md); }
</style>
