<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import { pickErrMsg } from '@/api/http';

const router = useRouter();
const auth = useAuthStore();

const oldPwd = ref('');
const newPwd = ref('');
const confirm = ref('');
const showOld = ref(false);
const showNew = ref(false);
const submitting = ref(false);
const errMsg = ref('');

const newLenOk = computed(() => newPwd.value.length >= 8 && newPwd.value.length <= 64);
const newMixOk = computed(() => /[A-Za-z]/.test(newPwd.value) && /\d/.test(newPwd.value));
const matchOk = computed(() => confirm.value.length > 0 && confirm.value === newPwd.value);
const notSameOk = computed(() => !oldPwd.value || !newPwd.value || oldPwd.value !== newPwd.value);

const canSubmit = computed(
  () =>
    oldPwd.value.length >= 1 &&
    newLenOk.value &&
    newMixOk.value &&
    matchOk.value &&
    notSameOk.value,
);

async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  submitting.value = true;
  errMsg.value = '';
  try {
    await authApi.changePassword(oldPwd.value, newPwd.value);
    auth.logout();
    router.replace({ path: '/login', query: { pwd: 'changed' } });
  } catch (e) {
    errMsg.value = pickErrMsg(e, '修改失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="修改密码" back-to="/me" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <div class="hero-card">
        <p class="hero-title">保护你的日记</p>
        <p class="hero-sub">修改成功后需要重新登录，其他设备上的登录也会同步失效</p>
      </div>

      <div class="field">
        <label class="lbl" for="old">当前密码</label>
        <div class="pwd-row">
          <input
            id="old"
            v-model="oldPwd"
            :type="showOld ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="请输入当前密码"
          />
          <button type="button" class="eye" @click="showOld = !showOld" aria-label="切换显示">
            {{ showOld ? '隐藏' : '显示' }}
          </button>
        </div>
      </div>

      <div class="field">
        <label class="lbl" for="new">新密码</label>
        <div class="pwd-row">
          <input
            id="new"
            v-model="newPwd"
            :type="showNew ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="8-64 位，含字母和数字"
          />
          <button type="button" class="eye" @click="showNew = !showNew" aria-label="切换显示">
            {{ showNew ? '隐藏' : '显示' }}
          </button>
        </div>
        <ul class="rules">
          <li :class="{ ok: newLenOk }">
            <span class="dot" /> 长度 8-64 位
          </li>
          <li :class="{ ok: newMixOk }">
            <span class="dot" /> 至少含 1 个字母 + 1 个数字
          </li>
          <li :class="{ ok: notSameOk }">
            <span class="dot" /> 不能与当前密码相同
          </li>
        </ul>
      </div>

      <div class="field">
        <label class="lbl" for="conf">再次输入</label>
        <div class="pwd-row">
          <input
            id="conf"
            v-model="confirm"
            :type="showNew ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="再次输入新密码"
          />
        </div>
        <p v-if="confirm.length > 0 && !matchOk" class="hint warn">两次输入不一致</p>
      </div>

      <div class="cta">
        <button type="button" class="ghost" @click="router.push('/me')">取消</button>
        <button
          type="button"
          class="primary"
          :disabled="!canSubmit || submitting"
          @click="submit"
        >{{ submitting ? '修改中…' : '确认修改' }}</button>
      </div>

      <p class="link">
        <router-link to="/forgot">忘记当前密码?</router-link>
      </p>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body {
  padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 120px);
  display: flex; flex-direction: column; gap: 16px;
}

.err {
  margin: 0; padding: 10px 14px;
  background: var(--color-error-container); color: var(--color-on-error-container);
  border-radius: var(--radius-default); font-size: var(--font-size-caption);
}

.hero-card {
  padding: 18px 20px;
  border-radius: 22px;
  background: linear-gradient(140deg, #fff4cc 0%, #ffe0d5 60%, rgba(255,255,255,0.7) 100%);
  box-shadow: 0 16px 32px -22px rgba(255, 180, 60, 0.4);
}
.hero-title { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: var(--color-on-surface); }
.hero-sub { margin: 0; font-size: 12px; color: var(--color-on-surface-variant); line-height: 1.5; }

.field {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 20px;
  box-shadow: 0 12px 26px -18px rgba(120, 90, 200, 0.16);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.lbl {
  font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--color-on-surface-variant); font-weight: 500;
}
.pwd-row { position: relative; display: flex; align-items: center; }
input {
  flex: 1; height: 48px; padding: 0 68px 0 14px;
  border-radius: 14px; border: 1px solid rgba(120,90,200,0.14);
  background: rgba(255, 255, 255, 0.55);
  font-size: 15px; color: var(--color-on-surface);
  font-family: var(--font-family-num);
}
input:focus { outline: none; border-color: var(--color-primary); background: #fff; }
.eye {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  height: 34px; padding: 0 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(120,90,200,0.14);
  border-radius: 999px;
  font-size: 12px; color: var(--color-on-surface-variant);
}
.eye:active { background: rgba(255, 224, 213, 0.5); }

.rules { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.rules li { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-outline); }
.rules li .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(120,90,200,0.2); transition: background var(--duration-fast);
}
.rules li.ok { color: #4a7a1a; }
.rules li.ok .dot { background: #7cbb3b; }

.hint { margin: 0; font-size: 11px; color: var(--color-outline); letter-spacing: 0.03em; }
.hint.warn { color: var(--color-error); }

.cta { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-top: 4px; }
.ghost {
  height: 52px; border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-on-surface-variant);
  border: 1px solid rgba(120,90,200,0.14);
  font-size: 15px;
}
.primary {
  height: 52px; border-radius: 18px;
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  font-size: 15px; font-weight: 600; letter-spacing: 0.02em;
  box-shadow: 0 12px 22px -12px rgba(165, 51, 20, 0.5);
  transition: transform var(--duration-fast);
}
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: 0.5; box-shadow: none; }

.link { text-align: center; margin: 4px 0 0; font-size: 12px; }
.link a { color: var(--color-primary); text-decoration: none; }
</style>
