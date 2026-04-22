import { NextRequest, NextResponse } from 'next/server';
import { eq, or, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { createUserSchema } from '@/lib/validation/user';
import { hash, compare } from 'bcryptjs';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: { message: '需要管理员权限' } }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search');
  const status = searchParams.get('status');

  const conditions = [];
  if (search) {
    conditions.push(or(eq(users.name, search), eq(users.email, search)));
  }
  if (status) {
    conditions.push(eq(users.status, status));
  }

  const where = conditions.length > 0 ? conditions[0] : undefined;
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: users.id }).from(users),
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
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: { message: '需要管理员权限' } }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { name, email, password, role, phone } = parsed.data;

    // Check email uniqueness
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: { message: '邮箱已被使用' } },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role: role || 'operator',
        phone: phone || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        status: newUser.status,
        createdAt: newUser.createdAt,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: '服务器内部错误' } },
      { status: 500 }
    );
  }
}
