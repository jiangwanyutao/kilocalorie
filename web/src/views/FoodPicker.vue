<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import Stepper from '@/components/Stepper.vue';
import { foodApi, type FoodStdItem } from '@/api/food';
import { mealApi, type CreateItemPayload } from '@/api/meal';
import { pickErrMsg } from '@/api/http';

type MealType = 'B' | 'L' | 'D' | 'S';
const MEAL_NAME: Record<MealType, string> = { B: '早餐', L: '午餐', D: '晚餐', S: '加餐' };

const route = useRoute();
const router = useRouter();

const meal = computed<MealType>(() => {
  const m = route.query.meal;
  return (m === 'B' || m === 'L' || m === 'D' || m === 'S') ? m : 'B';
});
const date = computed<string | undefined>(() => {
  const d = route.query.date;
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
});

interface Cat { code: string; label: string; emoji: string; group?: string; }
/** 左侧竖排 tabs · 分三组：个人 · 品牌 · 分类 */
const CATS: Cat[] = [
  { code: '__mine__',  label: '我的上传', emoji: '📤', group: 'me' },
  { code: '__custom__',label: '自定义',   emoji: '✏',  group: 'me' },
  { code: '__fav__',   label: '收藏',     emoji: '❤',  group: 'me' },
  { code: '__used__',  label: '常用',     emoji: '⭐', group: 'me' },
  { code: '__ku__',    label: '库迪',     emoji: '☕', group: 'brand' },
  { code: '__lu__',    label: '瑞幸',     emoji: '🥤', group: 'brand' },
  { code: '01',        label: '主食杂粮', emoji: '🍚', group: 'cat' },
  { code: '06_04',     label: '肉蛋奶',   emoji: '🥚', group: 'cat' },
  { code: '02_03',     label: '蔬果',     emoji: '🥬', group: 'cat' },
  { code: '05',        label: '海鲜水产', emoji: '🐟', group: 'cat' },
  { code: '07',        label: '豆类坚果', emoji: '🥜', group: 'cat' },
  { code: '11',        label: '中西菜肴', emoji: '🍜', group: 'cat' },
  { code: '08',        label: '饮料',     emoji: '🥛', group: 'cat' },
  { code: '09',        label: '烘焙甜点', emoji: '🥐', group: 'cat' },
  { code: '12',        label: '零食',     emoji: '🍪', group: 'cat' },
];

const activeCat = ref<string>('__used__');
const q = ref('');
const items = ref<FoodStdItem[]>([]);
const loading = ref(false);
const err = ref('');

/** 收藏集合 · 用 API 拉 · 展示星标 & toggle */
const favSet = ref<Set<string>>(new Set());
async function refreshFavSet() {
  try {
    const list = await foodApi.favorites();
    favSet.value = new Set(list.map((f) => f.id));
  } catch { /* silent */ }
}

async function toggleFav(id: string, ev?: Event) {
  ev?.stopPropagation();
  // 后端 toggle · 只支持 foodSrc=S（自定义 U 的 toggle 由自建页管理）
  try {
    const r = await foodApi.toggleFavorite('S', id);
    const s = new Set(favSet.value);
    if (r.favorited) s.add(id); else s.delete(id);
    favSet.value = s;
    if (activeCat.value === '__fav__') load(); // 刷新列表
  } catch (e) {
    err.value = pickErrMsg(e, '操作失败');
  }
}

async function load() {
  loading.value = true;
  err.value = '';
  try {
    const cat = activeCat.value;
    if (cat === '__fav__') items.value = await foodApi.favorites();
    else if (cat === '__used__') items.value = await foodApi.frequent(60);
    else if (cat === '__mine__' || cat === '__custom__') items.value = await foodApi.userFoods(60);
    else if (cat === '__ku__') items.value = await foodApi.search('库迪', undefined, 60);
    else if (cat === '__lu__') items.value = await foodApi.search('瑞幸', undefined, 60);
    else if (cat === '06_04') {
      const [a, b] = await Promise.all([foodApi.search('', '06', 40), foodApi.search('', '04', 40)]);
      items.value = [...a, ...b];
    } else if (cat === '02_03') {
      const [a, b] = await Promise.all([foodApi.search('', '02', 40), foodApi.search('', '03', 40)]);
      items.value = [...a, ...b];
    } else {
      items.value = await foodApi.search(q.value.trim() || undefined, cat || undefined, 60);
    }
  } catch (e) {
    err.value = pickErrMsg(e, '加载失败');
    items.value = [];
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(q, (v) => {
  if (searchTimer) clearTimeout(searchTimer);
  if (v.trim()) {
    // 有搜索词 · 切到"全部搜索"模式（不受 tab 限制）
    searchTimer = setTimeout(async () => {
      loading.value = true;
      try { items.value = await foodApi.search(v.trim(), undefined, 60); }
      catch (e) { err.value = pickErrMsg(e, '搜索失败'); }
      finally { loading.value = false; }
    }, 250);
  } else {
    load();
  }
});
watch(activeCat, () => { q.value = ''; load(); });
onMounted(async () => {
  await refreshFavSet();
  load();
});

// ── 份量选择 sheet ──
const picked = ref<FoodStdItem | null>(null);
const portionMode = ref<'portion' | 'h100' | 'custom'>('portion');
const portionCount = ref(1);
const customG = ref(100);
const submitting = ref(false);

function pickFood(f: FoodStdItem, ev?: Event) {
  ev?.stopPropagation();
  picked.value = f;
  portionMode.value = 'portion';
  portionCount.value = 1;
  customG.value = 100;
  err.value = '';
}
function closeSheet() { picked.value = null; }

const finalG = computed(() => {
  const f = picked.value;
  if (!f) return 0;
  if (portionMode.value === 'portion') return Math.round(f.portionG * portionCount.value * 10) / 10;
  if (portionMode.value === 'h100') return 100;
  return Number(customG.value) || 0;
});
function scale(v: number): number {
  const f = picked.value;
  if (!f || finalG.value <= 0) return 0;
  return Math.round((v * finalG.value) / 100 * 10) / 10;
}
const finalKcal = computed(() => Math.round(scale(picked.value?.kcal ?? 0)));
const finalCarb = computed(() => scale(picked.value?.carbG ?? 0));
const finalProt = computed(() => scale(picked.value?.protG ?? 0));
const finalFat  = computed(() => scale(picked.value?.fatG  ?? 0));

async function submit() {
  const f = picked.value;
  if (!f || finalG.value <= 0) { err.value = '份量无效'; return; }
  submitting.value = true;
  err.value = '';
  try {
    const isPortion = portionMode.value === 'portion';
    const item: CreateItemPayload = {
      foodName: f.foodName, foodId: f.id, foodSrc: 'S',
      portionMode: isPortion ? 'P' : 'G',
      portionQty: isPortion ? portionCount.value : finalG.value,
      actualG: finalG.value,
      kcal: finalKcal.value, carbG: finalCarb.value, protG: finalProt.value, fatG: finalFat.value,
    };
    const mealTime = date.value
      ? new Date(`${date.value}T12:00:00`).toISOString()
      : new Date().toISOString();
    await mealApi.createEntry({ mealType: meal.value, mealTime, entrySrc: 'M', items: [item] });
    // 常用 · 由后端 meal_item 统计 · 不再本地
    router.replace({ path: '/log', query: date.value ? { date: date.value } : {} });
  } catch (e) {
    err.value = pickErrMsg(e, '保存失败');
  } finally { submitting.value = false; }
}

// ── 自定义添加 sheet ──
const customOpen = ref(false);
const customName = ref('');
const customKcal = ref<number>(0);
const customGramInput = ref<number>(100);

function openCustom() {
  customOpen.value = true;
  customName.value = q.value.trim() || '';
  customKcal.value = 0;
  customGramInput.value = 100;
  err.value = '';
}
function closeCustom() { customOpen.value = false; }

async function submitCustom() {
  if (!customName.value.trim() || customKcal.value <= 0 || customGramInput.value <= 0) {
    err.value = '至少填名字 · 克数 · 卡路里';
    return;
  }
  submitting.value = true;
  try {
    const item: CreateItemPayload = {
      foodName: customName.value.trim(),
      foodSrc: 'X',
      portionMode: 'G',
      portionQty: Number(customGramInput.value),
      actualG: Number(customGramInput.value),
      kcal: Number(customKcal.value),
    };
    const mealTime = date.value
      ? new Date(`${date.value}T12:00:00`).toISOString()
      : new Date().toISOString();
    await mealApi.createEntry({ mealType: meal.value, mealTime, entrySrc: 'M', items: [item] });
    router.replace({ path: '/log', query: date.value ? { date: date.value } : {} });
  } catch (e) {
    err.value = pickErrMsg(e, '保存失败');
  } finally { submitting.value = false; }
}

function servingKcal(f: FoodStdItem): number {
  return Math.round((f.kcal * f.portionG) / 100);
}

/** 分类下彩色圆点（依 cat_code · 视觉区分） */
function dotColor(code: string): string {
  const map: Record<string, string> = {
    '01': '#c8b168', '02': '#7dbf76', '03': '#e58f8f',
    '04': '#c67a5c', '05': '#4a90c4', '06': '#e5b96a',
    '07': '#a68a5b', '08': '#7fa7d8', '09': '#e0a468',
    '11': '#c48865', '12': '#b988c4',
  };
  return map[code] || 'var(--color-primary)';
}
</script>

<template>
  <section class="wrap">
    <AppHeader :title="'食物库 · ' + MEAL_NAME[meal]" :back-to="'/log' + (date ? '?date=' + date : '')" />

    <div class="search-row">
      <div class="search-box">
        <span class="s-icon" aria-hidden="true">🔍</span>
        <input v-model="q" type="text" placeholder="搜食物" enterkeyhint="search" />
        <button v-if="q" class="s-clear" type="button" @click="q = ''" aria-label="清除">×</button>
      </div>
      <button class="unit-btn" type="button" aria-label="称量模式">
        <span aria-hidden="true">⚖</span> 千卡
      </button>
    </div>

    <div class="main">
      <!-- 左侧竖排 tabs -->
      <nav class="sidebar" aria-label="分类">
        <template v-for="(c, i) in CATS" :key="c.code">
          <div
            v-if="i > 0 && CATS[i - 1].group !== c.group"
            class="side-divider"
            aria-hidden="true"
          ></div>
          <button
            type="button"
            :class="['side-tab', { on: activeCat === c.code }]"
            @click="activeCat = c.code"
          >{{ c.label }}</button>
        </template>
      </nav>

      <!-- 右侧食物列表 -->
      <div class="list-wrap">
        <p v-if="err" class="err">{{ err }}</p>

        <div v-if="loading" class="hint">加载中…</div>
        <div v-else-if="items.length === 0" class="empty">
          <p v-if="activeCat === '__fav__'">还没收藏 · 点右上角 ♡</p>
          <p v-else-if="activeCat === '__used__'">还没常用 · 记过几笔后自动出现</p>
          <p v-else-if="activeCat === '__mine__' || activeCat === '__custom__'">还没自建食物 · 点下方 "自定义添加"</p>
          <p v-else-if="q">没找到 "{{ q }}"</p>
          <p v-else>这个分类还没数据</p>
          <p class="e-hint">点下方"自定义添加"手动录入</p>
        </div>

        <ul v-else class="food-list">
          <li v-for="f in items" :key="f.id" class="row" @click="pickFood(f)">
            <div class="icon" :style="{ background: 'var(--color-surface-container)' }" aria-hidden="true">
              <span class="i-emoji">🍽</span>
            </div>
            <div class="row-body">
              <p class="rn">
                <span class="dot" :style="{ background: dotColor(f.catCode) }"></span>
                {{ f.foodName }}
              </p>
              <p class="rmeta num">{{ servingKcal(f) }} 千卡 / {{ f.portionDesc }}<span v-if="f.portionG"> ({{ f.portionG }}g)</span></p>
            </div>
            <button type="button" class="add" :aria-label="'加 ' + f.foodName" @click="pickFood(f, $event)">＋</button>
          </li>
        </ul>
      </div>
    </div>

    <!-- 底部大按钮：自定义添加 -->
    <div class="footer">
      <button type="button" class="custom-btn" @click="openCustom">自定义添加</button>
    </div>

    <!-- 份量 sheet -->
    <transition name="sheet">
      <div v-if="picked" class="sheet-mask" @click.self="closeSheet">
        <div class="sheet">
          <div class="handle"></div>
          <div class="p-head">
            <div class="p-title">
              <p class="p-name">{{ picked.foodName }}</p>
              <p class="p-meta num">{{ picked.kcal }} kcal / 100 g</p>
            </div>
            <button type="button" :class="['fav-big', { on: favSet.has(picked.id) }]" @click="toggleFav(picked.id)">
              {{ favSet.has(picked.id) ? '❤ 已收藏' : '♡ 收藏' }}
            </button>
          </div>
          <p class="lbl">份量</p>
          <div class="chips">
            <button type="button" class="chip" :class="{ on: portionMode === 'portion' }" @click="portionMode = 'portion'">
              {{ picked.portionDesc || '1 份' }}<br/><span class="chip-sub">{{ picked.portionG }} g</span>
            </button>
            <button type="button" class="chip" :class="{ on: portionMode === 'h100' }" @click="portionMode = 'h100'">
              100 g<br/><span class="chip-sub">称量</span>
            </button>
            <button type="button" class="chip" :class="{ on: portionMode === 'custom' }" @click="portionMode = 'custom'">
              自定义<br/><span class="chip-sub">按克数</span>
            </button>
          </div>
          <Stepper v-if="portionMode === 'portion'" v-model="portionCount" label="份数" :min="0.5" :max="99" :step="0.5" :decimals="1" :hint="`= ${finalG} g`" />
          <Stepper v-if="portionMode === 'custom'" v-model="customG" label="克数" :min="1" :max="9999" :step="10" :decimals="0" hint="克" />
          <div class="calc">
            <div class="calc-big">
              <span class="ck num">{{ finalKcal }}</span>
              <span class="cu">kcal · {{ finalG }} g</span>
            </div>
            <div class="macros">
              <span>碳水 <b class="num">{{ finalCarb }}</b> g</span>
              <span>蛋白 <b class="num">{{ finalProt }}</b> g</span>
              <span>脂肪 <b class="num">{{ finalFat }}</b> g</span>
            </div>
          </div>
          <p v-if="err" class="err in-sheet">{{ err }}</p>
          <div class="cta">
            <button type="button" class="ghost" @click="closeSheet">取消</button>
            <button type="button" class="primary" :disabled="submitting" @click="submit">
              {{ submitting ? '保存中…' : '加到 ' + MEAL_NAME[meal] }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 自定义添加 sheet -->
    <transition name="sheet">
      <div v-if="customOpen" class="sheet-mask" @click.self="closeCustom">
        <div class="sheet">
          <div class="handle"></div>
          <p class="p-name">自定义添加</p>
          <p class="c-hint">用于外卖 / 家里做的 / 库里没有的食物</p>
          <label class="field">
            <span class="lbl">名字</span>
            <input v-model="customName" type="text" maxlength="50" placeholder="如：外卖 · 干煎带鱼" />
          </label>
          <div class="row2">
            <label class="field">
              <span class="lbl">克数</span>
              <input v-model.number="customGramInput" type="number" min="1" max="9999" inputmode="numeric" />
            </label>
            <label class="field">
              <span class="lbl">卡路里</span>
              <input v-model.number="customKcal" type="number" min="0" max="9999" inputmode="numeric" />
            </label>
          </div>
          <p v-if="err" class="err in-sheet">{{ err }}</p>
          <div class="cta">
            <button type="button" class="ghost" @click="closeCustom">取消</button>
            <button type="button" class="primary" :disabled="submitting" @click="submitCustom">
              {{ submitting ? '保存中…' : '加到 ' + MEAL_NAME[meal] }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.wrap { height: 100dvh; background: var(--color-surface); color: var(--color-on-surface); display: flex; flex-direction: column; overflow: hidden; }

/* 顶部搜索 */
.search-row { display: flex; gap: 8px; padding: var(--space-md) var(--space-margin-mobile) var(--space-sm); }
.search-box { flex: 1; position: relative; height: 44px; display: flex; align-items: center; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-full); padding: 0 12px; }
.s-icon { font-size: 16px; color: var(--color-outline); margin-right: 6px; }
.search-box input { flex: 1; background: transparent; border: 0; outline: 0; font-size: var(--font-size-body); color: var(--color-on-surface); }
.s-clear { width: 24px; height: 24px; border-radius: 50%; background: var(--color-surface-container-high); color: var(--color-outline); font-size: 14px; padding: 0; }
.unit-btn { flex-shrink: 0; height: 44px; padding: 0 14px; border-radius: var(--radius-full); background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); color: var(--color-on-surface); font-size: var(--font-size-caption); display: inline-flex; align-items: center; gap: 4px; }

/* 主区：左侧 tabs + 右侧列表 · 各自独立滚动 · 页面 body 不滚 */
.main { flex: 1; display: grid; grid-template-columns: 88px 1fr; gap: 0; min-height: 0; overflow: hidden; }

.sidebar { display: flex; flex-direction: column; gap: 4px; padding: 8px 6px 8px 12px; background: var(--color-surface-container); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; min-height: 0; }
.sidebar::-webkit-scrollbar { display: none; }
.side-tab { padding: 12px 0; background: transparent; color: var(--color-on-surface-variant); font-size: var(--font-size-caption); text-align: center; border-radius: var(--radius-md); transition: all var(--duration-fast); }
.side-tab.on { background: var(--color-surface); color: var(--color-primary); font-weight: 600; box-shadow: 0 2px 6px rgba(29, 25, 23, 0.06); }
.side-divider { height: 1px; background: var(--color-outline-variant); margin: 4px 12px; }

.list-wrap { padding: 8px 12px calc(env(safe-area-inset-bottom) + 96px) 10px; overflow-y: auto; overscroll-behavior: contain; min-height: 0; }
.food-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row { display: grid; grid-template-columns: 52px 1fr 36px; gap: 10px; align-items: center; padding: 10px 12px; background: var(--color-surface-container-lowest); border-radius: var(--radius-lg); border: 1px solid var(--color-outline-variant); cursor: pointer; transition: background var(--duration-fast); }
.row:active { background: var(--color-surface-container); }
.icon { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; }
.i-emoji { font-size: 26px; }
.row-body { min-width: 0; }
.rn { margin: 0; font-size: var(--font-size-body); font-weight: 500; color: var(--color-on-surface); display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.rmeta { margin: 2px 0 0; font-size: var(--font-size-label); letter-spacing: 0.02em; color: var(--color-outline); font-family: var(--font-family-num); }
.add { width: 36px; height: 36px; border-radius: 50%; background: var(--color-surface-container); color: var(--color-primary); font-size: 20px; padding: 0; font-weight: 300; border: 0; }
.add:active { background: var(--color-primary-fixed); }

.hint, .empty { padding: 40px 20px; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.empty { display: flex; flex-direction: column; gap: 6px; }
.e-hint { font-size: var(--font-size-label); color: var(--color-outline); margin: 0; }
.err { margin: 8px 12px; padding: 8px 12px; background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }
.err.in-sheet { margin: 0; }

/* 底部大按钮 */
.footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 12px); background: linear-gradient(to top, var(--color-surface) 60%, transparent); z-index: 40; }
.custom-btn { display: block; width: min(360px, 100%); margin: 0 auto; height: 52px; border-radius: var(--radius-full); background: var(--color-inverse-surface); color: var(--color-inverse-on-surface); font-size: var(--font-size-body); font-weight: 500; box-shadow: 0 8px 20px rgba(29, 25, 23, 0.24); border: 0; }
.custom-btn:active { transform: scale(0.98); }

/* Sheet */
.sheet-mask { position: fixed; inset: 0; background: rgba(29,25,23,0.4); display: grid; align-items: end; z-index: 100; }
.sheet { background: var(--color-surface-container-lowest); border-radius: var(--radius-xl) var(--radius-xl) 0 0; padding: 8px var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-lg)); max-height: 85vh; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-md); }
.handle { width: 40px; height: 4px; border-radius: 2px; background: var(--color-outline-variant); margin: 0 auto; }
.p-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.p-name { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-surface); }
.p-meta { margin: 2px 0 0; font-size: var(--font-size-caption); color: var(--color-outline); font-family: var(--font-family-num); }
.c-hint { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.fav-big { padding: 6px 12px; border-radius: var(--radius-full); background: var(--color-surface-container); color: var(--color-on-surface-variant); border: 1px solid var(--color-outline-variant); font-size: var(--font-size-caption); }
.fav-big.on { background: var(--color-primary-fixed); color: var(--color-primary); border-color: var(--color-primary); }

.lbl { margin: 0; font-size: var(--font-size-label); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-on-surface-variant); }
.chips { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.chip { padding: 10px 8px; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-caption); font-weight: 500; line-height: 1.3; text-align: center; }
.chip.on { background: var(--color-primary-fixed); border-color: var(--color-primary); color: var(--color-on-primary-fixed); }
.chip-sub { font-size: var(--font-size-label); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-num); }
.chip.on .chip-sub { color: var(--color-on-primary-fixed-variant); }

.field { display: flex; flex-direction: column; gap: 4px; }
.field input { height: 48px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); font-family: var(--font-family-num); }
.field input[type="text"] { font-family: var(--font-family-sans); }
.field input:focus { outline: none; border-color: var(--color-primary); }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.calc { background: var(--color-surface-container); border-radius: var(--radius-md); padding: var(--space-md); }
.calc-big { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.ck { font-size: 40px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.cu { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.macros { display: flex; gap: 12px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); flex-wrap: wrap; }
.macros b { color: var(--color-on-surface); font-weight: 500; }

.cta { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-top: var(--space-sm); }
.primary { height: 52px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:disabled { opacity: .5; }
.ghost { height: 52px; border-radius: var(--radius-md); background: transparent; color: var(--color-on-surface-variant); border: 1px solid var(--color-outline-variant); }

.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform var(--duration-normal) var(--ease-out-expo); }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
.sheet-enter-active, .sheet-leave-active { transition: opacity var(--duration-normal); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
