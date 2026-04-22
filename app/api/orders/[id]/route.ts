import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products, inventoryTransactions } from '@/lib/db/schema';
import { orderSchema } from '@/lib/validation/order';
import { getSession } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { id } = await params;
  const orderId = parseInt(id);

  const orderResult = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (orderResult.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: '订单不存在' } },
      { status: 404 }
    );
  }

  const itemsResult = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  return NextResponse.json({
    success: true,
    data: {
      ...orderResult[0],
      items: itemsResult,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { id } = await params;
  const orderId = parseInt(id);
  const body = await request.json();

  // Settlement action
  if (body.action === 'settle') {
    return handleSettlement(orderId, body.amount);
  }

  // Order edit action - full order update with delta stock adjustment
  return handleOrderEdit(orderId, body, session);
}

async function handleSettlement(orderId: number, amount: number) {
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, error: { message: '结算金额必须大于0' } },
      { status: 400 }
    );
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json(
      { success: false, error: { message: '订单不存在' } },
      { status: 404 }
    );
  }

  const totalAmount = parseFloat(order.totalAmount);
  const settledAmount = parseFloat(order.settledAmount);
  const remaining = totalAmount - settledAmount;

  if (amount > remaining + 0.01) {
    return NextResponse.json(
      { success: false, error: { message: `结算金额超过未结算余额，最多 ¥${remaining.toFixed(2)}` } },
      { status: 400 }
    );
  }

  const newSettled = Math.round((settledAmount + amount) * 100) / 100;
  const newSettlementStatus =
    newSettled >= totalAmount - 0.01 ? 'settled' : newSettled > 0 ? 'partially_settled' : 'unsettled';

  const [updated] = await db
    .update(orders)
    .set({
      settledAmount: newSettled.toString(),
      settlementStatus: newSettlementStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return NextResponse.json({ success: true, data: updated });
}

async function handleOrderEdit(orderId: number, body: unknown, session: { id: number }) {
  try {
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { buyerName, buyerPhone, notes, items: newItems } = parsed.data;
    const productIds = [...new Set(newItems.map((i) => i.productId))];

    const result = await db.transaction(async (tx) => {
      // 1. Load existing order
      const [existingOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!existingOrder) {
        throw new Error('订单不存在');
      }

      // 2. Load existing order items
      const existingItems = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // 3. Build maps for delta calculation
      const oldItemMap = new Map<number, { quantity: number; totalPrice: number; item: typeof existingItems[0] }>(
        existingItems.map((item) => [item.productId, {
          quantity: parseFloat(item.quantity),
          totalPrice: parseFloat(item.totalPrice),
          item,
        }])
      );

      const newItemMap = new Map(
        newItems.map((item) => [item.productId, item])
      );

      const allProductIds = new Set([...oldItemMap.keys(), ...newItemMap.keys()]);

      // 4. Lock and load products using Drizzle query builder
      const lockedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, [...allProductIds]))
        .for('update');

      const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

      // 5. Calculate deltas and validate stock
      const deltas = new Map<number, number>();

      for (const productId of allProductIds) {
        const oldItem = oldItemMap.get(productId);
        const newItem = newItemMap.get(productId);
        const oldQty = oldItem?.quantity ?? 0;
        const newQty = newItem?.quantity ?? 0;
        const delta = newQty - oldQty;

        if (delta > 0) {
          // Need more stock
          const product = productMap.get(productId);
          if (!product) {
            throw new Error(`商品 ID ${productId} 不存在`);
          }
          const currentStock = parseFloat(product.stockQuantity);
          if (currentStock < delta) {
            throw new Error(`商品 "${product.name}" 库存不足，当前库存 ${currentStock}，需要增加 ${delta}`);
          }
        }

        deltas.set(productId, delta);
      }

      // 6. Apply stock adjustments
      for (const [productId, delta] of deltas) {
        if (delta === 0) continue;

        const product = productMap.get(productId)!;
        const stockBefore = parseFloat(product.stockQuantity);
        const stockAfter = stockBefore - delta;

        await tx
          .update(products)
          .set({ stockQuantity: stockAfter.toString() })
          .where(eq(products.id, productId));

        await tx.insert(inventoryTransactions).values({
          productId,
          transactionType: delta > 0 ? 'sale' : 'sale_reversal',
          quantityChange: (-delta).toString(),
          quantityBefore: stockBefore.toString(),
          quantityAfter: stockAfter.toString(),
          referenceType: 'order',
          referenceId: orderId,
          notes: `订单编辑 (delta: ${delta > 0 ? '+' : ''}${delta})`,
          createdBy: session.id,
        });
      }

      // 7. Replace order items
      await tx
        .delete(orderItems)
        .where(eq(orderItems.orderId, orderId));

      let totalAmount = 0;

      for (const item of newItems) {
        const unitPrice = item.totalPrice / item.quantity;
        totalAmount += item.totalPrice;

        await tx.insert(orderItems).values({
          orderId,
          productId: item.productId,
          quantity: item.quantity.toString(),
          unitPrice: unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
        });
      }

      // 8. Update order header
      const [updated] = await tx
        .update(orders)
        .set({
          buyerName: buyerName || null,
          buyerPhone: buyerPhone || null,
          notes: notes || null,
          totalAmount: totalAmount.toString(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      const updatedItems = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      return { ...updated, items: updatedItems };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    return NextResponse.json(
      { success: false, error: { message } },
      { status: err instanceof Error && message.includes('库存') ? 400 : 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { id } = await params;
  const orderId = parseInt(id);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Load order
      const [existingOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!existingOrder) {
        throw new Error('订单不存在');
      }

      // 2. Load order items
      const existingItems = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // 3. Lock and restore stock for each item
      for (const item of existingItems) {
        const quantity = parseFloat(item.quantity);

        // Lock the product row
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .for('update')
          .limit(1);

        if (!product) continue;

        const stockBefore = parseFloat(product.stockQuantity);
        const stockAfter = stockBefore + quantity;

        await tx
          .update(products)
          .set({ stockQuantity: stockAfter.toString() })
          .where(eq(products.id, item.productId));

        await tx.insert(inventoryTransactions).values({
          productId: item.productId,
          transactionType: 'sale_reversal',
          quantityChange: quantity.toString(),
          quantityBefore: stockBefore.toString(),
          quantityAfter: stockAfter.toString(),
          referenceType: 'order',
          referenceId: orderId,
          notes: '订单取消 - 库存恢复',
          createdBy: session.id,
        });
      }

      // 4. Delete order items (cascade) and order
      await tx
        .delete(orders)
        .where(eq(orders.id, orderId));

      return { orderId };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    );
  }
}
