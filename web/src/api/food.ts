import { http } from './http';

export interface FoodStdItem {
  id: string;
  foodName: string;
  spellCode: string;
  catCode: string;
  brand: string | null;
  unitG: number;
  portionG: number;
  portionDesc: string;
  kcal: number;
  carbG: number;
  protG: number;
  fatG: number;
}

export const foodApi = {
  search: (q?: string, cat?: string, limit = 30) =>
    http
      .get<FoodStdItem[]>('/food/search', {
        params: { q: q ?? undefined, cat: cat ?? undefined, limit },
      })
      .then((r) => r.data),
};
