import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import OrdersPage from "./pages/OrdersPage";
import BillsPage from "./pages/BillsPage";
import SettingsPage from "./pages/SettingsPage";

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

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
      {/* Sidebar */}
      <aside className="w-56 bg-white shadow-md">
        <div className="border-b px-6 py-5">
          <h1 className="text-lg font-bold text-gray-800">商店管理</h1>
          {user && (
            <p className="mt-1 text-xs text-gray-400">{user.username}</p>
          )}
        </div>
        <nav className="p-3">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`mb-1 w-full rounded-lg px-4 py-2.5 text-left text-sm transition ${
                isActive(item.path)
                  ? "bg-blue-50 font-medium text-blue-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 w-48 px-3">
          <button
            onClick={logout}
            className="w-full rounded-lg px-4 py-2 text-left text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
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
