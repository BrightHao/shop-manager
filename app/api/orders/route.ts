import { NextRequest, NextResponse } from 'next/server';
import { eq, like, and, desc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products, inventoryTransactions } from '@/lib/db/schema';
import { orderSchema } from '@/lib/validation/order';
import { getSession } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const settlementStatus = searchParams.get('settlementStatus');
  const buyerSearch = searchParams.get('buyer');

  const conditions = [];
  if (dateFrom) conditions.push(sql`${orders.createdAt} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${orders.createdAt} <= ${dateTo}`);
  if (settlementStatus) conditions.push(eq(orders.settlementStatus, settlementStatus));
  if (buyerSearch) conditions.push(like(orders.buyerName, `%${buyerSearch}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: orders.id }).from(orders).where(where),
  ]);

  return NextResponse.json({
    success: true,
    data: items,
    meta: {
      page,
      limit,
      total: countResult.length,
      totalPages: Math.ceil(countResult.length / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { buyerName, buyerPhone, notes, items: orderItemsInput } = parsed.data;
    const productIds = [...new Set(orderItemsInput.map((i) => i.productId))];

    const result = await db.transaction(async (tx) => {
      // Load and lock product rows
      const lockedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds))
        .for('update');

      const productMap = new Map(
        lockedProducts.map((p) => [p.id, p])
      );

      // Validate stock
      for (const item of orderItemsInput) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`商品 ID ${item.productId} 不存在`);
        }
        const stock = parseFloat(product.stockQuantity);
        if (stock < item.quantity) {
          throw new Error(`商品 "${product.name}" 库存不足，当前库存 ${stock}，需要 ${item.quantity}`);
        }
      }

      // Generate order number using timestamp-based sequence
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}${String(today.getSeconds()).padStart(2, '0')}`;
      const orderNo = `ORD-${dateStr}-${timeStr}`;

      // Create order
      const [{ id: insertId }] = await tx
        .insert(orders)
        .values({
          orderNo,
          buyerName: buyerName || null,
          buyerPhone: buyerPhone || null,
          notes: notes || null,
          createdBy: session.id,
        })
        .$returningId();

      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, insertId))
        .limit(1);

      // Create order items, deduct stock, record transactions
      let totalAmount = 0;

      for (const item of orderItemsInput) {
        const unitPrice = item.totalPrice / item.quantity;
        totalAmount += item.totalPrice;

        const product = productMap.get(item.productId)!;
        const stockBefore = parseFloat(product.stockQuantity);

        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity.toString(),
          unitPrice: unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
        });

        await tx
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
          })
          .where(eq(products.id, item.productId));

        await tx.insert(inventoryTransactions).values({
          productId: item.productId,
          transactionType: 'sale',
          quantityChange: (-item.quantity).toString(),
          quantityBefore: stockBefore.toString(),
          quantityAfter: (stockBefore - item.quantity).toString(),
          referenceType: 'order',
          referenceId: order.id,
          createdBy: session.id,
        });
      }

      await tx
        .update(orders)
        .set({ totalAmount: totalAmount.toString() })
        .where(eq(orders.id, order.id));

      const [fullOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, order.id))
        .limit(1);

      const orderItemsResult = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      return { ...fullOrder, items: orderItemsResult };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    return NextResponse.json(
      { success: false, error: { message } },
      { status: err instanceof Error && message.includes('库存') ? 400 : 500 }
    );
  }
}
