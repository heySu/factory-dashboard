<template>
  <div class="viewport">
    <div class="screen" :style="screenStyle">
      <!-- 背景层 -->
      <div class="bg-grid"></div>
      <div class="bg-glow"></div>
      <div class="bg-vignette"></div>

      <ScreenHeader />
      <NavBar :autoplay="autoplay" :auto-seconds="AUTO_SECONDS" @toggle-autoplay="toggleAutoplay" />

      <main class="screen-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScreenScale } from '@/utils/scale'
import { routes } from '@/router'
import ScreenHeader from '@/components/ScreenHeader.vue'
import NavBar from '@/components/NavBar.vue'

const { scale, offsetX, offsetY } = useScreenScale()
const route = useRoute()
const router = useRouter()

const screenStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`
}))

/* ===== 大屏自动轮播 ===== */
const AUTO_SECONDS = 20
const autoplay = ref(true)
const pages = routes.filter((r) => r.meta && r.meta.title)
let timer = null

function nextPage() {
  const idx = pages.findIndex((p) => p.path === route.path)
  const next = pages[(idx + 1) % pages.length]
  router.push(next.path)
}

function startTimer() {
  clearInterval(timer)
  if (!autoplay.value) return
  timer = setInterval(nextPage, AUTO_SECONDS * 1000)
}

function toggleAutoplay() {
  autoplay.value = !autoplay.value
  startTimer()
}

// 手动切换页面后重置计时器
watch(
  () => route.path,
  () => startTimer()
)

onMounted(startTimer)
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.viewport {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #02060d;
}

.screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 1920px;
  height: 1080px;
  display: flex;
  flex-direction: column;
  transform-origin: top left;
  background:
    radial-gradient(ellipse 90% 60% at 50% -10%, rgba(20, 80, 150, 0.4), transparent 65%),
    linear-gradient(180deg, #04101f 0%, #020810 55%, #030c18 100%);
  overflow: hidden;
}

/* 网格底纹 */
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(51, 214, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(51, 214, 255, 0.045) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 90%);
  pointer-events: none;
}

.bg-glow {
  position: absolute;
  left: 50%;
  bottom: -320px;
  width: 1400px;
  height: 640px;
  transform: translateX(-50%);
  background: radial-gradient(ellipse, rgba(43, 127, 255, 0.24), transparent 68%);
  pointer-events: none;
}

.bg-vignette {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 200px 40px rgba(0, 0, 0, 0.65);
  pointer-events: none;
}

.screen-main {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 0 20px 16px;
  z-index: 1;
}
</style>
