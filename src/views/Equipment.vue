<template>
  <div class="page">
    <div class="kpis">
      <KpiCard label="设备总数" :value="k.deviceTotal" unit="台" tone="blue" hint="含 6 类产线设备" />
      <KpiCard label="运行中" :value="k.deviceRun" unit="台" tone="teal" :hint="`占用率 ${runPct}%`" />
      <KpiCard label="故障停机" :value="k.deviceAlarm" unit="台" tone="red" hint="已派工处理" />
      <KpiCard label="平均 OEE" :value="k.oee" :decimals="1" unit="%" tone="cyan" :trend="0.8" hint="目标 85%" />
      <KpiCard label="MTBF / MTTR" :value="386" unit="h / 42min" tone="purple" hint="较上月改善 6.2%" />
    </div>

    <div class="grid">
      <PanelBox title="设备效率趋势" sub="近 7 日" class="g-oee">
        <ChartBox :option="oeeOption" />
      </PanelBox>

      <PanelBox title="设备类型分布与故障" sub="按类型统计" class="g-type">
        <ChartBox :option="typeOption" />
      </PanelBox>

      <PanelBox title="保养计划提醒" sub="未来 12 天" class="g-maint">
        <div class="maint">
          <div v-for="m in d.maintenance" :key="m.device" class="maint__item" :class="`lv-${m.level}`">
            <div class="maint__left">
              <span class="maint__day num">{{ m.due }}</span>
              <span class="maint__count">剩 {{ m.remain }} 天</span>
            </div>
            <div class="maint__mid">
              <div class="maint__device">{{ m.device }}</div>
              <div class="maint__type">{{ m.type }}</div>
            </div>
            <span class="maint__tag">{{ m.level === 'high' ? '紧急' : m.level === 'mid' ? '本周' : '计划' }}</span>
          </div>
        </div>
      </PanelBox>

      <PanelBox title="故障原因 TOP" sub="本月累计" class="g-fault">
        <ChartBox :option="faultOption" />
      </PanelBox>

      <PanelBox title="重点设备实时状态" sub="12 台关键设备" class="g-device">
        <template #extra>
          <span class="legend-dots">
            <i style="background: #00e5b8"></i>运行
            <i style="background: #8fb4d9; margin-left: 8px"></i>待机
            <i style="background: #ff4d5e; margin-left: 8px"></i>故障
          </span>
        </template>
        <div class="table">
          <div class="table__head">
            <span>设备编号</span>
            <span>名称</span>
            <span>状态</span>
            <span>负载</span>
            <span>温度</span>
            <span>振动</span>
            <span>OEE</span>
          </div>
          <div class="table__body">
            <div v-for="dv in d.equipment.devices" :key="dv.id" class="table__row" :class="{ 'is-bad': dv.status === 'alarm' }">
              <span class="num c-id">{{ dv.id }}</span>
              <span class="c-name">{{ dv.name }}</span>
              <span>
                <StatusBadge :status="dv.status" />
              </span>
              <span class="c-bar">
                <i class="bar"><b :style="{ width: dv.load + '%' }"></b></i>
                <em class="num">{{ dv.load }}%</em>
              </span>
              <span class="num" :style="{ color: dv.temp > 75 ? '#ff4d5e' : dv.temp > 68 ? '#ffb020' : '#cfe9ff' }">{{ dv.temp }}℃</span>
              <span class="num" :style="{ color: dv.vibration > 3.6 ? '#ffb020' : '#cfe9ff' }">{{ dv.vibration }}</span>
              <span class="num" :style="{ color: dv.oee >= 85 ? '#00e5b8' : dv.oee >= 70 ? '#ffb020' : '#ff4d5e' }">{{ dv.oee }}%</span>
            </div>
          </div>
        </div>
      </PanelBox>

      <PanelBox title="设备健康度评估" sub="六维度" class="g-radar">
        <ChartBox :option="radarOption" />
      </PanelBox>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PanelBox from '@/components/PanelBox.vue'
import KpiCard from '@/components/KpiCard.vue'
import ChartBox from '@/components/ChartBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useDashboard } from '@/services/api'
import { catAxis, valAxis, tooltipBase, gridBase, hGradient, vGradient, hexA, textSub } from '@/charts/theme'

const state = useDashboard()
const d = computed(() => state.data)
const k = computed(() => state.data?.kpi || {})

const runPct = computed(() => k.value.deviceTotal ? ((k.value.deviceRun / k.value.deviceTotal) * 100).toFixed(1) : 0)

/* OEE 趋势 */
const oeeOption = computed(() => {
  const o = d.value.equipment.oeeTrend
  return {
    grid: { ...gridBase, top: 42, left: 4, right: 4 },
    tooltip: { ...tooltipBase, valueFormatter: (v) => `${v}%` },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, itemGap: 10, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(o.labels, { boundaryGap: false }),
    yAxis: valAxis({ min: 60, max: 100, splitNumber: 4, axisLabel: { color: '#517593', fontSize: 10, formatter: '{value}%' } }),
    series: [
      {
        name: 'OEE',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: o.oee,
        lineStyle: { color: '#33d6ff', width: 2.4, shadowColor: 'rgba(51,214,255,.7)', shadowBlur: 12 },
        itemStyle: { color: '#33d6ff', borderColor: '#04101f', borderWidth: 2 },
        areaStyle: { color: vGradient('#33d6ff', 0.26, 0.01) }
      },
      {
        name: '稼动率',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: o.availability,
        lineStyle: { color: '#00e5b8', width: 1.6 }
      },
      {
        name: '性能率',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: o.performance,
        lineStyle: { color: '#a86bff', width: 1.6 }
      },
      {
        name: '合格率',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: o.quality,
        lineStyle: { color: '#ffb020', width: 1.4, type: 'dashed' }
      }
    ]
  }
})

/* 设备类型：柱 + 故障点 */
const typeOption = computed(() => {
  const ts = d.value.deviceTypes
  return {
    grid: { ...gridBase, top: 36, left: 4, right: 10 },
    tooltip: { ...tooltipBase },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(ts.map((t) => t.name), {
      axisLabel: { color: textSub, fontSize: 10, interval: 0, rotate: 18 }
    }),
    yAxis: valAxis({ name: '台', nameTextStyle: { color: '#517593', fontSize: 10 } }),
    series: [
      {
        name: '设备数量',
        type: 'bar',
        barWidth: '44%',
        data: ts.map((t) => t.value),
        itemStyle: { borderRadius: [3, 3, 0, 0], color: hGradient('#2b7fff', 0.95, 0.2) },
        label: { show: true, position: 'top', color: '#9dc2e2', fontSize: 10, fontFamily: 'Bahnschrift' }
      },
      {
        name: '故障台数',
        type: 'bar',
        barWidth: '20%',
        data: ts.map((t) => t.fault),
        itemStyle: { borderRadius: [3, 3, 0, 0], color: '#ff4d5e' }
      }
    ]
  }
})

/* 故障帕累托 */
const faultOption = computed(() => {
  const fs = [...d.value.faultTop].sort((a, b) => b.value - a.value)
  const total = fs.reduce((s, f) => s + f.value, 0)
  let acc = 0
  const cum = fs.map((f) => {
    acc += f.value
    return Number(((acc / total) * 100).toFixed(1))
  })
  return {
    grid: { ...gridBase, top: 38, left: 4, right: 6 },
    tooltip: { ...tooltipBase },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(fs.map((f) => f.name), { axisLabel: { color: textSub, fontSize: 10, interval: 0, rotate: 26 } }),
    yAxis: [valAxis({ name: '次', nameTextStyle: { color: '#517593', fontSize: 10 } }), valAxis({ max: 100, position: 'right', splitLine: { show: false }, axisLabel: { show: false } })],
    series: [
      {
        name: '故障次数',
        type: 'bar',
        barWidth: '46%',
        data: fs.map((f) => f.value),
        itemStyle: { borderRadius: [3, 3, 0, 0], color: hGradient('#ff7a2f', 0.9, 0.25) }
      },
      {
        name: '累计占比',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: cum,
        lineStyle: { color: '#ffd166', width: 1.6 },
        itemStyle: { color: '#ffd166' }
      }
    ]
  }
})

/* 健康度雷达 */
const radarOption = computed(() => {
  const base = d.value.kpi.oee
  const mk = (bias) => [
    Math.min(100, base + 6 + bias),
    Math.min(100, base - 4 + bias),
    Math.min(100, base + 12 + bias),
    Math.min(100, base - 8 + bias),
    Math.min(100, base + 2 + bias),
    Math.min(100, 78 + bias)
  ]
  return {
    tooltip: { ...tooltipBase, trigger: 'item' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    radar: {
      center: ['50%', '46%'],
      radius: '62%',
      splitNumber: 4,
      axisName: { color: textSub, fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(51,214,255,.18)' } },
      splitLine: { lineStyle: { color: 'rgba(51,214,255,.18)' } },
      splitArea: { areaStyle: { color: ['rgba(20,70,120,.18)', 'rgba(10,36,64,.1)'] } },
      indicator: [
        { name: '可用率', max: 100 },
        { name: '性能率', max: 100 },
        { name: '质量率', max: 100 },
        { name: '可靠性', max: 100 },
        { name: '维护性', max: 100 },
        { name: '能效', max: 100 }
      ]
    },
    series: [
      {
        type: 'radar',
        symbolSize: 4,
        data: [
          {
            name: '本期',
            value: mk(0),
            areaStyle: { color: hexA('#33d6ff', 0.28) },
            lineStyle: { color: '#33d6ff', width: 2 },
            itemStyle: { color: '#33d6ff' }
          },
          {
            name: '上期',
            value: mk(-7),
            areaStyle: { color: hexA('#a86bff', 0.14) },
            lineStyle: { color: hexA('#a86bff', 0.85), width: 1.4, type: 'dashed' },
            itemStyle: { color: '#a86bff' }
          }
        ]
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
  grid-template-rows: 0.88fr 1.12fr;
  gap: 14px;
}

.g-oee {
  grid-column: 1;
  grid-row: 1;
}
.g-type {
  grid-column: 2;
  grid-row: 1;
}
.g-maint {
  grid-column: 3;
  grid-row: 1;
}
.g-fault {
  grid-column: 1;
  grid-row: 2;
}
.g-device {
  grid-column: 2;
  grid-row: 2;
}
.g-radar {
  grid-column: 3;
  grid-row: 2;
}

.legend-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--text-dim);
}
.legend-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
}

/* ===== 保养 ===== */
.maint {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  overflow-y: auto;
}

.maint__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: linear-gradient(90deg, rgba(20, 54, 92, 0.5), rgba(8, 24, 44, 0.2));
  border: 1px solid rgba(46, 108, 170, 0.2);
  border-radius: 2px;
  flex-shrink: 0;
}

.maint__left {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 52px;
  flex-shrink: 0;
  border-right: 1px solid rgba(46, 108, 170, 0.25);
  padding-right: 8px;
}
.maint__day {
  font-size: 12px;
  color: #cfe9ff;
  letter-spacing: 0.5px;
}
.maint__count {
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 1px;
}

.maint__mid {
  flex: 1;
  min-width: 0;
}
.maint__device {
  font-size: 12.5px;
  color: #dceeff;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.maint__type {
  font-size: 10.5px;
  color: var(--text-dim);
  margin-top: 2px;
}

.maint__tag {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 2px;
  color: #8fb4d9;
  background: rgba(143, 180, 217, 0.12);
}
.lv-high .maint__tag {
  color: #ff6b7a;
  background: rgba(255, 77, 94, 0.14);
}
.lv-high .maint__day {
  color: #ff8a96;
}
.lv-mid .maint__tag {
  color: #ffb020;
  background: rgba(255, 176, 32, 0.14);
}

/* ===== 表格 ===== */
.table {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}

.table__head,
.table__row {
  display: grid;
  grid-template-columns: 78px 1.5fr 82px 1.15fr 64px 60px 64px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
}

.table__head {
  height: 26px;
  color: var(--text-dim);
  font-size: 11px;
  background: rgba(24, 60, 100, 0.42);
  border-radius: 2px;
  flex-shrink: 0;
}

.table__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.table__row {
  height: 27px;
  border-bottom: 1px dashed rgba(46, 108, 170, 0.16);
  transition: background 0.2s;
}
.table__row:hover {
  background: rgba(51, 214, 255, 0.07);
}
.table__row.is-bad {
  background: rgba(255, 77, 94, 0.07);
}

.c-id {
  color: var(--c-cyan);
  font-size: 11px;
}
.c-name {
  color: #cfe6ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.c-bar {
  display: flex;
  align-items: center;
  gap: 5px;
}
.c-bar .bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.c-bar .bar b {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #1d6fd0, #33d6ff);
  transition: width 0.5s;
}
.c-bar em {
  font-style: normal;
  font-size: 10.5px;
  color: var(--text-sub);
  width: 30px;
  text-align: right;
}
</style>
