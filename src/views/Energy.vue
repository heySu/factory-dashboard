<template>
  <div class="page">
    <div class="kpis">
      <KpiCard label="今日用电量" :value="d.energy.electricity" unit="kWh" tone="amber" :trend="-2.4" hint="较昨日同期" />
      <KpiCard label="今日用水量" :value="d.energy.water" unit="t" tone="cyan" :trend="1.1" hint="含工艺与生活用水" />
      <KpiCard label="天然气用量" :value="d.energy.gas" unit="m³" tone="purple" :trend="-0.8" hint="烘干工序为主" />
      <KpiCard label="单位产品能耗" :value="d.energy.perUnit" :decimals="3" unit="kWh/件" tone="teal" :trend="-3.2" hint="行业均值 0.48" />
      <KpiCard label="今日能耗成本" :value="d.energy.cost" :decimals="2" unit="万元" tone="red" hint="含峰谷电价" />
    </div>

    <div class="grid">
      <PanelBox title="分时电耗趋势" sub="今日 / 昨日对比" class="g-trend">
        <ChartBox :option="trendOption" />
      </PanelBox>

      <PanelBox title="各车间能耗对比" sub="kWh · 今日" class="g-area">
        <ChartBox :option="areaOption" />
      </PanelBox>

      <PanelBox title="能耗结构" sub="按用途" class="g-type">
        <ChartBox :option="typeOption" />
      </PanelBox>

      <PanelBox title="峰谷平电量分布" sub="分时电价策略" class="g-peak">
        <div class="peak">
          <div v-for="p in peaks" :key="p.name" class="peak__item" :class="`pk-${p.key}`">
            <div class="peak__ring" :style="{ '--p': p.pct }">
              <span class="num">{{ p.pct }}%</span>
            </div>
            <div class="peak__info">
              <div class="peak__name">{{ p.name }}</div>
              <div class="peak__val num">{{ thousands(p.value) }} kWh</div>
              <div class="peak__price">电价 {{ p.price }} 元/kWh</div>
            </div>
          </div>
        </div>
      </PanelBox>

      <PanelBox title="能耗与产量关联" sub="双轴对比" class="g-rel">
        <ChartBox :option="relationOption" />
      </PanelBox>

      <PanelBox title="节能优化建议" sub="AI 诊断 · 5 条" class="g-tip">
        <div class="tips">
          <div v-for="(t, i) in tips" :key="i" class="tip">
            <span class="tip__no num">{{ String(i + 1).padStart(2, '0') }}</span>
            <div class="tip__body">
              <div class="tip__title">{{ t.title }}</div>
              <div class="tip__desc">{{ t.desc }}</div>
            </div>
            <span class="tip__save num">-{{ t.save }}%</span>
          </div>
        </div>
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

const peaks = computed(() => {
  const total = d.value.energy.electricity || 1
  const list = [
    { key: 'sharp', name: '尖峰时段', pct: 18, price: '1.35' },
    { key: 'peak', name: '高峰时段', pct: 32, price: '1.08' },
    { key: 'flat', name: '平段', pct: 34, price: '0.72' },
    { key: 'valley', name: '低谷时段', pct: 16, price: '0.38' }
  ]
  return list.map((p) => ({ ...p, value: Math.round((total * p.pct) / 100) }))
})

const tips = [
  { title: '空压机群控优化', desc: '当前 3 台空压机并行空载，建议切换至 2 台联控，压力设定下调 0.1MPa', save: 6.2 },
  { title: '注塑机加热圈保温', desc: '12 台注塑机加热段无保温层，散热损失约 8%，建议加装保温套', save: 4.5 },
  { title: '错峰生产调度', desc: '将高耗能烘干工序由高峰段移至 22:00 后低谷段，电价差 0.7 元/kWh', save: 11.8 },
  { title: '照明分区智控', desc: '仓储区夜间照明常亮，建议加装人体感应，预计年省 3.2 万 kWh', save: 2.1 },
  { title: '余热回收利用', desc: '空压机余热可满足车间 40% 生活热水需求，投资回收期约 14 个月', save: 3.6 }
]

/* 分时趋势 */
const trendOption = computed(() => {
  const t = d.value.energy.trend
  return {
    grid: { ...gridBase, top: 40, left: 4, right: 8 },
    tooltip: { ...tooltipBase, valueFormatter: (v) => `${v} kWh` },
    legend: { top: 2, right: 4, itemWidth: 12, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(t.labels, { boundaryGap: false, axisLabel: { color: textSub, fontSize: 10, interval: 3 } }),
    yAxis: valAxis({ name: 'kWh', nameTextStyle: { color: '#517593', fontSize: 10 } }),
    series: [
      {
        name: '今日',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: t.values,
        lineStyle: { color: '#ffb020', width: 2.2, shadowColor: 'rgba(255,176,32,.55)', shadowBlur: 12 },
        areaStyle: { color: vGradient('#ffb020', 0.32, 0.01) }
      },
      {
        name: '昨日',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: t.last,
        lineStyle: { color: hexA('#8fb4d9', 0.75), width: 1.4, type: 'dashed' }
      }
    ]
  }
})

/* 车间能耗 */
const areaOption = computed(() => {
  const as = [...d.value.energy.byArea].sort((a, b) => b.value - a.value)
  return {
    grid: { ...gridBase, top: 14, left: 4, right: 52 },
    tooltip: { ...tooltipBase, trigger: 'item', formatter: (p) => `${p.name}<br/>${p.value} kWh` },
    xAxis: valAxis({ splitLine: { show: false }, axisLabel: { show: false } }),
    yAxis: {
      type: 'category',
      data: as.map((a) => a.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: textSub, fontSize: 12, margin: 12 }
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,.05)', borderRadius: 7 },
        data: as.map((a, i) => ({
          value: a.value,
          itemStyle: {
            borderRadius: 7,
            color: hGradient(i === 0 ? '#ff7a2f' : i < 3 ? '#ffb020' : '#33d6ff', 0.92, 0.2)
          }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: '{c}',
          color: '#cfe9ff',
          fontSize: 11,
          fontFamily: 'Bahnschrift'
        }
      }
    ]
  }
})

/* 结构 */
const typeOption = computed(() => {
  const ts = d.value.energy.byType
  return {
    tooltip: { ...tooltipBase, trigger: 'item', formatter: '{b}<br/>{c}%' },
    legend: {
      bottom: 2,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { color: textSub, fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        center: ['50%', '44%'],
        radius: ['42%', '66%'],
        itemStyle: { borderColor: '#061223', borderWidth: 2 },
        label: {
          show: true,
          formatter: '{d}%',
          color: '#cfe9ff',
          fontSize: 11,
          fontFamily: 'Bahnschrift'
        },
        labelLine: { length: 8, length2: 10, lineStyle: { color: 'rgba(51,214,255,.4)' } },
        data: ts.map((t, i) => ({
          name: t.name,
          value: t.value,
          itemStyle: { color: hexA(['#ffb020', '#33d6ff', '#a86bff', '#00e5b8'][i] || palette[i], 0.88) }
        }))
      }
    ]
  }
})

/* 能耗与产量 */
const relationOption = computed(() => {
  const t = d.value.trendHour
  const energy = d.value.energy.trend
  return {
    grid: { ...gridBase, top: 40, left: 4, right: 4 },
    tooltip: { ...tooltipBase },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(t.labels, { axisLabel: { color: textSub, fontSize: 10, interval: 4 } }),
    yAxis: [
      valAxis({ name: '件', nameTextStyle: { color: '#517593', fontSize: 10 } }),
      valAxis({ name: 'kWh', position: 'right', splitLine: { show: false }, nameTextStyle: { color: '#517593', fontSize: 10 } })
    ],
    series: [
      {
        name: '小时产量',
        type: 'bar',
        barWidth: '44%',
        data: t.actual,
        itemStyle: { borderRadius: [2, 2, 0, 0], color: hGradient('#2b7fff', 0.9, 0.2) }
      },
      {
        name: '小时电耗',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'none',
        data: energy.values,
        lineStyle: { color: '#ffb020', width: 2 }
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

.g-trend {
  grid-column: 1;
  grid-row: 1;
}
.g-area {
  grid-column: 2;
  grid-row: 1;
}
.g-type {
  grid-column: 3;
  grid-row: 1;
}
.g-peak {
  grid-column: 1;
  grid-row: 2;
}
.g-rel {
  grid-column: 2;
  grid-row: 2;
}
.g-tip {
  grid-column: 3;
  grid-row: 2;
}

/* ===== 峰谷平 ===== */
.peak {
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  gap: 8px;
  height: 100%;
}

.peak__item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  background: linear-gradient(90deg, rgba(20, 54, 92, 0.5), rgba(8, 24, 44, 0.18));
  border: 1px solid rgba(46, 108, 170, 0.2);
  border-left: 2px solid var(--c);
  border-radius: 2px;
}

.pk-sharp {
  --c: #ff4d5e;
}
.pk-peak {
  --c: #ffb020;
}
.pk-flat {
  --c: #33d6ff;
}
.pk-valley {
  --c: #00e5b8;
}

.peak__ring {
  --p: 0;
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: conic-gradient(var(--c) calc(var(--p) * 1%), rgba(255, 255, 255, 0.07) 0);
  box-shadow: 0 0 14px -4px var(--c);
}
.peak__ring::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: #08192e;
}
.peak__ring span {
  position: relative;
  font-size: 12px;
  color: #eaf9ff;
  font-weight: 600;
}

.peak__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.peak__name {
  font-size: 12.5px;
  color: #dceeff;
  font-weight: 600;
}
.peak__val {
  font-size: 13px;
  color: var(--c);
}
.peak__price {
  font-size: 10px;
  color: var(--text-dim);
}

/* ===== 建议 ===== */
.tips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  overflow-y: auto;
}

.tip {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 7px 10px;
  background: linear-gradient(90deg, rgba(20, 54, 92, 0.5), rgba(8, 24, 44, 0.18));
  border: 1px solid rgba(46, 108, 170, 0.2);
  border-radius: 2px;
  flex-shrink: 0;
}

.tip__no {
  font-size: 12px;
  color: var(--c-cyan);
  opacity: 0.7;
  line-height: 16px;
}

.tip__body {
  flex: 1;
  min-width: 0;
}
.tip__title {
  font-size: 12.5px;
  color: #dceeff;
  font-weight: 600;
}
.tip__desc {
  font-size: 10.5px;
  color: var(--text-dim);
  margin-top: 2px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tip__save {
  flex-shrink: 0;
  font-size: 12px;
  color: #22d18c;
  font-weight: 600;
}
</style>
