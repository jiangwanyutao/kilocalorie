import { http } from './http';

export interface MealItem {
  id: string;
  entryId: string;
  foodName: string;
  foodSrc: string;
  portionMode: string;
  portionQty: string;
  actualG: string;
  kcal: string;
  carbG: string;
  protG: string;
  fatG: string;
  sortNo: number;
}

export interface MealEntry {
  id: string;
  userId: string;
  mealDate: string;
  mealTime: string;
  mealType: 'B' | 'L' | 'D' | 'S';
  entrySrc: string;
  totalKcal: string;
  totalCarb: string;
  totalProt: string;
  totalFat: string;
  note?: string | null;
  items: MealItem[];
}

export interface DayResponse {
  date: string;
  entries: MealEntry[];
  byType: Partial<Record<'B' | 'L' | 'D' | 'S', number>>;
}

export interface StatsToday {
  date: string;
  kcalGoal: number;
  consumed: number;
  /** 结构化训练消耗（ex_entry 汇总） */
  burned: number;
  /** Apple Health 活动能量（今日 body_steps.kcal_burn） */
  activeKcalToday: number;
  /** Apple Health 今日步数 */
  stepsToday: number;
  remaining: number;
  pct: number;
  byType: Partial<Record<'B' | 'L' | 'D' | 'S', number>>;
  macros: { carbG: number; protG: number; fatG: number };
  entryCount: number;
  waterMl: number;
  waterGoal: number;
  waterPct: number;
  exMin: number;
  latestWeightKg: number | null;
  latestWeightAt: string | null;
  latestWaistCm: number | null;
}

export interface CreateItemPayload {
  foodName: string;
  foodSrc: 'S' | 'U' | 'X';
  foodId?: string;
  portionMode: 'P' | 'G';
  portionQty: number;
  actualG: number;
  kcal: number;
  carbG?: number;
  protG?: number;
  fatG?: number;
}

export interface CreateMealPayload {
  mealType: 'B' | 'L' | 'D' | 'S';
  mealTime: string;
  entrySrc?: 'M' | 'A' | 'D' | 'V';
  note?: string;
  items: CreateItemPayload[];
}

export interface VisionItem {
  foodName: string;
  portionG: number;
  kcal: number;
  carbG: number;
  protG: number;
  fatG: number;
  confidence: number;
}

export interface VisionResult {
  provider: string;
  items: VisionItem[];
  costCents?: number;
}

export interface DayKcal {
  /** local YYYY-MM-DD */
  date: string;
  /** 食物摄入 */
  kcal: number;
  /** 结构化训练消耗 */
  burned: number;
  /** Apple 活动能量 */
  active: number;
}

export const mealApi = {
  day: (date?: string) =>
    http.get<DayResponse>('/meal/day', { params: date ? { date } : {} }).then((r) => r.data),
  days: (from: string, to: string) =>
    http.get<DayKcal[]>('/meal/days', { params: { from, to } }).then((r) => r.data),
  createEntry: (payload: CreateMealPayload) =>
    http.post<MealEntry>('/meal/entry', payload).then((r) => r.data),
  deleteEntry: (id: string) =>
    http.delete<{ success: true }>(`/meal/entry/${id}`).then((r) => r.data),
  today: () => http.get<StatsToday>('/stats/today').then((r) => r.data),
  analyzePhoto: (imageBase64: string, mimeType?: string) =>
    http.post<VisionResult>('/meal/photo/analyze', { imageBase64, mimeType }).then((r) => r.data),
};
