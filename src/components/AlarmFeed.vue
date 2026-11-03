<template>
  <div class="feed">
    <div class="feed__stat">
      <div class="stat">
        <span class="stat__n num" style="color: #ff4d5e">{{ counts.critical }}</span>
        <span class="stat__l">紧急</span>
      </div>
      <div class="stat">
        <span class="stat__n num" style="color: #ffb020">{{ counts.major }}</span>
        <span class="stat__l">重要</span>
      </div>
      <div class="stat">
        <span class="stat__n num" style="color: #33d6ff">{{ counts.minor }}</span>
        <span class="stat__l">一般</span>
      </div>
      <div class="stat stat--wide">
        <span class="stat__n num">{{ counts.open }}</span>
        <span class="stat__l">未处理</span>
      </div>
    </div>

    <div class="feed__list">
      <TransitionGroup name="alarm">
        <button
          v-for="a in visible"
          :key="a.id"
          class="item"
          :class="`item--${a.level}`"
          @click="$emit('ack', a.id)"
        >
          <span class="item__flag"></span>
          <div class="item__main">
            <div class="item__top">
              <span class="item__type">{{ a.type }}</span>
              <span class="item__target">{{ a.target }}</span>
              <span class="item__time num">{{ fmtTime(a.time) }}</span>
            </div>
            <div class="item__msg">{{ a.msg }}</div>
          </div>
          <span class="item__status" :class="`s-${a.status}`">
            {{ a.status === 'open' ? '待处理' : a.status === 'ack' ? '已确认' : '已闭环' }}
          </span>
        </button>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fmtTime } from '@/utils/format'

const props = defineProps({
  alarms: { type: Array, default: () => [] },
  limit: { type: Number, default: 7 }
})
defineEmits(['ack'])

const visible = computed(() =>
  [...props.alarms].sort((a, b) => b.time - a.time).slice(0, props.limit)
)

const counts = computed(() => {
  const open = props.alarms.filter((a) => a.status === 'open')
  return {
    critical: open.filter((a) => a.level === 'critical').length,
    major: open.filter((a) => a.level === 'major').length,
    minor: open.filter((a) => a.level === 'minor').length,
    open: open.length
  }
})
</script>

<style scoped>
.feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.feed__stat {
  display: flex;
  gap: 6px;
  margin-bottom: 7px;
  flex-shrink: 0;
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0 3px;
  background: rgba(20, 54, 92, 0.45);
  border: 1px solid rgba(46, 108, 170, 0.22);
  border-radius: 2px;
}
.stat--wide {
  flex: 1.2;
}

.stat__n {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.1;
}
.stat__l {
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 1px;
}

.feed__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}

.item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 7px 9px 7px 12px;
  background: linear-gradient(90deg, rgba(22, 58, 98, 0.5), rgba(9, 26, 48, 0.22));
  border: 1px solid rgba(46, 108, 170, 0.2);
  border-radius: 2px;
  transition: all 0.2s;
  overflow: hidden;
}

.item:hover {
  border-color: rgba(51, 214, 255, 0.45);
  background: linear-gradient(90deg, rgba(30, 78, 128, 0.62), rgba(12, 34, 60, 0.3));
  transform: translateX(2px);
}

.item__flag {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #33d6ff;
}
.item--critical .item__flag {
  background: #ff4d5e;
  box-shadow: 0 0 10px #ff4d5e;
  animation: blink 1.4s infinite;
}
.item--major .item__flag {
  background: #ffb020;
  box-shadow: 0 0 8px rgba(255, 176, 32, 0.8);
}
.item--minor .item__flag {
  background: #33d6ff;
}

.item__main {
  flex: 1;
  min-width: 0;
}

.item__top {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
}

.item__type {
  color: #cfe6ff;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.item__target {
  color: var(--c-cyan);
  font-size: 10.5px;
  padding: 0 5px;
  border: 1px solid rgba(51, 214, 255, 0.28);
  border-radius: 2px;
  line-height: 14px;
}

.item__time {
  margin-left: auto;
  color: var(--text-dim);
  font-size: 10.5px;
}

.item__msg {
  margin-top: 3px;
  font-size: 11.5px;
  color: #9dc2e2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item__status {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 2px;
  align-self: center;
}
.s-open {
  color: #ff6b7a;
  background: rgba(255, 77, 94, 0.12);
}
.s-ack {
  color: #ffb020;
  background: rgba(255, 176, 32, 0.12);
}
.s-closed {
  color: #22d18c;
  background: rgba(34, 209, 140, 0.12);
}

/* 进场动画 */
.alarm-enter-active {
  transition: all 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.alarm-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}
.alarm-move {
  transition: transform 0.4s ease;
}
</style>
