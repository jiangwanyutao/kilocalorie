<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@/api/auth';
import { pickErrMsg } from '@/api/http';
import AppHeader from '@/components/AppHeader.vue';
import EmailInput from '@/components/EmailInput.vue';
import PasswordInput from '@/components/PasswordInput.vue';

const router = useRouter();

const email = ref('');
const password = ref('');
const nickname = ref('');
const submitting = ref(false);
const errMsg = ref('');
const done = ref<{ email: string } | null>(null);

async function submit() {
  errMsg.value = '';
  if (!email.value.includes('@')) {
    errMsg.value = '请填写完整邮箱';
    return;
  }
  submitting.value = true;
  try {
    const u = await authApi.register(email.value, password.value, nickname.value.trim());
    done.value = { email: u.email };
  } catch (e) {
    errMsg.value = pickErrMsg(e, '注册失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="注册账号" back-to="/welcome" />

    <div v-if="!done" class="body">
      <div class="hero">
        <p class="eyebrow">开始写下第一页</p>
        <h1 class="title">创建账号</h1>
      </div>

      <div class="form">
        <div class="field">
          <span class="lbl">邮箱</span>
          <EmailInput v-model="email" autocomplete="email" />
        </div>
        <label class="field">
          <span class="lbl">昵称</span>
          <input v-model="nickname" type="text" required maxlength="30" placeholder="想让搭子怎么叫你" />
        </label>
        <label class="field">
          <span class="lbl">密码</span>
          <PasswordInput v-model="password" autocomplete="new-password" required placeholder="8-64 位 · 含字母和数字" />
        </label>
        <p v-if="errMsg" class="err">{{ errMsg }}</p>
        <button type="button" class="primary" :disabled="submitting" @click="submit">
          {{ submitting ? '注册中…' : '注册 · 发送验证邮件' }}
        </button>
        <p class="foot">
          已有账号？<router-link to="/login">直接登录</router-link>
        </p>
      </div>
    </div>

    <div v-else class="done">
      <div class="mark">✓</div>
      <h1 class="title">验证邮件已发出</h1>
      <p class="hint">
        我们给 <strong>{{ done.email }}</strong> 发了一封激活邮件。<br />
        点邮件里的按钮激活账号，之后回来登录即可。
      </p>
      <p class="tip">收不到？看看垃圾邮件文件夹，或稍后重试。</p>
      <button class="primary" @click="router.push('/login')">我已激活 · 去登录</button>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: 0 var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-xl)); }
.hero { padding: var(--space-md) 0 var(--space-lg); }
.eyebrow { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-primary); margin: 0 0 var(--space-sm); }
.title { font-size: var(--font-size-hero); line-height: var(--line-height-hero); letter-spacing: var(--letter-spacing-hero); font-weight: 600; margin: 0; }
.form { display: flex; flex-direction: column; gap: var(--space-md); }
.field { display: flex; flex-direction: column; gap: var(--space-xs); }
.lbl { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-on-surface-variant); }
input { height: 52px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); color: var(--color-on-surface); }
input:focus { outline: none; border-color: var(--color-primary); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }
.primary { height: 56px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: .5; }
.foot { text-align: center; margin: var(--space-sm) 0 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.foot a { color: var(--color-primary); text-decoration: none; }
.done { display: grid; place-items: center; gap: var(--space-md); padding-top: 20vh; text-align: center; }
.mark { width: 72px; height: 72px; display: grid; place-items: center; border-radius: var(--radius-full); background: var(--color-secondary-container); color: var(--color-on-secondary-container); font-size: 40px; }
.done .title { font-size: var(--font-size-title); line-height: var(--line-height-title); }
.hint { font-size: var(--font-size-body); color: var(--color-on-surface); max-width: 28em; margin: 0; }
.tip { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); margin: 0; }
.done .primary { margin-top: var(--space-md); padding: 0 var(--space-xl); width: 100%; max-width: 280px; }
</style>
