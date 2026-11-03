<template>
  <span class="ticker num">
    <span v-if="prefix" class="ticker__unit">{{ prefix }}</span>{{ display
    }}<span v-if="suffix" class="ticker__unit">{{ suffix }}</span>
  </span>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  decimals: { type: Number, default: 0 },
  duration: { type: Number, default: 700 },
  separator: { type: Boolean, default: true },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' }
})

const display = ref('')
let raf = null
let from = 0

function format(v) {
  const fixed = Number(v).toFixed(props.decimals)
  if (!props.separator) return fixed
  const [i, d] = fixed.split('.')
  const c = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return d ? `${c}.${d}` : c
}

function animate(to) {
  cancelAnimationFrame(raf)
  const start = performance.now()
  const begin = from
  const delta = to - begin
  const step = (now) => {
    const p = Math.min(1, (now - start) / props.duration)
    // easeOutCubic
    const e = 1 - Math.pow(1 - p, 3)
    const cur = begin + delta * e
    display.value = format(cur)
    from = cur
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

onMounted(() => {
  from = props.value
  display.value = format(props.value)
})

watch(
  () => props.value,
  (v) => animate(v)
)

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.ticker {
  display: inline-flex;
  align-items: baseline;
}
.ticker__unit {
  font-size: 0.55em;
  margin: 0 2px;
  color: var(--text-sub);
  font-weight: 400;
}
</style>
