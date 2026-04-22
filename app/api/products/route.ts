import { NextRequest, NextResponse } from 'next/server';
import { eq, ilike, and, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { productSchema } from '@/lib/validation/product';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'active';

  const where = and(
    eq(products.status, status as 'active' | 'archived'),
    search ? ilike(products.name, `%${search}%`) : undefined,
  );

  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db.select().from(products).where(where).orderBy(asc(products.name)).limit(limit).offset(offset),
    db.select({ count: products.id }).from(products).where(where),
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
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { name, sku, unit, unitPrice, stockQuantity } = parsed.data;

    // Check SKU uniqueness
    if (sku) {
      const existing = await db
        .select()
        .from(products)
        .where(eq(products.sku, sku))
        .limit(1);
      if (existing.length > 0) {
        return NextResponse.json(
          { success: false, error: { message: 'SKU 已存在' } },
          { status: 409 }
        );
      }
    }

    const result = await db
      .insert(products)
      .values({
        name,
        sku,
        unit,
        unitPrice: unitPrice.toString(),
        stockQuantity: stockQuantity.toString(),
        createdBy: session.id,
      })
      .returning();

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: '服务器内部错误' } },
      { status: 500 }
    );
  }
}
