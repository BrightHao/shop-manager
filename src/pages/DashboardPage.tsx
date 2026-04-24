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
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <h1 className="mb-4 text-xl font-bold sm:mb-6 sm:text-2xl">数据概览</h1>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-6 lg:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-base font-semibold sm:text-lg">最近订单</h2>
          </div>
          <div className="divide-y">
            {data.recentOrders.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 sm:px-6 sm:py-8">
                暂无订单
              </div>
            ) : (
              data.recentOrders.map((o: any) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {o.order_no}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {o.buyer_name || "匿名"} ·{" "}
                      {new Date(o.created_at).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <div className="text-sm font-medium">
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
          <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-base font-semibold sm:text-lg">库存预警</h2>
          </div>
          <div className="divide-y">
            {data.lowStockProducts.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 sm:px-6 sm:py-8">
                暂无预警
              </div>
            ) : (
              data.lowStockProducts.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{p.name}</div>
                    <div className="truncate text-xs text-gray-500">
                      SKU: {p.sku || "-"}
                    </div>
                  </div>
                  <div
                    className={`ml-3 shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
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
      <div
        className={`bg-gradient-to-r ${colorMap[color]} p-3 text-white sm:p-6`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-90 sm:text-sm">{title}</p>
            <p className="mt-0.5 text-lg font-bold sm:mt-1 sm:text-2xl">
              {value}
            </p>
          </div>
          <span className="text-xl opacity-80 sm:text-3xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
