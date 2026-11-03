<template>
  <div class="map">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" class="map__svg">
      <defs>
        <linearGradient id="zoneFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1b4d80" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#0a2340" stop-opacity="0.28" />
        </linearGradient>
        <linearGradient id="zoneFillHot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2a6fb0" stop-opacity="0.62" />
          <stop offset="100%" stop-color="#0f3057" stop-opacity="0.34" />
        </linearGradient>
        <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- 场地外框 -->
      <rect :x="4" :y="4" :width="W - 8" :height="H - 8" rx="4" fill="none" stroke="rgba(51,214,255,.18)" stroke-dasharray="6 5" />

      <!-- 车间分区 -->
      <g v-for="(z, i) in zones" :key="z.name">
        <rect
          :x="z.x"
          :y="z.y"
          :width="z.w"
          :height="z.h"
          rx="3"
          :fill="z.load > 80 ? 'url(#zoneFillHot)' : 'url(#zoneFill)'"
          stroke="rgba(51,214,255,.34)"
          stroke-width="0.7"
        />
        <!-- 分区顶部标题栏 -->
        <path :d="`M${z.x} ${z.y + 15} h${z.w}`" stroke="rgba(51,214,255,.18)" stroke-width="0.6" />
        <text :x="z.x + 7" :y="z.y + 10.5" class="z-name">{{ z.name }}</text>
        <text :x="z.x + z.w - 7" :y="z.y + 10.5" class="z-load" text-anchor="end">
          {{ z.running }}/{{ z.total }}
        </text>

        <!-- 设备点位 -->
        <g v-for="(p, j) in z.points" :key="j">
          <circle
            :cx="p.x"
            :cy="p.y"
            r="2.2"
            :fill="p.color"
            :opacity="p.off ? 0.3 : 1"
            :filter="p.off ? 'none' : 'url(#softGlow)'"
          >
            <animate
              v-if="!p.off && p.color === '#ff4d5e'"
              attributeName="opacity"
              values="1;0.25;1"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        <!-- 负载条 -->
        <rect :x="z.x + 6" :y="z.y + z.h - 8" :width="z.w - 12" height="2.4" rx="1.2" fill="rgba(255,255,255,.08)" />
        <rect
          :x="z.x + 6"
          :y="z.y + z.h - 8"
          :width="((z.w - 12) * z.load) / 100"
          height="2.4"
          rx="1.2"
          :fill="z.load > 85 ? '#ffb020' : '#33d6ff'"
        />
      </g>

      <!-- 物流通道（流动虚线） -->
      <g v-for="(path, i) in routes" :key="`r${i}`">
        <path :d="path" fill="none" stroke="rgba(0,229,184,.5)" stroke-width="1.1" stroke-dasharray="5 7" class="flow" :style="{ animationDelay: `${i * 0.4}s` }" />
      </g>
    </svg>

    <div class="map__legend">
      <span><i style="background: #00e5b8"></i>运行</span>
      <span><i style="background: #8fb4d9"></i>待机</span>
      <span><i style="background: #ff4d5e"></i>故障</span>
      <span><i style="background: #ffb020"></i>维护</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  zones: { type: Array, default: () => [] },
  seed: { type: Number, default: 1 }
})

const W = 400
const H = 210

// 车间平面布点（固定坐标，接近真实厂区布局）
const LAYOUT = [
  { x: 8, y: 8, w: 126, h: 92 },
  { x: 142, y: 8, w: 112, h: 92 },
  { x: 262, y: 8, w: 130, h: 92 },
  { x: 8, y: 112, w: 94, h: 92 },
  { x: 110, y: 112, w: 144, h: 92 },
  { x: 262, y: 112, w: 130, h: 92 }
]

const routes = [
  'M134 54 h8',
  'M254 54 h8',
  'M55 100 v12',
  'M182 100 v12',
  'M327 100 v12',
  'M102 158 h8'
]

const STATUS_COLORS = ['#00e5b8', '#00e5b8', '#00e5b8', '#00e5b8', '#8fb4d9', '#ffb020', '#ff4d5e']

function pseudo(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const zones = computed(() =>
  props.zones.slice(0, 6).map((z, i) => {
    const box = LAYOUT[i] || LAYOUT[0]
    const cols = 6
    const rows = 3
    const points = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c
        if (k >= 17) continue
        const px = box.x + 16 + c * ((box.w - 26) / (cols - 1))
        const py = box.y + 30 + r * ((box.h - 46) / (rows - 1))
        const rnd = pseudo(i * 31 + k, props.seed)
        const ci = Math.floor(rnd * STATUS_COLORS.length)
        points.push({
          x: px,
          y: py,
          color: STATUS_COLORS[Math.min(ci, STATUS_COLORS.length - 1)],
          off: rnd > 0.94
        })
      }
    }
    return { ...z, ...box, points }
  })
)
</script>

<style scoped>
.map {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map__svg {
  width: 100%;
  height: 100%;
}

.z-name {
  fill: #cfe6ff;
  font-size: 6.4px;
  letter-spacing: 0.4px;
}

.z-load {
  fill: #6fa8dc;
  font-size: 5.6px;
  font-family: var(--font-num);
}

.flow {
  animation: dash 2.4s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -24;
  }
}

.map__legend {
  position: absolute;
  right: 6px;
  bottom: 2px;
  display: flex;
  gap: 12px;
  font-size: 10.5px;
  color: var(--text-dim);
}
.map__legend span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.map__legend i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
}
</style>
