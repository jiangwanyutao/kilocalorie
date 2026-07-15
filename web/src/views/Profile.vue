<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import WheelPicker from '@/components/WheelPicker.vue';
import { userApi, type MeResponse, type UpdateProfilePayload } from '@/api/user';
import { useAuthStore } from '@/stores/auth';
import { pickErrMsg } from '@/api/http';
import { resizeImage } from '@/lib/image-resize';

const router = useRouter();
const auth = useAuthStore();

const loading = ref(true);
const submitting = ref(false);
const errMsg = ref('');
const okMsg = ref('');

const avatarUrl = ref<string | null>(null);
const avatarKey = ref<string | null>(null);
const avatarBusy = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const nickname = ref('');
const gender = ref<'M' | 'F' | 'U'>('U');
const birthYear = ref<number>(new Date().getFullYear() - 25);
const heightCm = ref<number>(170);
const activityLvl = ref<'1' | '2' | '3' | '4' | '5'>('2');

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = CURRENT_YEAR - 100;
const YEAR_MAX = CURRENT_YEAR - 10;
const HEIGHT_MIN = 100;
const HEIGHT_MAX = 220;

const age = computed(() =>
  birthYear.value >= YEAR_MIN && birthYear.value <= YEAR_MAX
    ? CURRENT_YEAR - birthYear.value
    : null,
);

const yearValues: (number | string)[] = (() => {
  const arr: number[] = [];
  for (let y = YEAR_MAX; y >= YEAR_MIN; y--) arr.push(y);
  return arr;
})();
const heightValues: (number | string)[] = (() => {
  const arr: number[] = [];
  for (let h = HEIGHT_MIN; h <= HEIGHT_MAX; h++) arr.push(h);
  return arr;
})();

const ACTIVITY = [
  { v: '1', label: '久坐 · 基本无运动' },
  { v: '2', label: '轻度 · 每周 1-2 次' },
  { v: '3', label: '中度 · 每周 3-5 次' },
  { v: '4', label: '高度 · 每周 6-7 次' },
  { v: '5', label: '极高 · 每天高强度' },
] as const;

const initial = ref<{
  nickname: string;
  gender: 'M' | 'F' | 'U';
  birthYear: number;
  heightCm: number;
  activityLvl: '1' | '2' | '3' | '4' | '5';
} | null>(null);

function seed(m: MeResponse): void {
  avatarUrl.value = m.avatarUrl ?? null;
  avatarKey.value = m.avatarKey ?? null;
  nickname.value = m.nickname ?? '';
  const g = (m.gender as 'M' | 'F' | 'U') || 'U';
  gender.value = g === 'M' || g === 'F' ? g : 'U';
  birthYear.value = m.birthYear ?? YEAR_MAX - 15;
  const h = m.heightCm ? Number(m.heightCm) : 170;
  heightCm.value = Number.isFinite(h) ? Math.round(h) : 170;
  const a = (m.activityLvl as '1' | '2' | '3' | '4' | '5') || '2';
  activityLvl.value = a;
  initial.value = {
    nickname: nickname.value,
    gender: gender.value,
    birthYear: birthYear.value,
    heightCm: heightCm.value,
    activityLvl: activityLvl.value,
  };
}

onMounted(async () => {
  loading.value = true;
  try {
    const me = await userApi.me();
    seed(me);
  } catch (e) {
    errMsg.value = pickErrMsg(e, '加载失败');
  } finally {
    loading.value = false;
  }
});

const dirty = computed(() => {
  if (!initial.value) return false;
  return (
    initial.value.nickname !== nickname.value.trim() ||
    initial.value.gender !== gender.value ||
    initial.value.birthYear !== birthYear.value ||
    initial.value.heightCm !== heightCm.value ||
    initial.value.activityLvl !== activityLvl.value
  );
});

const canSubmit = computed(
  () =>
    !!nickname.value.trim() &&
    nickname.value.trim().length >= 2 &&
    nickname.value.trim().length <= 30 &&
    gender.value !== 'U' &&
    birthYear.value >= YEAR_MIN &&
    birthYear.value <= YEAR_MAX &&
    heightCm.value >= 80 &&
    heightCm.value <= 250 &&
    dirty.value,
);

function pickFile(): void {
  fileInput.value?.click();
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
    errMsg.value = '仅支持 JPG / PNG / WebP';
    return;
  }
  avatarBusy.value = true;
  errMsg.value = '';
  okMsg.value = '';
  try {
    const blob = await resizeImage(file, 512, 0.85);
    const me = await userApi.uploadAvatar(blob, 'avatar.jpg');
    seed(me);
    await auth.refreshMe();
    okMsg.value = '头像已更新';
    setTimeout(() => { okMsg.value = ''; }, 1600);
  } catch (err) {
    errMsg.value = pickErrMsg(err, '上传失败');
  } finally {
    avatarBusy.value = false;
  }
}

async function removeAvatar(): Promise<void> {
  if (!avatarKey.value) return;
  if (!window.confirm('确认移除当前头像?')) return;
  avatarBusy.value = true;
  errMsg.value = '';
  try {
    const me = await userApi.removeAvatar();
    seed(me);
    await auth.refreshMe();
    okMsg.value = '头像已移除';
    setTimeout(() => { okMsg.value = ''; }, 1600);
  } catch (err) {
    errMsg.value = pickErrMsg(err, '移除失败');
  } finally {
    avatarBusy.value = false;
  }
}

async function submit(): Promise<void> {
  if (!canSubmit.value || !initial.value) return;
  submitting.value = true;
  errMsg.value = '';
  okMsg.value = '';
  try {
    const dto: UpdateProfilePayload = {};
    const nn = nickname.value.trim();
    if (nn !== initial.value.nickname) dto.nickname = nn;
    if (gender.value !== initial.value.gender) dto.gender = gender.value;
    if (birthYear.value !== initial.value.birthYear) dto.birthYear = birthYear.value;
    if (heightCm.value !== initial.value.heightCm) dto.heightCm = heightCm.value;
    if (activityLvl.value !== initial.value.activityLvl) dto.activityLvl = activityLvl.value;

    const me = await userApi.updateProfile(dto);
    seed(me);
    await auth.refreshMe();
    okMsg.value = '已保存';
    setTimeout(() => { okMsg.value = ''; }, 1600);
  } catch (e) {
    errMsg.value = pickErrMsg(e, '保存失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="wrap">
    <AppHeader title="编辑资料" back-to="/me" />

    <div class="body">
      <p v-if="errMsg" class="err">{{ errMsg }}</p>
      <p v-if="okMsg" class="ok">{{ okMsg }}</p>

      <div v-if="loading" class="skel">
        <div class="skel-card" />
        <div class="skel-card lg" />
        <div class="skel-card lg" />
      </div>

      <template v-else>
        <div class="ident-card">
          <button
            type="button"
            class="halo"
            :disabled="avatarBusy"
            @click="pickFile"
            aria-label="更换头像"
          >
            <div class="avatar">
              <img v-if="avatarUrl" :src="avatarUrl" alt="头像" />
              <span v-else>{{ (nickname || '?').slice(0, 1) }}</span>
            </div>
            <span class="cam">{{ avatarBusy ? '⋯' : '📷' }}</span>
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display:none"
            @change="onFileChange"
          />
          <div class="ident-meta">
            <p class="lbl">邮箱（不可修改）</p>
            <p class="email num">{{ auth.user?.email ?? '—' }}</p>
            <div class="ident-actions">
              <button type="button" class="mini" :disabled="avatarBusy" @click="pickFile">更换头像</button>
              <button
                v-if="avatarKey"
                type="button"
                class="mini danger"
                :disabled="avatarBusy"
                @click="removeAvatar"
              >移除</button>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="lbl" for="nick">昵称</label>
          <input
            id="nick"
            v-model="nickname"
            type="text"
            maxlength="30"
            placeholder="2-30 个字符"
            autocomplete="nickname"
          />
          <p class="hint">已输入 {{ nickname.trim().length }} / 30</p>
        </div>

        <div class="field">
          <span class="lbl">性别</span>
          <div class="chips">
            <button
              v-for="g in [{ v: 'M', label: '男' }, { v: 'F', label: '女' }] as const"
              :key="g.v"
              type="button"
              class="chip"
              :class="{ on: gender === g.v }"
              @click="gender = g.v"
            >{{ g.label }}</button>
          </div>
        </div>

        <div class="field">
          <div class="rowlbl">
            <span class="lbl">出生年份</span>
            <span class="value num">
              {{ birthYear }}
              <span v-if="age !== null" class="unit"> · {{ age }} 岁</span>
            </span>
          </div>
          <WheelPicker v-model="birthYear" :values="yearValues" />
        </div>

        <div class="field">
          <div class="rowlbl">
            <span class="lbl">身高</span>
            <span class="value num">{{ heightCm }}<span class="unit"> cm</span></span>
          </div>
          <WheelPicker v-model="heightCm" :values="heightValues" unit="cm" />
        </div>

        <div class="field">
          <span class="lbl">活动等级</span>
          <div class="stack">
            <button
              v-for="a in ACTIVITY"
              :key="a.v"
              type="button"
              class="row-btn"
              :class="{ on: activityLvl === a.v }"
              @click="activityLvl = a.v"
            >{{ a.label }}</button>
          </div>
          <p class="hint">调整后 BMR/TDEE 需去「目标」页重算 · 现有 kcal 目标不会自动变</p>
        </div>

        <div class="cta">
          <button type="button" class="ghost" @click="router.push('/me')">取消</button>
          <button
            type="button"
            class="primary"
            :disabled="!canSubmit || submitting"
            @click="submit"
          >{{ submitting ? '保存中…' : dirty ? '保存修改' : '未修改' }}</button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.wrap { min-height: 100dvh; background: var(--page-gradient); color: var(--color-on-surface); }
.body {
  padding: var(--space-md) var(--space-margin-mobile) calc(env(safe-area-inset-bottom) + 120px);
  display: flex; flex-direction: column; gap: 18px;
}

.err {
  margin: 0; padding: 10px 14px;
  background: var(--color-error-container); color: var(--color-on-error-container);
  border-radius: var(--radius-default); font-size: var(--font-size-caption);
}
.ok {
  margin: 0; padding: 10px 14px;
  background: #e6f5d5; color: #4a7a1a;
  border-radius: var(--radius-default); font-size: var(--font-size-caption);
}

.skel { display: flex; flex-direction: column; gap: 14px; }
.skel-card { height: 72px; border-radius: 20px; background: rgba(120,90,200,0.08); animation: pulse 1.4s ease-in-out infinite; }
.skel-card.lg { height: 120px; }
@keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

.ident-card {
  display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  box-shadow: 0 16px 34px -22px rgba(120, 90, 200, 0.20);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.halo {
  position: relative;
  width: 66px; height: 66px;
  border-radius: 22px;
  background: linear-gradient(140deg, #fff4cc 0%, #ffe0d5 60%, #ffcf5a 100%);
  padding: 3px; border: 0;
  box-shadow: 0 10px 22px -8px rgba(255, 180, 60, 0.5);
  cursor: pointer;
  transition: transform var(--duration-fast);
}
.halo:active { transform: scale(0.96); }
.halo:disabled { opacity: 0.6; cursor: wait; }
.avatar {
  width: 100%; height: 100%; border-radius: 19px;
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  display: grid; place-items: center;
  font-size: 24px; font-weight: 700;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cam {
  position: absolute; right: -4px; bottom: -4px;
  width: 26px; height: 26px; display: grid; place-items: center;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 6px 14px -6px rgba(120, 90, 200, 0.3);
  font-size: 13px;
}
.ident-meta { min-width: 0; }
.ident-meta .lbl { margin: 0 0 2px; }
.email { margin: 0; font-size: 14px; color: var(--color-on-surface); word-break: break-all; letter-spacing: 0.02em; }

.ident-actions { display: flex; gap: 8px; margin-top: 8px; }
.mini {
  height: 26px; padding: 0 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(120,90,200,0.14);
  border-radius: 999px;
  color: var(--color-primary);
  font-size: 12px; font-weight: 500; letter-spacing: 0.03em;
  cursor: pointer;
}
.mini:active { background: rgba(255, 224, 213, 0.5); }
.mini:disabled { opacity: 0.5; cursor: wait; }
.mini.danger { color: var(--color-error); border-color: rgba(198, 75, 42, 0.24); }

.field {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 20px;
  box-shadow: 0 12px 26px -18px rgba(120, 90, 200, 0.16);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.lbl {
  font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--color-on-surface-variant); font-weight: 500;
}
.hint {
  margin: 0; font-size: 11px; color: var(--color-outline); letter-spacing: 0.03em;
}
.rowlbl { display: flex; justify-content: space-between; align-items: baseline; }
.value {
  font-size: 26px; font-weight: 600; color: var(--color-primary);
  font-family: var(--font-family-num); line-height: 1;
}
.value .unit {
  font-size: 12px; font-weight: 400;
  color: var(--color-on-surface-variant);
  font-family: var(--font-family-sans); margin-left: 4px;
}

input {
  height: 48px; padding: 0 14px;
  border-radius: 14px; border: 1px solid rgba(120,90,200,0.14);
  background: rgba(255, 255, 255, 0.55);
  font-size: 15px; color: var(--color-on-surface);
}
input:focus { outline: none; border-color: var(--color-primary); background: #fff; }

.chips { display: flex; gap: 8px; }
.chip {
  flex: 1; height: 48px;
  border-radius: 14px; border: 1px solid rgba(120,90,200,0.14);
  background: rgba(255, 255, 255, 0.55);
  font-size: 15px; color: var(--color-on-surface-variant);
  transition: all var(--duration-fast);
}
.chip.on {
  background: var(--color-primary); border-color: var(--color-primary);
  color: var(--color-on-primary); font-weight: 600;
}

.stack { display: flex; flex-direction: column; gap: 6px; }
.row-btn {
  text-align: left; padding: 12px 14px;
  border-radius: 14px; border: 1px solid rgba(120,90,200,0.14);
  background: rgba(255, 255, 255, 0.55);
  color: var(--color-on-surface); font-size: 14px;
  transition: all var(--duration-fast);
}
.row-btn.on {
  border-color: var(--color-primary);
  background: linear-gradient(155deg, #ffe0d5 0%, rgba(255,255,255,0.7) 60%);
  color: var(--color-on-surface); font-weight: 600;
}

.cta {
  display: grid; grid-template-columns: 1fr 2fr; gap: 10px;
  margin-top: 4px;
}
.ghost {
  height: 52px; border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-on-surface-variant);
  border: 1px solid rgba(120,90,200,0.14);
  font-size: 15px;
}
.primary {
  height: 52px; border-radius: 18px;
  background: linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  font-size: 15px; font-weight: 600; letter-spacing: 0.02em;
  box-shadow: 0 12px 22px -12px rgba(165, 51, 20, 0.5);
  transition: transform var(--duration-fast);
}
.primary:active { transform: scale(0.98); }
.primary:disabled { opacity: 0.5; box-shadow: none; }
</style>
