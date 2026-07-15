<script setup lang="ts">
import { ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';

const version = '0.1.0-mvp';

interface Feature {
  icon: string;
  title: string;
  desc: string;
}

const features: readonly Feature[] = [
  { icon: '📸', title: '拍照识别',   desc: 'DeepSeek 视觉一拍成一餐 · 支持外卖截图' },
  { icon: '🤖', title: 'AI 饮食搭子', desc: '对话即操作 · 三层记忆逐步懂你' },
  { icon: '🍚', title: '本土食物库', desc: '900+ 中式菜品 · 库迪瑞幸星巴克全菜单' },
  { icon: '📅', title: '轻断食计时', desc: '16:8 · 18:6 · OMAD · 一键开始' },
  { icon: '📊', title: '全维度记录', desc: '饮食 · 饮水 · 运动 · 体重 · 睡眠 · 步数' },
  { icon: '🔐', title: '数据可导出', desc: '一键下载全量 JSON · 随时删除账号' },
];

const copied = ref<'email' | 'domain' | null>(null);

async function copy(text: string, tag: 'email' | 'domain'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = tag;
    setTimeout(() => { copied.value = null; }, 1500);
  } catch { /* 无剪贴板权限时静默 */ }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="关于千卡日记" />
    <div class="body">
      <!-- hero -->
      <div class="hero">
        <div class="logo">🥗</div>
        <p class="brand">千卡日记</p>
        <p class="slogan">写下每一餐 · 看清你的选择</p>
        <div class="ver-row">
          <span class="ver-chip num">v{{ version }}</span>
        </div>
      </div>

      <!-- 简介 -->
      <div class="card intro">
        <p class="i-eyebrow">这是什么</p>
        <p class="i-text">
          一款为中国人饮食习惯打磨的
          <span class="hl">开放注册 · 免费 H5 记录本</span>。
          不是又一个"减脂 App"，而是把每一口吃下去的东西写成日记，让你和自己的身体对上话。
        </p>
      </div>

      <!-- 特色 -->
      <div class="section">
        <p class="s-eyebrow">核心能力</p>
        <div class="grid">
          <div v-for="f in features" :key="f.title" class="feat">
            <div class="f-icon">{{ f.icon }}</div>
            <p class="f-title">{{ f.title }}</p>
            <p class="f-desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>

      <!-- 联系 -->
      <div class="card links">
        <p class="i-eyebrow">联系与数据</p>
        <button type="button" class="link-row" @click="copy('qianka@jwyt.cloud', 'email')">
          <span class="lr-label">反馈邮箱</span>
          <span class="lr-val num">qianka@jwyt.cloud</span>
          <span class="lr-copy">{{ copied === 'email' ? '已复制' : '复制' }}</span>
        </button>
        <button type="button" class="link-row" @click="copy('qk.jwyt.cloud', 'domain')">
          <span class="lr-label">官方域名</span>
          <span class="lr-val num">qk.jwyt.cloud</span>
          <span class="lr-copy">{{ copied === 'domain' ? '已复制' : '复制' }}</span>
        </button>
        <router-link class="link-row" to="/ai/memory">
          <span class="lr-label">管理 AI 记忆</span>
          <span class="arrow">›</span>
        </router-link>
        <router-link class="link-row" to="/export">
          <span class="lr-label">导出全部数据</span>
          <span class="arrow">›</span>
        </router-link>
        <router-link class="link-row" to="/settings">
          <span class="lr-label">设置 · 提醒 · 清理</span>
          <span class="arrow">›</span>
        </router-link>
      </div>

      <!-- 免责 -->
      <div class="card disclaim">
        <p class="d-title">📌 使用声明</p>
        <p class="d-text">
          本应用提供的所有内容 (含 AI 输出、卡路里估算、营养建议)
          <span class="hl">仅供参考</span>·
          不构成任何医疗、诊断或处方建议。孕期、哺乳期、慢性病人群及青少年，
          请在专业医师指导下调整饮食与运动方案。
        </p>
      </div>

      <!-- 版权 -->
      <div class="foot">
        <p class="copy">© 2026 千卡日记 · Made with 🥑 in 中国</p>
        <p class="tech num">Vue 3 · NestJS · PostgreSQL · pgvector · DeepSeek</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wrap {
  min-height: 100dvh;
  background:
    radial-gradient(1000px 500px at 100% 0%, rgba(198, 75, 42, 0.06), transparent 60%),
    radial-gradient(800px 400px at 0% 30%, rgba(83, 101, 35, 0.05), transparent 60%),
    linear-gradient(180deg, #ecebff 0%, #f5f2ff 22%, #fbf5f0 50%, #fff8f5 100%);
  color: var(--color-on-surface);
}
.body {
  padding: 12px 16px calc(env(safe-area-inset-bottom) + 48px);
  display: flex; flex-direction: column; gap: 20px;
}

/* ─── hero ─────────────────────────────────── */
.hero {
  text-align: center;
  padding: 36px 20px 32px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 32px;
  box-shadow: 0 20px 40px -18px rgba(120, 90, 200, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.logo {
  width: 88px; height: 88px; margin: 0 auto 12px;
  border-radius: 26px;
  background: linear-gradient(140deg, #fff4cc 0%, #ffe0d5 60%, #ffcf5a 100%);
  display: grid; place-items: center;
  font-size: 44px;
  box-shadow: 0 12px 30px -10px rgba(255, 180, 60, 0.55);
}
.brand {
  margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.02em;
  color: var(--color-on-surface);
}
.slogan {
  margin: 6px 0 16px; font-size: 14px; color: var(--color-on-surface-variant); letter-spacing: 0.06em;
}
.ver-row { display: inline-flex; align-items: center; gap: 8px; }
.ver-chip {
  padding: 4px 12px; border-radius: 999px;
  background: var(--color-primary-fixed); color: var(--color-primary);
  font-size: 12px; font-weight: 600; letter-spacing: 0.03em;
}

/* ─── 通用白卡 ─────────────────────────────── */
.card {
  padding: 22px 20px;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 32px;
  box-shadow: 0 18px 36px -20px rgba(120, 90, 200, 0.18);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.i-eyebrow, .s-eyebrow {
  margin: 0 0 10px; font-size: 11px; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-primary);
}
.s-eyebrow { padding-left: 4px; }
.i-text {
  margin: 0; font-size: 14px; line-height: 1.75;
  color: var(--color-on-surface);
}
.hl { color: var(--color-primary); font-weight: 600; }

/* ─── 特色 grid ────────────────────────────── */
.section { display: flex; flex-direction: column; gap: 10px; }
.grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
}
.feat {
  padding: 16px 14px;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  box-shadow: 0 12px 24px -18px rgba(120, 90, 200, 0.20);
  display: flex; flex-direction: column; gap: 6px;
  min-height: 118px;
}
.feat:nth-child(1) { background: linear-gradient(155deg, #ffe0d5 0%, rgba(255, 255, 255, 0.9) 60%); }
.feat:nth-child(2) { background: linear-gradient(155deg, #eeeaff 0%, rgba(255, 255, 255, 0.9) 60%); }
.feat:nth-child(3) { background: linear-gradient(155deg, #fff4cc 0%, rgba(255, 255, 255, 0.9) 60%); }
.feat:nth-child(4) { background: linear-gradient(155deg, #dcefff 0%, rgba(255, 255, 255, 0.9) 60%); }
.feat:nth-child(5) { background: linear-gradient(155deg, #e6f5d5 0%, rgba(255, 255, 255, 0.9) 60%); }
.feat:nth-child(6) { background: linear-gradient(155deg, #fce4d3 0%, rgba(255, 255, 255, 0.9) 60%); }
.f-icon { font-size: 24px; line-height: 1; }
.f-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-on-surface); }
.f-desc { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--color-on-surface-variant); }

/* ─── 联系链接 ─────────────────────────────── */
.links { padding: 18px 20px; }
.link-row {
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  padding: 14px 0; border-bottom: 1px solid rgba(120, 90, 200, 0.08);
  background: transparent; border-left: 0; border-right: 0; border-top: 0;
  text-decoration: none; color: inherit;
  font: inherit; cursor: pointer;
  text-align: left;
}
.link-row:last-child { border-bottom: 0; }
.link-row:active { opacity: 0.7; }
.lr-label { font-size: 14px; color: var(--color-on-surface); flex-shrink: 0; }
.lr-val { flex: 1; text-align: right; font-size: 12.5px; color: var(--color-on-surface-variant); word-break: break-all; }
.lr-copy {
  padding: 3px 10px; border-radius: 999px;
  background: var(--color-primary-fixed); color: var(--color-primary);
  font-size: 11px; font-weight: 500; flex-shrink: 0;
}
.arrow { color: var(--color-outline); font-size: 18px; margin-left: auto; }

/* ─── 免责 ─────────────────────────────────── */
.disclaim {
  background:
    linear-gradient(155deg, rgba(255, 240, 220, 0.9) 0%, rgba(255, 255, 255, 0.85) 60%);
}
.d-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #7E5100; }
.d-text {
  margin: 0; font-size: 12.5px; line-height: 1.75;
  color: var(--color-on-surface-variant);
}

/* ─── 版权 ─────────────────────────────────── */
.foot { text-align: center; padding: 8px 0 4px; }
.copy { margin: 0; font-size: 12px; color: var(--color-outline); }
.tech { margin: 6px 0 0; font-size: 10px; color: var(--color-outline); letter-spacing: 0.08em; }
</style>
