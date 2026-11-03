<template>
  <div class="page">
    <div class="kpis">
      <KpiCard label="一次通过率 FPY" :value="k.fpy" :decimals="2" unit="%" tone="teal" :trend="0.3" hint="目标 98.0%" />
      <KpiCard label="不良率" :value="k.defectRate" :decimals="2" unit="%" tone="amber" :trend="-0.2" hint="较昨日下降" />
      <KpiCard label="报废率" :value="k.scrapRate" :decimals="2" unit="%" tone="red" hint="目标 ≤ 0.5%" />
      <KpiCard label="质量成本" :value="8.7" :decimals="1" unit="万元" tone="purple" :trend="-4.1" hint="本月累计" />
      <KpiCard label="客诉件数" :value="3" unit="件" tone="blue" hint="本月 · 已闭环 2 件" />
    </div>

    <div class="grid">
      <PanelBox title="一次通过率趋势" sub="近 12 小时" class="g-fpy">
        <ChartBox :option="fpyOption" />
      </PanelBox>

      <PanelBox title="缺陷类型帕累托" sub="本月累计" class="g-pareto">
        <template #extra>
          <span class="mini">TOP3 占比 <b class="num">71%</b></span>
        </template>
        <ChartBox :option="paretoOption" />
      </PanelBox>

      <PanelBox title="各产线质量对比" sub="FPY / 缺陷数" class="g-line">
        <ChartBox :option="lineQualityOption" />
      </PanelBox>

      <PanelBox title="SPC 过程控制图" sub="关键尺寸 φ25.00 ±0.60" class="g-spc">
        <template #extra>
          <span class="cpk">CPK <b class="num">1.42</b></span>
        </template>
        <ChartBox :option="spcOption" />
      </PanelBox>

      <PanelBox title="质量成本构成" sub="万元 / 本月" class="g-cost">
        <ChartBox :option="costOption" />
      </PanelBox>

      <PanelBox title="不良趋势与分布" sub="近 7 日" class="g-trend">
        <ChartBox :option="defectTrendOption" />
      </PanelBox>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PanelBox from '@/components/PanelBox.vue'
import KpiCard from '@/components/KpiCard.vue'
import ChartBox from '@/components/ChartBox.vue'
import { useDashboard } from '@/services/api'
import { catAxis, valAxis, tooltipBase, gridBase, hGradient, vGradient, hexA, textSub, palette } from '@/charts/theme'

const state = useDashboard()
const d = computed(() => state.data)
const k = computed(() => state.data?.kpi || {})

/* FPY 趋势 */
const fpyOption = computed(() => {
  const q = d.value.quality.fpyTrend
  return {
    grid: { ...gridBase, top: 38, left: 4, right: 8 },
    tooltip: { ...tooltipBase, valueFormatter: (v) => `${v}%` },
    legend: { top: 2, right: 4, itemWidth: 12, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(q.labels, { boundaryGap: false, axisLabel: { color: textSub, fontSize: 10, interval: 1 } }),
    yAxis: valAxis({ min: 96, max: 100, splitNumber: 4, axisLabel: { color: '#517593', fontSize: 10, formatter: '{value}%' } }),
    series: [
      {
        name: 'FPY',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: q.fpy,
        lineStyle: { color: '#00e5b8', width: 2.2, shadowColor: 'rgba(0,229,184,.6)', shadowBlur: 12 },
        itemStyle: { color: '#00e5b8', borderColor: '#04101f', borderWidth: 2 },
        areaStyle: { color: vGradient('#00e5b8', 0.3, 0.01) }
      },
      {
        name: '目标',
        type: 'line',
        symbol: 'none',
        data: q.target,
        lineStyle: { color: '#ffb020', width: 1.2, type: 'dashed', opacity: 0.85 }
      }
    ]
  }
})

/* 缺陷帕累托 */
const paretoOption = computed(() => {
  const ds = [...d.value.quality.defectPareto].sort((a, b) => b.value - a.value)
  const total = ds.reduce((s, f) => s + f.value, 0)
  let acc = 0
  const cum = ds.map((f) => {
    acc += f.value
    return Number(((acc / total) * 100).toFixed(1))
  })
  return {
    grid: { ...gridBase, top: 40, left: 4, right: 8 },
    tooltip: { ...tooltipBase },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(ds.map((f) => f.name), { axisLabel: { color: textSub, fontSize: 10.5, interval: 0, rotate: 16 } }),
    yAxis: [
      valAxis({ name: '件', nameTextStyle: { color: '#517593', fontSize: 10 } }),
      valAxis({ max: 100, position: 'right', splitLine: { show: false }, axisLabel: { color: '#517593', fontSize: 10, formatter: '{value}%' } })
    ],
    series: [
      {
        name: '缺陷数',
        type: 'bar',
        barWidth: '46%',
        data: ds.map((f, i) => ({
          value: f.value,
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: hGradient(i < 3 ? '#ff7a2f' : '#2b7fff', 0.92, 0.22)
          }
        })),
        label: { show: true, position: 'top', color: '#9dc2e2', fontSize: 10, fontFamily: 'Bahnschrift' }
      },
      {
        name: '累计占比',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: cum,
        lineStyle: { color: '#ffd166', width: 1.8 },
        itemStyle: { color: '#ffd166' },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(255,209,102,.55)', type: 'dashed' },
          data: [{ yAxis: 80, label: { formatter: '80%', color: '#ffd166', fontSize: 10, position: 'insideEndTop' } }]
        }
      }
    ]
  }
})

/* 各产线 */
const lineQualityOption = computed(() => {
  const ls = [...d.value.quality.byLine].sort((a, b) => a.fpy - b.fpy)
  return {
    grid: { left: 8, right: 74, top: 14, bottom: 6, containLabel: true },
    tooltip: { ...tooltipBase, trigger: 'item' },
    xAxis: valAxis({ min: 94, max: 100, splitLine: { show: false }, axisLabel: { show: false } }),
    yAxis: {
      type: 'category',
      data: ls.map((l) => l.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: textSub, fontSize: 12, margin: 12 }
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,.05)', borderRadius: 6 },
        data: ls.map((l) => ({
          value: l.fpy,
          itemStyle: {
            borderRadius: 6,
            color: l.fpy >= 99 ? hGradient('#00e5b8') : l.fpy >= 97.5 ? hGradient('#33d6ff') : hGradient('#ffb020')
          }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: (p) => `${p.value}%  · ${ls[p.dataIndex].defect}件`,
          color: '#cfe9ff',
          fontSize: 11
        }
      }
    ]
  }
})

/* SPC 控制图 */
const spcOption = computed(() => {
  const s = d.value.quality.spc
  const points = s.values.map((v) => ({
    value: v,
    itemStyle: {
      color: v > s.ucl[0] || v < s.lcl[0] ? '#ff4d5e' : '#33d6ff',
      borderColor: '#04101f',
      borderWidth: 1.5
    }
  }))
  return {
    grid: { ...gridBase, top: 32, left: 4, right: 14 },
    tooltip: { ...tooltipBase, valueFormatter: (v) => `${v} mm` },
    xAxis: catAxis(s.labels, { boundaryGap: false, axisLabel: { color: textSub, fontSize: 10, interval: 1 } }),
    yAxis: valAxis({ min: 24.2, max: 25.9, splitNumber: 5, axisLabel: { color: '#517593', fontSize: 10, formatter: '{value}' } }),
    series: [
      {
        name: '实测值',
        type: 'line',
        smooth: false,
        symbol: 'circle',
        symbolSize: 5,
        data: points,
        lineStyle: { color: '#33d6ff', width: 1.6 },
        areaStyle: { color: vGradient('#33d6ff', 0.16, 0.01) },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            { yAxis: s.ucl[0], lineStyle: { color: '#ff4d5e', type: 'dashed', width: 1 }, label: { formatter: `UCL ${s.ucl[0]}`, color: '#ff4d5e', fontSize: 10, position: 'insideEndTop' } },
            { yAxis: s.lcl[0], lineStyle: { color: '#ff4d5e', type: 'dashed', width: 1 }, label: { formatter: `LCL ${s.lcl[0]}`, color: '#ff4d5e', fontSize: 10, position: 'insideEndBottom' } },
            { yAxis: s.cl[0], lineStyle: { color: 'rgba(0,229,184,.75)', type: 'solid', width: 1 }, label: { formatter: `CL ${s.cl[0]}`, color: '#00e5b8', fontSize: 10, position: 'insideEndTop' } }
          ]
        }
      }
    ]
  }
})

/* 质量成本 */
const costOption = computed(() => {
  const cs = d.value.qualityCost
  const total = cs.reduce((s, c) => s + c.value, 0)
  return {
    tooltip: { ...tooltipBase, trigger: 'item', formatter: '{b}<br/>{c} 万元 · {d}%' },
    legend: {
      orient: 'vertical',
      right: 14,
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: textSub, fontSize: 12 }
    },
    title: {
      text: total.toFixed(1),
      subtext: '万元合计',
      left: '26%',
      top: '40%',
      textAlign: 'center',
      textStyle: { color: '#eaf9ff', fontSize: 24, fontFamily: 'Bahnschrift', fontWeight: 700 },
      subtextStyle: { color: '#517593', fontSize: 10 }
    },
    series: [
      {
        type: 'pie',
        center: ['26%', '50%'],
        radius: ['50%', '72%'],
        itemStyle: { borderColor: '#061223', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: cs.map((c, i) => ({
          name: c.name,
          value: c.value,
          itemStyle: { color: hexA(['#ff4d5e', '#ff7a2f', '#ffb020', '#33d6ff'][i] || palette[i], 0.88) }
        }))
      }
    ]
  }
})

/* 不良趋势 */
const defectTrendOption = computed(() => {
  const labels = ['10-28', '10-29', '10-30', '10-31', '11-01', '11-02', '11-03']
  const mk = (base, amp) => labels.map((_, i) => Math.max(0, Math.round(base + Math.sin(i / 1.8) * amp)))
  const size = mk(18, 5)
  const appear = mk(12, 4)
  const assemble = mk(8, 3)
  return {
    grid: { ...gridBase, top: 40, left: 4, right: 8 },
    tooltip: { ...tooltipBase },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, itemGap: 10, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(labels),
    yAxis: valAxis({ name: '件', nameTextStyle: { color: '#517593', fontSize: 10 } }),
    series: [
      { name: '尺寸超差', type: 'bar', stack: 'd', barWidth: '46%', data: size, itemStyle: { color: hexA('#ff4d5e', 0.85) } },
      { name: '外观不良', type: 'bar', stack: 'd', data: appear, itemStyle: { color: hexA('#ffb020', 0.85) } },
      { name: '装配不良', type: 'bar', stack: 'd', data: assemble, itemStyle: { color: hexA('#33d6ff', 0.85), borderRadius: [3, 3, 0, 0] } }
    ]
  }
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}

.kpis {
  display: flex;
  gap: 12px;
  height: 96px;
  flex-shrink: 0;
}

.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 460px 1fr 424px;
  grid-template-rows: 0.9fr 1.1fr;
  gap: 14px;
}

.g-fpy {
  grid-column: 1;
  grid-row: 1;
}
.g-pareto {
  grid-column: 2;
  grid-row: 1;
}
.g-line {
  grid-column: 3;
  grid-row: 1;
}
.g-spc {
  grid-column: 1;
  grid-row: 2;
}
.g-cost {
  grid-column: 2;
  grid-row: 2;
}
.g-trend {
  grid-column: 3;
  grid-row: 2;
}

.mini {
  font-size: 11px;
  color: var(--text-dim);
}
.mini b {
  color: #ffd166;
  font-size: 13px;
  margin-left: 2px;
}

.cpk {
  font-size: 11px;
  color: var(--text-dim);
}
.cpk b {
  color: #00e5b8;
  font-size: 14px;
  margin-left: 3px;
  text-shadow: 0 0 10px rgba(0, 229, 184, 0.6);
}
</style>
