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
  avatarUrl: string | null;
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

export interface UpdateProfilePayload {
  nickname?: string;
  gender?: 'M' | 'F' | 'U';
  birthYear?: number;
  heightCm?: number;
  activityLvl?: '1' | '2' | '3' | '4' | '5';
  avatarKey?: string;
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
  updateProfile: (dto: UpdateProfilePayload) => http.put<MeResponse>('/user/me', dto).then((r) => r.data),
  updateGoal: (dto: UpdateGoalPayload) => http.patch<MeResponse>('/user/goal', dto).then((r) => r.data),
  exportAll: () => http.get<ExportBundle>('/user/export').then((r) => r.data),
  deleteAccount: () => http.delete<{ success: true; scheduledPurgeAt: string }>('/user/me').then((r) => r.data),
  uploadAvatar: (blob: Blob, filename = 'avatar.jpg') => {
    const fd = new FormData();
    fd.append('file', blob, filename);
    return http.post<MeResponse>('/user/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  removeAvatar: () => http.delete<MeResponse>('/user/avatar').then((r) => r.data),
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
