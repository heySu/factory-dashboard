<template>
  <header class="hd">
    <div class="hd__bg"></div>

    <!-- 左：企业标识 -->
    <div class="hd__left">
      <div class="brand">
        <svg class="brand__logo" viewBox="0 0 44 44" fill="none">
          <path d="M22 2 40 12v20L22 42 4 32V12z" stroke="#33d6ff" stroke-width="1.4" opacity=".75" />
          <path d="M22 8 34 15v14L22 36 10 29V15z" stroke="#2b7fff" stroke-width="1" opacity=".5" />
          <path d="M14 28v-9l5 3.2V19l5 3.2V17h2.6v11z" fill="#33d6ff" opacity=".92" />
        </svg>
        <div class="brand__text">
          <div class="brand__name">华东智能制造基地</div>
          <div class="brand__sub">EAST CHINA INTELLIGENT MFG. BASE</div>
        </div>
      </div>
    </div>

    <!-- 中：主标题 -->
    <div class="hd__center">
      <div class="title-wrap">
        <span class="title-deco title-deco--l"></span>
        <h1 class="title">智慧工厂生产运营中心</h1>
        <span class="title-deco title-deco--r"></span>
      </div>
      <div class="title-en">SMART FACTORY OPERATION CENTER</div>
    </div>

    <!-- 右：时间 / 状态 -->
    <div class="hd__right">
      <div class="status-chip" :class="`is-${connClass}`">
        <i class="status-chip__dot"></i>
        <span>{{ connText }}</span>
      </div>
      <div class="clock">
        <div class="clock__time num">{{ clock }}</div>
        <div class="clock__date">{{ date }} {{ week }}</div>
      </div>
      <button class="fullscreen" title="全屏切换" @click="toggleFullscreen">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { fmtDate, fmtClock, fmtWeek } from '@/utils/format'
import { useDashboard } from '@/services/api'

const state = useDashboard()

const clock = ref(fmtClock())
const date = ref(fmtDate())
const week = ref(fmtWeek())
let timer = null

onMounted(() => {
  timer = setInterval(() => {
    const d = new Date()
    clock.value = fmtClock(d)
    date.value = fmtDate(d)
    week.value = fmtWeek(d)
  }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const connClass = computed(() => {
  if (state.connection === 'live') return 'live'
  if (state.connection === 'reconnecting') return 'wait'
  return 'off'
})

/**
 * 链路状态文案
 * 大屏值班人员只看这一处就能判断「数据是不是真的在走」：
 *   live          WebSocket 正常，数据实时刷新
 *   reconnecting  断线重连中，界面保留最后一次数据
 *   offline       后端不可达，已降级为本地缓存/模拟数据
 */
const connText = computed(() => {
  const map = {
    live: '数据链路正常',
    reconnecting: '链路重连中',
    connecting: '正在连接',
    offline: '离线缓存'
  }
  const mode = state.runtime === 'live' ? 'LIVE' : state.runtime === 'mock' ? 'MOCK' : 'INIT'
  return `${map[state.connection] || '未知'} · ${mode}`
})

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}
</script>

<style scoped>
.hd {
  position: relative;
  display: flex;
  align-items: center;
  height: 78px;
  padding: 0 22px;
  flex-shrink: 0;
  z-index: 10;
}

/* 顶部背景：中间亮两侧暗 */
.hd__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 120% at 50% 0%, rgba(43, 127, 255, 0.3), transparent 70%),
    linear-gradient(180deg, rgba(10, 34, 64, 0.9), rgba(4, 12, 24, 0));
  border-bottom: 1px solid rgba(51, 214, 255, 0.16);
  z-index: -1;
}
.hd__bg::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(51, 214, 255, 0.65), transparent);
}

.hd__left {
  width: 460px;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand__logo {
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 0 8px rgba(51, 214, 255, 0.55));
}
.brand__name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #d8ecff;
}
.brand__sub {
  font-size: 9px;
  letter-spacing: 1.1px;
  color: rgba(120, 170, 220, 0.62);
  margin-top: 2px;
  font-family: var(--font-num);
}

.hd__center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}

.title {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 7px;
  background: linear-gradient(180deg, #ffffff 10%, #7fdcff 55%, #2b9fff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(51, 180, 255, 0.45));
  white-space: nowrap;
}

.title-en {
  margin-top: 1px;
  font-size: 9.5px;
  letter-spacing: 4.6px;
  color: rgba(110, 168, 220, 0.6);
  font-family: var(--font-num);
  padding-left: 6px;
}

.title-deco {
  position: relative;
  width: 92px;
  height: 10px;
  background: linear-gradient(90deg, transparent, rgba(51, 214, 255, 0.7));
  clip-path: polygon(0 45%, 88% 45%, 100% 0, 100% 100%, 88% 55%, 0 55%);
}
.title-deco--r {
  transform: scaleX(-1);
}

.hd__right {
  width: 460px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  border-radius: 20px;
  border: 1px solid rgba(46, 108, 170, 0.4);
  background: rgba(12, 36, 64, 0.6);
  color: var(--text-sub);
  white-space: nowrap;
}
.status-chip__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-teal);
  box-shadow: 0 0 8px var(--c-teal);
  animation: blink 2s infinite;
}
.status-chip.is-off .status-chip__dot {
  background: var(--c-red);
  box-shadow: 0 0 8px var(--c-red);
}
.status-chip.is-wait .status-chip__dot {
  background: var(--c-amber);
  box-shadow: 0 0 8px var(--c-amber);
}

.clock {
  text-align: right;
  line-height: 1.1;
}
.clock__time {
  font-size: 24px;
  font-weight: 600;
  color: #eaf6ff;
  letter-spacing: 1.5px;
  text-shadow: 0 0 14px rgba(51, 214, 255, 0.45);
}
.clock__date {
  font-size: 11px;
  color: var(--text-sub);
  letter-spacing: 1px;
  margin-top: 3px;
}

.fullscreen {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(51, 214, 255, 0.3);
  border-radius: 3px;
  color: var(--c-cyan);
  background: rgba(12, 40, 70, 0.5);
  transition: all 0.2s;
}
.fullscreen:hover {
  background: rgba(51, 214, 255, 0.16);
  border-color: var(--c-cyan);
}
</style>
