import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  uniqueIndex,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';

// ============================================================
// Users
// ============================================================

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('operator'),
    phone: varchar('phone', { length: 50 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_users_email').on(table.email)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ============================================================
// Products
// ============================================================

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 100 }),
    unit: varchar('unit', { length: 50 }).notNull(),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
    stockQuantity: decimal('stock_quantity', { precision: 14, scale: 4 }).notNull().default('0'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('idx_products_status').on(table.status), index('idx_products_name').on(table.name)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// ============================================================
// Orders
// ============================================================

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNo: varchar('order_no', { length: 50 }).notNull(),
    buyerName: varchar('buyer_name', { length: 255 }),
    buyerPhone: varchar('buyer_phone', { length: 50 }),
    totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    settlementStatus: varchar('settlement_status', { length: 20 }).notNull().default('unsettled'),
    settledAmount: decimal('settled_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_orders_created_at').on(table.createdAt),
    index('idx_orders_settlement_status').on(table.settlementStatus),
    index('idx_orders_order_no').on(table.orderNo),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

// ============================================================
// Order Items
// ============================================================

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: decimal('quantity', { precision: 14, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

// ============================================================
// Inventory Transactions
// ============================================================

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  transactionType: varchar('transaction_type', { length: 30 }).notNull(),
  quantityChange: decimal('quantity_change', { precision: 14, scale: 4 }).notNull(),
  quantityBefore: decimal('quantity_before', { precision: 14, scale: 4 }).notNull(),
  quantityAfter: decimal('quantity_after', { precision: 14, scale: 4 }).notNull(),
  referenceType: varchar('reference_type', { length: 30 }).notNull(),
  referenceId: integer('reference_id'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert;
