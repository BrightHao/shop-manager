import { callShopApi } from "../api/shop";
import { useState, useEffect } from "react";

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  unit_price: string;
  stock_quantity: string;
  status: string;
  created_at: string;
}

const UNIT_HINT = "斤 / kg / 个";

function generateSku(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `SKU-${ts}`;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    unit: "",
    unitPrice: "",
    stockQuantity: "",
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

  const handleShowForm = () => {
    setEditingId(null);
    setShowForm(true);
    setFormData({
      name: "",
      sku: generateSku(),
      unit: "",
      unitPrice: "",
      stockQuantity: "",
    });
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setShowForm(true);
    setFormData({
      name: p.name,
      sku: p.sku || "",
      unit: p.unit || "",
      unitPrice: p.unit_price || "",
      stockQuantity: p.stock_quantity || "",
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      alert("请输入商品名称");
      return;
    }
    if (!formData.sku.trim()) {
      alert("SKU编码不能为空");
      return;
    }
    try {
      await callShopApi("products.create", {
        name: formData.name,
        sku: formData.sku,
        unit: formData.unit || "个",
        unitPrice: formData.unitPrice || "0",
        stockQuantity: formData.stockQuantity || "0",
      });
      setShowForm(false);
      setEditingId(null);
      fetchProducts();
    } catch (e) {
      alert("创建失败");
    }
  };

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      alert("请输入商品名称");
      return;
    }
    try {
      await callShopApi("products.update", {
        id: editingId,
        name: formData.name,
        sku: formData.sku,
        unit: formData.unit,
        unitPrice: formData.unitPrice,
        stockQuantity: formData.stockQuantity,
      });
      setShowForm(false);
      setEditingId(null);
      fetchProducts();
    } catch (e) {
      alert("更新失败");
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
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">商品管理</h1>
        <button
          onClick={handleShowForm}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 sm:px-4 sm:py-2 sm:text-sm"
        >
          新增商品
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold sm:text-lg">
              {editingId ? "编辑商品" : "新增商品"}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              取消
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
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
                placeholder="自动生成"
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
                placeholder={`如：${UNIT_HINT}`}
              />
              <p className="mt-1 text-xs text-gray-400">例：{UNIT_HINT}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                单价(元)
              </label>
              <input
                type="number"
                value={formData.unitPrice}
                onChange={(e) =>
                  setFormData({ ...formData, unitPrice: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="如：12.50"
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
                placeholder="请输入初始库存"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              className="mt-4 rounded-lg bg-green-600 px-6 py-2 text-sm text-white hover:bg-green-700"
            >
              {editingId ? "确认更新" : "确认创建"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="mt-4 rounded-lg border px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
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
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border sm:block">
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
                      ¥{parseFloat(p.unit_price || "0").toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {parseFloat(p.stock_quantity || "0").toFixed(0)}
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
                        onClick={() => handleEdit(p)}
                        className="mr-2 text-blue-600 hover:text-blue-800"
                      >
                        编辑
                      </button>
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

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {p.status === "active" ? "在售" : "下架"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>SKU: {p.sku || "-"}</div>
                  <div>单位: {p.unit}</div>
                  <div>
                    库存: {parseFloat(p.stock_quantity || "0").toFixed(0)}
                  </div>
                  <div className="font-medium text-gray-700">
                    ¥{parseFloat(p.unit_price || "0").toFixed(2)}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-4">
                  <button
                    onClick={() => handleEdit(p)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="py-8 text-center text-gray-400">暂无商品数据</div>
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
