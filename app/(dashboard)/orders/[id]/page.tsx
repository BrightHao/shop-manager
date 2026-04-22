'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, XCircle, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const settlementLabels: Record<string, string> = {
  unsettled: '未结算',
  partially_settled: '部分结算',
  settled: '已结算',
};

const settlementColors: Record<string, string> = {
  unsettled: 'bg-red-100 text-red-800',
  partially_settled: 'bg-yellow-100 text-yellow-800',
  settled: 'bg-green-100 text-green-800',
};

interface OrderItem {
  id: number;
  productId: number;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  product?: { name: string; unit: string };
}

interface Order {
  id: number;
  orderNo: string;
  buyerName: string | null;
  buyerPhone: string | null;
  totalAmount: string;
  settlementStatus: string;
  settledAmount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settling, setSettling] = useState(false);
  const { id } = React.use(params);
  const orderId = parseInt(id);

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setOrder(result.data);
        } else {
          toast.error(result.error?.message || '订单不存在');
          router.push('/orders');
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [orderId, router]);

  async function handleCancel() {
    if (!confirm('确定要取消此订单吗？取消后将恢复库存。')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('订单已取消，库存已恢复');
        router.refresh();
        // Refetch order
        const detail = await fetch(`/api/orders/${orderId}`).then((r) => r.json());
        if (detail.success) setOrder(detail.data);
      } else {
        toast.error(result.error?.message || '取消失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setCancelling(false);
    }
  }

  async function handleSettle() {
    setSettling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle', amount: parseFloat(settleAmount) }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('结算成功');
        setSettleDialogOpen(false);
        setSettleAmount('');
        const detail = await fetch(`/api/orders/${orderId}`).then((r) => r.json());
        if (detail.success) setOrder(detail.data);
      } else {
        toast.error(result.error?.message || '结算失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setSettling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!order) return null;

  const remaining = Math.max(0, parseFloat(order.totalAmount) - parseFloat(order.settledAmount));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.push('/orders')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回订单列表
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/orders/${orderId}/edit`)}>
            <Pencil className="w-4 h-4 mr-2" />
            编辑
          </Button>
          <Button variant="outline" onClick={() => setSettleDialogOpen(true)}>
            <CreditCard className="w-4 h-4 mr-2" />
            结算
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
            <XCircle className="w-4 h-4 mr-2" />
            {cancelling ? '取消中...' : '取消订单'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>订单信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">订单号</span>
                  <p className="font-mono font-medium">{order.orderNo}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">日期</span>
                  <p>{new Date(order.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">购买人</span>
                  <p>{order.buyerName || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">联系电话</span>
                  <p>{order.buyerPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">结算状态</span>
                  <div className="mt-1">
                    <Badge className={settlementColors[order.settlementStatus] || 'bg-gray-100'}>
                      {settlementLabels[order.settlementStatus] || order.settlementStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">备注</span>
                  <p>{order.notes || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>商品明细</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm text-gray-500">商品</th>
                    <th className="text-right py-2 text-sm text-gray-500">数量</th>
                    <th className="text-right py-2 text-sm text-gray-500">单价</th>
                    <th className="text-right py-2 text-sm text-gray-500">总价</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.product?.name || `商品 #${item.productId}`}</td>
                      <td className="py-2 text-right">{item.quantity} {item.product?.unit || ''}</td>
                      <td className="py-2 text-right">¥{parseFloat(item.unitPrice).toFixed(2)}</td>
                      <td className="py-2 text-right font-medium">¥{parseFloat(item.totalPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="py-3 text-right font-medium">合计：</td>
                    <td className="py-3 text-right text-lg font-bold">¥{parseFloat(order.totalAmount).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>结算明细</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">订单总额</span>
                <p className="text-xl font-bold">¥{parseFloat(order.totalAmount).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">已结算</span>
                <p className="text-lg text-green-600 font-medium">¥{parseFloat(order.settledAmount).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">未结算</span>
                <p className="text-lg text-red-600 font-medium">¥{remaining.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>结算订单</DialogTitle>
            <DialogDescription>
              请输入本次结算金额，剩余 ¥{remaining.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>结算金额</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder={`最大 ¥${remaining.toFixed(2)}`}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setSettleAmount(remaining.toFixed(2))}>
              全额结算
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialogOpen(false)} disabled={settling}>
              取消
            </Button>
            <Button onClick={handleSettle} disabled={settling || !settleAmount}>
              {settling ? '结算中...' : '确认结算'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
