import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products, inventoryTransactions } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const period = searchParams.get('period') || 'today';
  const customFrom = searchParams.get('customFrom');
  const customTo = searchParams.get('customTo');

  const { from, to } = getDateRange(period, customFrom, customTo);

  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  // Parallel queries for all summary data
  const [
    kpiResult,
    orderCountResult,
    settlementResult,
    topOrdersResult,
    topProductsResult,
    dailySalesResult,
    inventoryChangeResult,
  ] = await Promise.all([
    // Total revenue
    db
      .select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(and(sql`${orders.createdAt} >= ${fromStr}`, sql`${orders.createdAt} <= ${toStr}`)),

    // Order count
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(sql`${orders.createdAt} >= ${fromStr}`, sql`${orders.createdAt} <= ${toStr}`)),

    // Settlement breakdown
    db
      .select({
        status: orders.settlementStatus,
        total: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(and(sql`${orders.createdAt} >= ${fromStr}`, sql`${orders.createdAt} <= ${toStr}`))
      .groupBy(orders.settlementStatus),

    // Top 10 orders by amount
    db
      .select({
        orderNo: orders.orderNo,
        buyerName: orders.buyerName,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(sql`${orders.createdAt} >= ${fromStr}`, sql`${orders.createdAt} <= ${toStr}`))
      .orderBy(desc(orders.totalAmount))
      .limit(10),

    // Top 10 products by quantity
    db
      .select({
        productId: orderItems.productId,
        productName: products.name,
        totalQuantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
        totalRevenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}), 0)`,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(sql`${orders.createdAt} >= ${fromStr}`, sql`${orders.createdAt} <= ${toStr}`))
      .groupBy(orderItems.productId, products.name)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(10),

    // Daily sales for chart
    db.execute(sql`
      SELECT
        DATE(${orders.createdAt}) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(${orders.totalAmount}), 0) as total_amount
      FROM ${orders}
      WHERE ${orders.createdAt} >= ${fromStr} AND ${orders.createdAt} <= ${toStr}
      GROUP BY DATE(${orders.createdAt})
      ORDER BY date
    `),

    // Inventory changes summary
    db
      .select({
        type: inventoryTransactions.transactionType,
        count: sql<number>`count(*)`,
        totalQuantity: sql<number>`COALESCE(SUM(ABS(${inventoryTransactions.quantityChange})), 0)`,
      })
      .from(inventoryTransactions)
      .where(and(sql`${inventoryTransactions.createdAt} >= ${fromStr}`, sql`${inventoryTransactions.createdAt} <= ${toStr}`))
      .groupBy(inventoryTransactions.transactionType),
  ]);

  const totalRevenue = kpiResult[0]?.total ?? 0;
  const orderCount = orderCountResult[0]?.count ?? 0;
  const avgOrderValue = orderCount > 0 ? Number(totalRevenue) / orderCount : 0;

  // Settlement breakdown
  const settlementBreakdown = settlementResult.map((row) => ({
    status: row.status,
    total: Number(row.total),
    count: Number(row.count),
  }));

  // Daily sales for chart
  const dailySales = (dailySalesResult as any[]).map((row: any) => ({
    date: row.date.toISOString().split('T')[0],
    orderCount: Number(row.order_count),
    totalAmount: Number(row.total_amount),
  }));

  // Top products with resolved names
  const topProducts = (topProductsResult as any[]).map((row: any) => ({
    productId: Number(row.productId),
    productName: row.productName,
    totalQuantity: Number(row.totalQuantity),
    totalRevenue: Number(row.totalRevenue),
  }));

  // Top orders
  const topOrders = topOrdersResult.map((row) => ({
    orderNo: row.orderNo,
    buyerName: row.buyerName,
    totalAmount: Number(row.totalAmount),
    createdAt: row.createdAt,
  }));

  // Inventory changes
  const inventoryChanges = inventoryChangeResult.map((row) => ({
    type: row.type,
    count: Number(row.count),
    totalQuantity: Number(row.totalQuantity),
  }));

  return NextResponse.json({
    success: true,
    data: {
      period,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      kpis: {
        totalRevenue: Number(totalRevenue),
        orderCount: Number(orderCount),
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      },
      settlementBreakdown,
      dailySales,
      topProducts,
      topOrders,
      inventoryChanges,
    },
  });
}

function getDateRange(period: string, customFrom?: string | null, customTo?: string | null) {
  const now = new Date();
  let from: Date;
  let to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (period === 'custom' && customFrom && customTo) {
    from = new Date(customFrom);
    to = new Date(customTo + 'T23:59:59');
  } else {
    switch (period) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        from = new Date(now);
        from.setDate(now.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        break;
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  return { from, to };
}
