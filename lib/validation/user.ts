import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(255),
  email: z.string().email('邮箱格式不正确').max(255),
  password: z.string().min(6, '密码至少6位').max(128),
  role: z.enum(['admin', 'operator']).default('operator'),
  phone: z.string().max(50).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(255).optional(),
  role: z.enum(['admin', 'operator']).optional(),
  phone: z.string().max(50).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少6位').max(128),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
