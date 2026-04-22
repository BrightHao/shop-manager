'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { Loader2, Package, ShoppingCart, BarChart3, Users, Settings, LogOut } from 'lucide-react';

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator';
}

const navItems = [
  { href: '/dashboard', label: '仪表盘', icon: BarChart3, admin: false },
  { href: '/products', label: '商品管理', icon: Package, admin: false },
  { href: '/orders', label: '订单管理', icon: ShoppingCart, admin: false },
  { href: '/bills', label: '账单汇总', icon: BarChart3, admin: false },
  { href: '/settings', label: '系统设置', icon: Settings, admin: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data.user);
        } else {
          router.push('/login');
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
        setLoading(false);
      });
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r transition-all duration-300 flex flex-col fixed lg:static h-full z-50`}>
        <div className="p-4 border-b flex items-center justify-between">
          {sidebarOpen && <span className="font-bold text-lg">店铺管理</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-gray-100">
            <span className="text-xl">{sidebarOpen ? '◀' : '▶'}</span>
          </button>
        </div>
        <nav className="flex-1 py-2">
          {navItems
            .filter((item) => !item.admin || user?.role === 'admin')
            .map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 cursor-pointer"
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            ))}
        </nav>
        <div className="p-4 border-t">
          {sidebarOpen && (
            <div className="mb-3">
              <p className="font-medium text-sm truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>退出登录</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
