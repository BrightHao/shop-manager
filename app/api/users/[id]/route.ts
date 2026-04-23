import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { updateUserSchema, changePasswordSchema } from '@/lib/validation/user';
import { hash, compare } from 'bcryptjs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: '未登录' } }, { status: 401 });
  }

  const { id } = await params;
  const targetId = parseInt(id);
  const body = await request.json();
  const isAdmin = session.role === 'admin';

  // Admin can update any user; non-admin can only update themselves
  if (!isAdmin && targetId !== session.id) {
    return NextResponse.json({ success: false, error: { message: '无权操作' } }, { status: 403 });
  }

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: '用户不存在' } }, { status: 404 });
    }

    if (body.action === 'changePassword') {
      return handleChangePassword(targetId, body, isAdmin);
    }

    // Admin-only field updates
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: { message: '需要管理员权限' } }, { status: 403 });
    }

    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { name, role, phone, status } = parsed.data;

    await db
      .update(users)
      .set({
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(phone !== undefined && { phone }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId));

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        phone: updated.phone,
        status: updated.status,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: '服务器内部错误' } },
      { status: 500 }
    );
  }
}

async function handleChangePassword(userId: number, body: { currentPassword: string; newPassword: string }, isAdmin: boolean) {
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: '输入格式错误', details: parsed.error.issues } },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Verify current password (skip for admin resetting another user)
  if (!isAdmin) {
    const [existing] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existing || !existing.passwordHash) {
      return NextResponse.json({ success: false, error: { message: '用户不存在' } }, { status: 404 });
    }

    const isValid = await compare(currentPassword, existing.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: { message: '当前密码不正确' } }, { status: 400 });
    }
  }

  const passwordHash = await hash(newPassword, 12);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true, data: { message: '密码已修改' } });
}
