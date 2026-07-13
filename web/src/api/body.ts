import { http } from './http';

export interface WeightPoint {
  id: string;
  measTime: string;
  weightKg: number;
  bmi: number | null;
  note: string | null;
}

export interface WeightSummary {
  latest: WeightPoint | null;
  first: WeightPoint | null;
  delta30: number;
  count: number;
  history: WeightPoint[];
  targetWt: number | null;
  heightCm: number | null;
}

export interface AddWeightPayload {
  weightKg: number;
  measTime?: string;
  note?: string;
}

/** 围度 6 维（5 body-cm + 1 body-fat-%） */
export const MEASURE_DIMS = ['waistCm', 'hipCm', 'chestCm', 'thighCm', 'armCm', 'bodyFatPct'] as const;
export type MeasureDim = typeof MEASURE_DIMS[number];

export interface MeasurePoint {
  id: string;
  measTime: string;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  armCm: number | null;
  bodyFatPct: number | null;
  note: string | null;
}

export interface MeasureSummary {
  latest: Record<MeasureDim, { value: number; measTime: string } | null>;
  first: Record<MeasureDim, number | null>;
  delta90: Record<MeasureDim, number>;
  count: number;
  history: MeasurePoint[];
}

export interface AddMeasurePayload {
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  thighCm?: number;
  armCm?: number;
  bodyFatPct?: number;
  measTime?: string;
  note?: string;
}

export const bodyApi = {
  addWeight: (p: AddWeightPayload) => http.post<WeightSummary>('/body/weight', p).then((r) => r.data),
  summary: () => http.get<WeightSummary>('/body/weight/summary').then((r) => r.data),
  history: (days = 30) => http.get<WeightPoint[]>('/body/weight/history', { params: { days } }).then((r) => r.data),
  delWeight: (id: string) => http.delete<WeightSummary>(`/body/weight/${id}`).then((r) => r.data),

  addMeasure: (p: AddMeasurePayload) =>
    http.post<MeasureSummary>('/body/measure', p).then((r) => r.data),
  measureSummary: () =>
    http.get<MeasureSummary>('/body/measure/summary').then((r) => r.data),
  measureHistory: (days = 90) =>
    http.get<MeasurePoint[]>('/body/measure/history', { params: { days } }).then((r) => r.data),
  delMeasure: (id: string) =>
    http.delete<MeasureSummary>(`/body/measure/${id}`).then((r) => r.data),

  stepsSummary: (days = 30) =>
    http.get<StepsSummary>('/body/steps/summary', { params: { days } }).then((r) => r.data),
  stepsHistory: (days = 30) =>
    http.get<StepsPoint[]>('/body/steps/history', { params: { days } }).then((r) => r.data),
  sleepSummary: (days = 30) =>
    http.get<SleepSummary>('/body/sleep/summary', { params: { days } }).then((r) => r.data),
  sleepHistory: (days = 30) =>
    http.get<SleepPoint[]>('/body/sleep/history', { params: { days } }).then((r) => r.data),
};

export interface StepsPoint {
  id: string;
  date: string;
  stepCount: number;
  distanceM: number | null;
  kcalBurn: number | null;
}
export interface StepsSummary {
  count: number;
  avgSteps: number;
  maxSteps: number;
  totalDistanceKm: number;
  totalKcal: number;
  latest: StepsPoint | null;
  history: StepsPoint[];
}

export interface SleepPoint {
  id: string;
  date: string;
  asleepMin: number;
  inBedMin: number | null;
  deepMin: number | null;
  remMin: number | null;
}
export interface SleepSummary {
  count: number;
  avgAsleepMin: number;
  avgDeepMin: number;
  avgRemMin: number;
  latest: SleepPoint | null;
  history: SleepPoint[];
}
