import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { id } = await params;
  const productId = parseInt(id);

  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (result.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: '商品不存在' } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: result[0] });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { id } = await params;
  const productId = parseInt(id);

  try {
    const body = await request.json();

    const result = await db
      .update(products)
      .set({
        name: body.name,
        sku: body.sku,
        unit: body.unit,
        unitPrice: body.unitPrice?.toString(),
        status: body.status,
      })
      .where(eq(products.id, productId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: '商品不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: '服务器内部错误' } },
      { status: 500 }
    );
  }
}
