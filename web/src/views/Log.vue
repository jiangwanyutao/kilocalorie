<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
// dateParam 变化时重拉 · 由 watch(dateParam) 处理
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import Stepper from '@/components/Stepper.vue';
import { mealApi, type DayResponse, type MealEntry, type CreateItemPayload } from '@/api/meal';
import { foodApi, type FoodStdItem } from '@/api/food';
import { pickErrMsg } from '@/api/http';

const route = useRoute();
const router = useRouter();

type MealType = 'B' | 'L' | 'D' | 'S';
const VALID_TYPES: readonly MealType[] = ['B', 'L', 'D', 'S'] as const;

const MEAL: { key: MealType; name: string; hint: string }[] = [
  { key: 'B', name: '早餐', hint: '06:00 - 10:00' },
  { key: 'L', name: '午餐', hint: '11:00 - 14:00' },
  { key: 'D', name: '晚餐', hint: '17:00 - 20:00' },
  { key: 'S', name: '加餐', hint: '零食 · 夜宵 · 补水后' },
];

const loading = ref(true);
const day = ref<DayResponse | null>(null);
const errMsg = ref('');

/** URL 上的日期 · YYYY-MM-DD · 无则今天 */
const dateParam = computed<string | undefined>(() => {
  const q = route.query.date;
  if (typeof q !== 'string') return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : undefined;
});
const isToday = computed(() => {
  if (!dateParam.value) return true;
  return dateParam.value === new Date().toISOString().slice(0, 10);
});
const headerTitle = computed(() => {
  if (isToday.value) return '今日记录';
  const [_, m, d] = dateParam.value!.split('-');
  return `${Number(m)} 月 ${Number(d)} 日 · 记录`;
});

const grouped = computed(() => {
  const map: Record<MealType, MealEntry[]> = { B: [], L: [], D: [], S: [] };
  for (const e of day.value?.entries ?? []) map[e.mealType].push(e);
  return map;
});

const kcalOf = (key: MealType): number => Math.round(day.value?.byType[key] ?? 0);

async function load() {
  loading.value = true;
  errMsg.value = '';
  try {
    day.value = await mealApi.day(dateParam.value);
  } catch (e) {
    errMsg.value = pickErrMsg(e, '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  const rawType = route.query.type;
  const rawOpen = route.query.open;
  const type = typeof rawType === 'string' ? rawType : '';
  if (rawOpen === '1' && VALID_TYPES.includes(type as MealType)) {
    openSheet(type as MealType);
    // 清 query 里的 open/type · 保留 date · 防返回 / 刷新时再次自动打开
    const keep = dateParam.value ? { date: dateParam.value } : {};
    router.replace({ path: '/log', query: keep });
  }
});

/** date query 变了（首页 strip 切日期后跳过来）→ 重拉 */
watch(dateParam, () => { load(); });

// ============ Bottom Sheet 状态 ============
const sheetOpen = ref<MealType | null>(null);
const searchQ = ref('');
const searchResults = ref<FoodStdItem[]>([]);
const searchLoading = ref(false);
const picked = ref<FoodStdItem | null>(null);

// 份量选择：portion（1份）/ h100（100g）/ custom（自定义 g）
const portionMode = ref<'portion' | 'h100' | 'custom'>('portion');
const portionCount = ref<number>(1);
const customG = ref<number>(100);


// 手动模式（没搜到时）
const manualMode = ref(false);
const manualFoodName = ref('');
const manualG = ref<number>(100);
const manualKcal = ref<number>(0);

const submitting = ref(false);

const finalG = computed(() => {
  if (manualMode.value) return Number(manualG.value) || 0;
  if (!picked.value) return 0;
  if (portionMode.value === 'portion') {
    return Math.round(picked.value.portionG * portionCount.value * 10) / 10;
  }
  if (portionMode.value === 'h100') return 100;
  return Number(customG.value) || 0;
});

function scale(v: number): number {
  if (!picked.value || finalG.value <= 0) return 0;
  return Math.round((v * finalG.value) / 100 * 10) / 10;
}
const finalKcal = computed(() => manualMode.value ? Number(manualKcal.value) || 0 : Math.round(scale(picked.value?.kcal ?? 0)));
const finalCarb = computed(() => scale(picked.value?.carbG ?? 0));
const finalProt = computed(() => scale(picked.value?.protG ?? 0));
const finalFat = computed(() => scale(picked.value?.fatG ?? 0));

// Debounced search
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchQ, (v) => {
  if (searchTimer) clearTimeout(searchTimer);
  const q = v.trim();
  if (!q) { searchResults.value = []; return; }
  if (picked.value) return; // 已选择则不再搜
  searchTimer = setTimeout(async () => {
    searchLoading.value = true;
    try {
      searchResults.value = await foodApi.search(q, undefined, 20);
    } catch {
      searchResults.value = [];
    } finally {
      searchLoading.value = false;
    }
  }, 250);
});

function openSheet(m: MealType) {
  sheetOpen.value = m;
  searchQ.value = '';
  searchResults.value = [];
  picked.value = null;
  portionMode.value = 'portion';
  portionCount.value = 1;
  customG.value = 100;
  manualMode.value = false;
  manualFoodName.value = '';
  manualG.value = 100;
  manualKcal.value = 0;
  errMsg.value = '';
}

function closeSheet() { sheetOpen.value = null; }

function pickFood(f: FoodStdItem) {
  picked.value = f;
  searchResults.value = [];
  searchQ.value = f.foodName;
  portionMode.value = 'portion';
  portionCount.value = 1;
  manualMode.value = false;
}

function reselect() {
  picked.value = null;
  searchQ.value = '';
  searchResults.value = [];
}

function toggleManual() {
  manualMode.value = !manualMode.value;
  if (manualMode.value) {
    picked.value = null;
    if (searchQ.value && !manualFoodName.value) manualFoodName.value = searchQ.value;
  }
}

async function submit() {
  if (!sheetOpen.value) return;
  errMsg.value = '';

  let item: CreateItemPayload;
  if (manualMode.value) {
    if (!manualFoodName.value.trim() || manualKcal.value <= 0 || manualG.value <= 0) {
      errMsg.value = '手动录入至少填食物名 · 克数 · 卡路里';
      return;
    }
    item = {
      foodName: manualFoodName.value.trim(),
      foodSrc: 'X',
      portionMode: 'G',
      portionQty: Number(manualG.value),
      actualG: Number(manualG.value),
      kcal: Number(manualKcal.value),
    };
  } else {
    if (!picked.value) { errMsg.value = '请先选择食物'; return; }
    if (finalG.value <= 0) { errMsg.value = '份量无效'; return; }
    const isPortion = portionMode.value === 'portion';
    item = {
      foodName: picked.value.foodName,
      foodId: picked.value.id,
      foodSrc: 'S',
      portionMode: isPortion ? 'P' : 'G',
      portionQty: isPortion ? portionCount.value : finalG.value,
      actualG: finalG.value,
      kcal: finalKcal.value,
      carbG: finalCarb.value,
      protG: finalProt.value,
      fatG: finalFat.value,
    };
  }

  submitting.value = true;
  try {
    // 若指定了 date · 用那天 12:00 作为 mealTime · 否则用现在
    const mealTime = dateParam.value
      ? new Date(`${dateParam.value}T12:00:00`).toISOString()
      : new Date().toISOString();
    await mealApi.createEntry({
      mealType: sheetOpen.value,
      mealTime,
      entrySrc: 'M',
      items: [item],
    });
    closeSheet();
    await load();
  } catch (e) {
    errMsg.value = pickErrMsg(e, '提交失败');
  } finally {
    submitting.value = false;
  }
}

async function delEntry(id: string) {
  if (!confirm('删除这条记录？')) return;
  try { await mealApi.deleteEntry(id); await load(); }
  catch (e) { errMsg.value = pickErrMsg(e, '删除失败'); }
}
</script>

<template>
  <section class="wrap">
    <AppHeader :title="headerTitle" :hide-back="isToday" :back-to="isToday ? undefined : '/'" />

    <div class="body">
      <p v-if="errMsg && !sheetOpen" class="err">{{ errMsg }}</p>

      <!-- 加载骨架 -->
      <template v-if="loading && !day">
        <div v-for="i in 4" :key="i" class="meal-card skel-card">
          <div class="skel-line w40" />
          <div class="skel-line w70" />
        </div>
      </template>

      <article
        v-for="(m, i) in MEAL" :key="m.key"
        class="meal-card" :class="`tint-${i}`"
      >
        <header class="mhead">
          <div class="mleft">
            <span class="memoji" aria-hidden="true">
              {{ m.key === 'B' ? '🥞' : m.key === 'L' ? '🍜' : m.key === 'D' ? '🍚' : '🍎' }}
            </span>
            <div>
              <h2 class="mname">{{ m.name }}</h2>
              <p class="mhint">{{ m.hint }}</p>
            </div>
          </div>
          <div class="mright">
            <span class="mkcal num">{{ kcalOf(m.key) }}<span class="ukcal">kcal</span></span>
            <button
              class="cam-btn" type="button"
              @click="router.push(`/meal/photo?type=${m.key}`)"
              aria-label="拍照识别"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.8"/>
              </svg>
            </button>
            <button
              class="add-btn"
              type="button"
              @click="router.push({ path: '/food/picker', query: { meal: m.key, ...(dateParam ? { date: dateParam } : {}) } })"
              aria-label="记一笔"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <div v-if="grouped[m.key].length" class="entries">
          <div v-for="e in grouped[m.key]" :key="e.id" class="entry">
            <div v-for="it in e.items" :key="it.id" class="item">
              <span class="fn">{{ it.foodName }}</span>
              <span class="fg num">{{ Math.round(Number(it.actualG)) }}g</span>
              <span class="fk num">{{ Math.round(Number(it.kcal)) }} kcal</span>
            </div>
            <button class="del" type="button" @click="delEntry(e.id)">删除</button>
          </div>
        </div>
        <p v-else class="empty">还没记录 · 点 <span class="pill">＋</span> 加一笔</p>
      </article>
    </div>

    <transition name="sheet">
      <div v-if="sheetOpen" class="sheet-mask" @click.self="closeSheet">
        <div class="sheet">
          <div class="handle"></div>
          <h3 class="sheet-title">记一笔 · {{ MEAL.find(x => x.key === sheetOpen)?.name }}</h3>

          <div v-if="!picked && !manualMode" class="search-block">
            <input
              class="search"
              v-model="searchQ"
              type="text"
              placeholder="搜食物 · 米饭 · 茶叶蛋 · 星巴克 · 拼音"
              autocomplete="off"
              autofocus
            />
            <div v-if="searchLoading" class="hint">搜索中…</div>
            <ul v-else-if="searchResults.length" class="results">
              <li v-for="r in searchResults" :key="r.id" class="rrow" @click="pickFood(r)">
                <div class="rmain">
                  <span class="rname">{{ r.foodName }}</span>
                  <span v-if="r.brand" class="rbrand">· {{ r.brand }}</span>
                </div>
                <div class="rside">
                  <span class="rport">{{ r.portionDesc }} · {{ r.portionG }}g</span>
                  <span class="rkcal num">{{ Math.round(r.kcal * r.portionG / 100) }} kcal</span>
                </div>
              </li>
            </ul>
            <p v-else-if="searchQ && !searchLoading" class="hint">
              没找到？<button type="button" class="link" @click="toggleManual">手动录入</button>
            </p>
            <p v-else class="hint">
              试试："米饭" · "茶叶蛋" · "拿铁" · "宫保" · 或 <button type="button" class="link" @click="toggleManual">手动录入</button>
            </p>
          </div>

          <div v-if="picked" class="picked-block">
            <div class="picked-head">
              <div>
                <p class="pname">{{ picked.foodName }}<span v-if="picked.brand" class="pbrand"> · {{ picked.brand }}</span></p>
                <p class="pmeta num">{{ picked.kcal }} kcal / 100g</p>
              </div>
              <button type="button" class="link" @click="reselect">重选</button>
            </div>

            <p class="lbl">份量</p>
            <div class="pchips">
              <button
                type="button"
                class="pchip"
                :class="{ on: portionMode === 'portion' }"
                @click="portionMode = 'portion'"
              >{{ picked.portionDesc || '1 份' }}<br/><span class="pchip-sub">{{ picked.portionG }} g</span></button>
              <button
                type="button"
                class="pchip"
                :class="{ on: portionMode === 'h100' }"
                @click="portionMode = 'h100'"
              >100 g<br/><span class="pchip-sub">称量</span></button>
              <button
                type="button"
                class="pchip"
                :class="{ on: portionMode === 'custom' }"
                @click="portionMode = 'custom'"
              >自定义<br/><span class="pchip-sub">按克数</span></button>
            </div>
            <Stepper
              v-if="portionMode === 'portion'"
              v-model="portionCount"
              label="份数"
              :min="0.5"
              :max="99"
              :step="0.5"
              :decimals="1"
              :hint="`= ${finalG} g`"
            />
            <Stepper
              v-if="portionMode === 'custom'"
              v-model="customG"
              label="克数"
              :min="1"
              :max="9999"
              :step="10"
              :decimals="0"
              hint="克"
            />
            <div v-if="portionMode === 'h100'" class="static-100">
              <span class="s100-label">克数</span>
              <div class="s100-v">100 g</div>
              <span class="s100-hint">称量食物首选</span>
            </div>

            <div class="calc">
              <div class="big-kcal">
                <span class="k num">{{ finalKcal }}</span>
                <span class="v">kcal · {{ finalG }} g</span>
              </div>
              <div class="macros">
                <span>碳水 <b class="num">{{ finalCarb }}</b> g</span>
                <span>蛋白 <b class="num">{{ finalProt }}</b> g</span>
                <span>脂肪 <b class="num">{{ finalFat }}</b> g</span>
              </div>
            </div>
          </div>

          <div v-if="manualMode" class="manual-block">
            <div class="manual-head">
              <p class="lbl">手动录入</p>
              <button type="button" class="link" @click="toggleManual">改用搜索</button>
            </div>
            <label class="field">
              <span class="lbl">食物名</span>
              <input v-model="manualFoodName" type="text" maxlength="50" placeholder="如：外卖 · 家里做的" />
            </label>
            <div class="row2">
              <label class="field">
                <span class="lbl">克数</span>
                <input v-model.number="manualG" type="number" min="1" max="9999" inputmode="numeric" />
              </label>
              <label class="field">
                <span class="lbl">卡路里</span>
                <input v-model.number="manualKcal" type="number" min="0" max="9999" inputmode="numeric" />
              </label>
            </div>
          </div>

          <p v-if="errMsg" class="err">{{ errMsg }}</p>

          <div class="sheet-cta">
            <button type="button" class="ghost" @click="closeSheet">取消</button>
            <button
              type="button"
              class="primary"
              :disabled="submitting || (!picked && !manualMode)"
              @click="submit"
            >{{ submitting ? '保存中…' : '保存' }}</button>
          </div>
        </div>
      </div>
    </transition>
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
  padding: 12px 16px calc(env(safe-area-inset-bottom) + 100px);
  display: flex; flex-direction: column; gap: 14px;
}

.err {
  margin: 0; padding: 10px 14px;
  background: var(--color-error-container);
  color: var(--color-on-error-container);
  border-radius: 14px;
  font-size: 12.5px;
}

/* ─── meal card ─── */
.meal-card {
  padding: 0;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 28px;
  box-shadow: 0 18px 36px -22px rgba(120, 90, 200, 0.20);
  overflow: hidden;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.tint-0 { background: linear-gradient(155deg, #fff4cc 0%, rgba(255, 255, 255, 0.88) 55%); }
.tint-1 { background: linear-gradient(155deg, #ffe0d5 0%, rgba(255, 255, 255, 0.88) 55%); }
.tint-2 { background: linear-gradient(155deg, #eeeaff 0%, rgba(255, 255, 255, 0.88) 55%); }
.tint-3 { background: linear-gradient(155deg, #e6f5d5 0%, rgba(255, 255, 255, 0.88) 55%); }

.mhead {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 18px;
  gap: 8px;
}
.mleft { display: flex; align-items: center; gap: 12px; min-width: 0; }
.memoji {
  font-size: 26px; line-height: 1;
  width: 44px; height: 44px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.7);
  display: grid; place-items: center;
  box-shadow: 0 4px 10px -4px rgba(120, 90, 200, 0.20);
  flex-shrink: 0;
}
.mname { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.01em; }
.mhint { margin: 1px 0 0; font-size: 11px; color: var(--color-on-surface-variant); letter-spacing: 0.03em; }
.mright { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.mkcal {
  font-size: 17px; font-weight: 700;
  color: var(--color-primary);
  font-family: var(--font-family-num);
  letter-spacing: 0.01em;
  display: inline-flex; align-items: baseline; gap: 3px;
}
.ukcal { font-size: 10px; font-weight: 500; color: var(--color-on-surface-variant); font-family: var(--font-family-sans); letter-spacing: 0.03em; }

.add-btn, .cam-btn {
  width: 38px; height: 38px; border: 0; border-radius: 12px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform var(--duration-fast);
}
.add-btn {
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  box-shadow: 0 8px 18px -6px rgba(165, 51, 20, 0.40);
}
.cam-btn {
  background: rgba(255, 255, 255, 0.7);
  color: var(--color-primary);
  border: 1px solid rgba(120, 90, 200, 0.14);
}
.add-btn:active, .cam-btn:active { transform: scale(0.92); }

/* ─── entries ─── */
.entries { display: flex; flex-direction: column; padding: 0 6px 6px; }
.entry {
  padding: 12px 12px 10px;
  margin: 0 0 6px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.62);
}
.entry:last-child { margin-bottom: 6px; }
.item {
  display: grid; grid-template-columns: 1fr auto auto;
  gap: 10px; align-items: baseline;
  padding: 4px 0;
  font-size: 13px;
}
.fn { color: var(--color-on-surface); font-weight: 500; }
.fg { color: var(--color-on-surface-variant); font-family: var(--font-family-num); font-size: 11.5px; letter-spacing: 0.02em; }
.fk { color: var(--color-primary); font-family: var(--font-family-num); font-size: 12.5px; font-weight: 600; letter-spacing: 0.02em; }
.del {
  margin-top: 6px; padding: 4px 12px;
  background: transparent; color: var(--color-error);
  font-size: 11px;
  border: 1px solid rgba(165, 51, 20, 0.24);
  border-radius: 999px;
  cursor: pointer;
}

.empty {
  margin: 0; padding: 18px 16px 22px; text-align: center;
  font-size: 12.5px; color: var(--color-on-surface-variant);
  letter-spacing: 0.03em;
}
.empty .pill {
  display: inline-block;
  padding: 1px 8px; margin: 0 3px;
  border-radius: 999px;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-weight: 600;
}

/* ─── skeleton ─── */
.skel-card {
  padding: 20px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.skel-line {
  height: 14px; border-radius: 7px;
  background: rgba(120, 90, 200, 0.10);
  animation: pulse 1.4s ease-in-out infinite;
}
.skel-line.w40 { width: 40%; }
.skel-line.w70 { width: 70%; }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

/* Bottom Sheet */
.sheet-mask { position: fixed; inset: 0; background: rgba(29,25,23,0.4); display: grid; align-items: end; z-index: 100; }
.sheet { background: var(--color-surface-container-lowest); border-radius: var(--radius-xl) var(--radius-xl) 0 0; padding: 8px var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + var(--space-lg)); box-shadow: var(--shadow-modal); max-height: 85vh; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-md); }
.handle { width: 40px; height: 4px; border-radius: 2px; background: var(--color-outline-variant); margin: 0 auto; }
.sheet-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; }

.search-block { display: flex; flex-direction: column; gap: 10px; }
.search { height: 52px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); }
.search:focus { outline: none; border-color: var(--color-primary); }
.results { list-style: none; margin: 0; padding: 0; max-height: 40vh; overflow-y: auto; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); }
.rrow { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px var(--space-md); border-bottom: 1px solid var(--color-surface-container-high); cursor: pointer; }
.rrow:last-child { border-bottom: 0; }
.rrow:active { background: var(--color-surface-container); }
.rmain { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.rname { font-size: var(--font-size-body); font-weight: 500; }
.rbrand { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.rside { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.rport { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); color: var(--color-outline); }
.rkcal { font-size: var(--font-size-body); color: var(--color-primary); font-family: var(--font-family-num); font-weight: 500; }
.hint { margin: 0; padding: var(--space-sm) 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.link { background: transparent; color: var(--color-primary); font-size: var(--font-size-caption); text-decoration: underline; padding: 0; }

/* Picked */
.picked-block { display: flex; flex-direction: column; gap: 12px; }
.picked-head { display: flex; justify-content: space-between; align-items: flex-start; }
.pname { margin: 0; font-size: var(--font-size-section); font-weight: 600; }
.pbrand { font-size: var(--font-size-caption); font-weight: 400; color: var(--color-on-surface-variant); }
.pmeta { margin: 2px 0 0; font-size: var(--font-size-caption); color: var(--color-outline); font-family: var(--font-family-num); }
.lbl { margin: 0; font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-on-surface-variant); }
.pchips { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.pchip { padding: 10px 8px; border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); color: var(--color-on-surface); font-size: var(--font-size-caption); font-weight: 500; line-height: 1.3; text-align: center; transition: all var(--duration-fast); }
.pchip.on { background: var(--color-primary-fixed); border-color: var(--color-primary); color: var(--color-on-primary-fixed); }
.pchip-sub { font-size: var(--font-size-label); font-weight: 400; color: var(--color-on-surface-variant); font-family: var(--font-family-num); }
.pchip.on .pchip-sub { color: var(--color-on-primary-fixed-variant); }
.custom-g { height: 48px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); font-family: var(--font-family-num); }
.custom-g:focus { outline: none; border-color: var(--color-primary); }

/* h100 静态 */
.static-100 { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 8px 12px; background: var(--color-surface-container-low); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); }
.s100-label { font-size: var(--font-size-label); letter-spacing: var(--letter-spacing-label); text-transform: uppercase; color: var(--color-on-surface-variant); }
.s100-v { text-align: center; font-size: var(--font-size-section); font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.s100-hint { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }

.calc { background: var(--color-surface-container); border-radius: var(--radius-md); padding: var(--space-md); }
.big-kcal { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.big-kcal .k { font-size: 40px; line-height: 1; font-weight: 600; color: var(--color-primary); font-family: var(--font-family-num); }
.big-kcal .v { font-size: var(--font-size-caption); color: var(--color-on-surface-variant); }
.macros { display: flex; gap: 12px; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); flex-wrap: wrap; }
.macros b { color: var(--color-on-surface); font-weight: 500; }

/* Manual */
.manual-block { display: flex; flex-direction: column; gap: 12px; }
.manual-head { display: flex; justify-content: space-between; align-items: center; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field input { height: 48px; padding: 0 var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-outline-variant); background: var(--color-surface-container-lowest); font-size: var(--font-size-body); font-family: var(--font-family-num); }
.field input[type="text"] { font-family: var(--font-family-sans); }
.field input:focus { outline: none; border-color: var(--color-primary); }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.sheet-cta { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-top: var(--space-sm); }
.primary { height: 52px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: var(--shadow-card); }
.primary:disabled { opacity: .5; }
.ghost { height: 52px; border-radius: var(--radius-md); background: transparent; color: var(--color-on-surface-variant); border: 1px solid var(--color-outline-variant); }

.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform var(--duration-normal) var(--ease-out-expo); }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
.sheet-enter-active, .sheet-leave-active { transition: opacity var(--duration-normal); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
