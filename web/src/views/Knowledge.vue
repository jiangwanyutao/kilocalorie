<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { kbApi, type KbDoc } from '@/api/ai';
import { pickErrMsg } from '@/api/http';

const docs = ref<KbDoc[]>([]);
const loading = ref(true);
const errMsg = ref('');

const showEditor = ref(false);
const draftTitle = ref('');
const draftTag = ref('');
const draftText = ref('');
const submitting = ref(false);

const searchQ = ref('');
const searchHits = ref<{ id: string; docTitle: string; docTag: string | null; chunkText: string }[]>([]);
const searching = ref(false);

async function load() {
  loading.value = true;
  errMsg.value = '';
  try { docs.value = await kbApi.list(); }
  catch (e) { errMsg.value = pickErrMsg(e, '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

const draftChunks = computed(() => {
  return draftText.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).length;
});

async function submit() {
  const title = draftTitle.value.trim();
  const text = draftText.value.trim();
  if (!title || !text) { errMsg.value = '标题和正文都不能空'; return; }
  submitting.value = true;
  errMsg.value = '';
  try {
    const res = await kbApi.create(title, text, draftTag.value.trim() || undefined);
    alert(`✓ 已入库 · 切成 ${res.chunkCount} 段`);
    draftTitle.value = ''; draftTag.value = ''; draftText.value = '';
    showEditor.value = false;
    await load();
  } catch (e) { errMsg.value = pickErrMsg(e, '保存失败'); }
  finally { submitting.value = false; }
}

async function delOne(id: string, title: string) {
  if (!confirm(`删除《${title}》？相关切片一起清。`)) return;
  try { await kbApi.del(id); await load(); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}

async function runSearch() {
  const q = searchQ.value.trim();
  if (!q) { searchHits.value = []; return; }
  searching.value = true;
  try {
    const r = await kbApi.search(q, 5);
    searchHits.value = r.map((x) => ({
      id: x.id,
      docTitle: x.docTitle,
      docTag: x.docTag,
      chunkText: x.chunkText,
    }));
  } catch (e) { errMsg.value = pickErrMsg(e, '搜索失败'); }
  finally { searching.value = false; }
}

function fmt(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function statusLabel(s: string): string {
  return s === 'A' ? '已上线' : s === 'D' ? '草稿' : s === 'X' ? '已下线' : s;
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="知识库" back-to="/ai" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section class="hero">
        <div class="h-icon" aria-hidden="true">📚</div>
        <div>
          <p class="h-title">你的私域知识库</p>
          <p class="h-hint">AI 搭子答原理题时会先来这里查 · 上传你信的营养/减脂/家庭菜单</p>
        </div>
        <button class="add-btn" @click="showEditor = !showEditor" aria-label="添加">
          <template v-if="showEditor">×</template>
          <template v-else>+</template>
        </button>
      </section>

      <section v-if="showEditor" class="editor">
        <label class="field">
          <span class="lbl">标题</span>
          <input v-model="draftTitle" type="text" maxlength="100" placeholder="如：我的减脂原则" />
        </label>
        <label class="field">
          <span class="lbl">标签 · 可选</span>
          <input v-model="draftTag" type="text" maxlength="100" placeholder="如：减脂,家庭 · 逗号分隔" />
        </label>
        <label class="field">
          <span class="lbl">
            正文 · <span class="chunk-hint num">切成 {{ draftChunks }} 段</span>
          </span>
          <textarea
            v-model="draftText"
            rows="10"
            maxlength="20000"
            placeholder="用空行分段 · 每段 = 一个可检索切片&#10;&#10;比如：&#10;蛋白质每天要吃 1.6-2.2 g/kg · 优先鸡胸/鱼虾/鸡蛋&#10;&#10;不喝碳酸饮料 · 咖啡不加糖&#10;&#10;每周至少 3 次力量训练"
          ></textarea>
        </label>
        <button class="primary" :disabled="submitting" @click="submit">
          {{ submitting ? '保存中…' : `+ 入库 · ${draftChunks} 段` }}
        </button>
      </section>

      <section class="search">
        <h3 class="s-title">试试搜</h3>
        <div class="s-row">
          <input v-model="searchQ" type="text" placeholder="输关键词看看能查到啥" @keydown.enter="runSearch" />
          <button class="s-btn" :disabled="searching || !searchQ.trim()" @click="runSearch">搜</button>
        </div>
        <ul v-if="searchHits.length" class="hits">
          <li v-for="h in searchHits" :key="h.id" class="hit">
            <p class="hit-src">[{{ h.docTitle }}]<span v-if="h.docTag"> · {{ h.docTag }}</span></p>
            <p class="hit-txt">{{ h.chunkText }}</p>
          </li>
        </ul>
        <p v-else-if="searchQ && !searching" class="s-empty">没搜到 · 换个词试试</p>
      </section>

      <section class="doc-list">
        <h3 class="dl-title">
          文档 · <span class="num">{{ docs.length }}</span>
        </h3>
        <p v-if="!docs.length && !loading" class="empty">
          还没有任何文档 · 点右上 <b>+</b> 加一份
        </p>
        <ul class="docs">
          <li v-for="d in docs" :key="d.id" class="doc-row">
            <div class="dr-body">
              <p class="dr-title">
                {{ d.docTitle }}
                <span :class="['dr-st', 's-' + d.kbStatus]">{{ statusLabel(d.kbStatus) }}</span>
              </p>
              <p class="dr-meta num">
                <span v-if="d.docTag">{{ d.docTag }} · </span>
                {{ d.chunkCount }} 段 · {{ fmt(d.publishTime ?? d.createTime) }}
              </p>
            </div>
            <button class="dr-del" @click="delOne(d.id, d.docTitle)" aria-label="删除">×</button>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.hero {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: linear-gradient(140deg, var(--color-secondary-container) 0%, var(--color-tertiary-container) 100%);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(29, 25, 23, 0.08);
  box-shadow: 0 8px 24px rgba(83, 101, 35, 0.12);
}
.h-icon { width: 56px; height: 56px; display: grid; place-items: center; background: var(--color-surface-container-lowest); border-radius: 20px; font-size: 28px; }
.h-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-secondary-container); }
.h-hint { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-secondary-container); opacity: 0.85; line-height: 1.4; }
.add-btn { width: 44px; height: 44px; border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-on-primary); font-size: 24px; box-shadow: 0 6px 14px rgba(165, 51, 20, 0.32); font-weight: 300; }
.add-btn:active { transform: scale(0.94); }

.editor {
  padding: 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08);
  display: flex; flex-direction: column; gap: 12px;
}
.field { display: flex; flex-direction: column; gap: 4px; }
.lbl { font-size: var(--font-size-label); letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-on-surface-variant); font-weight: 500; }
.chunk-hint { text-transform: none; color: var(--color-primary); font-weight: 600; letter-spacing: 0; }
.editor input, .editor textarea {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
  font-size: var(--font-size-body);
  font-family: var(--font-family-sans);
  color: var(--color-on-surface);
  line-height: 1.5;
}
.editor textarea { min-height: 200px; resize: vertical; }
.editor input:focus, .editor textarea:focus { outline: none; border-color: var(--color-primary); }
.primary { height: 48px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: 0.5; box-shadow: none; }

.search { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06); }
.s-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.s-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.s-row input { height: 40px; padding: 0 12px; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container); font-size: var(--font-size-body); color: var(--color-on-surface); }
.s-row input:focus { outline: none; border-color: var(--color-primary); }
.s-btn { padding: 0 20px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-caption); font-weight: 500; }
.s-btn:disabled { opacity: 0.5; }

.hits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.hit { padding: 10px 12px; background: var(--color-primary-fixed); border-radius: var(--radius-default); }
.hit-src { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-primary); font-weight: 500; }
.hit-txt { margin: 4px 0 0; font-size: var(--font-size-caption); color: var(--color-on-surface); line-height: 1.5; }
.s-empty { margin: 0; text-align: center; padding: 8px; font-size: var(--font-size-caption); color: var(--color-outline); }

.doc-list { display: flex; flex-direction: column; gap: 10px; }
.dl-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); }
.dl-title .num { color: var(--color-primary); font-weight: 700; }
.docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.doc-row {
  display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
  padding: 12px 14px;
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-outline-variant);
  box-shadow: 0 2px 6px rgba(29, 25, 23, 0.04);
}
.dr-title { margin: 0; font-size: var(--font-size-body); font-weight: 600; color: var(--color-on-surface); display: flex; align-items: center; gap: 8px; }
.dr-st { padding: 2px 8px; border-radius: var(--radius-full); font-size: 10px; letter-spacing: 0.05em; font-weight: 500; }
.dr-st.s-A { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.dr-st.s-D { background: var(--color-surface-container-high); color: var(--color-on-surface-variant); }
.dr-st.s-X { background: var(--color-error-container); color: var(--color-on-error-container); }
.dr-meta { margin: 3px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.dr-del { width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent; color: var(--color-outline); font-size: 20px; }
.dr-del:active { background: var(--color-error-container); color: var(--color-error); }

.empty { margin: 20px 0 0; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.empty b { color: var(--color-primary); font-weight: 700; }
</style>
