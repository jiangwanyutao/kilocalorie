import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const P = () => import('@/views/Placeholder.vue');

/** 无需登录即可访问的路由 name 白名单 */
const PUBLIC_ROUTES = new Set([
  'welcome', 'login', 'register', 'verify-email', 'forgot', 'reset', 'not-found', 'onboarding',
]);

const routes: RouteRecordRaw[] = [
  { path: '/welcome', name: 'welcome', component: () => import('@/views/Welcome.vue'),
    meta: { title: '欢迎', hideTabBar: true, guest: true } },
  { path: '/onboarding', name: 'onboarding', component: () => import('@/views/Onboarding.vue'),
    meta: { title: '引导', hideTabBar: true } },
  { path: '/login', name: 'login', component: () => import('@/views/Login.vue'),
    meta: { title: '登录', hideTabBar: true, guest: true } },
  { path: '/register', name: 'register', component: () => import('@/views/Register.vue'),
    meta: { title: '注册', hideTabBar: true, guest: true } },
  { path: '/verify-email', name: 'verify-email', component: () => import('@/views/VerifyEmail.vue'),
    meta: { title: '邮箱验证', hideTabBar: true, guest: true } },
  { path: '/forgot', name: 'forgot', component: () => import('@/views/Forgot.vue'),
    meta: { title: '找回密码', hideTabBar: true, guest: true } },
  { path: '/reset', name: 'reset', component: () => import('@/views/Reset.vue'),
    meta: { title: '重置密码', hideTabBar: true, guest: true } },

  { path: '/', name: 'home', component: () => import('@/views/Home.vue'), meta: { title: '首页' } },
  { path: '/log', name: 'log', component: () => import('@/views/Log.vue'), meta: { title: '记录' } },
  { path: '/add', name: 'add', component: P, meta: { title: '中心', hideTabBar: true } },
  { path: '/ai', name: 'ai', component: () => import('@/views/AI.vue'), meta: { title: 'AI 搭子' } },
  { path: '/me', name: 'me', component: () => import('@/views/Me.vue'), meta: { title: '我的' } },

  { path: '/meal/new', name: 'meal-new', component: P, meta: { title: '新增就餐', hideTabBar: true } },
  { path: '/meal/photo', name: 'meal-photo', component: () => import('@/views/PhotoRecognize.vue'), meta: { title: '拍照识别', hideTabBar: true } },
  { path: '/meal/delivery', name: 'meal-delivery', component: P, meta: { title: '外卖截图', hideTabBar: true } },
  { path: '/food/search', name: 'food-search', component: P, meta: { title: '搜索食物', hideTabBar: true } },
  { path: '/food/picker', name: 'food-picker', component: () => import('@/views/FoodPicker.vue'), meta: { title: '食物库', hideTabBar: true } },
  { path: '/food/user/new', name: 'food-user-new', component: P, meta: { title: '添加私人食物', hideTabBar: true } },

  { path: '/water', name: 'water', component: () => import('@/views/Water.vue'), meta: { title: '饮水', hideTabBar: true } },
  { path: '/exercise', name: 'exercise', component: () => import('@/views/Exercise.vue'), meta: { title: '运动', hideTabBar: true } },
  { path: '/exercise/history', name: 'exercise-history', component: () => import('@/views/ExerciseHistory.vue'), meta: { title: '锻炼历史', hideTabBar: true } },
  { path: '/exercise/new', name: 'exercise-new', component: P, meta: { title: '添加运动', hideTabBar: true } },
  { path: '/body/weight', name: 'body-weight', component: () => import('@/views/Weight.vue'), meta: { title: '体重', hideTabBar: true } },
  { path: '/body/measure', name: 'body-measure', component: () => import('@/views/Measure.vue'), meta: { title: '围度', hideTabBar: true } },
  { path: '/body/steps', name: 'body-steps', component: () => import('@/views/Steps.vue'), meta: { title: '步数', hideTabBar: true } },
  { path: '/body/sleep', name: 'body-sleep', component: () => import('@/views/Sleep.vue'), meta: { title: '睡眠', hideTabBar: true } },
  { path: '/fast', name: 'fast', component: () => import('@/views/Fasting.vue'), meta: { title: '轻断食', hideTabBar: true } },

  { path: '/goal', name: 'goal', component: () => import('@/views/Goal.vue'), meta: { title: '目标', hideTabBar: true } },
  { path: '/stats', name: 'stats', component: P, meta: { title: '统计', hideTabBar: true } },
  { path: '/calendar', name: 'calendar', component: P, meta: { title: '日历', hideTabBar: true } },
  { path: '/health/import', name: 'health-import', component: () => import('@/views/HealthImport.vue'), meta: { title: 'Apple Health 导入', hideTabBar: true } },
  { path: '/health/import-xml', name: 'health-import-xml', component: () => import('@/views/HealthImportXml.vue'), meta: { title: 'XML 上传', hideTabBar: true } },
  { path: '/health/shortcut', name: 'health-shortcut', component: P, meta: { title: 'Shortcuts 模板', hideTabBar: true } },
  { path: '/export', name: 'export', component: () => import('@/views/Export.vue'), meta: { title: '数据导出', hideTabBar: true } },

  { path: '/ai/chat/:convId', name: 'ai-chat', component: () => import('@/views/AIChat.vue'), meta: { title: '对话', hideTabBar: true } },
  { path: '/ai/memory', name: 'ai-memory', component: () => import('@/views/AIMemory.vue'), meta: { title: '记忆管理', hideTabBar: true } },
  { path: '/kb', name: 'kb', component: () => import('@/views/Knowledge.vue'), meta: { title: '知识库', hideTabBar: true } },

  { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置', hideTabBar: true } },
  { path: '/settings/remind', redirect: '/settings' },
  { path: '/about', name: 'about', component: P, meta: { title: '关于', hideTabBar: true } },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: P, meta: { title: '页面走丢', hideTabBar: true } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

/** 全局登录守卫：未登录访问非白名单路由 → 跳 /welcome */
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!auth.accessToken) auth.loadFromStorage();
  const isPublic = PUBLIC_ROUTES.has(to.name as string) || to.meta?.guest === true;
  if (!auth.isAuthed && !isPublic) {
    return { name: 'welcome', query: { redirect: to.fullPath } };
  }
  // 已登录时打开 welcome/login/register → 直接回首页
  if (auth.isAuthed && (to.name === 'welcome' || to.name === 'login' || to.name === 'register')) {
    return { name: 'home' };
  }
  return true;
});

router.afterEach((to) => {
  const t = (to.meta?.title as string) || '';
  document.title = t ? `${t} · 千卡日记` : '千卡日记';
});

