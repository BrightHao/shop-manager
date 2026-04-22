'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardData {
  kpis: {
    todayOrders: number;
    todayRevenue: number;
    monthlyOrders: number;
  };
  lowStockProducts: {
    id: number;
    name: string;
    stockQuantity: number;
    unit: string;
  }[];
  recentOrders: {
    orderNo: string;
    buyerName: string | null;
    totalAmount: number;
    settlementStatus: string;
    createdAt: string;
  }[];
}

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

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;
  if (!data) return null;

  const { kpis, lowStockProducts, recentOrders } = data;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">仪表盘</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日订单</CardTitle>
            <ShoppingCart className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{kpis.todayOrders}</p>
            <p className="text-xs text-gray-500 mt-1">
              本月累计 {kpis.monthlyOrders} 单
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日收入</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">¥{kpis.todayRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">库存预警</CardTitle>
            <AlertTriangle className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{lowStockProducts.length}</p>
            <p className="text-xs text-gray-500 mt-1">库存 ≤ 10 的商品</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              库存预警
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
              查看全部
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {lowStockProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="font-medium">{p.name}</span>
                    <Badge className={p.stockQuantity <= 5 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                      {p.stockQuantity} {p.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">所有商品库存充足</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>最近订单</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/orders')}>
              查看全部
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.orderNo}
                    className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                    onClick={() => router.push(`/orders/${order.orderNo.split('-').pop()}`)}
                  >
                    <div>
                      <p className="font-mono text-sm">{order.orderNo}</p>
                      <p className="text-xs text-gray-500">{order.buyerName || '匿名'} · {order.createdAt}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">¥{order.totalAmount.toFixed(2)}</p>
                      <Badge className={settlementColors[order.settlementStatus] || 'bg-gray-100'}>
                        {settlementLabels[order.settlementStatus]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">暂无订单</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
