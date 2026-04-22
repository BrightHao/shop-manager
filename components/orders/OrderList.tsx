'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, Pencil, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Order {
  id: number;
  orderNo: string;
  buyerName: string | null;
  totalAmount: string;
  settlementStatus: string;
  createdAt: string;
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

interface OrderListProps {
  onOrderDeleted?: () => void;
}

export default function OrderList({ onOrderDeleted }: OrderListProps) {
  const router = useRouter();
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filtersApplied, setFiltersApplied] = useState(0);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
    });
    if (buyerSearch) params.set('buyer', buyerSearch);
    if (settlementFilter) params.set('settlementStatus', settlementFilter);

    fetch(`/api/orders?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result.data);
          setTotalPages(result.meta.totalPages);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, buyerSearch, settlementFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApplyFilters = () => {
    setPage(1);
    setFiltersApplied((f) => f + 1);
  };

  const handleDelete = async (orderId: number, orderNo: string) => {
    if (!confirm(`确定要取消订单 ${orderNo} 吗？取消后将恢复库存。`)) return;
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('订单已取消，库存已恢复');
        fetchData();
        onOrderDeleted?.();
      } else {
        toast.error(result.error?.message || '取消失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: 'orderNo',
      header: '订单号',
      cell: (info) => <span className="font-mono text-sm">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: '日期',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString('zh-CN'),
    },
    {
      accessorKey: 'buyerName',
      header: '购买人',
      cell: (info) => (info.getValue() as string) || '-',
    },
    {
      accessorKey: 'totalAmount',
      header: '金额',
      cell: (info) => `¥${parseFloat(info.getValue() as string).toFixed(2)}`,
    },
    {
      accessorKey: 'settlementStatus',
      header: '结算状态',
      cell: (info) => {
        const status = info.getValue() as string;
        return (
          <Badge className={settlementColors[status] || 'bg-gray-100'}>
            {settlementLabels[status] || status}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '操作',
      cell: (info) => {
        const order = info.row.original;
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/orders/${order.id}/edit`)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(order.id, order.orderNo)}
              disabled={deletingId === order.id}
            >
              <XCircle className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">订单管理</h1>
        <Button onClick={() => router.push('/orders/new')}>
          <Plus className="w-4 h-4 mr-2" />
          新增订单
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="搜索购买人..."
          value={buyerSearch}
          onChange={(e) => setBuyerSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
          className="max-w-xs"
        />
        <Select value={settlementFilter} onValueChange={(v) => setSettlementFilter(v || '')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="结算状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部</SelectItem>
            <SelectItem value="unsettled">未结算</SelectItem>
            <SelectItem value="partially_settled">部分结算</SelectItem>
            <SelectItem value="settled">已结算</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleApplyFilters}>搜索</Button>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                  暂无订单数据
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-gray-500">第 {page} 页 / 共 {totalPages} 页</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
