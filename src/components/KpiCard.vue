<template>
  <div class="kpi" :class="`kpi--${tone}`">
    <div class="kpi__head">
      <span class="kpi__label">{{ label }}</span>
      <span class="kpi__dot"></span>
    </div>
    <div class="kpi__value">
      <NumberTicker :value="value" :decimals="decimals" :suffix="unit" />
    </div>
    <div class="kpi__foot">
      <span v-if="trend !== null" class="kpi__trend" :class="trend >= 0 ? 'is-up' : 'is-down'">
        {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend).toFixed(1) }}%
      </span>
      <span class="kpi__hint">{{ hint }}</span>
    </div>
  </div>
</template>

<script setup>
import NumberTicker from './NumberTicker.vue'

defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  decimals: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  hint: { type: String, default: '' },
  trend: { type: Number, default: null },
  tone: { type: String, default: 'cyan' } // cyan | teal | amber | red | blue | purple
})
</script>

<style scoped>
.kpi {
  --tone: var(--c-cyan);
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 10px 14px 9px 16px;
  background: linear-gradient(135deg, rgba(16, 48, 82, 0.55), rgba(6, 20, 38, 0.28));
  border: 1px solid rgba(46, 108, 170, 0.24);
  border-radius: 3px;
  overflow: hidden;
}

/* 左侧色条 */
.kpi::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12%;
  bottom: 12%;
  width: 3px;
  background: var(--tone);
  box-shadow: 0 0 12px var(--tone);
}

/* 右上角光晕 */
.kpi::after {
  content: '';
  position: absolute;
  right: -30px;
  top: -30px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--tone), transparent 68%);
  opacity: 0.16;
}

.kpi--cyan {
  --tone: #33d6ff;
}
.kpi--teal {
  --tone: #00e5b8;
}
.kpi--amber {
  --tone: #ffb020;
}
.kpi--red {
  --tone: #ff4d5e;
}
.kpi--blue {
  --tone: #2b7fff;
}
.kpi--purple {
  --tone: #a86bff;
}

.kpi__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kpi__label {
  font-size: 12.5px;
  color: var(--text-sub);
  letter-spacing: 0.8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 8px var(--tone);
  animation: blink 2.4s infinite;
  flex-shrink: 0;
}

.kpi__value {
  margin-top: 3px;
  font-size: 27px;
  line-height: 1.08;
  font-weight: 700;
  color: var(--text-main);
  text-shadow: 0 0 16px rgba(51, 214, 255, 0.35);
}

.kpi__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  height: 15px;
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
}

.kpi__trend {
  flex-shrink: 0;
  font-family: var(--font-num);
}
.kpi__trend.is-up {
  color: #ff6b7a;
}
.kpi__trend.is-down {
  color: #22d18c;
}

.kpi__hint {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
