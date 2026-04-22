'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Archive, Plus } from 'lucide-react';
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

interface Product {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  unitPrice: string;
  stockQuantity: string;
  status: string;
  createdAt: string;
}

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: '商品名称',
    cell: (info) => <span className="font-medium">{info.getValue() as string}</span>,
  },
  {
    accessorKey: 'sku',
    header: 'SKU',
    cell: (info) => info.getValue() as string || '-',
  },
  {
    accessorKey: 'unit',
    header: '单位',
  },
  {
    accessorKey: 'unitPrice',
    header: '单价',
    cell: (info) => `¥${parseFloat(info.getValue() as string).toFixed(2)}`,
  },
  {
    accessorKey: 'stockQuantity',
    header: '库存',
    cell: (info) => {
      const qty = parseFloat(info.getValue() as string);
      const color = qty <= 0 ? 'bg-red-100 text-red-800' : qty <= 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
      return <Badge className={color}>{qty}</Badge>;
    },
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: (info) => (
      <Badge variant={info.getValue() === 'active' ? 'default' : 'secondary'}>
        {info.getValue() === 'active' ? '正常' : '已归档'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: '操作',
    cell: (info) => {
      const router = useRouter();
      const product = info.row.original;
      return (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/products/${product.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {product.status === 'active' && (
            <Button variant="ghost" size="sm" className="text-red-600">
              <Archive className="w-4 h-4" />
            </Button>
          )}
        </div>
      );
    },
  },
];

export default function ProductList() {
  const router = useRouter();
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...(search ? { search } : {}),
    });

    fetch(`/api/products?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result.data);
          setTotalPages(result.meta.totalPages);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search]);

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
        <h1 className="text-3xl font-bold">商品管理</h1>
        <Button onClick={() => router.push('/products/new')}>
          <Plus className="w-4 h-4 mr-2" />
          新增商品
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="搜索商品名称..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table className="min-w-[600px]">
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
                  暂无商品数据
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
        <span className="text-sm text-gray-500">
          第 {page} 页
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
