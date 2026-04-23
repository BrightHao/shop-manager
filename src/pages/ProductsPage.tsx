import { callShopApi } from "../api/shop";
import { useState, useEffect } from "react";

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  unitPrice: string;
  stockQuantity: string;
  status: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    unit: "个",
    unitPrice: "0",
    stockQuantity: "0",
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await callShopApi("products.list", { page, limit, keyword });
      if (res.data) {
        setProducts(res.data);
        setTotal(res.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, keyword]);

  const totalPages = Math.ceil(total / limit);

  const handleCreate = async () => {
    try {
      await callShopApi("products.create", { ...formData });
      setShowForm(false);
      setFormData({
        name: "",
        sku: "",
        unit: "个",
        unitPrice: "0",
        stockQuantity: "0",
      });
      fetchProducts();
    } catch (e) {
      alert("创建失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此商品吗？")) return;
    try {
      await callShopApi("products.delete", { id });
      fetchProducts();
    } catch (e) {
      alert("删除失败");
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">商品管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {showForm ? "取消" : "新增商品"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">新增商品</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                商品名称
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="请输入商品名称"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                SKU编码
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="请输入SKU编码"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">单位</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">单价</label>
              <input
                type="number"
                value={formData.unitPrice}
                onChange={(e) =>
                  setFormData({ ...formData, unitPrice: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                库存数量
              </label>
              <input
                type="number"
                value={formData.stockQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, stockQuantity: e.target.value })
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
        <input
          type="text"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          placeholder="搜索商品名称或SKU..."
          className="w-full max-w-md rounded-md border px-4 py-2 text-sm"
        />
      </div>

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
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">商品名称</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">单位</th>
                  <th className="px-4 py-3 font-medium">单价</th>
                  <th className="px-4 py-3 font-medium">库存</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{p.id}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.sku || "-"}</td>
                    <td className="px-4 py-3">{p.unit}</td>
                    <td className="px-4 py-3">
                      ¥{parseFloat(p.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {parseFloat(p.stockQuantity).toFixed(0)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          p.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {p.status === "active" ? "在售" : "下架"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      暂无商品数据
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
