import { http } from './http';

export interface WaterEntryDto {
  id: string;
  drinkTime: string;
  drinkType: string;
  volumeMl: number;
  effectiveMl: number;
}

export interface WaterDay {
  date: string;
  totalMl: number;
  effectiveMl: number;
  goalMl: number;
  pct: number;
  remaining: number;
  entries: WaterEntryDto[];
}

export interface AddWaterPayload {
  volumeMl: number;
  drinkType?: 'W' | 'T' | 'C' | 'J' | 'S';
  drinkTime?: string;
}

export const waterApi = {
  day: (date?: string) =>
    http.get<WaterDay>('/water/day', { params: date ? { date } : {} }).then((r) => r.data),
  add: (p: AddWaterPayload) => http.post<WaterDay>('/water/entry', p).then((r) => r.data),
  del: (id: string) => http.delete<WaterDay>(`/water/entry/${id}`).then((r) => r.data),
};
