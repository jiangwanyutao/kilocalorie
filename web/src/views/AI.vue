<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { aiApi } from '@/api/ai';
import { pickErrMsg } from '@/api/http';

const router = useRouter();
const errMsg = ref('');

async function enter() {
  try {
    const list = await aiApi.listConvs();
    const active = list.find((c) => c.status === 'A') ?? list[0];
    if (active) {
      router.replace({ name: 'ai-chat', params: { convId: active.id } });
      return;
    }
    const conv = await aiApi.createConv('T');
    router.replace({ name: 'ai-chat', params: { convId: conv.id } });
  } catch (e) {
    errMsg.value = pickErrMsg(e, '打开 AI 搭子失败');
  }
}
onMounted(enter);
</script>

<template>
  <section class="loader">
    <div class="mark" aria-hidden="true">☾</div>
    <p v-if="errMsg" class="err">{{ errMsg }}</p>
    <p v-else class="hint">正在唤醒你的搭子...</p>
  </section>
</template>

<style scoped>
.loader { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: radial-gradient(ellipse at center top, var(--color-primary-fixed) 0%, transparent 45%), var(--color-surface); color: var(--color-on-surface); padding-bottom: 100px; }
.mark { width: 96px; height: 96px; display: grid; place-items: center; background: linear-gradient(140deg, var(--color-primary-container), var(--color-tertiary-container)); border-radius: 32px; font-size: 48px; box-shadow: 0 16px 36px rgba(165, 51, 20, 0.28), inset 0 -2px 4px rgba(0,0,0,0.08); animation: bob 2.2s ease-in-out infinite; }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.hint { margin: 0; font-size: var(--font-size-caption); color: var(--color-on-surface-variant); letter-spacing: 0.05em; }
.err { margin: 0; padding: var(--space-sm) var(--space-md); background: var(--color-error-container); color: var(--color-on-error-container); border-radius: var(--radius-default); font-size: var(--font-size-caption); }
</style>
