import { useState, useEffect } from "react";
import { callShopApi } from "../api/shop";

interface DashboardData {
  users: number;
  products: number;
  orders: number;
  totalAmount: number;
  recentOrders: any[];
  lowStockProducts: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callShopApi("dashboard")
      .then((res) => {
        if (res) setData(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!data)
    return <div className="py-8 text-center text-gray-500">加载失败</div>;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">数据概览</h1>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="用户总数" value={data.users} color="blue" icon="👥" />
        <StatCard
          title="商品总数"
          value={data.products}
          color="green"
          icon="📦"
        />
        <StatCard
          title="订单总数"
          value={data.orders}
          color="purple"
          icon="📋"
        />
        <StatCard
          title="订单总金额"
          value={`¥${data.totalAmount.toFixed(2)}`}
          color="orange"
          icon="💰"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">最近订单</h2>
          </div>
          <div className="divide-y">
            {data.recentOrders.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                暂无订单
              </div>
            ) : (
              data.recentOrders.map((o: any) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div>
                    <div className="font-medium">{o.order_no}</div>
                    <div className="text-xs text-gray-500">
                      {o.buyer_name || "匿名"} ·{" "}
                      {new Date(o.created_at).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      ¥{parseFloat(o.total_amount).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {o.settlement_status === "settled" ? "已结算" : "未结算"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">库存预警</h2>
          </div>
          <div className="divide-y">
            {data.lowStockProducts.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                暂无预警
              </div>
            ) : (
              data.lowStockProducts.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      SKU: {p.sku || "-"}
                    </div>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      parseFloat(p.stock_quantity) <= 0
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {parseFloat(p.stock_quantity).toFixed(0)} 件
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: string | number;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    orange: "from-orange-500 to-orange-600",
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm">
      <div className={`bg-gradient-to-r ${colorMap[color]} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <span className="text-3xl opacity-80">{icon}</span>
        </div>
      </div>
    </div>
  );
}
