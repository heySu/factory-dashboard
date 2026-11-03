<template>
  <div class="page">
    <!-- KPI 行 -->
    <div class="kpis">
      <KpiCard label="今日产量" :value="k.outputToday" unit="件" tone="cyan" :trend="3.2" :hint="`计划 ${thousands(k.outputPlan)} 件`" />
      <KpiCard label="计划达成率" :value="k.outputRate" :decimals="1" unit="%" tone="blue" :trend="-1.4" hint="较昨日同期" />
      <KpiCard label="综合设备效率 OEE" :value="k.oee" :decimals="1" unit="%" tone="teal" :trend="0.8" hint="目标 85%" />
      <KpiCard label="设备在线率" :value="k.onlineRate" :decimals="1" unit="%" tone="purple" :trend="1.2" :hint="`${k.deviceRun} / ${k.deviceTotal} 台运行`" />
      <KpiCard label="一次通过率 FPY" :value="k.fpy" :decimals="2" unit="%" tone="teal" :trend="0.3" hint="目标 98.0%" />
      <KpiCard label="单位能耗" :value="k.energyPerUnit" :decimals="3" unit="kWh/件" tone="amber" :trend="-2.6" hint="较昨日下降" />
    </div>

    <!-- 主体栅格 -->
    <div class="grid">
      <PanelBox title="产量趋势" sub="近 24 小时" class="g-trend">
        <template #extra>
          <span class="tag-live"><i></i>实时</span>
        </template>
        <ChartBox :option="trendOption" />
      </PanelBox>

      <PanelBox title="产线实时监控" sub="6 条产线" class="g-lines">
        <template #extra>
          <span class="mini-kpi">在制 <b class="num">{{ thousands(k.wip) }}</b> 件</span>
          <span class="mini-kpi">在岗 <b class="num">{{ k.staff }}</b> 人</span>
        </template>
        <LineBoard :lines="d.lines" />
      </PanelBox>

      <PanelBox title="设备状态分布" sub="共 198 台" class="g-dev">
        <div class="donut-wrap">
          <ChartBox :option="deviceOption" />
          <div class="donut-center">
            <div class="donut-center__v num">{{ k.deviceRun }}</div>
            <div class="donut-center__l">运行设备</div>
            <div class="donut-center__p num">{{ k.onlineRate }}%</div>
          </div>
        </div>
      </PanelBox>

      <PanelBox title="一次通过率趋势" sub="目标 98.0%" class="g-q">
        <ChartBox :option="fpyOption" />
      </PanelBox>

      <PanelBox title="车间平面与设备分布" sub="实时点位" class="g-map">
        <template #extra>
          <span class="mini-kpi">故障 <b class="num" style="color: #ff4d5e">{{ k.deviceAlarm }}</b> 台</span>
        </template>
        <WorkshopMap :zones="d.workshop" :seed="2" />
      </PanelBox>

      <PanelBox title="实时告警" sub="点击可确认" class="g-alarm">
        <template #extra>
          <span class="tag-alarm" v-if="openCount > 0"><i></i>{{ openCount }} 条待处理</span>
        </template>
        <AlarmFeed :alarms="d.alarms" :limit="7" @ack="onAck" />
      </PanelBox>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PanelBox from '@/components/PanelBox.vue'
import KpiCard from '@/components/KpiCard.vue'
import ChartBox from '@/components/ChartBox.vue'
import LineBoard from '@/components/LineBoard.vue'
import WorkshopMap from '@/components/WorkshopMap.vue'
import AlarmFeed from '@/components/AlarmFeed.vue'
import { useDashboard, updateAlarmStatus } from '@/services/api'
import { thousands } from '@/utils/format'
import { catAxis, valAxis, tooltipBase, gridBase, vGradient, hGradient, hexA, textSub } from '@/charts/theme'

const state = useDashboard()
const d = computed(() => state.data)
const k = computed(() => state.data?.kpi || {})

const openCount = computed(() => d.value?.alarms?.filter((a) => a.status === 'open').length || 0)

function onAck(id) {
  updateAlarmStatus(id, 'ack')
}

/* ---------- 产量趋势 ---------- */
const trendOption = computed(() => {
  const t = d.value.trendHour
  return {
    grid: { ...gridBase, top: 40, bottom: 2, left: 4, right: 10 },
    tooltip: { ...tooltipBase },
    legend: {
      top: 2,
      right: 4,
      itemWidth: 12,
      itemHeight: 6,
      itemGap: 14,
      textStyle: { color: textSub, fontSize: 11 },
      data: ['实际产量', '计划产量', '上周同期']
    },
    xAxis: catAxis(t.labels, { axisLabel: { color: textSub, fontSize: 10, interval: 3 } }),
    yAxis: valAxis({ name: '件', nameTextStyle: { color: '#517593', fontSize: 10, padding: [0, 0, 4, -18] } }),
    series: [
      {
        name: '实际产量',
        type: 'bar',
        barWidth: '46%',
        data: t.actual,
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: hGradient('#33d6ff', 0.95, 0.2)
        },
        emphasis: { itemStyle: { color: '#7ee8ff' } }
      },
      {
        name: '计划产量',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: t.plan,
        lineStyle: { color: '#ffb020', width: 1.4, type: 'dashed' }
      },
      {
        name: '上周同期',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: t.lastWeek,
        lineStyle: { color: hexA('#a86bff', 0.75), width: 1.4 }
      }
    ]
  }
})

/* ---------- 设备状态环形 ---------- */
const deviceOption = computed(() => {
  const list = d.value.equipment.byStatus
  const colorMap = { run: '#00e5b8', idle: '#8fb4d9', alarm: '#ff4d5e', maint: '#ffb020' }
  return {
    tooltip: {
      ...tooltipBase,
      trigger: 'item',
      formatter: '{b}<br/>{c} 台 · {d}%'
    },
    legend: {
      orient: 'vertical',
      right: 6,
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { color: textSub, fontSize: 12 },
      formatter: (name) => {
        const item = list.find((i) => i.name === name)
        return `${name}  ${item ? item.value : 0}`
      }
    },
    series: [
      {
        type: 'pie',
        center: ['30%', '52%'],
        radius: ['54%', '76%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderColor: '#061223',
          borderWidth: 2
        },
        label: { show: false },
        labelLine: { show: false },
        data: list.map((i) => ({
          name: i.name,
          value: i.value,
          itemStyle: { color: colorMap[i.status] }
        }))
      },
      // 外圈装饰刻度
      {
        type: 'pie',
        center: ['30%', '52%'],
        radius: ['82%', '83%'],
        silent: true,
        label: { show: false },
        data: [{ value: 1, itemStyle: { color: 'rgba(51,214,255,.28)' } }]
      }
    ]
  }
})

/* ---------- FPY 趋势 ---------- */
const fpyOption = computed(() => {
  const q = d.value.quality.fpyTrend
  return {
    grid: { ...gridBase, top: 34, bottom: 2, left: 4, right: 12 },
    tooltip: { ...tooltipBase, valueFormatter: (v) => `${v}%` },
    legend: {
      top: 2,
      right: 4,
      itemWidth: 12,
      itemHeight: 6,
      textStyle: { color: textSub, fontSize: 11 },
      data: ['一次通过率', '目标线']
    },
    xAxis: catAxis(q.labels, { boundaryGap: false, axisLabel: { color: textSub, fontSize: 10, interval: 1 } }),
    yAxis: valAxis({
      min: 96,
      max: 100,
      splitNumber: 4,
      axisLabel: { color: '#517593', fontSize: 10, formatter: '{value}%' }
    }),
    series: [
      {
        name: '一次通过率',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: q.fpy,
        lineStyle: { color: '#00e5b8', width: 2, shadowColor: 'rgba(0,229,184,.6)', shadowBlur: 10 },
        itemStyle: { color: '#00e5b8', borderColor: '#04101f', borderWidth: 1 },
        areaStyle: { color: vGradient('#00e5b8', 0.34, 0.01) }
      },
      {
        name: '目标线',
        type: 'line',
        symbol: 'none',
        data: q.target,
        lineStyle: { color: '#ffb020', width: 1.2, type: 'dashed', opacity: 0.8 }
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
  grid-template-rows: 0.85fr 1.15fr;
  gap: 14px;
}

.g-trend {
  grid-column: 1;
  grid-row: 1;
}
.g-lines {
  grid-column: 2;
  grid-row: 1;
}
.g-dev {
  grid-column: 3;
  grid-row: 1;
}
.g-q {
  grid-column: 1;
  grid-row: 2;
}
.g-map {
  grid-column: 2;
  grid-row: 2;
}
.g-alarm {
  grid-column: 3;
  grid-row: 2;
}

.donut-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.donut-center {
  position: absolute;
  left: 30%;
  top: 52%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}
.donut-center__v {
  font-size: 28px;
  font-weight: 700;
  color: #eaf9ff;
  line-height: 1;
  text-shadow: 0 0 16px rgba(0, 229, 184, 0.6);
}
.donut-center__l {
  font-size: 10.5px;
  color: var(--text-dim);
  margin-top: 3px;
  letter-spacing: 1px;
}
.donut-center__p {
  font-size: 11px;
  color: var(--c-teal);
  margin-top: 2px;
}

.tag-live,
.tag-alarm {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--c-teal);
}
.tag-live i,
.tag-alarm i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  animation: blink 1.6s infinite;
}
.tag-alarm {
  color: #ff6b7a;
}

.mini-kpi {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.3px;
}
.mini-kpi b {
  color: #cfe9ff;
  font-weight: 600;
  font-size: 13px;
  margin: 0 2px;
}
</style>
