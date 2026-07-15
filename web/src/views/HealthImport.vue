<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { healthApi, type HealthImportRow } from '@/api/user';
import { pickErrMsg, KEY } from '@/api/http';

const rows = ref<HealthImportRow[]>([]);
const loading = ref(true);
const errMsg = ref('');
const copied = ref<string>('');

const token = ref<string>('');
const baseUrl = ref<string>('');

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    token.value = localStorage.getItem(KEY.access) ?? '';
    baseUrl.value = `${location.origin}/api`;
    rows.value = await healthApi.imports(90);
  } catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

const endpoint = computed(() => `${baseUrl.value}/health/samples`);

const samplePayload = computed(() => JSON.stringify({
  samples: [
    { type: 'weight', value: 68.5, unit: 'kg', date: new Date().toISOString(), source: 'iOS Health' },
    { type: 'steps', value: 8432, unit: 'count', date: new Date().toISOString(), source: 'Apple Watch' },
  ],
}, null, 2));

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = label;
    setTimeout(() => { if (copied.value === label) copied.value = ''; }, 1500);
  } catch {
    errMsg.value = '复制失败 · 请手动选中复制';
  }
}

function fmt(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusChip(s: string): { label: string; cls: string } {
  if (s === 'S') return { label: '✓ 成功', cls: 's-S' };
  if (s === 'F') return { label: '✗ 失败', cls: 's-F' };
  return { label: '⏳ 处理中', cls: 's-P' };
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="Apple 健康数据导入" back-to="/me" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section class="hero">
        <div class="h-icon" aria-hidden="true">❤️</div>
        <div>
          <p class="h-title">用 iOS 快捷指令自动同步</p>
          <p class="h-hint">iPhone 「快捷指令」App 设置一个自动化 · 每天推送体重 + 步数 · 千卡日记会自动落库</p>
        </div>
      </section>

      <router-link to="/health/import-xml" class="xml-link">
        <span class="xl-icon">📥</span>
        <div class="xl-body">
          <p class="xl-title">或者一次性导入所有历史</p>
          <p class="xl-hint">iPhone 健康 App → 导出所有数据 → 上传 zip · 几年数据一次拿</p>
        </div>
        <span class="xl-caret">›</span>
      </router-link>

      <section class="creds">
        <h3 class="c-title">Shortcut 里要填这 2 个</h3>
        <div class="c-row">
          <div class="c-lbl">Endpoint URL</div>
          <code class="c-val">{{ endpoint }}</code>
          <button class="copy" @click="copy(endpoint, 'url')">
            <template v-if="copied === 'url'">✓</template><template v-else>复制</template>
          </button>
        </div>
        <div class="c-row">
          <div class="c-lbl">Authorization</div>
          <code class="c-val truncate">Bearer {{ token.slice(0, 20) }}...</code>
          <button class="copy" @click="copy('Bearer ' + token, 'auth')">
            <template v-if="copied === 'auth'">✓</template><template v-else>复制</template>
          </button>
        </div>
      </section>

      <section class="guide">
        <h3 class="g-title">6 步搞定</h3>
        <ol class="steps">
          <li>iPhone 打开「快捷指令」App · 右上角 + 新建</li>
          <li>加动作：<b>"查找体重样本"</b>（起 · 昨天 0 点 · 止 · 现在）</li>
          <li>再加：<b>"查找步数样本"</b>（时间段同上）</li>
          <li>加动作：<b>"获取字典的值"</b> · 组装成 JSON（示例见下）</li>
          <li>加动作：<b>"获取 URL 内容"</b>
            <ul>
              <li>URL：粘上面 Endpoint</li>
              <li>方法：POST</li>
              <li>Header：Authorization = 上面 Bearer token</li>
              <li>Body：JSON · 结构同下面示例</li>
            </ul>
          </li>
          <li>「自动化」→ 每天 08:00 触发 · 一劳永逸</li>
        </ol>
      </section>

      <section class="sample">
        <div class="sm-head">
          <h3 class="sm-title">Body JSON 示例</h3>
          <button class="copy" @click="copy(samplePayload, 'body')">
            <template v-if="copied === 'body'">✓ 已复制</template><template v-else>复制</template>
          </button>
        </div>
        <pre><code>{{ samplePayload }}</code></pre>
        <p class="sm-note">type 支持：<span class="num">weight</span>（kg）· <span class="num">steps</span>（步数）· value 是数字 · date ISO 8601 · 同一天重复推自动去重</p>
      </section>

      <section v-if="rows.length" class="history">
        <h3 class="hi-title">导入历史 · <span class="num">{{ rows.length }}</span></h3>
        <ul>
          <li v-for="r in rows" :key="r.id" class="row">
            <div class="r-body">
              <p class="r-time num">{{ fmt(r.createTime) }}</p>
              <p class="r-counts num">
                体重 <b>{{ r.weightCnt }}</b> · 步数 <b>{{ r.stepsCnt }}</b>
                <span v-if="r.errorMsg" class="r-err">{{ r.errorMsg }}</span>
              </p>
            </div>
            <span :class="['chip', statusChip(r.importStatus).cls]">{{ statusChip(r.importStatus).label }}</span>
          </li>
        </ul>
      </section>

      <p v-else-if="!loading" class="empty">还没有导入过 · 配好 Shortcut 试试</p>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.hero { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; padding: 16px 18px; background: linear-gradient(140deg, var(--color-error-container) 0%, var(--color-primary-container) 100%); border-radius: var(--radius-xl); border: 1px solid rgba(29,25,23,0.08); box-shadow: 0 8px 24px rgba(165,51,20,0.15); }
.h-icon { width: 56px; height: 56px; display: grid; place-items: center; background: var(--color-surface-container-lowest); border-radius: 20px; font-size: 28px; }
.h-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-primary-container); }
.h-hint { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-primary-container); opacity: 0.85; line-height: 1.45; }

.xml-link { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 14px 16px; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); text-decoration: none; color: var(--color-on-surface); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); transition: transform var(--duration-fast); }
.xml-link:active { transform: scale(0.99); }
.xl-icon { width: 44px; height: 44px; display: grid; place-items: center; background: var(--color-primary-fixed); border-radius: 14px; font-size: 22px; }
.xl-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.xl-hint { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); line-height: 1.4; }
.xl-caret { color: var(--color-outline); font-size: 22px; font-weight: 300; }

.creds { padding: 14px; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(29,25,23,0.06); }
.c-title { margin: 0 0 10px; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.c-row { display: grid; grid-template-columns: 80px 1fr auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.c-row:last-child { border-bottom: 0; }
.c-lbl { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-surface-variant); }
.c-val { font-family: var(--font-family-num); font-size: 12px; color: var(--color-on-surface); background: var(--color-surface-container); padding: 4px 8px; border-radius: var(--radius-default); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.truncate { max-width: 100%; }
.copy { padding: 6px 12px; border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-label); font-weight: 500; }
.copy:active { transform: scale(0.94); }

.guide { padding: 14px 16px; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(29,25,23,0.06); }
.g-title { margin: 0 0 10px; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.steps { margin: 0; padding-left: 22px; }
.steps > li { font-size: var(--font-size-caption); line-height: 1.7; color: var(--color-on-surface); padding: 2px 0; }
.steps b { color: var(--color-primary); font-weight: 600; }
.steps ul { margin: 4px 0; padding-left: 20px; }
.steps ul li { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-surface-variant); }

.sample { padding: 14px; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(29,25,23,0.06); }
.sm-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sm-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.sample pre { margin: 0; background: var(--color-surface-container); padding: 10px 12px; border-radius: var(--radius-default); overflow-x: auto; font-size: 11px; line-height: 1.5; }
.sample code { font-family: var(--font-family-num); color: var(--color-on-surface); }
.sm-note { margin: 8px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }
.sm-note .num { font-family: var(--font-family-num); color: var(--color-primary); font-weight: 500; }

.history { padding: 14px; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(29,25,23,0.06); }
.hi-title { margin: 0 0 8px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.hi-title .num { color: var(--color-primary); font-weight: 700; }
.history ul { list-style: none; margin: 0; padding: 0; }
.row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-surface-container-high); }
.row:last-child { border-bottom: 0; }
.r-time { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.r-counts { margin: 2px 0 0; font-size: var(--font-size-caption); color: var(--color-on-surface); font-family: var(--font-family-num); }
.r-counts b { color: var(--color-primary); font-weight: 600; }
.r-err { display: block; margin-top: 4px; font-size: var(--font-size-label); color: var(--color-error); }
.chip { padding: 3px 8px; border-radius: var(--radius-full); font-size: 10px; letter-spacing: 0.05em; font-weight: 500; }
.chip.s-S { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.chip.s-F { background: var(--color-error-container); color: var(--color-on-error-container); }
.chip.s-P { background: var(--color-surface-container-high); color: var(--color-on-surface-variant); }

.empty { margin: 0; padding: 20px 0; text-align: center; color: var(--color-on-surface-variant); font-size: var(--font-size-caption); }
</style>
