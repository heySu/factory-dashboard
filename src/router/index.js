import { createRouter, createWebHashHistory } from 'vue-router'

// 使用 hash 模式：大屏通常直接丢到内网 Nginx 静态目录，无需额外 rewrite 配置
const routes = [
  { path: '/', redirect: '/overview' },
  {
    path: '/overview',
    name: 'overview',
    component: () => import('@/views/Overview.vue'),
    meta: { title: '生产运营总览', code: 'OVERVIEW' }
  },
  {
    path: '/production',
    name: 'production',
    component: () => import('@/views/Production.vue'),
    meta: { title: '生产计划与达成', code: 'PRODUCTION' }
  },
  {
    path: '/equipment',
    name: 'equipment',
    component: () => import('@/views/Equipment.vue'),
    meta: { title: '设备运行监控', code: 'EQUIPMENT' }
  },
  {
    path: '/quality',
    name: 'quality',
    component: () => import('@/views/Quality.vue'),
    meta: { title: '质量与工艺分析', code: 'QUALITY' }
  },
  {
    path: '/energy',
    name: 'energy',
    component: () => import('@/views/Energy.vue'),
    meta: { title: '能源与能耗管理', code: 'ENERGY' }
  },
  {
    path: '/alarm',
    name: 'alarm',
    component: () => import('@/views/Alarm.vue'),
    meta: { title: '安防与告警中心', code: 'ALARM' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/overview' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})

export { routes }
