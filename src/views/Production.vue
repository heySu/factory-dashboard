<template>
  <div class="page">
    <div class="kpis">
      <KpiCard label="今日生产计划" :value="k.outputPlan" unit="件" tone="blue" hint="6 条产线合计" />
      <KpiCard label="已完成产量" :value="k.outputToday" unit="件" tone="cyan" :trend="3.2" hint="实时累计" />
      <KpiCard label="计划达成率" :value="k.outputRate" :decimals="1" unit="%" tone="teal" :trend="-1.4" hint="日目标 100%" />
      <KpiCard label="准时交付率" :value="k.onTimeRate" :decimals="1" unit="%" tone="purple" :trend="0.6" hint="本月累计" />
      <KpiCard label="在制品 WIP" :value="k.wip" unit="件" tone="amber" hint="安全水位 1,800" />
    </div>

    <div class="grid">
      <PanelBox title="产量达成趋势" sub="实际 / 计划" class="g-trend">
        <ChartBox :option="trendOption" />
      </PanelBox>

      <PanelBox title="各产线计划达成率" sub="按当前班次" class="g-line">
        <template #extra>
          <span class="mini">平均 <b class="num">{{ avgRate }}%</b></span>
        </template>
        <ChartBox :option="lineAchieveOption" />
      </PanelBox>

      <PanelBox title="工单执行看板" sub="6 张在制工单" class="g-order">
        <div class="orders">
          <div v-for="o in d.orders" :key="o.id" class="order" :class="`is-${o.status}`">
            <div class="order__top">
              <span class="order__id num">{{ o.id }}</span>
              <span class="order__status">{{ STATUS[o.status] }}</span>
            </div>
            <div class="order__mid">
              <span class="order__product">{{ o.product }}</span>
              <span class="order__qty num">{{ thousands(o.done) }} / {{ thousands(o.qty) }}</span>
            </div>
            <div class="order__bar">
              <i :style="{ width: orderPct(o) + '%' }"></i>
            </div>
            <div class="order__foot">
              <span>{{ o.line }}</span>
              <span>交期 {{ o.due }}</span>
            </div>
          </div>
        </div>
      </PanelBox>

      <PanelBox title="班组产出效率" sub="今日累计" class="g-team">
        <ChartBox :option="teamOption" />
      </PanelBox>

      <PanelBox title="产品产量结构" sub="按型号" class="g-product">
        <ChartBox :option="productOption" />
      </PanelBox>

      <PanelBox title="生产节拍波动" sub="近 30 分钟" class="g-takt">
        <template #extra>
          <span class="mini">标准节拍 <b class="num">48</b> 件/分</span>
        </template>
        <ChartBox :option="taktOption" />
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
import { thousands } from '@/utils/format'
import { catAxis, valAxis, tooltipBase, gridBase, hGradient, vGradient, hexA, textSub, palette } from '@/charts/theme'

const state = useDashboard()
const d = computed(() => state.data)
const k = computed(() => state.data?.kpi || {})

const STATUS = { running: '进行中', done: '已完工', delayed: '已延期', waiting: '待开工' }
const orderPct = (o) => Math.min(100, (o.done / o.qty) * 100)

const avgRate = computed(() => {
  const ls = d.value.lines
  return (ls.reduce((s, l) => s + (l.output / l.plan) * 100, 0) / ls.length).toFixed(1)
})

/* 产量趋势：柱 + 累计折线 */
const trendOption = computed(() => {
  const t = d.value.trendHour
  let acc = 0
  const cumulative = t.actual.map((v) => {
    acc += v || 0
    return v == null ? null : acc
  })
  return {
    grid: { ...gridBase, top: 40, left: 4, right: 4 },
    tooltip: { ...tooltipBase },
    legend: {
      top: 2,
      right: 4,
      itemWidth: 12,
      itemHeight: 6,
      textStyle: { color: textSub, fontSize: 11 }
    },
    xAxis: catAxis(t.labels, { axisLabel: { color: textSub, fontSize: 10, interval: 3 } }),
    yAxis: [
      valAxis({ name: '件/时', nameTextStyle: { color: '#517593', fontSize: 10, padding: [0, 0, 4, -20] } }),
      valAxis({ name: '累计', position: 'right', splitLine: { show: false }, nameTextStyle: { color: '#517593', fontSize: 10 } })
    ],
    series: [
      {
        name: '小时产量',
        type: 'bar',
        barWidth: '48%',
        data: t.actual,
        itemStyle: { borderRadius: [2, 2, 0, 0], color: hGradient('#2b7fff', 0.95, 0.22) }
      },
      {
        name: '计划',
        type: 'line',
        symbol: 'none',
        smooth: true,
        data: t.plan,
        lineStyle: { color: '#ffb020', width: 1.3, type: 'dashed' }
      },
      {
        name: '累计产量',
        type: 'line',
        yAxisIndex: 1,
        symbol: 'none',
        smooth: true,
        data: cumulative,
        lineStyle: { color: '#33d6ff', width: 1.8, shadowColor: 'rgba(51,214,255,.65)', shadowBlur: 10 },
        areaStyle: { color: vGradient('#33d6ff', 0.22, 0.01) }
      }
    ]
  }
})

/* 产线达成率：横向条 */
const lineAchieveOption = computed(() => {
  const ls = [...d.value.lines].sort((a, b) => a.output / a.plan - b.output / b.plan)
  return {
    grid: { left: 8, right: 56, top: 12, bottom: 6, containLabel: true },
    tooltip: { ...tooltipBase, trigger: 'item', formatter: (p) => `${p.name}<br/>达成率 ${p.value}%` },
    xAxis: valAxis({ max: 120, splitLine: { show: false }, axisLabel: { show: false } }),
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
        barWidth: 13,
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,.05)', borderRadius: 7 },
        data: ls.map((l) => {
          const v = Number(((l.output / l.plan) * 100).toFixed(1))
          return {
            value: v,
            itemStyle: {
              borderRadius: 7,
              color: v >= 100 ? hGradient('#00e5b8') : v >= 90 ? hGradient('#33d6ff') : v >= 80 ? hGradient('#ffb020') : hGradient('#ff4d5e')
            }
          }
        }),
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          color: '#cfe9ff',
          fontSize: 12,
          fontFamily: 'Bahnschrift'
        }
      },
      {
        // 100% 基准线
        type: 'line',
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(255,176,32,.5)', type: 'dashed', width: 1 },
          data: [{ xAxis: 100 }],
          label: { show: false }
        },
        data: []
      }
    ]
  }
})

/* 班组：柱 + 人均折线 */
const teamOption = computed(() => {
  const ts = d.value.teams
  return {
    grid: { ...gridBase, top: 36, left: 4, right: 4 },
    tooltip: { ...tooltipBase },
    legend: { top: 2, right: 4, itemWidth: 12, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(ts.map((t) => t.name), { axisLabel: { color: textSub, fontSize: 12 } }),
    yAxis: [
      valAxis({ name: '件', nameTextStyle: { color: '#517593', fontSize: 10 } }),
      valAxis({ name: '人均', position: 'right', splitLine: { show: false }, nameTextStyle: { color: '#517593', fontSize: 10 } })
    ],
    series: [
      {
        name: '产出',
        type: 'bar',
        barWidth: '38%',
        data: ts.map((t) => t.output),
        itemStyle: { borderRadius: [3, 3, 0, 0], color: hGradient('#33d6ff') },
        label: { show: true, position: 'top', color: '#9dc2e2', fontSize: 10, fontFamily: 'Bahnschrift' }
      },
      {
        name: '人均产出',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: ts.map((t) => Math.round(t.output / t.staff)),
        lineStyle: { color: '#ffb020', width: 2 },
        itemStyle: { color: '#ffb020' }
      }
    ]
  }
})

/* 产品结构玫瑰图 */
const productOption = computed(() => {
  const ps = d.value.products
  return {
    tooltip: { ...tooltipBase, trigger: 'item', formatter: '{b}<br/>{c} 件 · {d}%' },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 13,
      textStyle: { color: textSub, fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        center: ['36%', '52%'],
        radius: ['26%', '76%'],
        roseType: 'radius',
        itemStyle: { borderColor: '#061223', borderWidth: 2, borderRadius: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scaleSize: 6 },
        data: ps.map((p, i) => ({
          name: p.name,
          value: p.value,
          itemStyle: { color: hexA(palette[i % palette.length], 0.85) }
        }))
      }
    ]
  }
})

/* 节拍波动 */
const taktOption = computed(() => {
  const labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`)
  const eff = d.value.kpi.oee
  const values = Array.from({ length: 30 }, (_, i) => {
    const base = 48
    const s = Math.sin(i / 3.4) * 4 + Math.sin(i / 1.7) * 2
    return Number((base + s + (eff % 3) - 1.5).toFixed(1))
  })
  return {
    grid: { ...gridBase, top: 30, left: 4, right: 10 },
    tooltip: { ...tooltipBase, valueFormatter: (v) => `${v} 件/分` },
    xAxis: catAxis(labels, { boundaryGap: false, axisLabel: { color: textSub, fontSize: 10, interval: 4 } }),
    yAxis: valAxis({ min: 34, max: 62, splitNumber: 4 }),
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: values,
        lineStyle: { color: '#a86bff', width: 2, shadowColor: 'rgba(168,107,255,.6)', shadowBlur: 8 },
        areaStyle: { color: vGradient('#a86bff', 0.3, 0.01) },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ffb020', type: 'dashed', width: 1 },
          data: [{ yAxis: 48, label: { formatter: '标准 48', color: '#ffb020', fontSize: 10, position: 'insideEndTop' } }]
        }
      }
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
  grid-template-rows: 0.92fr 1.08fr;
  gap: 14px;
}

.g-trend {
  grid-column: 1;
  grid-row: 1;
}
.g-line {
  grid-column: 2;
  grid-row: 1;
}
.g-order {
  grid-column: 3;
  grid-row: 1;
}
.g-team {
  grid-column: 1;
  grid-row: 2;
}
.g-product {
  grid-column: 2;
  grid-row: 2;
}
.g-takt {
  grid-column: 3;
  grid-row: 2;
}

.mini {
  font-size: 11px;
  color: var(--text-dim);
}
.mini b {
  color: #cfe9ff;
  font-size: 13px;
  margin: 0 2px;
}

/* ===== 工单 ===== */
.orders {
  display: flex;
  flex-direction: column;
  gap: 5px;
  height: 100%;
  overflow-y: auto;
  padding-right: 2px;
}

.order {
  padding: 6px 9px 5px;
  background: linear-gradient(90deg, rgba(20, 54, 92, 0.5), rgba(8, 24, 44, 0.22));
  border: 1px solid rgba(46, 108, 170, 0.2);
  border-left: 2px solid var(--c-cyan);
  border-radius: 2px;
  flex-shrink: 0;
}
.order.is-done {
  border-left-color: #22d18c;
  opacity: 0.72;
}
.order.is-delayed {
  border-left-color: #ff4d5e;
}
.order.is-waiting {
  border-left-color: #8fb4d9;
  opacity: 0.6;
}

.order__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
}
.order__id {
  color: var(--c-cyan);
  letter-spacing: 0.4px;
}
.order__status {
  color: var(--text-dim);
}

.order__mid {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 2px 0 3px;
}
.order__product {
  font-size: 12.5px;
  color: #dceeff;
  font-weight: 600;
}
.order__qty {
  font-size: 11px;
  color: var(--text-sub);
}

.order__bar {
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}
.order__bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #1d6fd0, #33d6ff);
  box-shadow: 0 0 8px rgba(51, 214, 255, 0.7);
  transition: width 0.6s ease;
}
.order.is-done .order__bar i {
  background: linear-gradient(90deg, #12915f, #22d18c);
}
.order.is-delayed .order__bar i {
  background: linear-gradient(90deg, #a12a3a, #ff4d5e);
}

.order__foot {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 10px;
  color: var(--text-dim);
}
</style>
