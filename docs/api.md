# 接口文档

> 联调前先启动后端：`npm run server`（默认 `http://127.0.0.1:8080`）。
> 浏览器打开 `http://127.0.0.1:8080/api` 可查看全部端点索引。

## 通用约定

### 响应体

所有 REST 接口返回统一结构：

```json
{
  "code": 0,          // 0 成功；非 0 为业务错误码
  "message": "ok",    // 错误时为面向调用方的说明
  "data": { },        // 业务数据
  "ts": 1793706406502 // 服务器时间戳（毫秒）
}
```

### 分页

支持分页的接口统一返回：

```json
{ "list": [], "total": 128, "page": 1, "pageSize": 20 }
```

分页参数：`page`（≥1）、`pageSize`（≤500）。业务异常时 HTTP 状态码同步为 4xx/5xx，例如非法的状态流转返回 `409 Conflict`。

---

## 大屏聚合

### GET /api/dashboard/snapshot

大屏首屏聚合数据（约 20KB），结构与前端本地降级数据完全一致。一次请求拿到：KPI、24h 产量趋势、产线实时、设备状态与关键设备、质量（FPY/帕累托/SPC）、能耗、车间平面、最近 40 条告警。

### GET /api/dashboard/health

健康检查。返回运行时长、采集次数（ticks）、告警产生数、在线大屏连接数（wsClients）。运维探活与联调排障首选。

---

## 生产域 /api/production

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/overview` | 生产页首屏聚合（KPI + 趋势 + 产线 + 工单 + 班组 + 产品 + 节拍） |
| GET | `/trend?hours=24` | 产量趋势，`hours` 1~72，按小时分桶（真实查 `metric_points` 表聚合） |
| GET | `/lines` | 6 条产线实时状态（内存实时态，无 IO） |
| GET | `/orders` | 工单列表（查库，含进度百分比） |
| GET | `/teams` | 班组产出与人均效率 |
| GET | `/products` | 产品产量结构 |
| GET | `/takt` | 近 30 分钟生产节拍 |

---

## 设备域 /api/equipment

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/overview` | 设备页首屏聚合 |
| GET | `/devices?page=1&pageSize=20&status=alarm&keyword=CNC` | 198 台设备分页筛选 |
| GET | `/devices/:id` | 单台设备详情 |
| GET | `/key-devices` | 12 台关键设备实时态 |
| GET | `/status` | 状态分布（运行/待机/故障/维护） |
| GET | `/types` | 按类型统计 + 各类型故障数 |
| GET | `/oee-trend?days=7` | OEE 日趋势，`days` 1~30（按天 SQL 聚合） |
| GET | `/maintenance` | 保养计划（按运行小时动态推算剩余天数） |
| GET | `/fault-top` | 故障原因 TOP（告警表 30 天聚合） |

---

## 质量域 /api/quality

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/overview` | 质量页首屏聚合 |
| GET | `/fpy-trend?hours=12` | 一次通过率趋势 |
| GET | `/defect-pareto` | 缺陷类型帕累托 |
| GET | `/by-line` | 各产线质量对比 |
| GET | `/spc` | SPC 控制图（UCL/CL/LCL + CPK），同一 10 分钟窗口内数据稳定可复现 |
| GET | `/cost` | 质量成本构成 |
| GET | `/defect-trend?days=7` | 不良趋势 |

---

## 能源域 /api/energy

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/overview` | 能源页首屏聚合 |
| GET | `/trend?hours=24` | 分时电耗趋势（真实查 `energy_points` 表） |
| GET | `/by-area` | 车间能耗排名（今日 SQL 聚合） |
| GET | `/by-type` | 能耗用途结构 |
| GET | `/peak-valley` | 峰谷平电量分布（按分时电价时段真实切分） |
| GET | `/relation` | 能耗与产量双轴对比 |
| GET | `/tips` | 节能优化建议 |

---

## 告警域 /api/alarms（含写操作）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/` | 分页多条件查询 |
| GET | `/stats` | 统计：今日总数、各状态/等级数量、平均响应与闭环时长 |
| GET | `/trend?days=7` | 近 N 日告警趋势（按等级堆叠） |
| GET | `/response-time` | 处置时效（按等级分组 SQL 聚合） |
| GET | `/:id` | 告警详情 |
| PATCH | `/:id` | 状态流转 |

### 分页查询参数

```
GET /api/alarms?status=open&level=critical&keyword=CNC&page=1&pageSize=20&from=1730000000000&to=1790000000000
```

- `status`：`open` | `ack` | `closed` | `all`（不传 = 全部）
- `level`：`critical` | `major` | `minor`
- `keyword`：模糊匹配 类型 / 位置 / 描述
- `from` / `to`：创建时间范围（毫秒时间戳）

### 状态流转

```
PATCH /api/alarms/AL1730000000123
Content-Type: application/json

{ "status": "ack", "operator": "张建国" }
```

状态机：

```
open ──→ ack ──→ closed
  │                ↑
  └───────→────────┘
```

- 合法流转：`open→ack`、`open→closed`、`ack→closed`、`ack→open`（撤销）
- **`closed` 为终态，任何变更返回 409**
- 确认与闭环会记录 `ackAt` / `ackBy` / `closedAt`，供处置时效统计

成功后服务端会向所有 WebSocket 客户端广播 `alarm:update` 帧，实现多屏同步。

---

## WebSocket

```
ws://<host>:8080/ws/dashboard
```

### 服务端 → 客户端

| type | 时机 | data |
| --- | --- | --- |
| `hello` | 连接建立后立即 | `{ serverTime, pushInterval, serverVersion }` |
| `tick` | 每 2s | `{ ts, kpi, lines, devices(12台关键设备), energy, updatedAt }` |
| `alarm` | 新告警产生时 | 完整告警对象 |
| `alarm:update` | 任一大屏操作告警状态后 | `{ id, status, ackAt, closedAt, ackBy }` |
| `pong` | 收到 ping 后 | `{ ts }` |

### 客户端 → 服务端

| type | 说明 |
| --- | --- |
| `ping` | 心跳，30s 一次；60s 无响应服务端断开 |
| `subscribe` | `{ type:'subscribe', topics:['tick','alarm'] }` 按需订阅减少流量 |

### 断线重连

客户端负责重连（前端已内置指数退避 1s→30s），重连成功后先拉一次 `snapshot` 补齐断线期间的数据空洞，再恢复增量推送。

---

## 数据库表

SQLite 文件：`server/data/factory.db`（WAL 模式），首次启动自动建表并回填 7 天历史时序。

| 表 | 用途 |
| --- | --- |
| `lines` | 产线档案（id/名称/类型/标准产能） |
| `devices` | 设备台账 198 台（含 is_key 关键设备标记） |
| `work_orders` | 生产工单 |
| `alarms` | 告警记录（唯一写入热点表，含状态流转字段） |
| `metric_points` | 时序指标：output / oee / fpy / wip，10s 实时抽样 + 7 天回填 |
| `energy_points` | 能耗明细：按 30 分钟 × 车间 × 能源类型 |

接入真实 MES/PLC 时：把 `server/realtime/collector.js` 的 `tickState()` 换成 OPC-UA/MQTT 订阅回调，业务层与前端零改动。
