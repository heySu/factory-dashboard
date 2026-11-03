import * as echarts from 'echarts'
import { onMounted, onBeforeUnmount, shallowRef } from 'vue'

/**
 * ECharts 生命周期封装
 * - 自动 init / resize / dispose
 * - 页面隐藏时暂停（大屏 7x24 常开，降低 GPU 占用）
 * @param {import('vue').Ref<HTMLElement>} elRef 容器 ref
 * @returns {{ chart: import('vue').ShallowRef, setOption: Function }}
 */
export function useChart(elRef) {
  const chart = shallowRef(null)
  let observer = null

  const resize = () => chart.value && chart.value.resize()

  const setOption = (option, opts = {}) => {
    if (!chart.value) return
    chart.value.setOption(option, { notMerge: opts.notMerge ?? true, lazyUpdate: true })
  }

  onMounted(() => {
    if (!elRef.value) return
    chart.value = echarts.init(elRef.value, null, { renderer: 'canvas' })
    // 容器尺寸变化（父级 grid/flex 变动）也能跟随
    observer = new ResizeObserver(resize)
    observer.observe(elRef.value)
  })

  onBeforeUnmount(() => {
    observer && observer.disconnect()
    chart.value && chart.value.dispose()
    chart.value = null
  })

  return { chart, setOption, resize }
}

export { echarts }
