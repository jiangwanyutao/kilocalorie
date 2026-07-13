import { http } from './http';

export interface ExerciseType {
  id: string;
  name: string;
  spell: string;
  /** A 有氧 · S 力量 · F 柔韧 · M 综合 */
  category: 'A' | 'S' | 'F' | 'M';
  /** MET 系数 */
  met: number;
  /** L 低 · M 中 · H 高 */
  intensity: 'L' | 'M' | 'H';
  icon: string;
}

export interface ExerciseEntry {
  id: string;
  typeId: string;
  typeName: string;
  exTime: string;
  durationMin: number;
  kcalBurn: number;
}

export interface ExerciseDay {
  date: string;
  totalMin: number;
  totalKcal: number;
  entries: ExerciseEntry[];
}

export interface AddExercisePayload {
  typeId: string;
  durationMin: number;
  exTime?: string;
  note?: string;
}

export interface ExerciseHistoryEntry {
  id: string;
  typeId: string;
  typeName: string;
  exTime: string;
  durationMin: number;
  kcalBurn: number;
  note: string | null;
}

export interface ExerciseSummary {
  count: number;
  totalMin: number;
  totalKcal: number;
  byType: Record<string, { count: number; totalMin: number; totalKcal: number }>;
  history: ExerciseHistoryEntry[];
}

export const exerciseApi = {
  types: () => http.get<ExerciseType[]>('/exercise/types').then((r) => r.data),
  day: (date?: string) =>
    http.get<ExerciseDay>('/exercise/day', { params: date ? { date } : {} }).then((r) => r.data),
  add: (p: AddExercisePayload) =>
    http.post<ExerciseDay>('/exercise/entry', p).then((r) => r.data),
  del: (id: string) =>
    http.delete<ExerciseDay>(`/exercise/entry/${id}`).then((r) => r.data),
  history: (days = 30) =>
    http.get<ExerciseHistoryEntry[]>('/exercise/history', { params: { days } }).then((r) => r.data),
  summary: (days = 30) =>
    http.get<ExerciseSummary>('/exercise/summary', { params: { days } }).then((r) => r.data),
};
