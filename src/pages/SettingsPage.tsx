import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { callShopApi } from "../api/shop";
import { formatDate } from "../utils/date";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "users">("account");

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <h1 className="mb-4 text-xl font-bold sm:mb-6 sm:text-2xl">系统设置</h1>

      <div className="mb-4 flex gap-2 border-b sm:mb-6">
        <button
          onClick={() => setActiveTab("account")}
          className={`rounded-t px-3 py-2 text-sm ${
            activeTab === "account"
              ? "border-b-2 border-blue-600 font-medium text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          账户信息
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`rounded-t px-3 py-2 text-sm ${
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
    <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-base font-semibold sm:text-lg">当前账户</h2>
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
        className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 sm:px-6"
      >
        退出登录
      </button>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      await callShopApi("users.syncAll");
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
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">说明</p>
        <p className="mt-1 text-blue-700">
          用户注册/登录后会自动同步到本列表。如需重置密码，请前往 CloudBase
          控制台 → 用户管理 操作。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">用户名</th>
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
                    <td className="px-4 py-3">{formatDate(u.created_at)}</td>
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

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {users.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{u.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      u.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {u.status === "active" ? "正常" : "禁用"}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  <div>邮箱: {u.email}</div>
                  <div>角色: {u.role === "admin" ? "管理员" : "操作员"}</div>
                  {u.phone && <div>手机: {u.phone}</div>}
                  <div className="text-gray-400">
                    {formatDate(u.created_at)}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="py-8 text-center text-gray-400">暂无用户数据</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
