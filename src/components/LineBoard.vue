<template>
  <div class="board">
    <div v-for="line in lines" :key="line.id" class="line" :class="`is-${line.status}`">
      <div class="line__hd">
        <span class="line__id num">{{ line.id }}</span>
        <span class="line__name">{{ line.name }}</span>
        <StatusBadge :status="line.status" class="line__badge" />
      </div>

      <div class="line__bar-row">
        <div class="line__bar">
          <div class="line__bar-fill" :style="{ width: pct(line) + '%' }">
            <i class="line__bar-shine"></i>
          </div>
          <span class="line__bar-tip num">{{ pct(line).toFixed(1) }}%</span>
        </div>
      </div>

      <div class="line__meta">
        <div class="m">
          <span class="m__k">产出</span>
          <span class="m__v num">{{ thousands(line.output) }}</span>
          <span class="m__s">/ {{ thousands(line.plan) }}</span>
        </div>
        <div class="m">
          <span class="m__k">OEE</span>
          <span class="m__v num" :style="{ color: oeeColor(line.oee) }">{{ line.oee }}%</span>
        </div>
        <div class="m">
          <span class="m__k">节拍</span>
          <span class="m__v num">{{ line.speed }}<span class="m__s"> 件/分</span></span>
        </div>
        <div class="m">
          <span class="m__k">在制</span>
          <span class="m__v num">{{ thousands(line.wip) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import StatusBadge from './StatusBadge.vue'
import { thousands } from '@/utils/format'

defineProps({
  lines: { type: Array, default: () => [] }
})

const pct = (l) => Math.min(100, (l.output / l.plan) * 100)
const oeeColor = (v) => (v >= 85 ? '#00e5b8' : v >= 70 ? '#ffb020' : '#ff4d5e')
</script>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 1fr;
  gap: 8px;
  height: 100%;
  padding: 2px 0 0;
}

.line {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 9px 12px 8px;
  background: linear-gradient(120deg, rgba(16, 50, 88, 0.55), rgba(7, 22, 40, 0.35));
  border: 1px solid rgba(46, 108, 170, 0.24);
  border-left: 2px solid rgba(0, 229, 184, 0.8);
  border-radius: 3px;
  overflow: hidden;
  animation: riseIn 0.4s ease both;
}

.line.is-alarm {
  border-left-color: #ff4d5e;
  background: linear-gradient(120deg, rgba(78, 22, 32, 0.55), rgba(24, 10, 16, 0.32));
}
.line.is-idle {
  border-left-color: #8fb4d9;
}
.line.is-maint {
  border-left-color: #ffb020;
}

.line__hd {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.line__id {
  font-size: 11px;
  color: var(--c-cyan);
  letter-spacing: 0.5px;
  opacity: 0.85;
}

.line__name {
  font-size: 13.5px;
  font-weight: 600;
  color: #dceeff;
  letter-spacing: 0.8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line__badge {
  margin-left: auto;
}

.line__bar-row {
  margin: 6px 0 5px;
}

.line__bar {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.line__bar-fill {
  position: relative;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #1d6fd0, #33d6ff);
  box-shadow: 0 0 10px rgba(51, 214, 255, 0.55);
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
}

.line.is-alarm .line__bar-fill {
  background: linear-gradient(90deg, #a12a3a, #ff4d5e);
  box-shadow: 0 0 10px rgba(255, 77, 94, 0.5);
}

.line__bar-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
  animation: flowX 2.6s linear infinite;
}

.line__bar-tip {
  position: absolute;
  right: 5px;
  top: -1px;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 10px;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.9);
}

.line__meta {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.m {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.m__k {
  font-size: 10.5px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
}

.m__v {
  font-size: 15px;
  font-weight: 600;
  color: #e6f3ff;
  white-space: nowrap;
}

.m__s {
  font-size: 10px;
  color: var(--text-dim);
  font-weight: 400;
}
</style>
