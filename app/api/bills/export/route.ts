import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products, inventoryTransactions } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const period = searchParams.get('period') || 'today';
  const format = searchParams.get('format') || 'csv';
  const customFrom = searchParams.get('customFrom');
  const customTo = searchParams.get('customTo');

  const { from, to } = getDateRange(period, customFrom, customTo);

  // Fetch all orders with items for the period
  const ordersResult = await db
    .select()
    .from(orders)
    .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)))
    .orderBy(desc(orders.createdAt));

  const settlementLabels: Record<string, string> = {
    unsettled: '未结算',
    partially_settled: '部分结算',
    settled: '已结算',
  };

  if (format === 'csv') {
    const bom = '﻿';
    const headers = '订单号,日期,购买人,电话,金额,结算状态,已结算,未结算,备注\n';
    const rows = ordersResult.map((order) => {
      const total = Number(order.totalAmount);
      const settled = Number(order.settledAmount);
      const remaining = total - settled;
      return [
        order.orderNo,
        new Date(order.createdAt).toLocaleDateString('zh-CN'),
        order.buyerName || '',
        order.buyerPhone || '',
        total.toFixed(2),
        settlementLabels[order.settlementStatus] || order.settlementStatus,
        settled.toFixed(2),
        remaining.toFixed(2),
        order.notes || '',
      ].map(escapeCsv).join(',');
    }).join('\n');

    const csvContent = bom + headers + rows;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bill_${period}_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // JSON format for client-side Excel generation
  const orderData = ordersResult.map((order) => ({
    orderNo: order.orderNo,
    date: new Date(order.createdAt).toLocaleDateString('zh-CN'),
    buyerName: order.buyerName || '',
    buyerPhone: order.buyerPhone || '',
    totalAmount: Number(order.totalAmount),
    settlementStatus: settlementLabels[order.settlementStatus] || order.settlementStatus,
    settledAmount: Number(order.settledAmount),
    notes: order.notes || '',
  }));

  return NextResponse.json({
    success: true,
    data: {
      format: 'json',
      period,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      orders: orderData,
      summary: {
        totalOrders: orderData.length,
        totalRevenue: orderData.reduce((sum, o) => sum + o.totalAmount, 0),
        totalSettled: orderData.reduce((sum, o) => sum + o.settledAmount, 0),
      },
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
