<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { userApi, type ExportBundle } from '@/api/user';
import { pickErrMsg } from '@/api/http';

const bundle = ref<ExportBundle | null>(null);
const loading = ref(true);
const errMsg = ref('');
const downloaded = ref(false);

const LABEL: Record<string, string> = {
  goals: '目标（含历史版本）',
  meals: '饮食记录',
  mealItems: '饮食条目',
  waters: '喝水记录',
  exercises: '运动记录',
  weights: '体重记录',
  measures: '围度记录',
  fasts: '轻断食会话',
  conversations: 'AI 对话',
  messages: 'AI 消息',
  memories: 'AI 记忆',
  memoryLogs: '记忆变更历史',
};

async function load() {
  loading.value = true;
  errMsg.value = '';
  try { bundle.value = await userApi.exportAll(); }
  catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

const counts = computed(() => {
  const c = bundle.value?._meta?.counts ?? {};
  return Object.entries(LABEL).map(([k, label]) => ({ key: k, label, n: c[k] ?? 0 }));
});
const totalRecords = computed(() =>
  counts.value.reduce((s, r) => s + r.n, 0),
);

function download() {
  if (!bundle.value) return;
  const json = JSON.stringify(bundle.value, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `qianka-diary-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  downloaded.value = true;
}

const sizeKb = computed(() => {
  if (!bundle.value) return 0;
  const bytes = new Blob([JSON.stringify(bundle.value)]).size;
  return Math.round((bytes / 1024) * 10) / 10;
});
</script>

<template>
  <section class="wrap">
    <AppHeader title="数据导出" back-to="/me" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section class="hero">
        <div class="h-icon" aria-hidden="true">📦</div>
        <div>
          <p class="h-title">导出你的所有数据</p>
          <p class="h-hint">这是你说的算的数据 · 全部打包一个 JSON 文件 · 你可以拿走存自己电脑 · 或导入到别的工具</p>
        </div>
      </section>

      <section v-if="bundle" class="summary">
        <div class="s-head">
          <h3 class="s-title">包含内容</h3>
          <span class="s-size num">{{ sizeKb }} KB</span>
        </div>
        <ul class="items">
          <li v-for="c in counts" :key="c.key" :class="['item', { zero: c.n === 0 }]">
            <span class="i-label">{{ c.label }}</span>
            <span class="i-count num">{{ c.n }}</span>
          </li>
        </ul>
        <p class="total num">共 {{ totalRecords }} 条记录</p>
      </section>

      <button type="button" class="primary" :disabled="!bundle" @click="download">
        <template v-if="downloaded">✓ 已下载 · 再来一次</template>
        <template v-else>下载 JSON</template>
      </button>

      <section class="note">
        <p class="n-title">关于这份文件</p>
        <ul>
          <li>软删除的数据不会带走（你主动删的东西就是删了）</li>
          <li>头像 · 照片等文件不在里面（只有元数据）· 需另外下</li>
          <li>密码 hash · JWT · 会话 token 不在里面（安全考虑）</li>
          <li>格式 <span class="num">qianka-full-export/v1</span> · 未来版本可自动升级</li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 120px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.hero {
  display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center;
  padding: 16px 18px;
  background: linear-gradient(140deg, var(--color-primary-container) 0%, var(--color-tertiary-container) 100%);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(29, 25, 23, 0.08);
  box-shadow: 0 8px 24px rgba(165, 51, 20, 0.15);
}
.h-icon { width: 56px; height: 56px; display: grid; place-items: center; background: var(--color-surface-container-lowest); border-radius: 20px; font-size: 28px; }
.h-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-primary-container); }
.h-hint { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-primary-container); opacity: 0.85; line-height: 1.45; }

.summary {
  padding: 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
}
.s-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.s-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.s-size { font-size: var(--font-size-caption); font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }

.items { list-style: none; margin: 0; padding: 0; }
.item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.item:last-child { border-bottom: 0; }
.item.zero { color: var(--color-outline); }
.i-label { font-size: var(--font-size-caption); }
.i-count { font-family: var(--font-family-num); font-weight: 600; color: var(--color-primary); }
.item.zero .i-count { color: var(--color-outline); font-weight: 400; }
.total { margin: 10px 0 0; text-align: right; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }

.primary { height: 52px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: 0 8px 20px rgba(165, 51, 20, 0.32); }
.primary:disabled { opacity: 0.5; box-shadow: none; }
.primary:active:not(:disabled) { transform: scale(0.98); }

.note {
  padding: 14px 16px;
  background: var(--color-surface-container);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-outline-variant);
}
.n-title { margin: 0 0 6px; font-size: var(--font-size-label); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-on-surface-variant); font-weight: 500; }
.note ul { margin: 0; padding-left: 20px; }
.note li { font-size: var(--font-size-caption); color: var(--color-on-surface); line-height: 1.6; }
.note .num { font-family: var(--font-family-num); background: var(--color-primary-fixed); padding: 1px 6px; border-radius: var(--radius-default); font-size: 11px; }
</style>
