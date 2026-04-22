# Shop Manager — 店铺管理系统

> 现代化的一体化店铺管理解决方案，覆盖商品、订单、结算、账单全链路业务流程。

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-cyan)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![E2E Tests](https://img.shields.io/badge/E2E_Playwright-14%20passing-green)

---

## 功能概览

### 商品管理
- 商品信息的增删改查（名称、SKU、单位、单价、库存）
- 实时库存监控与低库存预警
- 入库、出库、手动调整全链路记录

### 订单管理
- **创建订单** — 多商品选择、实时价格计算、库存自动扣减
- **编辑订单** — 增量式库存调整（精确计算增减差异）
- **取消订单** — 自动恢复库存、记录操作流水
- **结算管理** — 支持全额/分次结算，自动计算未结算余额
- 多维筛选（日期范围、结算状态、购买人搜索）

### 账单汇总
- 灵活周期统计：今日 / 本周 / 本月 / 本年 / 自定义
- KPI 指标：总营收、订单数、平均客单价
- 结算状态分布与每日销售趋势图
- 热销商品 TOP 10、大额订单 TOP 10
- 库存变动汇总表
- 一键导出 CSV / Excel（兼容中文）

### 数据仪表盘
- 今日订单数 / 收入 / 本月累计
- 库存预警卡片（库存 <= 10 的商品自动提醒）
- 最近 5 笔订单快速预览

### 权限管理
- 多角色：管理员（admin）/ 操作员（operator）
- 基于 JWT 的会话认证
- 管理员专属用户管理面板（创建、角色变更、状态控制）
- 所有用户均可修改密码

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **框架** | Next.js (App Router) | 15.x |
| **语言** | TypeScript | 5.x |
| **样式** | Tailwind CSS | 4.x |
| **组件** | shadcn/ui | 最新 |
| **数据表格** | TanStack Table | 8.x |
| **数据库** | PostgreSQL | 16+ |
| **ORM** | Drizzle ORM | 0.45+ |
| **认证** | NextAuth.js (Auth.js) | 5.x |
| **验证** | Zod + React Hook Form | 3.x / 7.x |
| **导出** | SheetJS (xlsx) | 0.18+ |
| **E2E 测试** | Playwright | 1.x |
| **部署** | Vercel + Supabase | — |

---

## 安全设计

库存安全是系统的核心关注点，采用五层防护机制：

1. **应用层校验** — 创建/编辑订单前快速检查库存
2. **悲观行锁** — `SELECT ... FOR UPDATE` 串行化并发写入
3. **原子扣减** — `SET stock = stock - qty` 避免并发竞争
4. **数据库约束** — `CHECK (stock_quantity >= 0)` 底层兜底
5. **操作审计** — 每次库存变动都记录流水（before/after）

---

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 16+
- pnpm 9+

### 安装

```bash
# 克隆仓库
git clone git@github.com:BrightHao/shop-manager.git
cd shop-manager

# 安装依赖
pnpm install

# 复制环境配置
cp .env.example .env.local

# 编辑 .env.local，配置数据库连接
```

### 数据库初始化

```bash
# 创建数据库
createdb shop_manage  # 或使用 Supabase

# 执行迁移
pnpm db:generate
pnpm db:migrate

# 种子数据（可选）
pnpm db:seed
```

### 启动

```bash
pnpm dev
```

访问 http://localhost:3000，默认管理员账号：
- 邮箱：`admin@shop.com`
- 密码：`admin123`

---

## 测试

```bash
# 运行 E2E 测试
pnpm exec playwright test

# 指定浏览器
pnpm exec playwright test --project=chromium
```

---

## 项目结构

```
app/
  (auth)/                   # 认证相关页面
  (dashboard)/              # 受保护的后台页面
    dashboard/              # 数据仪表盘
    products/               # 商品管理
    orders/                 # 订单管理
    bills/                  # 账单汇总
    settings/               # 系统设置
  api/                      # REST API 路由
  error.tsx                 # 全局错误边界
  global-error.tsx          # 根级错误边界
  not-found.tsx             # 404 页面
components/
  ui/                       # shadcn/ui 基础组件
  products/                 # 商品相关组件
  orders/                   # 订单相关组件
  bills/                    # 账单相关组件
  dashboard/                # 仪表盘相关组件
lib/
  auth.ts                   # 认证配置（JWT 会话）
  db/
    schema.ts               # Drizzle 数据库 Schema
    index.ts                # 数据库客户端
  validation/               # Zod 校验 Schema
drizzle/
  migrations/               # 数据库迁移文件
  seed.ts                   # 种子数据脚本
e2e/                        # Playwright E2E 测试
```

---

## 部署

### Vercel + Supabase

1. 创建 Supabase 项目，获取数据库连接串
2. 运行 `drizzle-kit push` 或 `migrate` 到生产数据库
3. 在 Vercel 中导入仓库，配置环境变量：
   - `DATABASE_URL` — Supabase 连接串
   - `JWT_SECRET` — 强随机密钥
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — 初始管理员
4. 部署完成

---

## License

MIT © BrightHao
