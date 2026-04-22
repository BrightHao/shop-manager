'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';

const periodLabels: Record<string, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  year: '本年',
  custom: '自定义',
};

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

interface KPIs {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
}

interface SettlementBreakdown {
  status: string;
  total: number;
  count: number;
}

interface TopProduct {
  productId: number;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface TopOrder {
  orderNo: string;
  buyerName: string | null;
  totalAmount: number;
  createdAt: string;
}

interface DailySale {
  date: string;
  orderCount: number;
  totalAmount: number;
}

interface InventoryChange {
  type: string;
  count: number;
  totalQuantity: number;
}

interface BillData {
  period: string;
  dateRange: { from: string; to: string };
  kpis: KPIs;
  settlementBreakdown: SettlementBreakdown[];
  dailySales: DailySale[];
  topProducts: TopProduct[];
  topOrders: TopOrder[];
  inventoryChanges: InventoryChange[];
}

export default function BillSummaryPage() {
  const router = useRouter();
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [billData, setBillData] = useState<BillData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/summary?period=${period}`);
      const result = await res.json();
      if (result.success) {
        setBillData(result.data);
      } else {
        toast.error(result.error?.message || '加载失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleExport(format: 'csv' | 'excel') {
    if (format === 'csv') {
      const url = `/api/bills/export?period=${period}&format=csv`;
      window.open(url, '_blank');
      toast.success('CSV 导出已开始');
    } else {
      // Excel: fetch JSON and generate client-side
      try {
        const res = await fetch(`/api/bills/export?period=${period}&format=json`);
        const result = await res.json();
        if (result.success) {
          generateExcel(result.data);
          toast.success('Excel 导出成功');
        }
      } catch {
        toast.error('导出失败');
      }
    }
  }

  function generateExcel(data: any) {
    const wb = XLSX.utils.book_new();

    // Orders sheet
    const orderRows = data.orders.map((o: any) => ({
      订单号: o.orderNo,
      日期: o.date,
      购买人: o.buyerName,
      电话: o.buyerPhone,
      金额: o.totalAmount,
      结算状态: o.settlementStatus,
      已结算: o.settledAmount,
      备注: o.notes,
    }));
    const ws1 = XLSX.utils.json_to_sheet(orderRows);
    XLSX.utils.book_append_sheet(wb, ws1, '订单明细');

    // Summary sheet
    const summaryRows = [{
      期间: data.period,
      总订单数: data.summary.totalOrders,
      总收入: data.summary.totalRevenue,
      已结算: data.summary.totalSettled,
      未结算: data.summary.totalRevenue - data.summary.totalSettled,
    }];
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, '汇总');

    XLSX.writeFile(wb, `账单_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;
  if (!billData) return null;

  const { kpis, settlementBreakdown, dailySales, topProducts, topOrders, inventoryChanges } = billData;

  const invTypeLabels: Record<string, string> = {
    sale: '销售出库',
    sale_reversal: '销售退回',
    manual_adjustment: '手动调整',
    restock: '入库',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">账单汇总</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="w-4 h-4 mr-2" />
            CSV导出
          </Button>
          <Button variant="outline" onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel导出
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['today', 'week', 'month', 'year'].map((p) => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {periodLabels[p]}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">总收入</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">¥{kpis.totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">订单数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{kpis.orderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">平均客单价</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">¥{kpis.avgOrderValue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Settlement Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>结算汇总</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settlementBreakdown.map((s) => (
              <div key={s.status} className="flex items-center justify-between py-2 border-b last:border-0">
                <Badge className={settlementColors[s.status] || 'bg-gray-100'}>
                  {settlementLabels[s.status] || s.status}
                </Badge>
                <div className="text-right">
                  <p className="font-medium">¥{s.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{s.count} 笔</p>
                </div>
              </div>
            ))}
            {settlementBreakdown.length === 0 && (
              <p className="text-center text-gray-500 py-4">无数据</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Sales Chart (simple table representation) */}
        <Card>
          <CardHeader>
            <CardTitle>每日销售趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dailySales.map((day) => (
                <div key={day.date} className="flex items-center gap-2">
                  <span className="text-xs w-20 truncate">{day.date}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden min-w-0">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${kpis.totalRevenue > 0 ? Math.max(5, (day.totalAmount / kpis.totalRevenue) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-20 text-right truncate">¥{day.totalAmount.toFixed(2)}</span>
                  <span className="text-xs text-gray-500 w-10 text-right">{day.orderCount}单</span>
                </div>
              ))}
              {dailySales.length === 0 && (
                <p className="text-center text-gray-500 py-4">无数据</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>畅销商品 TOP 10</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-sm text-gray-500">#</th>
                  <th className="text-left py-2 text-sm text-gray-500">商品</th>
                  <th className="text-right py-2 text-sm text-gray-500">销量</th>
                  <th className="text-right py-2 text-sm text-gray-500">收入</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.productId} className="border-b last:border-0">
                    <td className="py-2 text-sm text-gray-500">{i + 1}</td>
                    <td className="py-2 font-medium">{p.productName}</td>
                    <td className="py-2 text-right">{p.totalQuantity.toFixed(2)}</td>
                    <td className="py-2 text-right font-medium">¥{p.totalRevenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topProducts.length === 0 && (
              <p className="text-center text-gray-500 py-4">无数据</p>
            )}
          </CardContent>
        </Card>

        {/* Top Orders */}
        <Card>
          <CardHeader>
            <CardTitle>大额订单 TOP 10</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-sm text-gray-500">#</th>
                  <th className="text-left py-2 text-sm text-gray-500">订单号</th>
                  <th className="text-left py-2 text-sm text-gray-500">购买人</th>
                  <th className="text-right py-2 text-sm text-gray-500">金额</th>
                </tr>
              </thead>
              <tbody>
                {topOrders.map((o, i) => (
                  <tr key={o.orderNo} className="border-b last:border-0">
                    <td className="py-2 text-sm text-gray-500">{i + 1}</td>
                    <td className="py-2 font-mono text-sm">{o.orderNo}</td>
                    <td className="py-2">{o.buyerName || '-'}</td>
                    <td className="py-2 text-right font-medium">¥{o.totalAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topOrders.length === 0 && (
              <p className="text-center text-gray-500 py-4">无数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Changes */}
      <Card>
        <CardHeader>
          <CardTitle>库存变动汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {inventoryChanges.map((ic) => (
              <div key={ic.type} className="p-4 border rounded-lg">
                <p className="text-sm text-gray-500">{invTypeLabels[ic.type] || ic.type}</p>
                <p className="text-2xl font-bold mt-1">{ic.count} 次</p>
                <p className="text-sm text-gray-500">共 {ic.totalQuantity.toFixed(2)} 件</p>
              </div>
            ))}
            {inventoryChanges.length === 0 && (
              <p className="text-center text-gray-500 py-4 col-span-4">无数据</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
