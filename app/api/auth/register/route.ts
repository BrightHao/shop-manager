import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { registerSchema } from '@/lib/validation/auth';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { message: '需要管理员权限' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { email, name, password, role, phone } = parsed.data;

    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: { message: '该邮箱已被注册' } },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 10);

    const [{ id: insertId }] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        role,
        phone,
        status: 'active',
      })
      .$returningId();

    const newUser = await db
      .select()
      .from(users)
      .where(eq(users.id, insertId))
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newUser[0].id,
          name: newUser[0].name,
          email: newUser[0].email,
          role: newUser[0].role,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { message: '服务器内部错误' } },
      { status: 500 }
    );
  }
}
