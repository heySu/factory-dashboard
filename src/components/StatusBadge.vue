<template>
  <span class="badge" :class="`badge--${status}`">
    <i class="badge__dot"></i>{{ text }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'run' } // run | idle | alarm | maint | open | ack | closed
})

const MAP = {
  run: '运行中',
  idle: '待机',
  alarm: '故障',
  maint: '维护中',
  open: '未处理',
  ack: '已确认',
  closed: '已闭环'
}

const text = computed(() => MAP[props.status] || props.status)
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  font-size: 11.5px;
  line-height: 1;
  border-radius: 2px;
  white-space: nowrap;
  color: var(--c);
  border: 1px solid var(--b);
  background: var(--bgc);
}

.badge__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c);
  box-shadow: 0 0 7px var(--c);
}

.badge--run {
  --c: #00e5b8;
  --b: rgba(0, 229, 184, 0.42);
  --bgc: rgba(0, 229, 184, 0.12);
}
.badge--idle {
  --c: #8fb4d9;
  --b: rgba(143, 180, 217, 0.38);
  --bgc: rgba(143, 180, 217, 0.1);
}
.badge--alarm,
.badge--open {
  --c: #ff4d5e;
  --b: rgba(255, 77, 94, 0.45);
  --bgc: rgba(255, 77, 94, 0.12);
}
.badge--maint,
.badge--ack {
  --c: #ffb020;
  --b: rgba(255, 176, 32, 0.42);
  --bgc: rgba(255, 176, 32, 0.12);
}
.badge--closed {
  --c: #22d18c;
  --b: rgba(34, 209, 140, 0.38);
  --bgc: rgba(34, 209, 140, 0.1);
}

.badge--alarm .badge__dot,
.badge--open .badge__dot {
  animation: blink 1.1s infinite;
}
</style>
