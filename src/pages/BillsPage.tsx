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
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">库存流水</h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
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
                    <td className="px-4 py-3">{b.transaction_type}</td>
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
                    <td className="px-4 py-3">{b.reference_type}</td>
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

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                共 {total} 条记录，第 {page}/{totalPages} 页
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
