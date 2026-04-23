import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { callShopApi } from "../api/shop";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  status: string;
  created_at: string;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "users">("account");

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">系统设置</h1>

      <div className="mb-6 flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("account")}
          className={`rounded-t px-4 py-2 text-sm ${
            activeTab === "account"
              ? "border-b-2 border-blue-600 font-medium text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          账户信息
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`rounded-t px-4 py-2 text-sm ${
            activeTab === "users"
              ? "border-b-2 border-blue-600 font-medium text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          用户管理
        </button>
      </div>

      {activeTab === "account" && <AccountInfo user={user} logout={logout} />}
      {activeTab === "users" && <UserManagement />}
    </div>
  );
}

function AccountInfo({ user, logout }: { user: any; logout: () => void }) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">当前账户</h2>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between border-b pb-2">
          <span className="text-gray-500">用户ID</span>
          <span>{user?.uid}</span>
        </div>
        <div className="flex justify-between border-b pb-2">
          <span className="text-gray-500">用户名</span>
          <span>{user?.username || "-"}</span>
        </div>
      </div>
      <button
        onClick={logout}
        className="mt-6 rounded-lg bg-red-600 px-6 py-2 text-sm text-white hover:bg-red-700"
      >
        退出登录
      </button>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    passwordHash: "",
    role: "operator",
    phone: "",
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await callShopApi("users.list", { page: 1, limit: 50 });
      if (res.data) setUsers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    try {
      await callShopApi("users.create", formData);
      setShowForm(false);
      setFormData({
        name: "",
        email: "",
        passwordHash: "",
        role: "operator",
        phone: "",
      });
      fetchUsers();
    } catch (e) {
      alert("创建用户失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此用户吗？")) return;
    try {
      await callShopApi("users.delete", { id });
      fetchUsers();
    } catch (e) {
      alert("删除用户失败");
    }
  };

  return (
    <div>
      {showForm && (
        <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">新增用户</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-600">姓名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">邮箱</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">密码</label>
              <input
                type="password"
                value={formData.passwordHash}
                onChange={(e) =>
                  setFormData({ ...formData, passwordHash: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">角色</label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="operator">操作员</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">手机</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="mt-4 rounded-lg bg-green-600 px-6 py-2 text-sm text-white hover:bg-green-700"
          >
            确认创建
          </button>
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {showForm ? "取消" : "新增用户"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">邮箱</th>
                <th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">手机</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{u.id}</td>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role === "admin" ? "管理员" : "操作员"}
                  </td>
                  <td className="px-4 py-3">{u.phone || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {u.status === "active" ? "正常" : "禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(u.created_at).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    暂无用户数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
