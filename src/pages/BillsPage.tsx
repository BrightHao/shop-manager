import { useState, useEffect } from "react";
import { callShopApi } from "../api/shop";

interface Bill {
  id: number;
  product_name: string;
  transaction_type: string;
  quantity_change: string;
  quantity_before: string;
  quantity_after: string;
  reference_type: string;
  notes: string;
  created_at: string;
}

const TX_TYPE_MAP: Record<string, string> = {
  initial: "初始入库",
  in: "入库",
  out: "出库",
  adjustment: "调整",
};

const REF_TYPE_MAP: Record<string, string> = {
  product_create: "商品创建",
  order: "订单出库",
  adjustment: "库存调整",
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await callShopApi("bills.list", { page, limit });
      if (res.data) {
        setBills(res.data);
        setTotal(res.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <h1 className="mb-4 text-xl font-bold sm:mb-6 sm:text-2xl">库存流水</h1>

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
                  <th className="px-4 py-3 font-medium">商品</th>
                  <th className="px-4 py-3 font-medium">变动类型</th>
                  <th className="px-4 py-3 font-medium">变动前</th>
                  <th className="px-4 py-3 font-medium">变动量</th>
                  <th className="px-4 py-3 font-medium">变动后</th>
                  <th className="px-4 py-3 font-medium">关联类型</th>
                  <th className="px-4 py-3 font-medium">备注</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {b.product_name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {TX_TYPE_MAP[b.transaction_type] || b.transaction_type}
                    </td>
                    <td className="px-4 py-3">
                      {parseFloat(b.quantity_before).toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${parseFloat(b.quantity_change) >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {parseFloat(b.quantity_change) >= 0 ? "+" : ""}
                      {parseFloat(b.quantity_change).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {parseFloat(b.quantity_after).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {REF_TYPE_MAP[b.reference_type] || b.reference_type}
                    </td>
                    <td className="px-4 py-3">{b.notes || "-"}</td>
                    <td className="px-4 py-3">
                      {new Date(b.created_at).toLocaleString("zh-CN")}
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      暂无库存流水记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {bills.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{b.product_name || "-"}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      parseFloat(b.quantity_change) >= 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {parseFloat(b.quantity_change) >= 0 ? "+" : ""}
                    {parseFloat(b.quantity_change).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  <div>
                    类型:{" "}
                    {TX_TYPE_MAP[b.transaction_type] || b.transaction_type}
                  </div>
                  <div>
                    库存: {parseFloat(b.quantity_before).toFixed(2)} →{" "}
                    {parseFloat(b.quantity_after).toFixed(2)}
                  </div>
                  <div>
                    关联: {REF_TYPE_MAP[b.reference_type] || b.reference_type}
                  </div>
                  {b.notes && <div>备注: {b.notes}</div>}
                  <div className="text-gray-400">
                    {new Date(b.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            ))}
            {bills.length === 0 && (
              <div className="py-8 text-center text-gray-400">
                暂无库存流水记录
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
              <span>
                共 {total} 条，第 {page}/{totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded border px-3 py-1 disabled:opacity-50 hover:bg-gray-50"
                >
                  上一页
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded border px-3 py-1 disabled:opacity-50 hover:bg-gray-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
