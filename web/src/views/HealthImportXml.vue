<script setup lang="ts">
import { computed, ref } from 'vue';
import JSZip from 'jszip';
import AppHeader from '@/components/AppHeader.vue';
import { http, KEY } from '@/api/http';

type Stage = 'idle' | 'unzipping' | 'parsing' | 'uploading' | 'done' | 'error';

const stage = ref<Stage>('idle');
const errMsg = ref('');
const fileName = ref('');
const fileSizeMb = ref(0);
const parseProgress = ref(0);
const parsedCount = ref(0);

interface Aggregate {
  weights: { date: string; value: number; source?: string }[];
  // 按 day → source → 累加 · 上传时取 max（同一天多设备算重复 · Apple Health UI 也这么去重）
  stepsPerDaySrc: Map<string, Map<string, number>>;
  distancePerDaySrc: Map<string, Map<string, number>>;
  activeKcalPerDaySrc: Map<string, Map<string, number>>;
  workouts: {
    activityType: string; date: string; startTime: string; endTime: string;
    durationMin: number; kcalBurned?: number; distanceM?: number; source?: string;
  }[];
  sleepPerNight: Map<string, {
    asleepMin: number; inBedMin: number; deepMin: number; remMin: number;
    startTime: string; endTime: string;
  }>;
}

const aggregate = ref<Aggregate>({
  weights: [], stepsPerDaySrc: new Map(), distancePerDaySrc: new Map(),
  activeKcalPerDaySrc: new Map(), workouts: [], sleepPerNight: new Map(),
});

function addToDaySrc(map: Map<string, Map<string, number>>, day: string, src: string, value: number) {
  let byDay = map.get(day);
  if (!byDay) { byDay = new Map(); map.set(day, byDay); }
  byDay.set(src, (byDay.get(src) ?? 0) + value);
}
function maxOfSources(m: Map<string, number>): number {
  let x = 0;
  for (const v of m.values()) if (v > x) x = v;
  return x;
}

const uploadStats = ref({
  totalBatches: 0, sentBatches: 0,
  weight: 0, steps: 0, distance: 0, activeKcal: 0, workout: 0, sleep: 0,
  errors: 0,
});

const fileInput = ref<HTMLInputElement | null>(null);

function pickFile() { fileInput.value?.click(); }

function parseAppleDate(s: string): Date {
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s*([-+]\d{2}):?(\d{2}))?/);
  if (!m) return new Date(s);
  const iso = `${m[1]}T${m[2]}${m[3] ? m[3] + ':' + m[4] : 'Z'}`;
  return new Date(iso);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  fileName.value = file.name;
  fileSizeMb.value = Math.round(file.size / 1024 / 1024 * 10) / 10;
  errMsg.value = '';
  input.value = '';
  try {
    await handle(file);
  } catch (err) {
    stage.value = 'error';
    errMsg.value = (err as Error).message ?? '未知错误';
  }
}

async function handle(file: File) {
  let xmlText: string;
  if (file.name.endsWith('.zip')) {
    stage.value = 'unzipping';
    const zip = await JSZip.loadAsync(file);
    // 匹配主健康 XML · 多语言 · 排除 _cda.xml（临床文档 · 我们不用）
    // 找主 XML · 多语言 · 排除 _cda.xml（临床文档 · 我们不用）
    const entry = Object.values(zip.files).find((f) =>
      !f.dir &&
      f.name.toLowerCase().endsWith('.xml') &&
      !f.name.toLowerCase().endsWith('_cda.xml'),
    );
    if (!entry) throw new Error('zip 里没找到主 XML · 你确定这是 iOS 健康导出的 zip 吗？');
    xmlText = await entry.async('string');
  } else if (file.name.endsWith('.xml')) {
    xmlText = await file.text();
  } else {
    throw new Error('只支持 .zip 或 .xml · 你传的是: ' + file.name);
  }

  stage.value = 'parsing';
  await parseAndAggregate(xmlText);

  stage.value = 'uploading';
  await uploadAll();

  stage.value = 'done';
}

async function parseAndAggregate(xml: string) {
  const A: Aggregate = {
    weights: [], stepsPerDaySrc: new Map(), distancePerDaySrc: new Map(),
    activeKcalPerDaySrc: new Map(), workouts: [], sleepPerNight: new Map(),
  };

  const recordRe = /<Record[^>]*\/>|<Record[^>]*>[\s\S]*?<\/Record>/g;
  const workoutRe = /<Workout\b[^>]*>[\s\S]*?<\/Workout>|<Workout\b[^>]*\/>/g;

  let m: RegExpExecArray | null;
  let counter = 0;

  const yieldPoint = async () => {
    parsedCount.value = counter;
    parseProgress.value = Math.min(100, Math.round(counter / 500));
    await new Promise((r) => setTimeout(r, 0));
  };

  while ((m = recordRe.exec(xml))) {
    counter++;
    const seg = m[0];
    const type = /type="([^"]+)"/.exec(seg)?.[1];
    if (!type) continue;
    const val = Number(/value="([^"]+)"/.exec(seg)?.[1] ?? '');
    const start = /startDate="([^"]+)"/.exec(seg)?.[1];
    const end = /endDate="([^"]+)"/.exec(seg)?.[1];
    const src = /sourceName="([^"]+)"/.exec(seg)?.[1];
    if (!start || !end) continue;
    const sd = parseAppleDate(start), ed = parseAppleDate(end);

    if (type.endsWith('BodyMass')) {
      if (Number.isFinite(val) && val >= 20 && val <= 300) {
        A.weights.push({ date: ed.toISOString(), value: val, source: src });
      }
    } else if (type.endsWith('StepCount')) {
      addToDaySrc(A.stepsPerDaySrc, dateKey(ed), src ?? '?', val);
    } else if (type.endsWith('DistanceWalkingRunning') || type.endsWith('DistanceCycling')) {
      const unit = /unit="([^"]+)"/.exec(seg)?.[1] ?? '';
      const meters = unit === 'km' ? val * 1000 : val;
      addToDaySrc(A.distancePerDaySrc, dateKey(ed), src ?? '?', meters);
    } else if (type.endsWith('ActiveEnergyBurned')) {
      addToDaySrc(A.activeKcalPerDaySrc, dateKey(ed), src ?? '?', val);
    } else if (type.endsWith('SleepAnalysis')) {
      const svRaw = /value="([^"]+)"/.exec(seg)?.[1] ?? '';
      const sv = svRaw.toLowerCase();
      const key = dateKey(ed);
      const rec = A.sleepPerNight.get(key) ?? {
        asleepMin: 0, inBedMin: 0, deepMin: 0, remMin: 0,
        startTime: sd.toISOString(), endTime: ed.toISOString(),
      };
      const dur = Math.max(0, (ed.getTime() - sd.getTime()) / 60_000);
      if (sv.includes('inbed')) rec.inBedMin += dur;
      else if (sv.includes('asleepdeep')) { rec.deepMin += dur; rec.asleepMin += dur; }
      else if (sv.includes('asleeprem')) { rec.remMin += dur; rec.asleepMin += dur; }
      else if (sv.includes('asleep')) rec.asleepMin += dur;
      if (sd.getTime() < parseAppleDate(rec.startTime).getTime()) rec.startTime = sd.toISOString();
      if (ed.getTime() > parseAppleDate(rec.endTime).getTime()) rec.endTime = ed.toISOString();
      A.sleepPerNight.set(key, rec);
    }
    if (counter % 500 === 0) await yieldPoint();
  }

  while ((m = workoutRe.exec(xml))) {
    counter++;
    const seg = m[0];
    const actType = /workoutActivityType="([^"]+)"/.exec(seg)?.[1];
    const duration = Number(/duration="([^"]+)"/.exec(seg)?.[1] ?? '');
    const durUnit = /durationUnit="([^"]+)"/.exec(seg)?.[1] ?? 'min';
    const durationMin = durUnit === 's' ? Math.round(duration / 60) : Math.round(duration);
    const kcal = Number(/totalEnergyBurned="([^"]+)"/.exec(seg)?.[1] ?? '');
    const dist = Number(/totalDistance="([^"]+)"/.exec(seg)?.[1] ?? '');
    const distUnit = /totalDistanceUnit="([^"]+)"/.exec(seg)?.[1] ?? 'km';
    const start = /startDate="([^"]+)"/.exec(seg)?.[1];
    const end = /endDate="([^"]+)"/.exec(seg)?.[1];
    const src = /sourceName="([^"]+)"/.exec(seg)?.[1];
    if (!actType || !start || !end || durationMin < 1) continue;
    A.workouts.push({
      activityType: actType,
      date: parseAppleDate(start).toISOString(),
      startTime: parseAppleDate(start).toISOString(),
      endTime: parseAppleDate(end).toISOString(),
      durationMin,
      kcalBurned: Number.isFinite(kcal) && kcal > 0 ? kcal : undefined,
      distanceM: Number.isFinite(dist) && dist > 0 ? (distUnit === 'km' ? dist * 1000 : dist) : undefined,
      source: src,
    });
    if (counter % 500 === 0) await yieldPoint();
  }
  await yieldPoint();
  aggregate.value = A;
}

async function uploadAll() {
  const samples: Record<string, unknown>[] = [];
  const A = aggregate.value;

  const wLatest = new Map<string, { date: string; value: number; source?: string }>();
  for (const w of A.weights) wLatest.set(dateKey(new Date(w.date)), w);
  for (const w of wLatest.values()) samples.push({ type: 'weight', value: w.value, date: w.date, source: w.source });

  // 多设备同一天数据 · 取最大值（Apple Health UI 的默认去重逻辑：Watch > iPhone > 其他 · 但 max 是最简的近似）
  for (const [k, srcMap] of A.stepsPerDaySrc) samples.push({ type: 'steps', value: Math.round(maxOfSources(srcMap)), date: `${k}T12:00:00Z`, source: 'Apple Health' });
  for (const [k, srcMap] of A.distancePerDaySrc) samples.push({ type: 'distance', value: Math.round(maxOfSources(srcMap)), date: `${k}T12:00:00Z`, source: 'Apple Health' });
  for (const [k, srcMap] of A.activeKcalPerDaySrc) samples.push({ type: 'activeKcal', value: Math.round(maxOfSources(srcMap)), date: `${k}T12:00:00Z`, source: 'Apple Health' });

  for (const w of A.workouts) {
    samples.push({
      type: 'workout', value: w.durationMin, date: w.date,
      startTime: w.startTime, endTime: w.endTime,
      activityType: w.activityType, kcalBurned: w.kcalBurned, distanceM: w.distanceM, source: w.source,
    });
  }

  for (const [k, r] of A.sleepPerNight) {
    // 若只有 inBed 无细分（华为等设备）· 按 85% 估算睡眠时长
    const asleep = r.asleepMin > 0 ? r.asleepMin : Math.round(r.inBedMin * 0.85);
    if (asleep < 30) continue;
    samples.push({
      type: 'sleep', value: Math.round(asleep), date: `${k}T08:00:00Z`,
      startTime: r.startTime, endTime: r.endTime,
      inBedMin: Math.round(r.inBedMin) || undefined,
      deepMin: Math.round(r.deepMin) || undefined,
      remMin: Math.round(r.remMin) || undefined,
      source: 'Apple Health',
    });
  }

  const BATCH = 300;
  uploadStats.value.totalBatches = Math.ceil(samples.length / BATCH);

  const token = localStorage.getItem(KEY.access);
  const stats = { weight: 0, steps: 0, distance: 0, activeKcal: 0, workout: 0, sleep: 0, errors: 0 };

  for (let i = 0; i < samples.length; i += BATCH) {
    const batch = samples.slice(i, i + BATCH);
    try {
      const r = await http.post<{ weightCnt: number; stepsCnt: number; workoutCnt: number; sleepCnt: number; errorCount: number }>(
        '/health/samples', { samples: batch },
        { headers: { Authorization: token ? `Bearer ${token}` : '' } },
      );
      stats.weight += r.data.weightCnt;
      stats.steps += r.data.stepsCnt;
      stats.workout += r.data.workoutCnt;
      stats.sleep += r.data.sleepCnt;
      stats.errors += r.data.errorCount;
    } catch {
      stats.errors += batch.length;
    }
    uploadStats.value = { ...uploadStats.value, sentBatches: Math.floor(i / BATCH) + 1, ...stats };
    await new Promise((r) => setTimeout(r, 30));
  }
  uploadStats.value.sentBatches = uploadStats.value.totalBatches;
}

const summary = computed(() => {
  const A = aggregate.value;
  return {
    weights: A.weights.length,
    stepDays: A.stepsPerDaySrc.size,
    distanceDays: A.distancePerDaySrc.size,
    kcalDays: A.activeKcalPerDaySrc.size,
    workouts: A.workouts.length,
    sleepNights: A.sleepPerNight.size,
  };
});
</script>

<template>
  <section class="wrap">
    <AppHeader title="上传 Apple Health XML" back-to="/health/import" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>

      <section class="hero">
        <div class="h-icon" aria-hidden="true">📥</div>
        <div>
          <p class="h-title">一次导入几年历史</p>
          <p class="h-hint">iPhone「健康」App → 头像 → 底部导出所有健康数据 → 得到 zip · 传上来</p>
        </div>
      </section>

      <section v-if="stage === 'idle'" class="picker">
        <button class="pick-btn" @click="pickFile">
          <span class="pk-icon">📂</span>
          <span class="pk-txt">选文件（.zip 或 .xml）</span>
        </button>
        <input ref="fileInput" type="file" accept=".zip,.xml" hidden @change="onFile" />
        <p class="hint">支持苹果原生 zip · 也支持你手动解压后的 export.xml · 浏览器里解析 · 不上传原始文件</p>
      </section>

      <section v-if="stage !== 'idle'" class="progress-card">
        <div class="pc-file">
          <span class="pcf-name">{{ fileName }}</span>
          <span class="pcf-size num">{{ fileSizeMb }} MB</span>
        </div>

        <div class="steps-bar">
          <div :class="['stp', stage === 'unzipping' ? 'now' : 'done']">1 解压</div>
          <div :class="['stp', stage === 'parsing' ? 'now' : (stage === 'uploading' || stage === 'done') ? 'done' : '']">2 解析</div>
          <div :class="['stp', stage === 'uploading' ? 'now' : stage === 'done' ? 'done' : '']">3 上传</div>
        </div>

        <div v-if="stage === 'unzipping'" class="live">
          <p class="l-txt">解压 ZIP...</p>
          <div class="spinner"></div>
        </div>

        <div v-else-if="stage === 'parsing'" class="live">
          <p class="l-txt">正在扫描 XML · 已看 <span class="num">{{ parsedCount.toLocaleString() }}</span> 条 Records</p>
          <div class="pbar"><div class="pfill" :style="{ width: Math.min(100, parseProgress) + '%' }"></div></div>
        </div>

        <div v-else-if="stage === 'uploading'" class="live">
          <p class="l-txt">上传 <span class="num">{{ uploadStats.sentBatches }} / {{ uploadStats.totalBatches }}</span> 批</p>
          <div class="pbar"><div class="pfill" :style="{ width: uploadStats.totalBatches > 0 ? (uploadStats.sentBatches / uploadStats.totalBatches * 100) + '%' : '0%' }"></div></div>
          <ul class="live-stats">
            <li>体重 <b>{{ uploadStats.weight }}</b></li>
            <li>步数/距离/热量 <b>{{ uploadStats.steps }}</b></li>
            <li>锻炼 <b>{{ uploadStats.workout }}</b></li>
            <li>睡眠 <b>{{ uploadStats.sleep }}</b></li>
          </ul>
        </div>

        <div v-else-if="stage === 'done'" class="done-block">
          <p class="dn-title">✓ 导入完成</p>
          <ul class="dn-list">
            <li>解析到 <b>{{ summary.weights }}</b> 次体重</li>
            <li><b>{{ summary.stepDays }}</b> 天步数 · <b>{{ summary.distanceDays }}</b> 天距离 · <b>{{ summary.kcalDays }}</b> 天热量</li>
            <li><b>{{ summary.workouts }}</b> 次锻炼</li>
            <li><b>{{ summary.sleepNights }}</b> 晚睡眠</li>
          </ul>
          <p class="dn-final">
            实际入库：体重 <b>{{ uploadStats.weight }}</b> · steps 相关 <b>{{ uploadStats.steps }}</b> · 锻炼 <b>{{ uploadStats.workout }}</b> · 睡眠 <b>{{ uploadStats.sleep }}</b>
            <template v-if="uploadStats.errors > 0"> · <span class="err-inline">失败 {{ uploadStats.errors }}</span></template>
          </p>
          <button class="primary" @click="() => { stage = 'idle'; fileName = ''; }">再传一次</button>
        </div>

        <div v-else-if="stage === 'error'" class="done-block">
          <p class="dn-title err-txt">✗ 出错了</p>
          <p class="dn-final">{{ errMsg }}</p>
          <button class="primary" @click="() => { stage = 'idle'; errMsg = ''; }">重试</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body { padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 96px); display: flex; flex-direction: column; gap: var(--space-md); }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }

.hero { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; padding: 16px 18px; background: linear-gradient(140deg, var(--color-primary-container) 0%, var(--color-tertiary-container) 100%); border-radius: var(--radius-xl); border: 1px solid rgba(29,25,23,0.08); box-shadow: 0 8px 24px rgba(165,51,20,0.15); }
.h-icon { width: 56px; height: 56px; display: grid; place-items: center; background: var(--color-surface-container-lowest); border-radius: 20px; font-size: 28px; }
.h-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-on-primary-container); }
.h-hint { margin: 4px 0 0; font-size: var(--font-size-label); letter-spacing: 0.05em; color: var(--color-on-primary-container); opacity: 0.85; line-height: 1.45; }

.picker { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px 20px; }
.pick-btn { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 40px; border-radius: var(--radius-xl); border: 2px dashed var(--color-primary); background: var(--color-primary-fixed); color: var(--color-primary); font-weight: 500; }
.pick-btn:active { transform: scale(0.98); }
.pk-icon { font-size: 40px; }
.pk-txt { font-size: var(--font-size-body); }
.hint { margin: 0; text-align: center; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); max-width: 24em; line-height: 1.5; }

.progress-card { padding: 16px; background: var(--color-surface-container-lowest); border: 1px solid var(--color-outline-variant); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(29,25,23,0.06); display: flex; flex-direction: column; gap: 14px; }
.pc-file { display: flex; justify-content: space-between; align-items: baseline; }
.pcf-name { font-size: var(--font-size-caption); font-weight: 500; color: var(--color-on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.pcf-size { font-size: var(--font-size-label); color: var(--color-outline); font-family: var(--font-family-num); }

.steps-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.stp { padding: 8px 4px; text-align: center; font-size: var(--font-size-label); letter-spacing: 0.05em; border-radius: var(--radius-default); background: var(--color-surface-container); color: var(--color-outline); }
.stp.now { background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 3px 8px rgba(165, 51, 20, 0.24); font-weight: 500; }
.stp.done { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }

.live { display: flex; flex-direction: column; gap: 8px; padding: 12px 0 4px; }
.l-txt { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface); }
.l-txt .num { color: var(--color-primary); font-weight: 600; font-family: var(--font-family-num); }
.pbar { height: 6px; background: var(--color-surface-container-high); border-radius: 3px; overflow: hidden; }
.pfill { height: 100%; background: linear-gradient(90deg, var(--color-primary), var(--color-primary-container)); border-radius: 3px; transition: width var(--duration-normal) var(--ease-out-expo); }
.spinner { width: 24px; height: 24px; border: 3px solid var(--color-surface-container-high); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 800ms linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
.live-stats { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: var(--font-size-label); color: var(--color-on-surface-variant); font-family: var(--font-family-num); }
.live-stats b { color: var(--color-primary); font-weight: 600; }

.done-block { display: flex; flex-direction: column; gap: 12px; }
.dn-title { margin: 0; font-size: var(--font-size-section); font-weight: 600; color: var(--color-secondary); }
.dn-title.err-txt { color: var(--color-error); }
.dn-list { margin: 0; padding-left: 20px; }
.dn-list li { font-size: var(--font-size-caption); color: var(--color-on-surface); line-height: 1.7; }
.dn-list b { color: var(--color-primary); font-weight: 600; font-family: var(--font-family-num); }
.dn-final { margin: 4px 0 0; font-size: var(--font-size-caption); color: var(--color-on-surface); line-height: 1.5; }
.dn-final b { color: var(--color-primary); font-family: var(--font-family-num); }
.err-inline { color: var(--color-error); font-weight: 500; }
.primary { height: 48px; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-body); font-weight: 500; box-shadow: 0 6px 16px rgba(165, 51, 20, 0.24); }
.primary:active { transform: scale(0.98); }
</style>
