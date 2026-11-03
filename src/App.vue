<template>
  <div v-if="state.loading" class="boot">
    <div class="boot__ring">
      <span></span><span></span><span></span>
    </div>
    <div class="boot__text">正在接入生产数据总线…</div>
  </div>
  <ScreenLayout v-else />
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import ScreenLayout from '@/layout/ScreenLayout.vue'
import { useDashboard, bootstrap, stopRealtime } from '@/services/api'

const state = useDashboard()

onMounted(bootstrap)
onBeforeUnmount(stopRealtime)
</script>

<style scoped>
.boot {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  background: radial-gradient(ellipse at center, #071828, #02060d 70%);
}

.boot__ring {
  position: relative;
  width: 74px;
  height: 74px;
}
.boot__ring span {
  position: absolute;
  inset: 0;
  border: 1.5px solid transparent;
  border-radius: 50%;
}
.boot__ring span:nth-child(1) {
  border-top-color: #33d6ff;
  animation: spin 1.1s linear infinite;
}
.boot__ring span:nth-child(2) {
  inset: 10px;
  border-right-color: #2b7fff;
  animation: spin 1.7s linear infinite reverse;
}
.boot__ring span:nth-child(3) {
  inset: 22px;
  border-bottom-color: #00e5b8;
  animation: spin 2.3s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.boot__text {
  font-size: 13px;
  letter-spacing: 4px;
  color: #6fa6d4;
}
</style>
