import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { KEY } from '@/api/http';
import { authApi, type PublicUser, type TokenBundle } from '@/api/auth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<PublicUser | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);

  const isAuthed = computed(() => !!accessToken.value && !!user.value);

  function loadFromStorage() {
    accessToken.value = localStorage.getItem(KEY.access);
    refreshToken.value = localStorage.getItem(KEY.refresh);
    const raw = localStorage.getItem(KEY.user);
    if (raw) {
      try {
        user.value = JSON.parse(raw) as PublicUser;
      } catch {
        user.value = null;
      }
    }
  }

  function applyBundle(t: TokenBundle) {
    accessToken.value = t.access_token;
    refreshToken.value = t.refresh_token;
    user.value = t.user;
    localStorage.setItem(KEY.access, t.access_token);
    localStorage.setItem(KEY.refresh, t.refresh_token);
    localStorage.setItem(KEY.user, JSON.stringify(t.user));
  }

  async function login(email: string, password: string) {
    const t = await authApi.login(email, password);
    applyBundle(t);
    return t.user;
  }

  async function refreshMe() {
    if (!accessToken.value) return null;
    const u = await authApi.me();
    const pub: PublicUser = {
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      gender: u.gender,
      activityLvl: u.activityLvl,
      vipLvl: u.vipLvl,
      emailVerified: u.emailVerified,
      avatarKey: (u.avatarKey as string | null) ?? null,
    };
    user.value = pub;
    localStorage.setItem(KEY.user, JSON.stringify(pub));
    return u;
  }

  function logout() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem(KEY.access);
    localStorage.removeItem(KEY.refresh);
    localStorage.removeItem(KEY.user);
  }

  return {
    user,
    accessToken,
    refreshToken,
    isAuthed,
    loadFromStorage,
    applyBundle,
    login,
    refreshMe,
    logout,
  };
});
