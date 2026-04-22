'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, Shield, UserMinus, UserCheck } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  phone: string | null;
  status: 'active' | 'disabled';
  createdAt: string;
}

const roleLabels: Record<string, string> = { admin: '管理员', operator: '操作员' };
const roleColors: Record<string, string> = { admin: 'bg-purple-100 text-purple-800', operator: 'bg-blue-100 text-blue-800' };
const statusLabels: Record<string, string> = { active: '正常', disabled: '已禁用' };
const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-800', disabled: 'bg-gray-100 text-gray-800' };

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'operator' as 'admin' | 'operator', phone: '' });
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editing, setEditing] = useState(false);

  // Password reset
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?page=${page}&limit=20`);
      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
        setTotalPages(result.meta.totalPages);
      }
    } catch {
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('请填写必填字段');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('用户创建成功');
        setCreateOpen(false);
        setNewUser({ name: '', email: '', password: '', role: 'operator', phone: '' });
        fetchUsers();
      } else {
        toast.error(result.error?.message || '创建失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate() {
    if (!editUser) return;
    setEditing(true);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole, status: editStatus }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('用户已更新');
        setEditOpen(false);
        fetchUsers();
      } else {
        toast.error(result.error?.message || '更新失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setEditing(false);
    }
  }

  async function handleResetPassword() {
    if (!editUser || !resetPassword) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changePassword', currentPassword: '', newPassword: resetPassword }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('密码已重置');
        setResetOpen(false);
        setResetPassword('');
      } else {
        toast.error(result.error?.message || '重置失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setResetting(false);
    }
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: '姓名',
      cell: (info) => info.getValue() as string,
    },
    {
      accessorKey: 'email',
      header: '邮箱',
      cell: (info) => info.getValue() as string,
    },
    {
      accessorKey: 'role',
      header: '角色',
      cell: (info) => {
        const role = info.getValue() as string;
        return <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>;
      },
    },
    {
      accessorKey: 'phone',
      header: '电话',
      cell: (info) => (info.getValue() as string) || '-',
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: (info) => {
        const status = info.getValue() as string;
        return <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: '创建时间',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString('zh-CN'),
    },
    {
      id: 'actions',
      header: '操作',
      cell: (info) => {
        const user = info.row.original;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => {
              setEditUser(user);
              setEditRole(user.role);
              setEditStatus(user.status);
              setEditOpen(true);
            }}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              setEditUser(user);
              setResetPassword('');
              setResetOpen(true);
            }}>
              <Shield className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: users,
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
        <h1 className="text-3xl font-bold">用户管理</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          创建用户
        </Button>
      </div>

      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                  暂无用户数据
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">第 {page} 页 / 共 {totalPages} 页</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription>填写用户信息创建新账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>邮箱 *</Label>
              <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>密码 *</Label>
              <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>电话</Label>
              <Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: (v || 'operator') as 'admin' | 'operator' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">操作员</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? '创建中...' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <span className="text-sm text-gray-500">姓名</span>
              <p className="font-medium">{editUser?.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">邮箱</span>
              <p className="font-medium">{editUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v || 'operator')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">操作员</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v || 'active')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="disabled">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editing}>取消</Button>
            <Button onClick={handleUpdate} disabled={editing}>{editing ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码 - {editUser?.name}</DialogTitle>
            <DialogDescription>为该用户设置新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="至少6位" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>取消</Button>
            <Button onClick={handleResetPassword} disabled={resetting || !resetPassword}>{resetting ? '重置中...' : '重置密码'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
