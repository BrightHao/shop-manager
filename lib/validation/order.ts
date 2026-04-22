import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.coerce.number().int().positive('请选择商品'),
  quantity: z.coerce.number().positive('数量必须大于0').max(999999.9999),
  totalPrice: z.coerce.number().min(0, '总价不能为负'),
});

export const orderSchema = z.object({
  buyerName: z.string().optional(),
  buyerPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, '至少添加一个商品'),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
