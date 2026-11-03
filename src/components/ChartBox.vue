<template>
  <div ref="el" class="chart-box"></div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useChart } from '@/charts/useChart'

const props = defineProps({
  option: { type: Object, default: null },
  // 数据结构变化（系列增减）时置 true，纯数值刷新保持 false 以获得平滑过渡
  notMerge: { type: Boolean, default: false }
})

const el = ref(null)
const { setOption } = useChart(el)
let first = true

function apply(opt) {
  if (!opt) return
  setOption(opt, { notMerge: first ? true : props.notMerge })
  first = false
}

onMounted(() => apply(props.option))
watch(() => props.option, apply)
</script>

<style scoped>
.chart-box {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
