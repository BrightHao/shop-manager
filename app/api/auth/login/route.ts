import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { loginSchema } from '@/lib/validation/auth';
import { setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: '邮箱或密码错误' } },
        { status: 401 }
      );
    }

    const valid = await compare(password, user[0].passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: { message: '邮箱或密码错误' } },
        { status: 401 }
      );
    }

    if (user[0].status === 'disabled') {
      return NextResponse.json(
        { success: false, error: { message: '账号已被禁用' } },
        { status: 403 }
      );
    }

    await setSession({
      id: user[0].id,
      name: user[0].name,
      email: user[0].email,
      role: user[0].role as 'admin' | 'operator',
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user[0].id,
          name: user[0].name,
          email: user[0].email,
          role: user[0].role,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: '服务器内部错误' } },
      { status: 500 }
    );
  }
}
