---
name: shop-manage-patterns
description: Coding patterns extracted from shop-manage (Vite + React + CloudBase shop management system)
version: 1.0.0
source: local-git-analysis
analyzed_commits: 23
---

# Shop Manage Patterns

## Stack

- **Frontend**: Vite + React 19 + TypeScript + React Router v6
- **Styling**: Tailwind CSS + daisyUI
- **Backend**: CloudBase Cloud Function (`cloudfunctions/shop-api/index.js`)
- **Database**: MySQL (CynosDB)
- **Auth**: CloudBase Auth (email/password)
- **Testing**: Playwright (E2E only, no unit tests)
- **Deployment**: CloudBase static hosting + cloud functions

## Commit Conventions

Uses **conventional commits**:
- `fix:` - Bug fixes (~70% of commits)
- `feat:` - New features (~20%)
- `docs:` - Documentation updates
- `refactor:` - Structural changes
- `style:` - Code formatting

Commit message pattern: `type: resolve/description` — always starts with action verb like "resolve", "add", "handle", "ensure"

## Code Architecture

```
src/
├── api/
│   └── shop.ts              # CloudBase JS SDK API client
├── components/
│   └── ErrorBoundary.tsx     # React error boundary
├── context/
│   └── AuthContext.tsx       # Auth state management (React Context)
├── pages/
│   ├── DashboardPage.tsx     # Home page with KPIs, recent orders, low stock alerts
│   ├── ProductsPage.tsx      # Product CRUD with search, pagination
│   ├── OrdersPage.tsx        # Order management with item editing
│   ├── BillsPage.tsx         # Inventory transaction log with pagination
│   ├── LoginPage.tsx         # Email/password login
│   └── SettingsPage.tsx      # User management
└── utils/
    ├── cloudbase.ts          # CloudBase initialization
    └── date.ts               # Date formatting utilities

cloudfunctions/
└── shop-api/
    └── index.js              # Single cloud function handling all API actions
```

### API Pattern

All API calls go through a single CloudBase cloud function using action-based routing:

```js
// Frontend calls:
app.callFunction({ name: 'shop-api', data: { action: 'orders.list', data: { page, limit } } });

// Cloud function handles:
switch (action) {
  case 'orders.list': result = await getOrders(data.page, data.limit, data.paymentStatus);
  // ... more actions
}
```

Available actions: `dashboard`, `users.*`, `products.*`, `orders.*`, `bills.list`, `products.restock`

## Workflows

### Bug Fix Workflow
1. Fix the bug in relevant files
2. Update `BUG_HISTORY.md` with bug details
3. Deploy cloud function if backend changed
4. Run E2E tests to verify
5. Commit with `fix: resolve <description>` format

### Adding New Feature
1. Modify `cloudfunctions/shop-api/index.js` for new API action
2. Modify corresponding `src/pages/` file for UI
3. Update CLAUDE.md if new testing requirements discovered
4. Test with E2E before deployment

### Deployment
1. Build: `npm run build`
2. Deploy static hosting via `cloudbase uploadFiles`
3. Deploy cloud function via `cloudbase manageFunctions`
4. Run E2E tests against production

## Testing Patterns

- E2E tests in `e2e/` directory
- Test file naming: `<feature>.spec.ts` (critical-flows, auth, responsive)
- Login helper pattern: `await page.goto('/login')` -> fill credentials -> navigate
- Tests run against production deployment
- No unit test framework configured
- CLAUDE.md requires E2E testing before deployment

## Database Conventions

- MySQL pool with retry on connection errors
- `DATE_FORMAT()` used in all SELECT queries for consistent datetime format
- `snake_case` for database columns, `camelCase` for frontend (cloud function handles conversion)
- Transactions used for multi-step operations (order creation, restock)
- `getConnection()` with retry logic for resilient connections

## Field Naming Convention

- **Database**: `snake_case` (e.g., `buyer_name`, `settlement_status`, `stock_quantity`)
- **API requests**: `camelCase` (e.g., `buyerName`, `settlementStatus`)
- **API responses**: `snake_case` from MySQL, converted to `camelCase` in frontend where needed
- Cloud function is the single source of truth for field mapping

## Known Patterns

- Dashboard queries: `LIMIT 5` for recent orders and low stock products
- Pagination: default `page=1, limit=20` for lists
- Low stock threshold: `stock_quantity < 10`
- Order number format: `'ORD' + Date.now()`
- TCB environment ID: `shop-manage-d6gsos8yoe6002412`
