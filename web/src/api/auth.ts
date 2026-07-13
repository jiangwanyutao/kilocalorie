import { http } from './http';

export interface PublicUser {
  id: string;
  email: string;
  nickname: string;
  gender: string;
  activityLvl: string;
  vipLvl: string;
  emailVerified: string;
  avatarKey?: string | null;
}

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: PublicUser;
}

export const authApi = {
  register: (email: string, password: string, nickname: string) =>
    http.post<PublicUser>('/auth/register', { email, password, nickname }).then((r) => r.data),

  verify: (token: string) =>
    http
      .get<{ success: true; email: string }>('/auth/verify', { params: { token } })
      .then((r) => r.data),

  login: (email: string, password: string) =>
    http.post<TokenBundle>('/auth/login', { email, password }).then((r) => r.data),

  forgot: (email: string) =>
    http.post<{ success: true }>('/auth/forgot', { email }).then((r) => r.data),

  reset: (token: string, newPassword: string) =>
    http.post<{ success: true }>('/auth/reset', { token, newPassword }).then((r) => r.data),

  me: () => http.get<PublicUser & Record<string, unknown>>('/user/me').then((r) => r.data),
};
