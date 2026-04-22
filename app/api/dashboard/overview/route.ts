import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, products } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = today.toISOString();
  const tomorrowStr = tomorrow.toISOString();
  const monthStartStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [
    todayOrders,
    todayRevenue,
    totalOrders,
    lowStockProducts,
    recentOrders,
  ] = await Promise.all([
    // Today's order count
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${todayStr} AND ${orders.createdAt} < ${tomorrowStr}`),

    // Today's revenue
    db
      .select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${todayStr} AND ${orders.createdAt} < ${tomorrowStr}`),

    // Total orders this month
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${monthStartStr}`),

    // Low stock products (stock <= 10)
    db
      .select({
        id: products.id,
        name: products.name,
        stockQuantity: products.stockQuantity,
        unit: products.unit,
      })
      .from(products)
      .where(sql`${products.stockQuantity} <= 10 AND ${products.status} = 'active'`)
      .orderBy(sql`${products.stockQuantity} ASC`)
      .limit(5),

    // Recent 5 orders
    db
      .select({
        orderNo: orders.orderNo,
        buyerName: orders.buyerName,
        totalAmount: orders.totalAmount,
        settlementStatus: orders.settlementStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(5),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      kpis: {
        todayOrders: todayOrders[0]?.count ?? 0,
        todayRevenue: Number(todayRevenue[0]?.total ?? 0),
        monthlyOrders: totalOrders[0]?.count ?? 0,
      },
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stockQuantity: Number(p.stockQuantity),
        unit: p.unit,
      })),
      recentOrders: recentOrders.map((o) => ({
        orderNo: o.orderNo,
        buyerName: o.buyerName,
        totalAmount: Number(o.totalAmount),
        settlementStatus: o.settlementStatus,
        createdAt: new Date(o.createdAt).toLocaleString('zh-CN'),
      })),
    },
  });
}
