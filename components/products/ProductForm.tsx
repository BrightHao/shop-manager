'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { productFormSchema } from '@/lib/validation/product';
import type { ProductFormInput } from '@/lib/validation/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function ProductForm() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string | undefined;
  const isEdit = !!productId;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const form = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      unit: '',
      unitPrice: '',
      stockQuantity: '',
    },
  });

  useEffect(() => {
    if (!isEdit) return;

    fetch(`/api/products/${productId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          const p = result.data;
          form.reset({
            name: p.name,
            sku: p.sku || '',
            unit: p.unit,
            unitPrice: p.unitPrice.toString(),
            stockQuantity: p.stockQuantity.toString(),
          });
        }
        setFetching(false);
      })
      .catch(() => setFetching(false));
  }, [isEdit, productId, form]);

  async function onSubmit(data: ProductFormInput) {
    setLoading(true);
    try {
      const url = isEdit ? `/api/products/${productId}` : '/api/products';
      const method = isEdit ? 'PATCH' : 'POST';
      const body = {
        name: data.name,
        sku: data.sku || undefined,
        unit: data.unit,
        unitPrice: parseFloat(data.unitPrice),
        stockQuantity: parseFloat(data.stockQuantity),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!result.success) {
        toast.error(result.error?.message || '保存失败');
        return;
      }

      toast.success(isEdit ? '商品更新成功' : '商品创建成功');
      router.push('/products');
      router.refresh();
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div>
      <Button variant="ghost" className="mb-4" onClick={() => router.push('/products')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回商品列表
      </Button>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isEdit ? '编辑商品' : '新增商品'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">商品名称 *</Label>
                <Input id="name" {...form.register('name')} disabled={loading} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...form.register('sku')} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">单位 *</Label>
                <Input id="unit" placeholder="如：kg、件、箱" {...form.register('unit')} disabled={loading} />
                {form.formState.errors.unit && (
                  <p className="text-sm text-red-500">{form.formState.errors.unit.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">单价 *</Label>
                <Input id="unitPrice" type="number" step="0.01" min="0" {...form.register('unitPrice')} disabled={loading} />
                {form.formState.errors.unitPrice && (
                  <p className="text-sm text-red-500">{form.formState.errors.unitPrice.message}</p>
                )}
              </div>
              {!isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">初始库存</Label>
                  <Input id="stockQuantity" type="number" step="0.0001" min="0" {...form.register('stockQuantity')} disabled={loading} />
                  {form.formState.errors.stockQuantity && (
                    <p className="text-sm text-red-500">{form.formState.errors.stockQuantity.message}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : isEdit ? '更新商品' : '创建商品'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/products')}>
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
