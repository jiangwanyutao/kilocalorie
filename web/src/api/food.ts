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

  favorites: () =>
    http.get<FoodStdItem[]>('/food/favorites').then((r) => r.data),

  toggleFavorite: (foodSrc: 'S' | 'U', foodId: string) =>
    http.post<{ favorited: boolean }>('/food/favorite', { foodSrc, foodId }).then((r) => r.data),

  frequent: (limit = 30) =>
    http.get<FoodStdItem[]>('/food/frequent', { params: { limit } }).then((r) => r.data),

  userFoods: (limit = 60) =>
    http.get<FoodStdItem[]>('/food/user', { params: { limit } }).then((r) => r.data),

  createUserFood: (dto: {
    foodName: string; kcal: number;
    portionG?: number; portionDesc?: string;
    carbG?: number; protG?: number; fatG?: number;
    catCode?: string;
  }) => http.post<{ id: string }>('/food/user', dto).then((r) => r.data),
};
