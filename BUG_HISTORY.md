# BUG_HISTORY

记录所有已发现和修复的 bug，避免重复踩坑。

---

## [已修复] bills.list 时间戳少8小时

**发现日期**: 2026-04-26
**状态**: 已修复

### 症状
库存流水页面显示的时间比实际时间少8小时。例如实际创建时间是 `2026-04-26 08:01:53`，但页面显示 `2026-04-26 00:01:53`。

### 根因
MySQL `TIMESTAMP` 字段内部以 UTC 存储。查询返回时 MySQL 按 session timezone (+08:00) 转换为字符串 `"2026-04-26 00:01:53"`（这是正确的北京时间）。但 mysql2 驱动把这个字符串当作 UTC Date 对象解析，JSON 序列化后变成 `"2026-04-26T00:01:53.000Z"`，比实际少8小时。

### 修复方案
在所有 SELECT 中对 TIMESTAMP 字段使用 `CONVERT_TZ(created_at, 'UTC', '+08:00')` 转换为北京时间字符串，或使用 `DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s')` 直接格式化。

涉及文件:
- `cloudfunctions/shop-api/index.js` — 所有 SELECT created_at 字段

---

## [已修复] ER_MALFORMED_PACKET 导致订单创建失败

**发现日期**: 2026-04-26
**状态**: 已修复

### 症状
创建订单时报错 `ER_MALFORMED_PACKET` 或 `ECONNRESET`，后续所有操作均失败。

### 根因
`verifyPool()` 在连接失败时调用 `pool.end()` 但没有重建连接池，导致池处于损坏状态，死连接残留。

### 修复方案
用 `getConnection()` 替代 `verifyPool()`，连接失败时自动重建整个连接池。

---

## [已修复] Cannot read properties of undefined reading 'stock_quantity'

**发现日期**: 2026-04-26
**状态**: 已修复

### 症状
创建/更新订单时，如果商品不存在，崩溃报错。

### 根因
`SELECT stock_quantity` 返回空数组时直接解构访问下标。

### 修复方案
增加 `if (rows.length === 0)` 检查再访问。

---

## [已修复] 空白页首次访问

**发现日期**: 2026-04-26
**状态**: 待修复

### 症状
首次进入页面时出现空白页，刷新后可正常显示。

### 根因
待调查。可能是认证/路由/数据加载竞态条件导致。

### 修复方案
待实现。

---
