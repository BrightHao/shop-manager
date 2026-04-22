'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { orderSchema } from '@/lib/validation/order';
import type { OrderInput } from '@/lib/validation/order';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  unit: string;
  stockQuantity: string;
  unitPrice: string;
}

interface OrderFormItem {
  productId: string;
  quantity: string;
  totalPrice: string;
}

interface OrderFormProps {
  orderId?: number;
}

export default function OrderForm({ orderId }: OrderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<{
    buyerName: string;
    buyerPhone: string;
    notes: string;
    items: OrderFormItem[];
  }>({
    resolver: zodResolver(orderSchema) as any,
    defaultValues: {
      buyerName: '',
      buyerPhone: '',
      notes: '',
      items: [{ productId: '', quantity: '', totalPrice: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Load products
  useEffect(() => {
    fetch('/api/products?limit=1000&status=active')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setProducts(result.data);
      })
      .catch(() => {});
  }, []);

  // Load existing order data if editing
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    fetch(`/api/orders/${orderId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          const order = result.data;
          form.setValue('buyerName', order.buyerName || '');
          form.setValue('buyerPhone', order.buyerPhone || '');
          form.setValue('notes', order.notes || '');

          if (order.items && order.items.length > 0) {
            // Clear default empty row
            form.setValue('items', []);
            for (const item of order.items) {
              append({
                productId: String(item.productId),
                quantity: item.quantity,
                totalPrice: item.totalPrice,
              });
            }
          }
        } else {
          toast.error(result.error?.message || '订单不存在');
          router.push('/orders');
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [orderId, form, append, router]);

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      form.setValue(`items.${index}.productId` as any, productId);
      const product = products.find((p) => String(p.id) === productId);
      if (product) {
        form.setValue(`items.${index}.quantity` as any, '');
        form.setValue(`items.${index}.totalPrice` as any, '');
      }
    },
    [form, products]
  );

  const handleQuantityChange = useCallback(
    (index: number, value: string) => {
      form.setValue(`items.${index}.quantity` as any, value);
      const productId = form.getValues(`items.${index}.productId` as any);
      const product = products.find((p) => String(p.id) === productId);
      if (product && value) {
        const qty = parseFloat(value);
        const price = parseFloat(product.unitPrice);
        if (!isNaN(qty) && !isNaN(price)) {
          const total = Math.round(qty * price * 100) / 100;
          form.setValue(`items.${index}.totalPrice` as any, total.toFixed(2));
        }
      }
    },
    [form, products]
  );

  const handleTotalPriceChange = useCallback(
    (index: number, value: string) => {
      form.setValue(`items.${index}.totalPrice` as any, value);
    },
    [form]
  );

  const grandTotal = fields.reduce((sum, field, index) => {
    const tp = form.getValues(`items.${index}.totalPrice` as any);
    return sum + (tp ? parseFloat(tp) : 0);
  }, 0);

  async function onSubmit(data: {
    buyerName: string;
    buyerPhone: string;
    notes: string;
    items: OrderFormItem[];
  }) {
    setSubmitting(true);
    try {
      const body: OrderInput = {
        buyerName: data.buyerName || undefined,
        buyerPhone: data.buyerPhone || undefined,
        notes: data.notes || undefined,
        items: data.items.map((item) => ({
          productId: parseInt(item.productId),
          quantity: parseFloat(item.quantity),
          totalPrice: parseFloat(item.totalPrice),
        })),
      };

      const url = orderId ? `/api/orders/${orderId}` : '/api/orders';
      const method = orderId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!result.success) {
        toast.error(result.error?.message || (orderId ? '更新订单失败' : '创建订单失败'));
        return;
      }

      toast.success(orderId ? '订单更新成功' : '订单创建成功');
      router.push(`/orders/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  const getSelectedProduct = (productId: string) =>
    products.find((p) => String(p.id) === productId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const isEdit = !!orderId;

  return (
    <div>
      <Button variant="ghost" className="mb-4" onClick={() => router.push(isEdit ? `/orders/${orderId}` : '/orders')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {isEdit ? '返回订单详情' : '返回订单列表'}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? '编辑订单' : '新增订单'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyerName">购买人</Label>
                <Input id="buyerName" {...form.register('buyerName')} disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyerPhone">联系电话</Label>
                <Input id="buyerPhone" {...form.register('buyerPhone')} disabled={submitting} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>订单商品</Label>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-3 py-2 text-sm font-medium">商品</th>
                      <th className="text-left px-3 py-2 text-sm font-medium">数量</th>
                      <th className="text-left px-3 py-2 text-sm font-medium">总价</th>
                      <th className="text-left px-3 py-2 text-sm font-medium">单价(自动)</th>
                      <th className="text-left px-3 py-2 text-sm font-medium">可用库存</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const selectedProduct = getSelectedProduct(
                        form.getValues(`items.${index}.productId` as any) || ''
                      );
                      const quantity = form.getValues(`items.${index}.quantity` as any) || '';
                      const totalPrice = form.getValues(`items.${index}.totalPrice` as any) || '';
                      const unitPrice =
                        quantity && totalPrice && parseFloat(quantity) > 0
                          ? (parseFloat(totalPrice) / parseFloat(quantity)).toFixed(2)
                          : '-';

                      return (
                        <tr key={field.id} className="border-b">
                          <td className="px-3 py-2">
                            <Select
                              value={form.getValues(`items.${index}.productId` as any) || ''}
                              onValueChange={(v) => handleProductChange(index, v)}
                              disabled={submitting}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择商品" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    {p.name} (¥{p.unitPrice}/{p.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={quantity}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              disabled={submitting}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={totalPrice}
                              onChange={(e) => handleTotalPriceChange(index, e.target.value)}
                              disabled={submitting}
                            />
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">{unitPrice}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {selectedProduct
                              ? `${selectedProduct.stockQuantity} ${selectedProduct.unit}`
                              : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                disabled={submitting}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={2} className="px-3 py-2 text-right font-medium">
                        合计：
                      </td>
                      <td className="px-3 py-2 font-bold text-lg">¥{grandTotal.toFixed(2)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: '', quantity: '', totalPrice: '' })}
                disabled={submitting}
              >
                <Plus className="w-4 h-4 mr-1" />
                添加商品
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Input id="notes" {...form.register('notes')} disabled={submitting} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? isEdit
                    ? '更新中...'
                    : '创建中...'
                  : isEdit
                    ? '更新订单'
                    : '创建订单'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(isEdit ? `/orders/${orderId}` : '/orders')}
              >
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
