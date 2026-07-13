<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import { aiApi } from '@/api/ai';
import { pickErrMsg } from '@/api/http';

/* ─── 提醒 ────────────────────────────── */
interface RemindPrefs {
  enabled: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
  waterInterval: number;
  fastingReminder: boolean;
}
const REMIND_KEY = 'qk.remind.prefs';
const DEFAULT_REMIND: RemindPrefs = {
  enabled: false,
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '18:30',
  waterInterval: 2,
  fastingReminder: true,
};
const remind = ref<RemindPrefs>({ ...DEFAULT_REMIND });
const notifyPerm = ref<NotificationPermission | 'unsupported'>('default');
const permMsg = ref('');

function loadRemind() {
  try {
    const raw = localStorage.getItem(REMIND_KEY);
    if (raw) remind.value = { ...DEFAULT_REMIND, ...JSON.parse(raw) };
  } catch {
    remind.value = { ...DEFAULT_REMIND };
  }
  notifyPerm.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}
function saveRemind() {
  localStorage.setItem(REMIND_KEY, JSON.stringify(remind.value));
}

async function toggleEnabled() {
  if (!remind.value.enabled) {
    if (notifyPerm.value === 'unsupported') {
      permMsg.value = '当前浏览器不支持系统通知';
      return;
    }
    if (notifyPerm.value !== 'granted') {
      try {
        const p = await Notification.requestPermission();
        notifyPerm.value = p;
        if (p !== 'granted') {
          permMsg.value = p === 'denied' ? '通知已被系统拒绝 · 请到系统设置里手动开启' : '需要通知权限才能提醒';
          return;
        }
      } catch {
        permMsg.value = '申请权限失败';
        return;
      }
    }
  }
  permMsg.value = '';
  remind.value.enabled = !remind.value.enabled;
  saveRemind();
}

function onTimeChange(key: 'breakfast' | 'lunch' | 'dinner', ev: Event) {
  const v = (ev.target as HTMLInputElement).value;
  if (!v) return;
  remind.value[key] = v;
  saveRemind();
}
function onWaterChange(ev: Event) {
  const v = Number((ev.target as HTMLSelectElement).value);
  remind.value.waterInterval = v;
  saveRemind();
}
function toggleFasting() {
  remind.value.fastingReminder = !remind.value.fastingReminder;
  saveRemind();
}

const permLabel = computed(() => {
  switch (notifyPerm.value) {
    case 'granted': return '已授权';
    case 'denied': return '已拒绝';
    case 'unsupported': return '不支持';
    default: return '未申请';
  }
});
const permTone = computed(() => {
  if (notifyPerm.value === 'granted') return 'ok';
  if (notifyPerm.value === 'denied') return 'err';
  return 'warn';
});

/* ─── 主题 ────────────────────────────── */
type ThemeMode = 'auto' | 'light' | 'dark';
const THEME_KEY = 'qk.theme';
const theme = ref<ThemeMode>('auto');
const themeOptions: Array<{ v: ThemeMode; label: string }> = [
  { v: 'light', label: '浅色' },
  { v: 'auto', label: '跟随系统' },
  { v: 'dark', label: '深色' },
];

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  theme.value = stored && (['auto', 'light', 'dark'] as const).includes(stored) ? stored : 'auto';
  applyTheme();
}
function applyTheme() {
  const root = document.documentElement;
  const wantDark = theme.value === 'dark' ||
    (theme.value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', wantDark ? 'dark' : 'light');
}
function setTheme(t: ThemeMode) {
  theme.value = t;
  localStorage.setItem(THEME_KEY, t);
  applyTheme();
}

/* ─── 数据清理 ────────────────────────── */
type BusyKey = 'convs' | 'memories' | null;
const busy = ref<BusyKey>(null);
const clearMsg = ref('');
const confirming = ref<'convs' | 'memories' | null>(null);

async function clearAllConvs() {
  busy.value = 'convs';
  clearMsg.value = '';
  try {
    const list = await aiApi.listConvs();
    if (list.length === 0) {
      clearMsg.value = '当前没有 AI 对话';
    } else {
      for (const c of list) await aiApi.deleteConv(c.id);
      clearMsg.value = `已删除 ${list.length} 个对话`;
    }
  } catch (e) {
    clearMsg.value = pickErrMsg(e, '清理失败');
  } finally {
    busy.value = null;
    confirming.value = null;
  }
}
async function clearAllMemories() {
  busy.value = 'memories';
  clearMsg.value = '';
  try {
    const list = await aiApi.listMemories();
    if (list.length === 0) {
      clearMsg.value = 'AI 还没记住任何东西';
    } else {
      for (const m of list) await aiApi.deleteMemory(m.id);
      clearMsg.value = `已删除 ${list.length} 条记忆`;
    }
  } catch (e) {
    clearMsg.value = pickErrMsg(e, '清理失败');
  } finally {
    busy.value = null;
    confirming.value = null;
  }
}

/* ─── 关于 ────────────────────────────── */
const version = '0.1.0-mvp';

onMounted(() => {
  loadRemind();
  loadTheme();
});
</script>

<template>
  <section class="wrap">
    <AppHeader title="设置" back-to="/me" />

    <div class="body">
      <section class="card">
        <header class="c-head">
          <h3 class="c-title">提醒</h3>
          <span :class="['perm-chip', permTone]">{{ permLabel }}</span>
        </header>

        <div class="row">
          <div class="r-body">
            <p class="r-label">开启系统通知提醒</p>
            <p class="r-hint">三餐时间 · 饮水间隔 · 断食节点</p>
          </div>
          <button
            type="button"
            :class="['switch', { on: remind.enabled }]"
            @click="toggleEnabled"
            :aria-checked="remind.enabled"
            role="switch"
          >
            <span class="s-knob" />
          </button>
        </div>

        <p v-if="permMsg" class="perm-msg">{{ permMsg }}</p>

        <template v-if="remind.enabled">
          <div class="row">
            <span class="r-label">早餐</span>
            <input class="time-input num" type="time" :value="remind.breakfast"
                   @change="(e) => onTimeChange('breakfast', e)" />
          </div>
          <div class="row">
            <span class="r-label">午餐</span>
            <input class="time-input num" type="time" :value="remind.lunch"
                   @change="(e) => onTimeChange('lunch', e)" />
          </div>
          <div class="row">
            <span class="r-label">晚餐</span>
            <input class="time-input num" type="time" :value="remind.dinner"
                   @change="(e) => onTimeChange('dinner', e)" />
          </div>
          <div class="row">
            <span class="r-label">饮水间隔</span>
            <select class="sel num" :value="remind.waterInterval" @change="onWaterChange">
              <option :value="1">每 1 小时</option>
              <option :value="2">每 2 小时</option>
              <option :value="3">每 3 小时</option>
              <option :value="4">每 4 小时</option>
            </select>
          </div>
          <div class="row">
            <div class="r-body">
              <p class="r-label">轻断食节点提醒</p>
              <p class="r-hint">开始 · 中点 · 结束前 30 分钟</p>
            </div>
            <button
              type="button"
              :class="['switch', { on: remind.fastingReminder }]"
              @click="toggleFasting"
              role="switch"
              :aria-checked="remind.fastingReminder"
            >
              <span class="s-knob" />
            </button>
          </div>
        </template>

        <p class="note-line">
          偏好已保存到本机 · 通知实际触发需要 App 在后台运行（PWA 已安装到桌面时最稳）
        </p>
      </section>

      <section class="card">
        <header class="c-head">
          <h3 class="c-title">主题</h3>
          <span class="perm-chip warn">深色即将上线</span>
        </header>
        <div class="theme-row">
          <button
            v-for="opt in themeOptions" :key="opt.v"
            :class="['seg', { on: theme === opt.v }]"
            @click="setTheme(opt.v)"
            type="button"
          >
            {{ opt.label }}
          </button>
        </div>
        <p class="note-line">
          目前只提供暖色调浅色主题 · 已选择的主题偏好会记住 · 深色模式在下一个版本上线
        </p>
      </section>

      <section class="card">
        <header class="c-head">
          <h3 class="c-title">数据清理</h3>
        </header>

        <div class="row">
          <div class="r-body">
            <p class="r-label">清空所有 AI 对话</p>
            <p class="r-hint">对话历史全部删除 · 记忆不受影响</p>
          </div>
          <button
            v-if="confirming !== 'convs'"
            type="button" class="danger-btn"
            :disabled="busy !== null"
            @click="confirming = 'convs'; clearMsg = ''"
          >清空</button>
          <div v-else class="confirm">
            <button type="button" class="danger-solid" :disabled="busy === 'convs'" @click="clearAllConvs">
              {{ busy === 'convs' ? '清理中…' : '确认删除' }}
            </button>
            <button type="button" class="ghost-btn" :disabled="busy === 'convs'" @click="confirming = null">取消</button>
          </div>
        </div>

        <div class="row">
          <div class="r-body">
            <p class="r-label">清空 AI 记住的所有事情</p>
            <p class="r-hint">你希望 AI 忘掉一切 · 请谨慎</p>
          </div>
          <button
            v-if="confirming !== 'memories'"
            type="button" class="danger-btn"
            :disabled="busy !== null"
            @click="confirming = 'memories'; clearMsg = ''"
          >清空</button>
          <div v-else class="confirm">
            <button type="button" class="danger-solid" :disabled="busy === 'memories'" @click="clearAllMemories">
              {{ busy === 'memories' ? '清理中…' : '确认删除' }}
            </button>
            <button type="button" class="ghost-btn" :disabled="busy === 'memories'" @click="confirming = null">取消</button>
          </div>
        </div>

        <p v-if="clearMsg" class="ok-msg">{{ clearMsg }}</p>

        <div class="link-row">
          <router-link class="link" to="/export">导出所有数据 →</router-link>
          <router-link class="link" to="/ai/memory">管理单条记忆 →</router-link>
        </div>
      </section>

      <section class="card about">
        <p class="a-title">千卡日记</p>
        <p class="a-sub num">{{ version }}</p>
        <p class="a-hint">AI 内容仅供参考 · 不构成医疗建议</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }

.card {
  padding: 14px 16px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
}

.c-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.c-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface-variant); letter-spacing: 0.06em; text-transform: uppercase; }

.perm-chip { padding: 3px 10px; border-radius: var(--radius-full); font-size: var(--font-size-label); letter-spacing: 0.05em; font-weight: 500; }
.perm-chip.ok { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
.perm-chip.warn { background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); }
.perm-chip.err { background: var(--color-error-container); color: var(--color-on-error-container); }

.row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--color-surface-container-high); min-height: 44px; }
.row:last-of-type { border-bottom: 0; }
.r-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.r-label { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface); }
.r-hint { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.03em; color: var(--color-outline); }

.switch { width: 46px; height: 26px; border-radius: 13px; background: var(--color-surface-container-high); border: 1px solid var(--color-outline-variant); position: relative; padding: 0; transition: background var(--duration-fast); flex-shrink: 0; }
.switch.on { background: var(--color-primary); border-color: var(--color-primary); }
.s-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(29, 25, 23, 0.2); transition: transform var(--duration-fast); }
.switch.on .s-knob { transform: translateX(20px); }

.time-input, .sel {
  height: 34px; padding: 0 10px;
  background: var(--color-surface-container); color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant); border-radius: var(--radius-default);
  font-size: var(--font-size-caption);
}
.time-input { min-width: 90px; text-align: center; font-family: var(--font-family-num); }
.sel { padding-right: 24px; }

.perm-msg { margin: 6px 0 0; padding: 8px 12px; background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-label); letter-spacing: 0.03em; }

.note-line { margin: 10px 0 0; font-size: var(--font-size-label); letter-spacing: 0.03em; color: var(--color-outline); line-height: 1.6; }

.theme-row { display: flex; gap: 4px; padding: 3px; background: var(--color-surface-container); border-radius: var(--radius-full); margin-top: 8px; }
.seg { flex: 1; padding: 8px 0; background: transparent; color: var(--color-on-surface-variant); font-size: var(--font-size-caption); border-radius: var(--radius-full); border: 0; transition: all var(--duration-fast); }
.seg.on { background: var(--color-primary); color: var(--color-on-primary); font-weight: 500; box-shadow: 0 2px 6px rgba(165, 51, 20, 0.24); }

.danger-btn { height: 32px; padding: 0 14px; background: transparent; color: var(--color-error); border: 1px solid var(--color-error); border-radius: var(--radius-full); font-size: var(--font-size-caption); flex-shrink: 0; }
.danger-btn:disabled { opacity: 0.4; }
.danger-solid { height: 32px; padding: 0 14px; background: var(--color-error); color: var(--color-on-error); border: 0; border-radius: var(--radius-full); font-size: var(--font-size-caption); font-weight: 500; }
.danger-solid:disabled { opacity: 0.6; }
.ghost-btn { height: 32px; padding: 0 12px; background: transparent; color: var(--color-on-surface-variant); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-full); font-size: var(--font-size-caption); }
.confirm { display: flex; gap: 6px; flex-shrink: 0; }

.ok-msg { margin: 10px 0 0; padding: 8px 12px; background: var(--color-secondary-container); color: var(--color-on-secondary-container); border-radius: var(--radius-default); font-size: var(--font-size-label); letter-spacing: 0.03em; }

.link-row { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--color-surface-container-high); }
.link { font-size: var(--font-size-caption); color: var(--color-primary); text-decoration: none; }
.link:active { opacity: 0.7; }

.about { text-align: center; padding: 20px 16px; }
.a-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-surface); }
.a-sub { margin: 2px 0 6px; font-size: var(--font-size-label); letter-spacing: 0.06em; color: var(--color-outline); font-family: var(--font-family-num); }
.a-hint { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.03em; color: var(--color-outline); }
</style>
