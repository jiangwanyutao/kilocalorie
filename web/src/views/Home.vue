<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { userApi, type MeResponse } from '@/api/user';
import { mealApi, type StatsToday, type DayKcal } from '@/api/meal';
import { fastingApi, type FastingCurrent } from '@/api/fasting';
import { bodyApi, type StepsSummary, type SleepSummary } from '@/api/body';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const me = ref<MeResponse | null>(null);
const stats = ref<StatsToday | null>(null);
const fasting = ref<FastingCurrent | null>(null);
const steps = ref<StepsSummary | null>(null);
const sleep = ref<SleepSummary | null>(null);
const loading = ref(true);

async function refresh() {
  try {
    const [m, s, f, st, sl] = await Promise.all([
      userApi.me(),
      mealApi.today(),
      fastingApi.current().catch(() => null),
      bodyApi.stepsSummary(30).catch(() => null),
      bodyApi.sleepSummary(30).catch(() => null),
    ]);
    me.value = m;
    stats.value = s;
    fasting.value = f;
    steps.value = st;
    sleep.value = sl;
    if (!m.goal) router.replace('/onboarding');
  } catch { /* 401 由 http.ts 拦截 */ } finally {
    loading.value = false;
  }
  // strip 范围 · 今天前后 3 天 · 静默拉一次
  const from = new Date(today); from.setDate(from.getDate() - 3);
  const to = new Date(today); to.setDate(to.getDate() + 3);
  loadRange(isoOf(from), isoOf(to));
}
onMounted(refresh);
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => { if (route.name === 'home') refresh(); });
}

const nickname = computed(() => auth.user?.nickname ?? '');
const goal = computed(() => me.value?.goal);
const kcalGoal = computed(() => stats.value?.kcalGoal ?? goal.value?.kcalGoal ?? 0);
const consumed = computed(() => stats.value?.consumed ?? 0);
const burned = computed(() => stats.value?.burned ?? 0);
const activeKcal = computed(() => stats.value?.activeKcalToday ?? 0);
const burnedTotal = computed(() => burned.value + activeKcal.value);
const remaining = computed(() => Math.max(0, kcalGoal.value - consumed.value + burnedTotal.value));
const pct = computed(() => (stats.value?.pct ?? 0) / 100);

// Date Strip · 中心为今天 · 左右各 3 天
const today = new Date();
const todayIso = today.toISOString().slice(0, 10);

interface DayInfo { kcal: number; burned: number; active: number; }
/** 已拉到的 daily 三项汇总 · key=YYYY-MM-DD */
const dayInfo = ref<Map<string, DayInfo>>(new Map());

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadRange(from: string, to: string) {
  try {
    const list: DayKcal[] = await mealApi.days(from, to);
    const next = new Map(dayInfo.value);
    for (const d of list) next.set(d.date, { kcal: d.kcal, burned: d.burned, active: d.active });
    dayInfo.value = next;
  } catch { /* silent · 不阻塞主视图 */ }
}

const dateStrip = computed(() => {
  const arr = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = isoOf(d);
    const info = dayInfo.value.get(iso);
    arr.push({
      day: d.getDate(),
      wd: ['日','一','二','三','四','五','六'][d.getDay()],
      isToday: i === 0,
      iso,
      kcal: info?.kcal,
    });
  }
  return arr;
});

const dateHeader = computed(() => {
  const d = today;
  return `${d.getFullYear()}·${String(d.getMonth() + 1).padStart(2, '0')}·${String(d.getDate()).padStart(2, '0')}`;
});

// 月历展开 · 支持切月
const calendarOpen = ref(false);
const viewMonth = ref<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() });
const monthLoading = ref(false);

async function loadMonth(y: number, m: number) {
  if (monthLoading.value) return;
  monthLoading.value = true;
  try {
    const from = isoOf(new Date(y, m, 1));
    const to = isoOf(new Date(y, m + 1, 0));
    await loadRange(from, to);
  } finally { monthLoading.value = false; }
}

function toggleCalendar() {
  calendarOpen.value = !calendarOpen.value;
  if (calendarOpen.value) loadMonth(viewMonth.value.y, viewMonth.value.m);
}
function prevMonth() {
  const { y, m } = viewMonth.value;
  const nm = m - 1;
  viewMonth.value = nm < 0 ? { y: y - 1, m: 11 } : { y, m: nm };
  loadMonth(viewMonth.value.y, viewMonth.value.m);
}
function nextMonth() {
  const { y, m } = viewMonth.value;
  const nm = m + 1;
  viewMonth.value = nm > 11 ? { y: y + 1, m: 0 } : { y, m: nm };
  loadMonth(viewMonth.value.y, viewMonth.value.m);
}
function pickDay(iso: string | undefined) {
  if (!iso) return;
  router.push({ path: '/log', query: { date: iso } });
}
const monthGrid = computed(() => {
  const { y, m } = viewMonth.value;
  const first = new Date(y, m, 1);
  const firstWd = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: { day: number | null; iso?: string; isToday?: boolean; logged?: boolean;
    kcal?: number; out?: number }[] = [];
  for (let i = 0; i < firstWd; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(new Date(y, m, d));
    const info = dayInfo.value.get(iso);
    const kcal = info?.kcal ?? 0;
    const out = (info?.burned ?? 0) + (info?.active ?? 0);
    cells.push({ day: d, iso, isToday: iso === todayIso,
      logged: kcal > 0 || out > 0, kcal: kcal || undefined, out: out || undefined });
  }
  while (cells.length < 42) cells.push({ day: null });
  return cells;
});
const monthLabel = computed(() => `${viewMonth.value.y} 年 ${viewMonth.value.m + 1} 月`);
const WEEKDAYS = ['日','一','二','三','四','五','六'];

const RING_R = 74;
const RING_CIRC = 2 * Math.PI * RING_R;
const dashOffset = computed(() => RING_CIRC * (1 - pct.value));

const consumedPct = computed(() => kcalGoal.value ? Math.min(100, (consumed.value / kcalGoal.value) * 100) : 0);
const burnedPct = computed(() => kcalGoal.value ? Math.min(100, (burned.value / kcalGoal.value) * 100) : 0);
const activePct = computed(() => kcalGoal.value ? Math.min(100, (activeKcal.value / kcalGoal.value) * 100) : 0);

// 三大营养素（示例：假设从 stats.macros 拿 · 未来接真数据）
const macros = computed(() => {
  const m = stats.value?.macros ?? { carbG: 0, protG: 0, fatG: 0 };
  const carbGoal = Math.round((kcalGoal.value * (goal.value?.carbPct ?? 50)) / 100 / 4);
  const protGoal = Math.round((kcalGoal.value * (goal.value?.protPct ?? 25)) / 100 / 4);
  const fatGoal = Math.round((kcalGoal.value * (goal.value?.fatPct ?? 25)) / 100 / 9);
  return {
    carb: { v: Math.round(m.carbG), g: carbGoal },
    prot: { v: Math.round(m.protG), g: protGoal },
    fat:  { v: Math.round(m.fatG),  g: fatGoal  },
  };
});

const latestWeightKg = computed(() => stats.value?.latestWeightKg ?? null);
const latestWeightAt = computed(() => {
  const iso = stats.value?.latestWeightAt;
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays <= 0) return '今天记录';
  if (diffDays === 1) return '昨天记录';
  if (diffDays <= 7) return `${diffDays} 天前记录`;
  return `${d.getMonth() + 1}/${d.getDate()} 记录`;
});
const exMin = computed(() => stats.value?.exMin ?? 0);
const latestWaistCm = computed(() => stats.value?.latestWaistCm ?? null);

const latestSteps = computed(() => steps.value?.latest?.stepCount ?? null);
const latestSleep = computed(() => sleep.value?.latest);
function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

const fastingLive = computed(() => {
  const c = fasting.value;
  if (!c) return null;
  const eh = Math.floor(c.elapsedMin / 60);
  const em = c.elapsedMin % 60;
  const rh = Math.floor(c.remainingMin / 60);
  const rm = c.remainingMin % 60;
  return {
    label: `${c.planHours}:${24 - c.planHours}`,
    elapsed: `${eh}h ${String(em).padStart(2, '0')}m`,
    remaining: c.done ? '达成 · 可结束' : `剩 ${rh}h ${rm}m`,
    pct: c.pct,
    done: c.done,
  };
});

const MEAL_NAME: Record<'B' | 'L' | 'D' | 'S', string> = { B: '早餐', L: '午餐', D: '晚餐', S: '加餐' };
const meals = computed(() =>
  (['B', 'L', 'D', 'S'] as const).map((k) => ({
    key: k,
    name: MEAL_NAME[k],
    kcal: Math.round(stats.value?.byType[k] ?? 0),
    logged: (stats.value?.byType[k] ?? 0) > 0,
  })),
);
</script>

<template>
  <section class="home">
    <!-- 头部 · 日期胶囊（可点展开月历）+ 头像 -->
    <header class="topbar">
      <button
        class="date-pill"
        :class="{ open: calendarOpen }"
        @click="toggleCalendar"
        aria-label="展开月历"
      >
        <span class="date-t">{{ calendarOpen ? monthLabel : dateHeader }}</span>
        <span class="date-caret" aria-hidden="true">▾</span>
      </button>
      <button class="avatar" @click="router.push('/me')" aria-label="我的">
        {{ (nickname[0] ?? '☺') }}
      </button>
    </header>

    <!-- 展开：月历 -->
    <section v-if="calendarOpen" class="month-cal">
      <div class="mc-head">
        <div class="mc-nav">
          <button class="mc-arrow" aria-label="上一月" @click="prevMonth">‹</button>
          <span class="mc-month num">{{ monthLabel }}</span>
          <button class="mc-arrow" aria-label="下一月" @click="nextMonth">›</button>
        </div>
        <button class="mc-close" @click="calendarOpen = false" aria-label="收起月历">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>收起</span>
        </button>
      </div>
      <div class="mc-wdrow">
        <span v-for="w in WEEKDAYS" :key="w" class="mc-wd">{{ w }}</span>
      </div>
      <div class="mc-grid">
        <button
          v-for="(c, i) in monthGrid"
          :key="i"
          type="button"
          :class="['mc-cell', { empty: !c.day, today: c.isToday, logged: c.logged && !c.isToday }]"
          :disabled="!c.day"
          :title="c.logged ? `${c.kcal} kcal · 点看详情` : ''"
          @click="pickDay(c.iso)"
        >
          <span v-if="c.day" class="mc-day num">{{ c.day }}</span>
          <span v-if="c.kcal" class="mc-kcal num in">{{ c.kcal }}</span>
          <span v-if="c.out" class="mc-kcal num out">-{{ c.out }}</span>
        </button>
      </div>
      <div class="mc-legend">
        <span class="lg-dot today" aria-hidden="true"></span><span>今天</span>
        <span class="lg-dot logged" aria-hidden="true"></span><span>已记录</span>
        <span class="lg-tip">点某天查看详情</span>
      </div>
    </section>

    <!-- 收起：7 天横滑条 · 每天可点跳日志 · 已记录显示 kcal -->
    <nav v-else class="strip" aria-label="日期选择">
      <button
        v-for="d in dateStrip"
        :key="d.iso"
        :class="['strip-day', { on: d.isToday, logged: d.kcal != null && d.kcal > 0 }]"
        @click="pickDay(d.iso)"
        :aria-label="d.isToday ? '今日 · 详情' : `${d.day} 日 · 详情`"
      >
        <span class="sd-wd">{{ d.wd }}</span>
        <span class="sd-day num">{{ d.day }}</span>
        <span v-if="d.kcal != null && d.kcal > 0" class="sd-kcal num">{{ Math.round(d.kcal) }}</span>
        <span v-else class="sd-dot" aria-hidden="true">·</span>
      </button>
    </nav>

    <!-- 断食横幅（仅进行中） -->
    <router-link v-if="fastingLive" to="/fast" class="fast-banner" :class="{ done: fastingLive.done }">
      <span class="fb-icon" aria-hidden="true">🌙</span>
      <div class="fb-body">
        <p class="fb-title">
          断食中 · <span class="num">{{ fastingLive.label }}</span>
          <span class="fb-time num">{{ fastingLive.elapsed }}</span>
        </p>
        <div class="fb-track">
          <div class="fb-fill" :style="{ width: fastingLive.pct + '%' }"></div>
        </div>
        <p class="fb-sub num">{{ fastingLive.remaining }}</p>
      </div>
      <span class="fb-caret" aria-hidden="true">›</span>
    </router-link>

    <!-- 主卡 · 左环 右进度条 -->
    <section class="hero-card">
      <div class="hero-ring">
        <svg viewBox="0 0 180 180" class="ring">
          <defs>
            <linearGradient id="rgrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--color-primary)" />
              <stop offset="100%" stop-color="var(--color-primary-container)" />
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" :r="RING_R" class="rt" />
          <circle
            cx="90" cy="90" :r="RING_R"
            class="rf"
            :stroke-dasharray="RING_CIRC"
            :stroke-dashoffset="dashOffset"
            stroke="url(#rgrad)"
          />
        </svg>
        <div class="ring-txt">
          <p class="rl">还可以吃</p>
          <p class="rv num">{{ remaining }}</p>
          <p class="ru num">/ {{ kcalGoal || '—' }} kcal</p>
        </div>
      </div>

      <div class="hero-bars">
        <div class="bar-row">
          <div class="bar-head">
            <span class="bh-l">食物摄入</span>
            <span class="bh-r num"><strong>{{ consumed }}</strong> kcal</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill in" :style="{ width: consumedPct + '%' }"></div>
          </div>
        </div>
        <div class="bar-row">
          <div class="bar-head">
            <span class="bh-l">训练消耗</span>
            <span class="bh-r num"><strong>{{ burned }}</strong> kcal</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill out" :style="{ width: burnedPct + '%' }"></div>
          </div>
        </div>
        <div class="bar-row">
          <div class="bar-head">
            <span class="bh-l">活动能量 · Apple</span>
            <span class="bh-r num"><strong>{{ activeKcal }}</strong> kcal</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill active" :style="{ width: activePct + '%' }"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 三大营养素 -->
    <section class="macro-card">
      <div class="mcol">
        <span class="mdot d-carb"></span>
        <div>
          <p class="mn">碳水</p>
          <p class="mv num">{{ macros.carb.v }}<span class="mg">/{{ macros.carb.g }}g</span></p>
        </div>
      </div>
      <div class="mcol">
        <span class="mdot d-prot"></span>
        <div>
          <p class="mn">蛋白质</p>
          <p class="mv num">{{ macros.prot.v }}<span class="mg">/{{ macros.prot.g }}g</span></p>
        </div>
      </div>
      <div class="mcol">
        <span class="mdot d-fat"></span>
        <div>
          <p class="mn">脂肪</p>
          <p class="mv num">{{ macros.fat.v }}<span class="mg">/{{ macros.fat.g }}g</span></p>
        </div>
      </div>
    </section>

    <!-- 4 小卡网格 -->
    <section class="grid4">
      <button class="sc-card" @click="router.push('/body/weight')">
        <div class="sc-head">
          <span class="sc-title">体重</span>
          <span class="sc-add">＋</span>
        </div>
        <p class="sc-v num">
          <template v-if="latestWeightKg != null">{{ latestWeightKg.toFixed(1) }}</template>
          <template v-else>—</template>
          <span class="sc-u"> kg</span>
        </p>
        <p class="sc-sub">{{ latestWeightKg != null ? latestWeightAt : '还没记录 · 记一笔' }}</p>
      </button>

      <button class="sc-card" @click="router.push('/water')">
        <div class="sc-head">
          <span class="sc-title">喝水</span>
          <span class="sc-add">＋</span>
        </div>
        <p class="sc-v num">{{ stats?.waterMl ?? 0 }}<span class="sc-u"> ml</span></p>
        <p class="sc-sub">{{ stats?.waterPct ?? 0 }}% · 目标 {{ stats?.waterGoal ?? goal?.waterMl ?? 2000 }} ml</p>
      </button>

      <button class="sc-card" @click="router.push('/exercise')">
        <div class="sc-head">
          <span class="sc-title">运动</span>
          <span class="sc-add">＋</span>
        </div>
        <p class="sc-v num">{{ burned }}<span class="sc-u"> kcal</span></p>
        <p class="sc-sub">
          <template v-if="exMin > 0"><span class="num">{{ exMin }}</span> 分钟 · 今日</template>
          <template v-else>还没运动 · 挑一项</template>
        </p>
      </button>

      <button class="sc-card" @click="router.push('/body/measure')">
        <div class="sc-head">
          <span class="sc-title">围度</span>
          <span class="sc-add">＋</span>
        </div>
        <p class="sc-v num">
          <template v-if="latestWaistCm != null">{{ latestWaistCm.toFixed(1) }}<span class="sc-u"> cm</span></template>
          <template v-else>—</template>
        </p>
        <p class="sc-sub">{{ latestWaistCm != null ? '最新腰围 · 点击查看' : '腰/臀/胸/臂/体脂' }}</p>
      </button>

      <button class="sc-card" @click="router.push('/body/steps')">
        <div class="sc-head">
          <span class="sc-title">步数</span>
          <span class="sc-add">›</span>
        </div>
        <p class="sc-v num">
          <template v-if="latestSteps != null">{{ latestSteps.toLocaleString() }}</template>
          <template v-else>—</template>
        </p>
        <p class="sc-sub">
          <template v-if="latestSteps != null">最新一日 · 近 30 天均 {{ steps?.avgSteps?.toLocaleString() }}</template>
          <template v-else>Apple 健康导入</template>
        </p>
      </button>

      <button class="sc-card" @click="router.push('/body/sleep')">
        <div class="sc-head">
          <span class="sc-title">睡眠</span>
          <span class="sc-add">›</span>
        </div>
        <p class="sc-v num">
          <template v-if="latestSleep">{{ hm(latestSleep.asleepMin) }}</template>
          <template v-else>—</template>
        </p>
        <p class="sc-sub">
          <template v-if="latestSleep">昨晚 · 近 30 天均 {{ hm(sleep?.avgAsleepMin ?? 0) }}</template>
          <template v-else>Apple 健康导入</template>
        </p>
      </button>
    </section>

    <!-- 今日三餐 -->
    <section class="meals">
      <div class="mtitle">
        <h2 class="section-title">今日三餐</h2>
        <router-link to="/log" class="more">全部记录 ›</router-link>
      </div>
      <ul class="meal-list">
        <li v-for="m in meals" :key="m.key" class="meal" @click="router.push('/log')">
          <span class="meal-icon" :class="'i-' + m.key">{{ m.name[0] }}</span>
          <div class="meal-body">
            <p class="meal-name">{{ m.name }}</p>
            <p class="meal-hint">{{ m.logged ? '已记录' : '还没记录' }}</p>
          </div>
          <span v-if="m.logged" class="meal-kcal num">{{ m.kcal }} <em>kcal</em></span>
          <span v-else class="meal-empty">＋ 记一笔</span>
        </li>
      </ul>
    </section>

    <p v-if="!loading && !goal" class="disclaimer">
      还没设置目标 · <router-link to="/onboarding">去引导</router-link>
    </p>
  </section>
</template>

<style scoped>
.home {
  padding: calc(env(safe-area-inset-top) + var(--space-md)) var(--space-margin-mobile) var(--space-xl);
  background:
    radial-gradient(ellipse at 20% -10%, var(--color-primary-fixed) 0%, transparent 40%),
    var(--color-surface);
  color: var(--color-on-surface);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-height: 100dvh;
}

.topbar { display: flex; justify-content: space-between; align-items: center; }
.date-pill { display: inline-flex; align-items: center; gap: 4px; padding: 8px 14px; border-radius: var(--radius-full); background: var(--color-surface-container-lowest); box-shadow: var(--shadow-card); border: 1px solid var(--color-outline-variant); transition: transform var(--duration-fast); }
.date-pill:active { transform: scale(0.96); }
.date-t { font-size: var(--font-size-caption); font-weight: 600; font-family: var(--font-family-num); color: var(--color-on-surface); letter-spacing: 0.02em; }
.date-caret { font-size: 12px; color: var(--color-primary); transition: transform var(--duration-fast) var(--ease-out-expo); }
.date-pill.open .date-caret { transform: rotate(180deg); }
.avatar { width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-on-primary); font-size: 18px; font-weight: 600; box-shadow: var(--shadow-card); }

/* Date strip */
.strip {
  display: flex; gap: 6px; overflow-x: auto;
  padding: 4px 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.strip::-webkit-scrollbar { display: none; }
.strip-day {
  flex: 0 0 auto; width: 54px; min-height: 72px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  padding: 8px 0;
  border-radius: 14px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  transition: all var(--duration-fast) var(--ease-out-expo);
}
.strip-day.on { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 6px 14px rgba(165, 51, 20, 0.28); }
.strip-day.logged:not(.on) { background: var(--color-secondary-container); border-color: var(--color-secondary); color: var(--color-on-secondary-container); }
.strip-day:active:not(.on) { transform: scale(0.96); }
.sd-kcal { font-size: 10px; letter-spacing: 0.02em; font-weight: 600; font-family: var(--font-family-num); margin-top: 1px; }
.sd-dot { font-size: 12px; color: var(--color-outline); line-height: 1; margin-top: 1px; opacity: 0.5; }
.strip-day.on .sd-kcal { color: var(--color-on-primary); }

/* Month calendar · 现代化 */
.month-cal {
  padding: 16px 14px 14px;
  background: var(--color-surface-container-lowest);
  border-radius: 24px;
  border: 1px solid var(--color-outline-variant);
  box-shadow: 0 12px 32px rgba(29, 25, 23, 0.10), 0 2px 8px rgba(29, 25, 23, 0.04);
}
.mc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.mc-nav { display: flex; align-items: center; gap: 4px; }
.mc-arrow { width: 34px; height: 34px; border-radius: 50%; background: var(--color-surface-container); color: var(--color-on-surface); font-size: 18px; font-weight: 400; transition: all var(--duration-fast); }
.mc-arrow:active { background: var(--color-surface-container-high); transform: scale(0.94); }
.mc-month { font-size: 17px; font-weight: 600; color: var(--color-on-surface); min-width: 96px; text-align: center; letter-spacing: 0.02em; }
.mc-close { display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: var(--radius-full); background: var(--color-primary-fixed); color: var(--color-primary); font-size: var(--font-size-caption); font-weight: 500; transition: all var(--duration-fast); }
.mc-close:active { background: var(--color-primary-fixed-dim); transform: scale(0.96); }
.mc-close svg { stroke: currentColor; }
.mc-wdrow { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
.mc-wd { text-align: center; font-size: 11px; letter-spacing: 0.08em; color: var(--color-outline); padding: 6px 0; font-weight: 500; }
.mc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }

/* 每格：日期 + kcal 数字两行显示 */
.mc-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 2px;
  border-radius: 12px;
  background: transparent;
  color: var(--color-on-surface);
  font-family: var(--font-family-num);
  font-weight: 500;
  border: 0; cursor: pointer;
  padding: 2px 0;
  transition: transform var(--duration-fast) var(--ease-out-expo),
              background var(--duration-fast);
}
.mc-cell.empty { visibility: hidden; }
.mc-cell:disabled { cursor: default; }
.mc-cell:active:not(:disabled) { transform: scale(0.92); }

.mc-day { font-size: 15px; line-height: 1; font-weight: 500; }
.mc-kcal {
  font-size: 9px; line-height: 1;
  font-weight: 600;
  letter-spacing: 0.01em;
  padding: 2px 4px;
  border-radius: 6px;
  min-width: 24px;
  text-align: center;
}
.mc-kcal.in {
  color: var(--color-primary);
  background: var(--color-primary-fixed);
}
.mc-kcal.out {
  color: var(--color-secondary);
  background: var(--color-secondary-container);
  margin-top: 1px;
}

/* 今日：主色渐变 · 突出但不刺眼 */
.mc-cell.today {
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  box-shadow: 0 6px 14px rgba(165, 51, 20, 0.32);
}
.mc-cell.today .mc-day { font-weight: 700; color: inherit; }
.mc-cell.today .mc-kcal.in,
.mc-cell.today .mc-kcal.out {
  background: rgba(255, 255, 255, 0.24);
  color: var(--color-on-primary);
}

/* 已记录：柔和茶绿背景 */
.mc-cell.logged {
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
}
.mc-cell.logged .mc-kcal.in {
  background: rgba(165, 51, 20, 0.14);
  color: var(--color-primary);
}
.mc-cell.logged .mc-kcal.out {
  background: rgba(83, 101, 35, 0.20);
  color: var(--color-secondary);
}

/* Legend 简化 · 单行 */
.mc-legend {
  display: flex; align-items: center; gap: 8px;
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid var(--color-surface-container-high);
  font-size: 11px; letter-spacing: 0.03em; color: var(--color-on-surface-variant);
}
.lg-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.lg-dot.today { background: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-fixed); }
.lg-dot.logged { background: var(--color-secondary); }
.lg-tip { margin-left: auto; color: var(--color-outline); }
.sd-wd { font-size: 10px; letter-spacing: 0.1em; }
.sd-day { font-size: 18px; font-weight: 600; line-height: 1; }

/* Fasting banner */
.fast-banner {
  display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center;
  padding: 12px 16px;
  background: linear-gradient(140deg, var(--color-primary-fixed) 0%, var(--color-surface-container-lowest) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-outline-variant);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06);
  text-decoration: none;
  color: var(--color-on-surface);
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.fast-banner:active { transform: scale(0.99); }
.fast-banner.done {
  background: linear-gradient(140deg, var(--color-secondary-container) 0%, var(--color-tertiary-container) 100%);
}
.fb-icon { font-size: 22px; }
.fb-title { margin: 0; font-size: var(--font-size-caption); font-weight: 600; color: var(--color-on-surface); display: flex; align-items: baseline; gap: 6px; }
.fb-title .num { color: var(--color-primary); font-family: var(--font-family-num); letter-spacing: 0.02em; }
.fb-time { margin-left: auto; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-family: var(--font-family-num); }
.fb-track { margin: 6px 0 4px; height: 4px; border-radius: 2px; background: var(--color-surface-container-high); overflow: hidden; }
.fb-fill { height: 100%; background: var(--color-primary); border-radius: 2px; transition: width var(--duration-slow) var(--ease-out-expo); }
.fast-banner.done .fb-fill { background: var(--color-secondary); }
.fb-sub { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); font-family: var(--font-family-num); }
.fast-banner.done .fb-sub { color: var(--color-on-secondary-container); font-weight: 500; }
.fb-caret { color: var(--color-outline); font-size: 22px; font-weight: 300; }

/* Hero */
.hero-card {
  display: grid;
  grid-template-columns: minmax(140px, 40%) 1fr;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 24px rgba(29, 25, 23, 0.08), 0 2px 6px rgba(29, 25, 23, 0.04);
}
.hero-ring { position: relative; display: grid; place-items: center; }
.ring { width: 100%; max-width: 170px; height: auto; transform: rotate(-90deg); aspect-ratio: 1; }
.rt { fill: none; stroke: var(--color-surface-container-high); stroke-width: 14; }
.rf { fill: none; stroke-width: 14; stroke-linecap: round; transition: stroke-dashoffset var(--duration-slow) var(--ease-out-expo); }
.ring-txt { position: absolute; text-align: center; }
.rl { margin: 0; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.rv { margin: 4px 0 0; font-size: 34px; line-height: 1; font-weight: 600; color: var(--color-on-surface); }
.ru { margin: 2px 0 0; font-size: 10px; color: var(--color-on-surface-variant); }
.hero-bars { display: flex; flex-direction: column; gap: 14px; }
.bar-row { display: flex; flex-direction: column; gap: 6px; }
.bar-head { display: flex; justify-content: space-between; align-items: baseline; }
.bh-l { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.bh-r { font-size: var(--font-size-caption); color: var(--color-on-surface); }
.bh-r strong { font-size: 16px; font-weight: 600; color: var(--color-primary); }
.bar-track { height: 8px; border-radius: 4px; background: var(--color-surface-container-high); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width var(--duration-slow) var(--ease-out-expo); }
.bar-fill.in  { background: linear-gradient(90deg, var(--color-primary), var(--color-primary-container)); }
.bar-fill.out { background: linear-gradient(90deg, var(--color-tertiary), var(--color-tertiary-container)); }
.bar-fill.active { background: linear-gradient(90deg, var(--color-secondary), var(--color-secondary-container)); }

/* Macro card */
.macro-card {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  padding: var(--space-md);
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-xl);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06), 0 1px 3px rgba(29, 25, 23, 0.04);
}
.mcol { display: flex; align-items: center; gap: 8px; }
.mdot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.d-carb { background: var(--color-secondary); }
.d-prot { background: var(--color-primary); }
.d-fat  { background: var(--color-tertiary); }
.mn { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.mv { margin: 2px 0 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-surface); }
.mg { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); margin-left: 2px; }

/* 4-grid */
.grid4 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sc-card {
  text-align: left; padding: 14px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  box-shadow: 0 4px 12px rgba(29, 25, 23, 0.06), 0 1px 3px rgba(29, 25, 23, 0.04);
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.sc-card:active { transform: scale(0.98); }
.sc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sc-title { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); font-weight: 500; }
.sc-add { width: 26px; height: 26px; display: grid; place-items: center; border-radius: var(--radius-full); background: var(--color-primary-fixed); color: var(--color-primary); font-size: 16px; font-weight: 400; }
.sc-v { margin: 0; font-size: 26px; line-height: 1.1; font-weight: 600; color: var(--color-on-surface); }
.sc-u { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); margin-left: 2px; }
.sc-sub { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); }

/* Meals */
.mtitle { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; padding: 0 4px; }
.section-title { margin: 0; font-size: var(--font-size-section); line-height: var(--line-height-section); font-weight: 600; }
.more { font-size: var(--font-size-caption); color: var(--color-primary); text-decoration: none; }
.meal-list { list-style: none; margin: 0; padding: 0; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-card); border: 1px solid var(--color-outline-variant); }
.meal { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 12px; padding: 12px var(--space-md); border-bottom: 1px solid var(--color-surface-container-high); cursor: pointer; transition: background var(--duration-fast); }
.meal:last-child { border-bottom: 0; }
.meal:active { background: var(--color-surface-container); }
.meal-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--radius-full); color: var(--color-on-primary); font-weight: 600; font-size: 16px; }
.i-B { background: var(--color-tertiary); }
.i-L { background: var(--color-primary); }
.i-D { background: var(--color-primary-container); }
.i-S { background: var(--color-secondary); }
.meal-body p { margin: 0; }
.meal-name { font-size: var(--font-size-body); font-weight: 500; color: var(--color-on-surface); }
.meal-hint { font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-outline); margin-top: 2px !important; }
.meal-kcal { font-size: var(--font-size-body); color: var(--color-primary); font-weight: 600; font-family: var(--font-family-num); }
.meal-kcal em { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); font-style: normal; margin-left: 2px; }
.meal-empty { font-size: var(--font-size-caption); color: var(--color-primary); }

.disclaimer { margin: 0; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.disclaimer a { color: var(--color-primary); text-decoration: none; }
</style>
