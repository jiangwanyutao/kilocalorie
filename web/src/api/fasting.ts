import { http } from './http';

export type PlanCode = '14' | '16' | '18';

export interface FastingCurrent {
  id: string;
  planCode: PlanCode;
  planHours: number;
  startTime: string;
  planEndTime: string;
  elapsedMin: number;
  remainingMin: number;
  pct: number;
  done: boolean;
}

export interface FastingEndResult {
  id: string;
  status: 'C' | 'A';
  actualHours: number;
  planHours: number;
  completed: boolean;
}

export interface FastingHistoryItem {
  id: string;
  planCode: PlanCode;
  planHours: number | null;
  startTime: string;
  endTime: string | null;
  status: string;
  actualHours: number | null;
  note: string | null;
}

export const fastingApi = {
  current: () => http.get<FastingCurrent | null>('/fasting/current').then((r) => r.data),
  start: (planCode: PlanCode) =>
    http.post<FastingCurrent>('/fasting/start', { planCode }).then((r) => r.data),
  end: (note?: string) =>
    http.post<FastingEndResult>('/fasting/end', { note }).then((r) => r.data),
  history: (days = 90) =>
    http.get<FastingHistoryItem[]>('/fasting/history', { params: { days } }).then((r) => r.data),
  del: (id: string) => http.delete<{ success: true }>(`/fasting/${id}`).then((r) => r.data),
};
