import { z } from 'zod';

// Schema for form input (strings from HTML inputs)
export const productFormSchema = z.object({
  name: z.string().min(1, '请输入商品名称'),
  sku: z.string().optional().or(z.literal('')),
  unit: z.string().min(1, '请输入单位'),
  unitPrice: z.string().min(1, '请输入单价'),
  stockQuantity: z.string().min(1, '请输入库存'),
});

// Schema for API payload (numbers after transformation)
export const productSchema = z.object({
  name: z.string().min(1, '请输入商品名称'),
  sku: z.string().optional().or(z.literal('')),
  unit: z.string().min(1, '请输入单位'),
  unitPrice: z.coerce.number().min(0, '单价不能为负').max(99999999.99),
  stockQuantity: z.coerce.number().min(0, '库存不能为负').max(99999999.9999),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
export type ProductInput = z.infer<typeof productSchema>;
