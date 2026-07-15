<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

interface MenuItem {
  path: string;
  label: string;
  hint: string;
  icon: string;
  tint: 'lilac' | 'peach' | 'butter' | 'sky' | 'mint' | 'blush';
}

const menu: readonly MenuItem[] = [
  { path: '/goal',              label: '目标',        hint: '卡路里 · 三大营养素', icon: '🎯', tint: 'lilac'  },
  { path: '/change-password',   label: '修改密码',    hint: '账号安全',             icon: '🔒', tint: 'blush'  },
  { path: '/stats',             label: '统计',        hint: '摄入 / 体重 / 运动',  icon: '📊', tint: 'peach'  },
  { path: '/settings',          label: '设置',        hint: '提醒 · 主题 · 清理',   icon: '⚙️', tint: 'butter' },
  { path: '/exercise/history',  label: '锻炼历史',    hint: '历次训练 · 消耗',      icon: '💪', tint: 'mint'   },
  { path: '/body/steps',        label: '步数',        hint: '距离 · 消耗',          icon: '👣', tint: 'sky'    },
  { path: '/body/sleep',        label: '睡眠',        hint: '入睡 / 深睡 / REM',    icon: '🌙', tint: 'lilac'  },
  { path: '/health/import',     label: 'Apple 健康',  hint: '导入 · 一次搞定',       icon: '❤️', tint: 'blush'  },
  { path: '/export',            label: '数据导出',    hint: '一键下载全量',          icon: '📦', tint: 'peach'  },
  { path: '/about',             label: '关于千卡日记', hint: '版本 · 反馈 · 声明',   icon: '🌱', tint: 'mint'   },
];

onMounted(() => { auth.refreshMe().catch(() => undefined); });

function logout(): void {
  auth.logout();
  router.replace('/welcome');
}
</script>

<template>
  <section class="wrap">
    <div class="body">
      <!-- header -->
      <header class="head">
        <h1 class="title">我的</h1>
      </header>

      <!-- profile 卡 · 点击整卡进入编辑 -->
      <button v-if="auth.user" type="button" class="profile" @click="router.push('/profile')">
        <div class="halo">
          <div class="avatar">
            <img v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" alt="头像" />
            <span v-else>{{ auth.user.nickname.slice(0, 1) }}</span>
          </div>
        </div>
        <div class="meta">
          <p class="nick">{{ auth.user.nickname }}</p>
          <p class="email num">{{ auth.user.email }}</p>
          <span class="chip" :class="auth.user.emailVerified === 'Y' ? 'ok' : 'warn'">
            {{ auth.user.emailVerified === 'Y' ? '✓ 已验证' : '未验证邮箱' }}
          </span>
        </div>
        <span class="edit-chip">编辑 ›</span>
      </button>
      <div v-else class="profile skel">
        <div class="skel-avatar" />
        <div class="skel-meta">
          <div class="skel-line w60" />
          <div class="skel-line w80" />
        </div>
      </div>

      <!-- menu grid -->
      <div class="menu">
        <button
          v-for="m in menu" :key="m.path"
          type="button"
          class="item"
          :class="`tint-${m.tint}`"
          @click="router.push(m.path)"
        >
          <span class="ico">{{ m.icon }}</span>
          <span class="l1">{{ m.label }}</span>
          <span class="l2">{{ m.hint }}</span>
          <span class="arrow">›</span>
        </button>
      </div>

      <button type="button" class="logout" @click="logout">
        <span>退出登录</span>
      </button>

      <button type="button" class="danger-link" @click="router.push('/account/delete')">
        注销账号
      </button>

      <p class="foot">AI 内容仅供参考 · 不构成医疗建议</p>
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
  padding: calc(env(safe-area-inset-top) + 12px) 16px calc(env(safe-area-inset-bottom) + 100px);
  display: flex; flex-direction: column; gap: 18px;
}

/* ─── head ─── */
.head { padding: 4px 4px 0; }
.title {
  margin: 0; font-size: 30px; font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-on-surface);
}

/* ─── profile ─── */
.profile {
  position: relative;
  width: 100%;
  display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center;
  padding: 22px 22px;
  background: rgba(255, 255, 255, 0.78);
  border: 0;
  border-radius: 32px;
  box-shadow: 0 20px 40px -18px rgba(120, 90, 200, 0.24);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  text-align: left;
  cursor: pointer;
  transition: transform var(--duration-fast), box-shadow var(--duration-fast);
}
.profile:active { transform: translateY(1px); box-shadow: 0 12px 22px -14px rgba(120, 90, 200, 0.24); }
.edit-chip {
  position: absolute; top: 14px; right: 16px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(165, 51, 20, 0.10);
  color: var(--color-primary);
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  line-height: 1.4;
}
.halo {
  position: relative;
  width: 66px; height: 66px;
  border-radius: 22px;
  background: linear-gradient(140deg, #fff4cc 0%, #ffe0d5 60%, #ffcf5a 100%);
  padding: 3px;
  box-shadow: 0 12px 24px -8px rgba(255, 180, 60, 0.5);
}
.avatar {
  width: 100%; height: 100%; border-radius: 19px;
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  display: grid; place-items: center;
  font-size: 26px; font-weight: 700;
  letter-spacing: 0.02em;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.nick { margin: 0; font-size: 18px; font-weight: 700; }
.email {
  margin: 0; font-size: 12px; color: var(--color-on-surface-variant);
  word-break: break-all; letter-spacing: 0.02em;
}
.chip {
  align-self: flex-start; margin-top: 4px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 11px; letter-spacing: 0.03em;
}
.chip.ok   { background: #e6f5d5; color: #4a7a1a; }
.chip.warn { background: #fff4cc; color: #7e5100; }

/* profile skeleton */
.profile.skel .skel-avatar {
  width: 66px; height: 66px; border-radius: 22px;
  background: rgba(120, 90, 200, 0.10);
  animation: pulse 1.4s ease-in-out infinite;
}
.skel-meta { display: flex; flex-direction: column; gap: 8px; }
.skel-line { height: 12px; border-radius: 6px; background: rgba(120, 90, 200, 0.10); animation: pulse 1.4s ease-in-out infinite; }
.skel-line.w60 { width: 60%; }
.skel-line.w80 { width: 80%; }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

/* ─── menu grid ─── */
.menu {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.item {
  position: relative;
  padding: 16px 14px 14px;
  background: rgba(255, 255, 255, 0.82);
  border: 0; border-radius: 22px;
  box-shadow: 0 12px 26px -18px rgba(120, 90, 200, 0.20);
  display: flex; flex-direction: column; gap: 4px;
  text-align: left;
  cursor: pointer;
  transition: transform var(--duration-fast), box-shadow var(--duration-fast);
  min-height: 96px;
}
.item:active { transform: translateY(1px); box-shadow: 0 6px 12px -8px rgba(120, 90, 200, 0.18); }
.item .ico { font-size: 22px; line-height: 1; margin-bottom: 4px; }
.item .l1 {
  font-size: 14px; font-weight: 600;
  color: var(--color-on-surface); letter-spacing: 0.01em;
}
.item .l2 {
  font-size: 11px; color: var(--color-on-surface-variant);
  letter-spacing: 0.03em; line-height: 1.4;
}
.item .arrow {
  position: absolute; top: 14px; right: 14px;
  color: var(--color-outline); font-size: 18px; line-height: 1;
}

.tint-lilac  { background: linear-gradient(155deg, #eeeaff 0%, rgba(255, 255, 255, 0.88) 60%); }
.tint-peach  { background: linear-gradient(155deg, #ffe0d5 0%, rgba(255, 255, 255, 0.88) 60%); }
.tint-butter { background: linear-gradient(155deg, #fff4cc 0%, rgba(255, 255, 255, 0.88) 60%); }
.tint-sky    { background: linear-gradient(155deg, #dcefff 0%, rgba(255, 255, 255, 0.88) 60%); }
.tint-mint   { background: linear-gradient(155deg, #e6f5d5 0%, rgba(255, 255, 255, 0.88) 60%); }
.tint-blush  { background: linear-gradient(155deg, #fce4d3 0%, rgba(255, 255, 255, 0.88) 60%); }

/* ─── logout ─── */
.logout {
  margin-top: 6px;
  height: 52px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-error);
  border: 1px solid rgba(165, 51, 20, 0.24);
  border-radius: 20px;
  font-size: 14px; font-weight: 600; letter-spacing: 0.04em;
  cursor: pointer;
  transition: background var(--duration-fast), transform var(--duration-fast);
}
.logout:active {
  background: rgba(255, 224, 213, 0.5);
  transform: scale(0.99);
}

.danger-link {
  margin: 4px auto 0;
  padding: 6px 14px;
  background: transparent;
  border: 0;
  color: var(--color-error);
  font-size: 12px;
  letter-spacing: 0.05em;
  opacity: 0.7;
  cursor: pointer;
}
.danger-link:active { opacity: 1; }

.foot {
  text-align: center; margin: 4px 0 0;
  font-size: 11px; color: var(--color-outline); letter-spacing: 0.05em;
}
</style>
