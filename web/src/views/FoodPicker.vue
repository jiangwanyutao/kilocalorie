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

/** 依食物名 + 品牌 + cat_code 智能选 emoji 图标 */
function iconOf(f: FoodStdItem): string {
  const n = f.foodName;
  const b = f.brand ?? '';
  // 品牌优先
  if (b.includes('库迪') || b.includes('瑞幸') || b.includes('星巴克') || b === 'Manner') {
    if (/星冰乐|冰乐|冷萃/.test(n)) return '🥤';
    if (/星冰|奶昔/.test(n)) return '🍦';
    if (/可颂|面包/.test(n)) return '🥐';
    if (/柠檬|果茶|冷萃/.test(n)) return '🍋';
    return '☕';
  }
  if (b.includes('麦当劳') || b.includes('肯德基') || b.includes('汉堡王') || b.includes('塔斯汀') || b.includes('华莱士')) {
    if (/汉堡|堡/.test(n)) return '🍔';
    if (/薯条|华夫脆薯/.test(n)) return '🍟';
    if (/鸡翅|鸡腿|鸡块|全鸡|辣翅|吮指|嫩汁|鸡米花|上校/.test(n)) return '🍗';
    if (/派/.test(n)) return '🥧';
    if (/可乐|雪碧|百事|饮料/.test(n)) return '🥤';
    if (/冰淇淋|圆筒|蛋筒|甜筒/.test(n)) return '🍦';
    if (/粥/.test(n)) return '🍚';
    if (/汤/.test(n)) return '🍲';
    if (/满分/.test(n)) return '🥪';
    return '🍔';
  }
  if (b.includes('蜜雪') || b.includes('喜茶') || b.includes('一点点')) {
    if (/柠檬/.test(n)) return '🍋';
    if (/冰淇淋|蛋筒|圣代/.test(n)) return '🍦';
    if (/芒/.test(n)) return '🥭';
    if (/葡萄/.test(n)) return '🍇';
    if (/桃/.test(n)) return '🍑';
    if (/莓|草莓/.test(n)) return '🍓';
    if (/柚|橙/.test(n)) return '🍊';
    if (/菠萝/.test(n)) return '🍍';
    return '🧋';
  }
  // 关键字匹配
  if (/汉堡|堡/.test(n)) return '🍔';
  if (/薯条|薯片|洋葱圈/.test(n)) return '🍟';
  if (/鸡翅|鸡腿|鸡块|辣翅/.test(n)) return '🍗';
  if (/牛排|排骨|肉排/.test(n)) return '🥩';
  if (/沙拉/.test(n)) return '🥗';
  if (/三明治|贝果|吐司|面包|可颂/.test(n)) return '🥪';
  if (/寿司|饭团/.test(n)) return '🍣';
  if (/披萨/.test(n)) return '🍕';
  if (/蛋糕|布朗尼|马卡龙|慕斯|提拉米苏|蛋挞/.test(n)) return '🍰';
  if (/冰淇淋|雪糕|圣代|蛋筒/.test(n)) return '🍦';
  if (/饼干|奥利奥|曲奇|威化|夹心/.test(n)) return '🍪';
  if (/巧克力/.test(n)) return '🍫';
  if (/糖|棒棒|软糖|棉花糖/.test(n)) return '🍬';
  if (/煎饼|烧饼|饼|烙饼|锅贴/.test(n)) return '🫓';
  if (/饺子|烧麦|包子|馄饨|云吞|蒸饺/.test(n)) return '🥟';
  if (/面|拉面|拌面|捞面|小面|粉|米粉|粿条|凉皮|米线|烩面/.test(n)) return '🍜';
  if (/粥/.test(n)) return '🍚';
  if (/饭|盖饭|便当|拌饭|炒饭/.test(n)) return '🍱';
  if (/米饭|杂粮/.test(n)) return '🍚';
  if (/汤/.test(n)) return '🍲';
  if (/火锅|串|烤/.test(n)) return '🍢';
  if (/寿喜锅/.test(n)) return '🍲';
  if (/奶茶|波霸|珍珠奶茶/.test(n)) return '🧋';
  if (/拿铁|摩卡|美式|卡布奇诺|咖啡|玛奇朵/.test(n)) return '☕';
  if (/可乐|雪碧|芬达|汽水/.test(n)) return '🥤';
  if (/啤酒|白酒|红酒|威士忌/.test(n)) return '🍺';
  if (/牛奶|酸奶|奶粉|炼乳|牛乳/.test(n)) return '🥛';
  if (/豆浆|豆奶/.test(n)) return '🥛';
  if (/柠檬/.test(n)) return '🍋';
  if (/芒果/.test(n)) return '🥭';
  if (/苹果/.test(n)) return '🍎';
  if (/香蕉/.test(n)) return '🍌';
  if (/葡萄|提子/.test(n)) return '🍇';
  if (/草莓|莓/.test(n)) return '🍓';
  if (/桃/.test(n)) return '🍑';
  if (/樱桃|车厘子/.test(n)) return '🍒';
  if (/橙|橘|柑/.test(n)) return '🍊';
  if (/西瓜/.test(n)) return '🍉';
  if (/菠萝|凤梨/.test(n)) return '🍍';
  if (/椰/.test(n)) return '🥥';
  if (/梨/.test(n)) return '🍐';
  if (/牛油果/.test(n)) return '🥑';
  if (/番茄|西红柿|圣女果/.test(n)) return '🍅';
  if (/玉米/.test(n)) return '🌽';
  if (/胡萝卜/.test(n)) return '🥕';
  if (/西兰花|花菜|花椰菜/.test(n)) return '🥦';
  if (/蘑菇|香菇|平菇|杏鲍菇|金针/.test(n)) return '🍄';
  if (/辣椒/.test(n)) return '🌶';
  if (/白菜|生菜|菠菜|芥兰|菜心|空心菜|苋菜/.test(n)) return '🥬';
  if (/黄瓜/.test(n)) return '🥒';
  if (/茄子/.test(n)) return '🍆';
  if (/南瓜/.test(n)) return '🎃';
  if (/花生|坚果|杏仁|开心果|核桃|腰果|松子|榛子|夏威夷/.test(n)) return '🥜';
  if (/瓜子/.test(n)) return '🌻';
  if (/蟹/.test(n)) return '🦀';
  if (/虾/.test(n)) return '🦐';
  if (/鱿鱼|章鱼|墨鱼/.test(n)) return '🦑';
  if (/鱼|三文鱼|带鱼|草鱼|鲈鱼|鲳鱼|鳕鱼|巴沙|龙利/.test(n)) return '🐟';
  if (/贝|扇贝|生蚝|蛤蜊/.test(n)) return '🦪';
  if (/蛋|鸡蛋|鸭蛋|鹌鹑蛋|皮蛋/.test(n)) return '🥚';
  if (/猪|牛|羊|肉/.test(n)) return '🥩';
  // 兜底按 cat_code
  const catFallback: Record<string, string> = {
    '01': '🍚', '02': '🥬', '03': '🍎', '04': '🥩', '05': '🐟',
    '06': '🥚', '07': '🥜', '08': '🥤', '09': '🥐', '11': '🍽', '12': '🍬',
  };
  return catFallback[f.catCode] || '🍽';
}

/** 图标背景色 · 依 cat_code 分组 · 更柔和 */
function iconBg(code: string): string {
  const map: Record<string, string> = {
    '01': 'linear-gradient(135deg, #fef6e2 0%, #fbe9c5 100%)',
    '02': 'linear-gradient(135deg, #eaf5df 0%, #d4ecc0 100%)',
    '03': 'linear-gradient(135deg, #fce8e8 0%, #f8d0d0 100%)',
    '04': 'linear-gradient(135deg, #f3e0d5 0%, #e6c7b3 100%)',
    '05': 'linear-gradient(135deg, #dceeff 0%, #b8daff 100%)',
    '06': 'linear-gradient(135deg, #fef2d4 0%, #fbe4a9 100%)',
    '07': 'linear-gradient(135deg, #ede1cd 0%, #dcc9a8 100%)',
    '08': 'linear-gradient(135deg, #dfe9f7 0%, #b8caea 100%)',
    '09': 'linear-gradient(135deg, #f8e5cd 0%, #f1cea0 100%)',
    '11': 'linear-gradient(135deg, #f0e2d3 0%, #dfc5a6 100%)',
    '12': 'linear-gradient(135deg, #ecd8f0 0%, #dab9e0 100%)',
  };
  return map[code] || 'var(--color-surface-container)';
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
            <div class="icon" :style="{ background: iconBg(f.catCode) }" aria-hidden="true">
              <span class="i-emoji">{{ iconOf(f) }}</span>
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
.icon { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; box-shadow: inset 0 -2px 4px rgba(0,0,0,0.05); }
.i-emoji { font-size: 28px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.08)); }
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
