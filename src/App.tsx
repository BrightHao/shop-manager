import { useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import OrdersPage from "./pages/OrdersPage";
import BillsPage from "./pages/BillsPage";
import SettingsPage from "./pages/SettingsPage";

function HamburgerIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function Sidebar({
  user,
  menuItems,
  isActive,
  onNavigate,
  onLogout,
  onClose,
}: {
  user: any;
  menuItems: { path: string; label: string }[];
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  return (
    <aside className="flex h-full flex-col bg-white shadow-md">
      <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-gray-800 sm:text-lg">
            商店管理
          </h1>
          {user && (
            <p className="mt-1 text-xs text-gray-400">{user.username}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 sm:hidden"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <nav className="flex-1 p-3">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => {
              onNavigate(item.path);
              onClose?.();
            }}
            className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition sm:px-4 sm:py-2.5 ${
              isActive(item.path)
                ? "bg-blue-50 font-medium text-blue-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="px-3 pb-4 sm:px-6">
        <button
          onClick={onLogout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 sm:px-4"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { path: "/", label: "数据概览" },
    { path: "/products", label: "商品管理" },
    { path: "/orders", label: "订单管理" },
    { path: "/bills", label: "库存流水" },
    { path: "/settings", label: "系统设置" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, visible on sm+ */}
      <div className="hidden w-56 sm:block">
        <Sidebar
          user={user}
          menuItems={menuItems}
          isActive={isActive}
          onNavigate={navigate}
          onLogout={logout}
        />
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-56 transform transition-transform sm:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          user={user}
          menuItems={menuItems}
          isActive={isActive}
          onNavigate={navigate}
          onLogout={logout}
          onClose={() => setMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <main className="flex w-full flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center border-b bg-white px-4 py-3 shadow-sm sm:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded p-1 text-gray-600 hover:bg-gray-100"
          >
            <HamburgerIcon />
          </button>
          <span className="ml-3 font-medium text-gray-800">商店管理</span>
        </header>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return <AppContent />;
}
