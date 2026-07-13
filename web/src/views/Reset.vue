<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '@/api/auth';
import { pickErrMsg } from '@/api/http';
import AppHeader from '@/components/AppHeader.vue';
import PasswordInput from '@/components/PasswordInput.vue';

const route = useRoute();
const router = useRouter();

const token = computed(() => (route.query.token as string) ?? '');
const p1 = ref('');
const p2 = ref('');
const submitting = ref(false);
const errMsg = ref('');
const done = ref(false);

async function submit() {
  errMsg.value = '';
  if (!token.value) { errMsg.value = '缺少 token'; return; }
  if (p1.value !== p2.value) { errMsg.value = '两次输入不一致'; return; }
  submitting.value = true;
  try {
    await authApi.reset(token.value, p1.value);
    done.value = true;
    setTimeout(() => router.replace('/login'), 2_500);
  } catch (e) {
    errMsg.value = pickErrMsg(e, '重置失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="重置密码" back-to="/login" />

    <div class="body">
    <div v-if="!done">
      <div class="hero">
        <p class="eyebrow">重置密码</p>
        <h1 class="title">设置新密码</h1>
      </div>
      <div class="form">
        <label class="field">
          <span class="lbl">新密码</span>
          <PasswordInput v-model="p1" autocomplete="new-password" required placeholder="8-64 位 · 含字母和数字" />
        </label>
        <label class="field">
          <span class="lbl">再次输入</span>
          <PasswordInput v-model="p2" autocomplete="new-password" required placeholder="确认" />
        </label>
        <p v-if="errMsg" class="err">{{ errMsg }}</p>
        <button type="button" class="primary" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中…' : '重置密码' }}
        </button>
      </div>
    </div>

    <div v-else class="done">
      <div class="mark">✓</div>
      <h1 class="title">密码已更新</h1>
      <p class="hint">即将跳转登录…</p>
    </div>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
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
.hint { color: var(--color-on-surface-variant); margin: 0; }
</style>
