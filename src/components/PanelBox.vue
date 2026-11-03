<template>
  <section class="panel">
    <header class="panel-hd">
      <span class="panel-hd__bar"></span>
      <h3 class="panel-hd__title">{{ title }}</h3>
      <span v-if="sub" class="panel-hd__sub">{{ sub }}</span>
      <div class="panel-hd__extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="panel-bd" :style="bodyStyle">
      <slot />
    </div>
    <!-- 四角装饰 -->
    <i class="corner corner--tl"></i>
    <i class="corner corner--tr"></i>
    <i class="corner corner--bl"></i>
    <i class="corner corner--br"></i>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  sub: { type: String, default: '' },
  padding: { type: String, default: '10px 4px 4px' }
})

const bodyStyle = computed(() => ({ padding: props.padding }))
</script>

<style scoped>
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: 0 12px 8px;
  background: linear-gradient(180deg, rgba(11, 34, 62, 0.82) 0%, rgba(5, 18, 34, 0.92) 100%);
  border: 1px solid rgba(46, 108, 170, 0.22);
  border-radius: 4px;
  box-shadow: inset 0 0 24px rgba(20, 90, 160, 0.16);
}

/* 顶部高亮描边 */
.panel::before {
  content: '';
  position: absolute;
  left: 10%;
  right: 10%;
  top: -1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(51, 214, 255, 0.75), transparent);
}

.panel-hd {
  display: flex;
  align-items: center;
  height: 34px;
  flex-shrink: 0;
  gap: 8px;
}

.panel-hd__bar {
  width: 3px;
  height: 13px;
  background: linear-gradient(180deg, #33d6ff, #2b7fff);
  box-shadow: 0 0 8px rgba(51, 214, 255, 0.9);
}

.panel-hd__title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: #dceeff;
  white-space: nowrap;
}

.panel-hd__sub {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
}

.panel-hd__extra {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-sub);
}

.panel-bd {
  flex: 1;
  min-height: 0;
  position: relative;
}

/* ===== 四角 ===== */
.corner {
  position: absolute;
  width: 9px;
  height: 9px;
  border-color: rgba(51, 214, 255, 0.75);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
}
.corner--tl {
  top: -1px;
  left: -1px;
  border-top-width: 2px;
  border-left-width: 2px;
}
.corner--tr {
  top: -1px;
  right: -1px;
  border-top-width: 2px;
  border-right-width: 2px;
}
.corner--bl {
  bottom: -1px;
  left: -1px;
  border-bottom-width: 2px;
  border-left-width: 2px;
}
.corner--br {
  bottom: -1px;
  right: -1px;
  border-bottom-width: 2px;
  border-right-width: 2px;
}
</style>
