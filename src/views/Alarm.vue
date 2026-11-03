<template>
  <div class="page">
    <div class="kpis">
      <KpiCard label="今日告警总数" :value="counts.todayTotal" unit="条" tone="cyan" hint="含已闭环" />
      <KpiCard label="未处理" :value="counts.open" unit="条" tone="red" hint="需 15 分钟内响应" />
      <KpiCard label="紧急告警" :value="counts.critical" unit="条" tone="amber" hint="已通知值班主管" />
      <KpiCard label="平均响应时长" :value="6.4" :decimals="1" unit="min" tone="purple" :trend="-8.2" hint="SLA ≤ 10 分钟" />
      <KpiCard label="安全运行" :value="k.safetyDays" unit="天" tone="teal" hint="无重大安全事故" />
    </div>

    <div class="grid">
      <PanelBox title="近 7 日告警趋势" sub="按等级堆叠" class="g-trend">
        <ChartBox :option="trendOption" />
      </PanelBox>

      <PanelBox title="告警类型分布" sub="本月累计" class="g-type">
        <ChartBox :option="typeOption" />
      </PanelBox>

      <PanelBox title="处置时效" sub="分钟" class="g-sla">
        <ChartBox :option="slaOption" />
      </PanelBox>

      <PanelBox title="告警等级构成" sub="当前未闭环" class="g-level">
        <div class="level-wrap">
          <ChartBox :option="levelOption" />
          <div class="level-center">
            <div class="level-center__v num">{{ counts.open }}</div>
            <div class="level-center__l">待处理</div>
          </div>
        </div>
      </PanelBox>

      <PanelBox title="告警工单" sub="分页查询 · 状态可流转" class="g-list">
        <template #extra>
          <span class="mini">共 <b class="num">{{ total }}</b> 条</span>
        </template>

        <div class="alist">
          <!-- 筛选栏：状态 / 等级 / 关键词，全部走后端查询 -->
          <div class="filters">
            <div class="seg">
              <button
                v-for="t in STATUS_TABS"
                :key="t.value"
                class="seg__btn"
                :class="{ 'is-on': filters.status === t.value }"
                @click="setStatus(t.value)"
              >
                {{ t.label }}
              </button>
            </div>
            <select v-model="filters.level" class="sel" @change="reload">
              <option value="">全部等级</option>
              <option value="critical">紧急</option>
              <option value="major">重要</option>
              <option value="minor">一般</option>
            </select>
            <input
              v-model.trim="filters.keyword"
              class="inp"
              placeholder="搜索类型 / 位置 / 描述"
              @keyup.enter="reload"
            />
            <button class="btn-query" @click="reload">查询</button>
          </div>

          <div class="alist__head">
            <span>时间</span>
            <span>等级</span>
            <span>类型</span>
            <span>告警位置</span>
            <span>告警描述</span>
            <span>状态</span>
            <span>操作</span>
          </div>

          <div class="alist__body">
            <div v-if="loading" class="alist__tip">查询中…</div>
            <div v-else-if="!list.length" class="alist__tip">暂无符合条件的告警</div>
            <div v-for="a in list" :key="a.id" class="alist__row" :class="`lv-${a.level}`">
              <span class="num c-time">{{ fmtTime(a.time) }}</span>
              <span>
                <i class="lv-dot" :class="`d-${a.level}`"></i>
                {{ LEVEL[a.level] }}
              </span>
              <span class="c-type">{{ a.type }}</span>
              <span class="c-target">{{ a.target }}</span>
              <span class="c-msg" :title="a.msg">{{ a.msg }}</span>
              <span>
                <StatusBadge :status="a.status" />
              </span>
              <span class="c-act">
                <button v-if="a.status === 'open'" class="act act--primary" @click="onAction(a, 'ack')">确认</button>
                <button v-if="a.status !== 'closed'" class="act" @click="onAction(a, 'closed')">闭环</button>
                <span v-else class="act-done">已完成</span>
              </span>
            </div>
          </div>

          <!-- 分页条 -->
          <div class="pager">
            <span class="pager__info">第 {{ page }} / {{ totalPages }} 页</span>
            <select v-model.number="pageSize" class="sel sel--mini" @change="reload">
              <option :value="8">8 条/页</option>
              <option :value="12">12 条/页</option>
              <option :value="20">20 条/页</option>
            </select>
            <button class="pg" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
            <button class="pg" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
          </div>
        </div>
      </PanelBox>

      <PanelBox title="安全与值班" sub="今日" class="g-duty">
        <div class="duty">
          <div class="duty__hero">
            <div class="duty__num num">{{ k.safetyDays }}</div>
            <div class="duty__unit">天 安全生产运行</div>
          </div>
          <div class="duty__grid">
            <div class="duty__cell">
              <span class="duty__k">隐患整改率</span>
              <span class="duty__v num" style="color: #00e5b8">96.8%</span>
            </div>
            <div class="duty__cell">
              <span class="duty__k">安全培训</span>
              <span class="duty__v num" style="color: #33d6ff">268 人次</span>
            </div>
            <div class="duty__cell">
              <span class="duty__k">在用摄像头</span>
              <span class="duty__v num" style="color: #a86bff">42 / 44</span>
            </div>
            <div class="duty__cell">
              <span class="duty__k">门禁异常</span>
              <span class="duty__v num" style="color: #ffb020">2 次</span>
            </div>
          </div>
          <div class="duty__staff">
            <div class="duty__staff-hd">当前值班</div>
            <div v-for="s in staff" :key="s.name" class="staff">
              <span class="staff__avatar">{{ s.name.slice(-1) }}</span>
              <div class="staff__info">
                <div class="staff__name">{{ s.name }} <span>{{ s.role }}</span></div>
                <div class="staff__tel num">{{ s.tel }}</div>
              </div>
              <span class="staff__state" :class="{ on: s.online }">{{ s.online ? '在岗' : '待命' }}</span>
            </div>
          </div>
        </div>
      </PanelBox>
    </div>
  </div>
</template>

<script setup>
/**
 * 安防与告警中心
 * ---------------------------------------------------------------------------
 * 本页是唯一「前后端双向交互」的页面，包含三个真实联调点：
 *   1. 列表分页查询  GET  /api/alarms?status=&level=&keyword=&page=&pageSize=
 *   2. 状态流转      PATCH /api/alarms/:id  { status }
 *   3. 多屏同步      WebSocket alarm / alarm:update 帧
 *
 * 注意：顶部 KPI 与环形图用 store 里的实时数据（WS 推送），
 *       下方表格用独立的分页请求，两者互不干扰——
 *       否则翻到第 3 页时来了新告警，页面会被强行刷新回第一页。
 */

import { ref, reactive, computed, watch, onMounted } from 'vue'
import PanelBox from '@/components/PanelBox.vue'
import KpiCard from '@/components/KpiCard.vue'
import ChartBox from '@/components/ChartBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useDashboard, fetchAlarms, updateAlarmStatus } from '@/services/api'
import { fmtTime } from '@/utils/format'
import { catAxis, valAxis, tooltipBase, gridBase, hGradient, hexA, textSub } from '@/charts/theme'

const state = useDashboard()
const d = computed(() => state.data)
const k = computed(() => state.data?.kpi || {})
const alarms = computed(() => d.value.alarms)

const LEVEL = { critical: '紧急', major: '重要', minor: '一般' }

/* ============================ 分页列表 ============================ */

/** 列表数据完全由后端驱动，与 store 解耦 */
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(8)
const loading = ref(false)
const loadError = ref('')

/** 查询条件：任意一项变化都需要重置到第一页 */
const filters = reactive({
  status: 'open', // 默认只看未处理，符合值班场景
  level: '',
  keyword: ''
})

const STATUS_TABS = [
  { label: '待处理', value: 'open' },
  { label: '已确认', value: 'ack' },
  { label: '已闭环', value: 'closed' },
  { label: '全部', value: 'all' }
]

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

/** 拉取当前页 */
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await fetchAlarms({
      status: filters.status,
      level: filters.level,
      keyword: filters.keyword,
      page: page.value,
      pageSize: pageSize.value
    })
    list.value = res.list
    total.value = res.total
    // 删除最后一页最后一条后，页码可能越界，回退一页重查
    if (!res.list.length && page.value > 1) {
      page.value = Math.max(1, page.value - 1)
      await load()
    }
  } catch (err) {
    loadError.value = err.message
    console.error('[alarm] 列表加载失败：', err.message)
  } finally {
    loading.value = false
  }
}

/** 条件变化：回到第一页再查 */
function reload() {
  page.value = 1
  load()
}

function setStatus(v) {
  if (filters.status === v) return
  filters.status = v
  reload()
}

function go(p) {
  const target = Math.min(totalPages.value, Math.max(1, p))
  if (target === page.value) return
  page.value = target
  load()
}

/**
 * 状态流转：先请求后端，成功后刷新列表
 * 后端有状态机校验（closed 不可再变更），失败时把错误提示出来
 */
async function onAction(alarm, status) {
  try {
    await updateAlarmStatus(alarm.id, status)
    await load()
  } catch (err) {
    loadError.value = err.message
  }
}

onMounted(load)

/**
 * 实时联动：WS 推来新告警时，若正停留在「第一页且未筛选等级/关键词」，
 * 延迟 1.2 秒静默刷新，让值班员不点刷新也能看到新告警。
 * 延迟是为了避免多条告警连续到达时反复请求。
 */
let refreshTimer = null
watch(
  () => alarms.value.length,
  (len, oldLen) => {
    if (len <= oldLen) return
    if (page.value !== 1) return
    if (filters.level || filters.keyword) return
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => load(), 1200)
  }
)

/* ============================ 统计与图表 ============================ */

/** 顶部 KPI 取服务端聚合值（首选），无则退化为本地数组统计 */
const counts = computed(() => {
  const s = d.value.alarmStats
  if (s) {
    return {
      todayTotal: s.todayTotal,
      open: s.open,
      critical: s.critical,
      major: s.major,
      minor: s.minor
    }
  }
  const open = alarms.value.filter((a) => a.status === 'open')
  return {
    todayTotal: alarms.value.length,
    open: open.length,
    critical: open.filter((a) => a.level === 'critical').length,
    major: open.filter((a) => a.level === 'major').length,
    minor: open.filter((a) => a.level === 'minor').length
  }
})

const staff = [
  { name: '张建国', role: '值班主管', tel: '138****6621', online: true },
  { name: '李文博', role: '设备工程师', tel: '139****3348', online: true },
  { name: '王海燕', role: '质量巡检', tel: '137****9902', online: false }
]

/* 趋势 */
const trendOption = computed(() => {
  const t = d.value.alarmTrend
  return {
    grid: { ...gridBase, top: 40, left: 4, right: 8 },
    tooltip: { ...tooltipBase },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, itemGap: 10, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(t.labels),
    yAxis: valAxis({ name: '条', nameTextStyle: { color: '#517593', fontSize: 10 } }),
    series: [
      { name: '紧急', type: 'bar', stack: 'a', barWidth: '46%', data: t.critical, itemStyle: { color: hexA('#ff4d5e', 0.88) } },
      { name: '重要', type: 'bar', stack: 'a', data: t.major, itemStyle: { color: hexA('#ffb020', 0.88) } },
      { name: '一般', type: 'bar', stack: 'a', data: t.minor, itemStyle: { color: hexA('#33d6ff', 0.82), borderRadius: [3, 3, 0, 0] } }
    ]
  }
})

/* 类型分布 */
const typeOption = computed(() => {
  const ts = [...d.value.alarmByType].sort((a, b) => a.value - b.value)
  return {
    grid: { left: 8, right: 46, top: 12, bottom: 6, containLabel: true },
    tooltip: { ...tooltipBase, trigger: 'item' },
    xAxis: valAxis({ splitLine: { show: false }, axisLabel: { show: false } }),
    yAxis: {
      type: 'category',
      data: ts.map((t) => t.name),
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
        data: ts.map((t, i) => ({
          value: t.value,
          itemStyle: { borderRadius: 7, color: hGradient(i >= ts.length - 2 ? '#ff7a2f' : '#2b7fff', 0.92, 0.2) }
        })),
        label: { show: true, position: 'right', color: '#cfe9ff', fontSize: 11, fontFamily: 'Bahnschrift' }
      }
    ]
  }
})

/* 时效 */
const slaOption = computed(() => {
  const r = d.value.responseTime
  return {
    grid: { ...gridBase, top: 40, left: 4, right: 8 },
    tooltip: { ...tooltipBase, valueFormatter: (v) => `${v} 分钟` },
    legend: { top: 2, right: 4, itemWidth: 10, itemHeight: 6, textStyle: { color: textSub, fontSize: 11 } },
    xAxis: catAxis(r.labels, { axisLabel: { color: textSub, fontSize: 12 } }),
    yAxis: valAxis({ name: '分钟', nameTextStyle: { color: '#517593', fontSize: 10 } }),
    series: [
      {
        name: '响应时长',
        type: 'bar',
        barWidth: '26%',
        data: r.respond,
        itemStyle: { borderRadius: [3, 3, 0, 0], color: hGradient('#33d6ff', 0.95, 0.25) },
        label: { show: true, position: 'top', color: '#9dc2e2', fontSize: 10.5, fontFamily: 'Bahnschrift' }
      },
      {
        name: '闭环时长',
        type: 'bar',
        barWidth: '26%',
        data: r.resolve,
        itemStyle: { borderRadius: [3, 3, 0, 0], color: hGradient('#a86bff', 0.85, 0.2) },
        label: { show: true, position: 'top', color: '#9dc2e2', fontSize: 10.5, fontFamily: 'Bahnschrift' }
      }
    ]
  }
})

/* 等级构成 */
const levelOption = computed(() => {
  const data = [
    { name: '紧急', value: counts.value.critical, color: '#ff4d5e' },
    { name: '重要', value: counts.value.major, color: '#ffb020' },
    { name: '一般', value: counts.value.minor, color: '#33d6ff' }
  ].filter((i) => i.value > 0)

  return {
    tooltip: { ...tooltipBase, trigger: 'item', formatter: '{b}<br/>{c} 条' },
    legend: {
      bottom: 4,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: textSub, fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        center: ['50%', '44%'],
        radius: ['54%', '74%'],
        itemStyle: { borderColor: '#061223', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: data.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } }))
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
  grid-template-rows: 0.78fr 1.22fr;
  gap: 14px;
}

.g-trend {
  grid-column: 1;
  grid-row: 1;
}
.g-type {
  grid-column: 2;
  grid-row: 1;
}
.g-sla {
  grid-column: 3;
  grid-row: 1;
}
.g-level {
  grid-column: 1;
  grid-row: 2;
}
.g-list {
  grid-column: 2;
  grid-row: 2;
}
.g-duty {
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

/* 等级环中心 */
.level-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.level-center {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}
.level-center__v {
  font-size: 26px;
  font-weight: 700;
  color: #ff6b7a;
  line-height: 1;
  text-shadow: 0 0 16px rgba(255, 77, 94, 0.55);
}
.level-center__l {
  font-size: 10.5px;
  color: var(--text-dim);
  margin-top: 3px;
  letter-spacing: 1px;
}

/* ===== 筛选栏 ===== */
.filters {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.seg {
  display: flex;
  height: 26px;
  border: 1px solid rgba(46, 108, 170, 0.34);
  border-radius: 2px;
  overflow: hidden;
}

.seg__btn {
  padding: 0 11px;
  font-size: 11.5px;
  color: var(--text-sub);
  border-right: 1px solid rgba(46, 108, 170, 0.24);
  transition: all 0.18s;
}
.seg__btn:last-child {
  border-right: none;
}
.seg__btn:hover {
  color: #cfe9ff;
  background: rgba(51, 214, 255, 0.08);
}
.seg__btn.is-on {
  color: #fff;
  background: linear-gradient(180deg, rgba(45, 130, 220, 0.7), rgba(20, 64, 116, 0.6));
  box-shadow: inset 0 -2px 0 var(--c-cyan);
}

/* 深色表单控件：color-scheme 让原生下拉列表也变深色 */
.sel,
.inp {
  height: 26px;
  font-size: 11.5px;
  color: #cfe6ff;
  background: rgba(12, 36, 64, 0.7);
  border: 1px solid rgba(46, 108, 170, 0.34);
  border-radius: 2px;
  outline: none;
  color-scheme: dark;
}
.sel {
  padding: 0 4px;
}
.inp {
  flex: 1;
  min-width: 90px;
  padding: 0 8px;
}
.inp::placeholder {
  color: rgba(110, 150, 190, 0.6);
}
.sel:focus,
.inp:focus {
  border-color: rgba(51, 214, 255, 0.6);
}
.sel--mini {
  height: 22px;
}

.btn-query {
  height: 26px;
  padding: 0 12px;
  font-size: 11.5px;
  color: var(--c-cyan);
  border: 1px solid rgba(51, 214, 255, 0.45);
  border-radius: 2px;
  background: rgba(51, 214, 255, 0.1);
  transition: all 0.18s;
}
.btn-query:hover {
  background: rgba(51, 214, 255, 0.2);
  color: #fff;
}

/* ===== 分页 ===== */
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 28px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-dim);
}
.pager__info {
  margin-right: auto;
  font-family: var(--font-num);
  letter-spacing: 0.5px;
}

.pg {
  height: 22px;
  padding: 0 10px;
  font-size: 11px;
  color: var(--text-sub);
  border: 1px solid rgba(46, 108, 170, 0.34);
  border-radius: 2px;
  transition: all 0.18s;
}
.pg:hover:not(:disabled) {
  color: #fff;
  border-color: var(--c-cyan);
  background: rgba(51, 214, 255, 0.12);
}
.pg:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.alist__tip {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
}

/* ===== 告警表格 ===== */
.alist {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}

.alist__head,
.alist__row {
  display: grid;
  grid-template-columns: 74px 62px 84px 1fr 2.1fr 76px 104px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
}

.alist__head {
  height: 26px;
  color: var(--text-dim);
  font-size: 11px;
  background: rgba(24, 60, 100, 0.42);
  border-radius: 2px;
  flex-shrink: 0;
}

.alist__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.alist__row {
  height: 30px;
  border-bottom: 1px dashed rgba(46, 108, 170, 0.15);
  transition: background 0.2s;
}
.alist__row:hover {
  background: rgba(51, 214, 255, 0.07);
}
.alist__row.lv-critical {
  background: rgba(255, 77, 94, 0.05);
}

.c-time {
  color: var(--text-sub);
  font-size: 11px;
}
.c-type {
  color: #cfe6ff;
}
.c-target {
  color: var(--c-cyan);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.c-msg {
  color: #9dc2e2;
  font-size: 11.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lv-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
.d-critical {
  background: #ff4d5e;
  box-shadow: 0 0 7px #ff4d5e;
  animation: blink 1.2s infinite;
}
.d-major {
  background: #ffb020;
  box-shadow: 0 0 7px rgba(255, 176, 32, 0.8);
}
.d-minor {
  background: #33d6ff;
  box-shadow: 0 0 7px rgba(51, 214, 255, 0.8);
}

.c-act {
  display: flex;
  gap: 6px;
  align-items: center;
}

.act {
  height: 20px;
  padding: 0 9px;
  font-size: 11px;
  color: var(--text-sub);
  border: 1px solid rgba(46, 108, 170, 0.4);
  border-radius: 2px;
  transition: all 0.18s;
}
.act:hover {
  color: #fff;
  border-color: var(--c-cyan);
  background: rgba(51, 214, 255, 0.14);
}
.act--primary {
  color: var(--c-cyan);
  border-color: rgba(51, 214, 255, 0.45);
}
.act-done {
  font-size: 10.5px;
  color: var(--text-dim);
}

/* 值班 */
.duty {
  display: flex;
  flex-direction: column;
  gap: 9px;
  height: 100%;
}

.duty__hero {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  padding: 4px 0 8px;
  border-bottom: 1px dashed rgba(46, 108, 170, 0.25);
}
.duty__num {
  font-size: 42px;
  font-weight: 700;
  line-height: 1;
  color: #00e5b8;
  text-shadow: 0 0 24px rgba(0, 229, 184, 0.5);
}
.duty__unit {
  font-size: 12px;
  color: var(--text-sub);
  letter-spacing: 1px;
}

.duty__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.duty__cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  background: rgba(20, 54, 92, 0.42);
  border: 1px solid rgba(46, 108, 170, 0.2);
  border-radius: 2px;
}
.duty__k {
  font-size: 10.5px;
  color: var(--text-dim);
}
.duty__v {
  font-size: 15px;
  font-weight: 600;
}

.duty__staff {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.duty__staff-hd {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 1px;
  margin-bottom: 1px;
}

.staff {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
  background: linear-gradient(90deg, rgba(20, 54, 92, 0.45), rgba(8, 24, 44, 0.15));
  border: 1px solid rgba(46, 108, 170, 0.18);
  border-radius: 2px;
}

.staff__avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: #bfe6ff;
  background: rgba(51, 214, 255, 0.16);
  border: 1px solid rgba(51, 214, 255, 0.35);
  flex-shrink: 0;
}

.staff__info {
  flex: 1;
  min-width: 0;
}
.staff__name {
  font-size: 12.5px;
  color: #dceeff;
}
.staff__name span {
  font-size: 10.5px;
  color: var(--text-dim);
  margin-left: 6px;
}
.staff__tel {
  font-size: 10.5px;
  color: var(--text-sub);
  margin-top: 1px;
}

.staff__state {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 2px;
  color: var(--text-dim);
  background: rgba(143, 180, 217, 0.1);
}
.staff__state.on {
  color: #22d18c;
  background: rgba(34, 209, 140, 0.12);
}
</style>
