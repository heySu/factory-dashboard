import { echarts } from './useChart'

export const palette = ['#33d6ff', '#2b7fff', '#00e5b8', '#ffb020', '#a86bff', '#ff4d5e']

export const textSub = '#8fb4d9'
export const textDim = '#517593'

/** 自上而下线性渐变（面积图用） */
export function vGradient(color, from = 0.42, to = 0.02) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: hexA(color, from) },
    { offset: 1, color: hexA(color, to) }
  ])
}

/** 左右线性渐变（柱状图用） */
export function hGradient(color, from = 1, to = 0.25) {
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: hexA(color, to) },
    { offset: 1, color: hexA(color, from) }
  ])
}

/** hex -> rgba */
export function hexA(hex, alpha = 1) {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16
  )
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export const tooltipBase = {
  trigger: 'axis',
  backgroundColor: 'rgba(6, 22, 42, 0.94)',
  borderColor: 'rgba(51, 214, 255, 0.35)',
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: '#e6f3ff', fontSize: 12 },
  axisPointer: {
    type: 'line',
    lineStyle: { color: 'rgba(51,214,255,0.5)', width: 1, type: 'dashed' }
  },
  extraCssText: 'box-shadow: 0 6px 24px rgba(0,0,0,.5); border-radius: 3px;'
}

export const gridBase = { left: 8, right: 12, top: 34, bottom: 4, containLabel: true }

export function catAxis(data, extra = {}) {
  return {
    type: 'category',
    data,
    boundaryGap: true,
    axisLine: { lineStyle: { color: 'rgba(51,214,255,0.22)' } },
    axisTick: { show: false },
    axisLabel: { color: textSub, fontSize: 11, margin: 10 },
    ...extra
  }
}

export function valAxis(extra = {}) {
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: 'rgba(51,214,255,0.09)', type: 'dashed' } },
    axisLabel: { color: textDim, fontSize: 11 },
    ...extra
  }
}

export const axisPointerLine = {
  type: 'line',
  lineStyle: { color: 'rgba(51,214,255,0.45)', width: 1 }
}
