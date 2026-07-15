<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/stores/auth';
import { pickErrMsg } from '@/api/http';

const router = useRouter();
const auth = useAuthStore();

const emailInput = ref('');
const agree = ref(false);
const submitting = ref(false);
const errMsg = ref('');
const purgeDate = ref('');

const targetEmail = computed(() => auth.user?.email ?? '');
const emailMatch = computed(
  () => emailInput.value.trim().toLowerCase() === targetEmail.value.toLowerCase(),
);
const canSubmit = computed(() => emailMatch.value && agree.value && !submitting.value);

async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  const sure = window.confirm(
    `确认注销账号 ${targetEmail.value}?\n\n· 30 天内无法登录（冷静期）\n· 30 天后所有数据将被物理删除\n· 此操作在冷静期内可联系客服撤销`,
  );
  if (!sure) return;
  submitting.value = true;
  errMsg.value = '';
  try {
    const r = await userApi.deleteAccount();
    purgeDate.value = new Date(r.scheduledPurgeAt).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    setTimeout(() => {
      auth.logout();
      router.replace('/welcome');
    }, 3200);
  } catch (e) {
    errMsg.value = pickErrMsg(e, '注销失败');
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="注销账号" back-to="/me" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <div v-if="purgeDate" class="done-card">
        <div class="done-mark">✓</div>
        <p class="done-title">注销申请已提交</p>
        <p class="done-sub">你的数据将于 <b>{{ purgeDate }}</b> 之前完全清除</p>
        <p class="done-hint">正在退出登录…</p>
      </div>

      <template v-else>
        <div class="warn-card">
          <p class="warn-title">⚠︎ 注销后果</p>
          <ul class="warn-list">
            <li>账号立即冻结，无法再登录</li>
            <li>饮食 / 体重 / 运动 / AI 对话所有数据将进入 30 天冷静期</li>
            <li>30 天后所有数据将被 <b>物理删除</b>，无法恢复</li>
            <li>冷静期内如需撤销，请联系客服邮箱</li>
          </ul>
        </div>

        <div class="tip-card">
          <p class="tip-title">在注销前，建议先备份数据</p>
          <button type="button" class="tip-btn" @click="router.push('/export')">
            <span>📦 一键导出全部数据</span>
            <span class="tip-arrow">›</span>
          </button>
        </div>

        <div class="field">
          <label class="lbl" for="mail">
            请输入你的邮箱 <span class="hint">（{{ targetEmail || '—' }}）</span>
          </label>
          <input
            id="mail"
            v-model="emailInput"
            type="email"
            inputmode="email"
            autocomplete="off"
            :placeholder="targetEmail || '你的注册邮箱'"
          />
        </div>

        <label class="agree">
          <input v-model="agree" type="checkbox" />
          <span>我已知晓并同意 <b>永久注销</b> 我的账号</span>
        </label>

        <div class="cta">
          <button type="button" class="ghost" @click="router.push('/me')">取消</button>
          <button
            type="button"
            class="danger"
            :disabled="!canSubmit"
            @click="submit"
          >{{ submitting ? '注销中…' : '确认注销账号' }}</button>
        </div>
      </template>
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

.warn-card {
  padding: 18px 20px;
  border-radius: 22px;
  background: linear-gradient(140deg, #ffe0d5 0%, rgba(255,255,255,0.72) 60%);
  box-shadow: 0 16px 32px -22px rgba(198, 75, 42, 0.24);
  border: 1px solid rgba(198, 75, 42, 0.14);
}
.warn-title { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: var(--color-error); }
.warn-list { margin: 0; padding: 0 0 0 18px; font-size: 13px; color: var(--color-on-surface); line-height: 1.7; }
.warn-list b { color: var(--color-error); }

.tip-card {
  padding: 14px 16px;
  border-radius: 20px;
  background: linear-gradient(140deg, #fff4cc 0%, rgba(255,255,255,0.72) 60%);
  box-shadow: 0 12px 26px -18px rgba(255, 180, 60, 0.4);
}
.tip-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--color-on-surface); }
.tip-btn {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  height: 44px; padding: 0 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 0; border-radius: 14px;
  color: var(--color-on-surface); font-size: 13px; font-weight: 500;
}
.tip-arrow { color: var(--color-outline); font-size: 18px; }

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
.lbl .hint { text-transform: none; letter-spacing: 0; color: var(--color-primary); font-weight: 600; font-family: var(--font-family-num); }
input[type="email"] {
  height: 48px; padding: 0 14px;
  border-radius: 14px; border: 1px solid rgba(120,90,200,0.14);
  background: rgba(255, 255, 255, 0.55);
  font-size: 15px; color: var(--color-on-surface);
  font-family: var(--font-family-num);
}
input[type="email"]:focus { outline: none; border-color: var(--color-primary); background: #fff; }

.agree {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(120,90,200,0.14);
  font-size: 13px; color: var(--color-on-surface); cursor: pointer;
}
.agree input { width: 20px; height: 20px; accent-color: var(--color-error); }
.agree b { color: var(--color-error); }

.cta { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-top: 4px; }
.ghost {
  height: 52px; border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-on-surface-variant);
  border: 1px solid rgba(120,90,200,0.14);
  font-size: 15px;
}
.danger {
  height: 52px; border-radius: 18px;
  background: linear-gradient(140deg, #c64b2a 0%, #a53314 100%);
  color: #fff;
  font-size: 15px; font-weight: 600; letter-spacing: 0.02em;
  box-shadow: 0 12px 22px -12px rgba(165, 51, 20, 0.6);
  transition: transform var(--duration-fast);
}
.danger:active { transform: scale(0.98); }
.danger:disabled { opacity: 0.4; box-shadow: none; background: #b4b4b4; }

.done-card {
  padding: 28px 20px; text-align: center;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 20px 40px -18px rgba(120, 90, 200, 0.24);
}
.done-mark {
  width: 64px; height: 64px; margin: 0 auto 12px;
  display: grid; place-items: center;
  border-radius: 999px;
  background: linear-gradient(140deg, #e6f5d5 0%, #7cbb3b 100%);
  color: #fff; font-size: 32px;
  box-shadow: 0 12px 22px -8px rgba(124, 187, 59, 0.5);
}
.done-title { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
.done-sub { margin: 0 0 12px; font-size: 13px; color: var(--color-on-surface-variant); }
.done-sub b { color: var(--color-primary); font-family: var(--font-family-num); }
.done-hint { margin: 0; font-size: 12px; color: var(--color-outline); }
</style>
