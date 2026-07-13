import { http } from './http';

export interface SetupPayload {
  gender: 'M' | 'F' | 'U';
  birthYear: number;
  heightCm: number;
  currentWeightKg: number;
  activityLvl: '1' | '2' | '3' | '4' | '5';
  goalType: 'M' | 'L1' | 'L2' | 'G1';
}

export interface MeResponse {
  id: string;
  email: string;
  nickname: string;
  gender: string;
  birthYear: number | null;
  heightCm: string | null;
  activityLvl: string;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  vipLvl: string;
  emailVerified: string;
  avatarKey: string | null;
  goal: null | {
    id: string;
    goalType: string;
    targetWt: string | null;
    kcalGoal: number;
    carbPct: number;
    protPct: number;
    fatPct: number;
    waterMl: number;
  };
}

export interface UpdateGoalPayload {
  goalType?: 'M' | 'L1' | 'L2' | 'G1';
  kcalGoal?: number;
  carbPct?: number;
  protPct?: number;
  fatPct?: number;
  waterMl?: number;
  targetWt?: number;
}

export interface ExportBundle {
  _meta: {
    exportedAt: string;
    appVersion: string;
    format: string;
    userId: string;
    counts: Record<string, number>;
  };
  [k: string]: unknown;
}

export const userApi = {
  me: () => http.get<MeResponse>('/user/me').then((r) => r.data),
  setup: (dto: SetupPayload) => http.post<MeResponse>('/user/setup', dto).then((r) => r.data),
  updateGoal: (dto: UpdateGoalPayload) => http.patch<MeResponse>('/user/goal', dto).then((r) => r.data),
  exportAll: () => http.get<ExportBundle>('/user/export').then((r) => r.data),
};

export interface HealthImportRow {
  id: string;
  importStatus: string;
  weightCnt: number;
  stepsCnt: number;
  hrCnt: number;
  errorMsg?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  finishTime?: string | null;
  createTime: string;
  fileSize?: number | null;
}

export const healthApi = {
  imports: (days = 90) =>
    http.get<HealthImportRow[]>('/health/imports', { params: { days } }).then((r) => r.data),
};
