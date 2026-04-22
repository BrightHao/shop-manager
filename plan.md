# Shop Management System - Implementation Plan

> Date: 2026-04-22
> Role: Software Architect & Planning Specialist

---

## 1. Recommended Tech Stack

### 1.1 Core Framework: Next.js 15 (App Router)

Full-stack framework with API routes, server components, and React Server Actions. Single codebase for frontend + backend.

### 1.2 Language: TypeScript

Strict mode. Type-safe throughout.

### 1.3 Database: PostgreSQL 16+

**Why PostgreSQL:**

- Recommended for this use case with excellent Supabase integration
- **Row-level locking** (`SELECT ... FOR UPDATE`) for safe concurrent stock deduction
- **ACID transactions** for atomic order operations
- **Complex joins** with excellent query optimizer for bill reports
- **CHECK constraints** to enforce `stock >= 0` at DB level
- **Drizzle ORM** has first-class PostgreSQL support

Drizzle ORM generates raw SQL and provides full TypeScript safety — you'll interact with the database through typed functions, not raw SQL. This means you don't need to know PostgreSQL specifics to use it effectively.

### 1.4 ORM: Drizzle ORM

**Why Drizzle:**

- Compiles to raw SQL, no runtime overhead
- Better TypeScript inference — types derived from schema definitions
- Serverless-friendly (no connection pooling issues)
- Migrations via Drizzle Kit generate SQL files
- Full PostgreSQL support including `FOR UPDATE`, raw SQL, and JSONB
- Zero cold starts on serverless deployments

### 1.5 Auth: NextAuth.js (Auth.js v5)

- Built-in support for Next.js App Router
- Credentials provider for username/password login
- Session management with JWT or database strategy
- Role-based access control via custom session callbacks
- Middleware protection for API routes and pages

### 1.6 UI: shadcn/ui + Tailwind CSS v4

- shadcn/ui: Copy-paste component architecture, owned code
- Tailwind CSS v4: Utility-first, zero CSS bundle bloat
- lucide-react: Consistent icon library

### 1.7 Data Tables: TanStack Table v8

Headless table with sorting, filtering, pagination. Paired with shadcn/ui Table for polished UI.

### 1.8 Charts: Recharts

Lightweight React charts for bill summary visualizations.

### 1.9 Validation: Zod + React Hook Form

Define schemas once, derive types automatically. Zod resolver integrates directly with React Hook Form.

### 1.10 Export: SheetJS (xlsx)

Client-side Excel/CSV generation with Chinese character support.

### Full Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui | latest |
| Data Tables | TanStack Table | 8.x |
| Charts | Recharts | 2.x |
| Database | PostgreSQL | 16+ |
| ORM | Drizzle ORM | 0.38+ |
| Migrations | Drizzle Kit | latest |
| Auth | NextAuth.js (Auth.js) | 5.x |
| Validation | Zod | 3.x |
| Forms | React Hook Form | 7.x |
| Date handling | date-fns | 4.x |
| CSV/Excel | SheetJS (xlsx) | 0.18+ |
| Package manager | pnpm | 9.x |
| Deployment | Vercel + Supabase | — |

---

## 2. Database Schema Design

### 2.1 Entity Relationship Overview

```
users (1) <--> (N) orders
products (1) <--> (N) order_items (N) <--> (1) orders
products (1) <--> (N) inventory_transactions
```

### 2.2 Table Definitions

#### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL (PK) | PRIMARY KEY | Auto-increment ID |
| name | VARCHAR(255) | NOT NULL | Display name |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email / login username |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hash |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'operator' | 'admin' \| 'operator' |
| phone | VARCHAR(50) | NULL | Contact phone |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' | 'active' \| 'disabled' |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_users_email` on (email)
- `idx_users_role` on (role)

#### products

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT (PK) | AUTO_INCREMENT | Auto-increment ID |
| name | VARCHAR(255) | NOT NULL | Product name |
| sku | VARCHAR(100) | UNIQUE, NULL | Stock keeping unit (optional) |
| unit | VARCHAR(50) | NOT NULL | Unit of measure (kg, piece, box) |
| unit_price | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Reference unit price |
| stock_quantity | DECIMAL(14,4) | NOT NULL, DEFAULT 0, CHECK (>= 0) | Current stock (decimal for fractional) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' | 'active' \| 'archived' |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |
| created_by | INT | NULL, FK -> users(id) | Creator |

**Indexes:**
- `idx_products_status` on (status)
- `idx_products_sku` on (sku)
- `idx_products_name` on (name)

#### orders

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT (PK) | AUTO_INCREMENT | Auto-increment ID |
| order_no | VARCHAR(50) | UNIQUE, NOT NULL | Human-readable (e.g., ORD-20260422-0001) |
| buyer_name | VARCHAR(255) | NULL | Optional buyer name |
| buyer_phone | VARCHAR(50) | NULL | Optional buyer phone |
| total_amount | DECIMAL(14,2) | NOT NULL, DEFAULT 0 | Sum of all line item totals |
| settlement_status | VARCHAR(20) | NOT NULL, DEFAULT 'unsettled' | 'unsettled' \| 'partially_settled' \| 'settled' |
| settled_amount | DECIMAL(14,2) | NOT NULL, DEFAULT 0 | Amount already paid |
| notes | TEXT | NULL | Order notes/memo |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |
| created_by | INT | NULL, FK -> users(id) | Creator |

**Indexes:**
- `idx_orders_created_at` on (created_at)
- `idx_orders_settlement_status` on (settlement_status)
- `idx_orders_order_no` on (order_no)
- `idx_orders_buyer_name` on (buyer_name)

#### order_items

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT (PK) | AUTO_INCREMENT | Auto-increment ID |
| order_id | INT | NOT NULL, FK -> orders(id) ON DELETE CASCADE | Parent order |
| product_id | INT | NOT NULL, FK -> products(id) | Product reference |
| quantity | DECIMAL(14,4) | NOT NULL, CHECK (> 0) | Quantity (supports decimals) |
| unit_price | DECIMAL(12,2) | NOT NULL, CHECK (>= 0) | Unit price at time of sale |
| total_price | DECIMAL(14,2) | NOT NULL, CHECK (>= 0) | Total for this line item |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_order_items_order_id` on (order_id)
- `idx_order_items_product_id` on (product_id)

#### inventory_transactions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT (PK) | AUTO_INCREMENT | Auto-increment ID |
| product_id | INT | NOT NULL, FK -> products(id) | Product affected |
| transaction_type | VARCHAR(30) | NOT NULL | 'sale' \| 'sale_reversal' \| 'manual_adjustment' \| 'restock' |
| quantity_change | DECIMAL(14,4) | NOT NULL | Positive = increase, negative = decrease |
| quantity_before | DECIMAL(14,4) | NOT NULL | Stock before this transaction |
| quantity_after | DECIMAL(14,4) | NOT NULL | Stock after this transaction |
| reference_type | VARCHAR(30) | NOT NULL | 'order' \| 'manual' |
| reference_id | INT | NULL | Order ID for order-related, NULL for manual |
| notes | TEXT | NULL | Transaction notes |
| created_by | INT | NULL, FK -> users(id) | Operator who made this change |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Transaction timestamp |

**Indexes:**
- `idx_inv_trans_product_date` on (product_id, created_at)
- `idx_inv_trans_reference` on (reference_type, reference_id)
- `idx_inv_trans_type_date` on (transaction_type, created_at)

#### sessions (NextAuth.js)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) (PK) | PRIMARY KEY (UUID) | Session ID |
| session_token | VARCHAR(255) | UNIQUE, NOT NULL | Session token |
| user_id | INT | NOT NULL, FK -> users(id) ON DELETE CASCADE | User reference |
| expires | TIMESTAMP | NOT NULL | Session expiry |

**Indexes:**
- `idx_sessions_token` on (session_token)

### 2.3 Key Design Decisions

1. **Decimal precision**: `DECIMAL(14,4)` for stock (supports 0.0001 fractional units), `DECIMAL(12,2)` for unit prices, `DECIMAL(14,2)` for totals.
2. **Integer foreign keys**: All FKs reference INT primary keys for simplicity.
3. **Inventory transaction log**: Every stock movement is recorded for audit trail and bill reporting.
4. **CHECK constraints**: PostgreSQL enforces `stock_quantity >= 0` at DB level.
5. **PostgreSQL `NOW()`**: Used instead of MySQL's `CURRENT_TIMESTAMP` for default timestamps.

---

## 3. API Endpoints

### 3.1 Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/[...nextauth]` | NextAuth.js handler (login, logout, session) |
| POST | `/api/auth/register` | Register new user (admin only) |
| GET | `/api/users` | List users (admin only) |
| PATCH | `/api/users/:id` | Update user role/status (admin only) |

### 3.2 Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List with pagination, search, filter |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product (authenticated) |
| PATCH | `/api/products/:id` | Update product (authenticated) |
| DELETE | `/api/products/:id` | Archive product (authenticated) |

### 3.3 Orders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List with pagination, date range, settlement filter |
| GET | `/api/orders/:id` | Get order with items |
| POST | `/api/orders` | Create order (atomic: order + items + stock deduction) |
| PATCH | `/api/orders/:id` | Update order (delta stock adjustment) |
| DELETE | `/api/orders/:id` | Cancel order (restore stock) |

### 3.4 Bills

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bills/summary` | Daily/weekly/monthly/yearly summary |
| GET | `/api/bills/export` | Export as CSV/Excel |

### 3.5 Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/overview` | Today's KPIs |

### 3.6 Response Envelope

```typescript
// Success
{ success: true, data: ..., meta?: { page, totalPages, total } }

// Error
{ success: false, error: { code, message, details? } }
```

Error codes: `INSUFFICIENT_STOCK` | `NOT_FOUND` | `UNAUTHORIZED` | `FORBIDDEN` | `VALIDATION_ERROR` | `INTERNAL_ERROR`

---

## 4. Frontend Page Structure

### 4.1 Route Map

```
/                               -> Redirect to /login or /dashboard
/login                          -> Login page
/dashboard                      -> Overview with KPIs, charts, alerts
/products                       -> Product list (search, filter, pagination)
/products/new                   -> Create product form
/products/[id]/edit             -> Edit product form
/orders                         -> Order list (date range, settlement filter)
/orders/new                     -> Create order (multi-item, real-time calc)
/orders/[id]                    -> Order detail view
/orders/[id]/edit               -> Edit order form
/bills                          -> Bill summary (period selector, charts, export)
/settings                       -> User management, shop settings (admin only)
```

### 4.2 Middleware Protection

All routes except `/login` and `/api/auth/*` require authentication.
`/settings` and user management routes require `admin` role.

---

## 5. Key Technical Challenges

### 5.1 Stock Deduction Race Conditions

**Solution**: Pessimistic row locking via Drizzle's raw SQL in a transaction:

```typescript
// Lock product rows within a Drizzle transaction
await db.transaction(async (tx) => {
  const products = await db.execute(sql`
    SELECT * FROM products WHERE id = ANY($1) FOR UPDATE
  `, [productIds]);
  // validate, create order, deduct stock, record transactions
});
```

Then validate stock, create order, deduct stock atomically within the same transaction.

Defense in depth:
1. Application-level stock check (fast fail for UI)
2. Row-level locking (serializes concurrent writes)
3. Atomic decrement (`SET stock = stock - qty`)
4. Database CHECK constraint (`stock_quantity >= 0`)
5. Inventory transaction log (audit trail)

### 5.2 Stock Adjustment on Order Edit

**Solution**: Delta-based calculation within a transaction:
1. Load existing order items
2. Build old vs new quantity map per product
3. Calculate delta (new - old) for each product
4. Lock affected product rows
5. Apply stock adjustments (positive delta = deduct more, negative = restore)
6. Update order items (delete removed, insert new, update changed)
7. Record inventory transactions

### 5.3 Decimal Precision

- Database: `DECIMAL` types (not `FLOAT`)
- Drizzle: maps PostgreSQL DECIMAL to `Numeric` type, converted to `number` in application
- Display: `Intl.NumberFormat` for formatted output
- Calculation: `Math.round(value * 100) / 100` for 2-decimal precision
- Zod validation enforces decimal precision on input

### 5.4 Bill Summary Performance

- Proper indexes on `created_at`, `settlement_status`, `product_id`
- Top-N queries with `LIMIT`, never full lists
- Expected scale for small shop: < 10K orders/year, sub-second queries
- Materialized monthly summaries via scheduled job if needed at scale

### 5.5 Chinese CSV Export

- CSV: UTF-8 with BOM for Excel compatibility
- Excel (.xlsx): native UTF-8 support (preferred for Chinese)
- SheetJS handles both formats client-side

### 5.6 Auth & Role-Based Access

- NextAuth.js with Credentials provider
- Password hashing with bcrypt
- Session stores user role (`admin` / `operator`)
- Next.js middleware protects routes based on authentication and role
- Admin-only routes: user management, system settings

---

## 6. Implementation Phases

### Phase 1: Project Setup & Auth (Day 1-2)

1. Initialize Next.js 15 + TypeScript + Tailwind CSS v4
2. Install dependencies: `drizzle-orm`, `drizzle-kit`, `next-auth`, `zod`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-table`, `recharts`, `xlsx`, `date-fns`, `lucide-react`, `bcryptjs`
3. Set up shadcn/ui + initialize core components
4. Configure Supabase PostgreSQL connection, Drizzle schema
5. Run initial migration (users, sessions tables)
6. Set up NextAuth.js with Credentials provider
7. Create login page, auth middleware, session utilities
8. Create admin seed script (create initial admin user)
9. Set up project structure

**Deliverable:** Login working, authenticated session, dashboard shell with sidebar

### Phase 2: Product CRUD (Day 3-4)

1. Drizzle schema: products table + migration
2. Zod validation schemas for products
3. Product API: GET/POST/PATCH/DELETE with auth guard
4. Product list page with TanStack Table
5. Product form (create + edit) with React Hook Form
6. Color-coded stock indicators

**Deliverable:** Full product CRUD working

### Phase 3: Order Create & List (Day 5-7)

1. Drizzle schema: orders, order_items, inventory_transactions + migration
2. Order creation API with stock deduction transaction
3. Order creation form: dynamic rows, real-time calculations, product autocomplete
4. Order list API + page with filters
5. Order detail view
6. Order number generation (PostgreSQL sequence + formatted string)

**Deliverable:** Create orders, stock deducts, list and detail work

### Phase 4: Order Edit, Cancel, Settlement (Day 8-9)

1. Order edit API with delta-based stock adjustment
2. Order edit form (reuse create form with pre-population)
3. Order cancellation with stock restoration
4. Settlement management (full/partial payment)

**Deliverable:** Full order lifecycle

### Phase 5: User Management & Admin (Day 10)

1. User list page (admin only)
2. Create user / change role / disable user
3. Password change functionality
4. Settings page (shop info, default units)

**Deliverable:** Admin can manage users

### Phase 6: Bill Summary & Export (Day 11-13)

1. Bill summary API with period handling
2. Bill summary page with period selector
3. Top N orders, top N products, inventory changes, settlement summary
4. Sales trend chart (Recharts)
5. CSV export (UTF-8 BOM)
6. Excel export (multi-sheet via SheetJS)

**Deliverable:** Complete bill reporting with export

### Phase 7: Dashboard & Polish (Day 14-15)

1. Dashboard overview: KPIs, charts, alerts, recent orders
2. Error boundaries, loading states, toast notifications
3. Responsive design testing
4. E2E tests (critical paths)
5. Performance review

**Deliverable:** Production-ready application

### Phase 8: Deploy to Vercel + Supabase (Day 16)

1. Create Supabase project and configure production database
2. Run production migrations on Supabase
3. Deploy to Vercel with environment variables
4. Connect custom domain
5. Set up production admin user
6. Verify all functionality in production

**Deliverable:** Running on Vercel + Supabase, zero maintenance

---

## 7. Implementation Checklist

| Phase | Description | Days | Dependencies |
|-------|-------------|------|--------------|
| 1 | Project Setup & Auth | 2 | None |
| 2 | Product CRUD | 2 | Phase 1 |
| 3 | Order Create & List | 3 | Phase 2 |
| 4 | Order Edit, Cancel, Settlement | 2 | Phase 3 |
| 5 | User Management & Admin | 1 | Phase 1 |
| 6 | Bill Summary & Export | 3 | Phase 4 |
| 7 | Dashboard & Polish | 2 | Phase 6 |
| 8 | Deploy to Vercel + Supabase | 1 | Phase 7 |
| **Total** | | **~16 days** | |

---

## 8. Project Structure

```
app/
  (auth)/
    login/page.tsx              # Login page
  (dashboard)/
    layout.tsx                  # Dashboard layout with sidebar + auth check
    page.tsx                    # Redirect to /dashboard
    dashboard/page.tsx          # Overview KPIs
    products/page.tsx           # Product list
    products/new/page.tsx       # Create product
    products/[id]/edit/page.tsx # Edit product
    orders/page.tsx             # Order list
    orders/new/page.tsx         # Create order
    orders/[id]/page.tsx        # Order detail
    orders/[id]/edit/page.tsx   # Edit order
    bills/page.tsx              # Bill summary
    settings/page.tsx           # Admin settings
    settings/users/page.tsx     # User management
  api/
    auth/[...nextauth]/route.ts # NextAuth handler
    auth/register/route.ts      # Register user (admin only)
    products/route.ts
    products/[id]/route.ts
    orders/route.ts
    orders/[id]/route.ts
    bills/summary/route.ts
    bills/export/route.ts
    dashboard/overview/route.ts
    users/route.ts
    users/[id]/route.ts
  layout.tsx                    # Root layout
  globals.css

components/
  ui/                           # shadcn/ui components
  auth/                         # LoginForm, etc.
  layout/                       # Sidebar, Header
  products/                     # ProductList, ProductForm
  orders/                       # OrderList, OrderForm, OrderDetail
  bills/                        # BillSummary, PeriodSelector
  dashboard/                    # KPICards, SalesChart

lib/
  auth.ts                       # NextAuth config
  db/
    schema.ts                   # Drizzle schema definitions
    index.ts                    # Drizzle client singleton
    queries.ts                  # Database query helpers
  middleware.ts                 # Route protection
  validation/                   # Zod schemas
  utils/                        # Helpers

drizzle/
  meta/                         # Migration metadata
  migrations/                   # Generated SQL migrations
  config.ts                     # Drizzle Kit config
  seed.ts                       # Admin seed script
```
