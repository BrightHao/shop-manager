import { callShopApi } from "../api/shop";
import { useState, useEffect, useRef, useCallback } from "react";
import Modal from "../components/Modal";

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  unit_price: string;
  cost_price: string;
  stock_quantity: string;
  status: string;
  category_id: number | null;
  category_name: string | null;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
  sort_order: number;
}

const UNIT_HINT = "斤 / kg / 个";

function generateSku(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `SKU-${ts}`;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const limit = 20;

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Restock state
  const [restockTarget, setRestockTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [restockQuantity, setRestockQuantity] = useState("");
  const [restockNotes, setRestockNotes] = useState("");
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    unit: "",
    unitPrice: "",
    costPrice: "",
    stockQuantity: "",
    categoryId: "" as number | string,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchProducts = useCallback(
    async (pageNum: number, reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await callShopApi("products.list", {
          page: pageNum,
          limit,
          keyword,
        });
        if (res.data) {
          setProducts((prev) => (reset ? res.data : [...prev, ...res.data]));
          setTotal(res.total || 0);
          setHasMore((res.data as Product[]).length >= limit);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [loading, keyword, limit],
  );

  // Load categories
  useEffect(() => {
    callShopApi("products.categories")
      .then((res) => {
        if (Array.isArray(res)) setCategories(res);
      })
      .catch(console.error);
  }, []);

  // Initial load and keyword change
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
    fetchProducts(1, true);
  }, [keyword]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchProducts(nextPage);
        }
      },
      { rootMargin: "100px" },
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, fetchProducts]);

  const handleShowForm = () => {
    setEditingId(null);
    setShowForm(true);
    setFormData({
      name: "",
      sku: generateSku(),
      unit: "",
      unitPrice: "",
      costPrice: "",
      stockQuantity: "",
      categoryId: "",
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
      costPrice: p.cost_price || "",
      stockQuantity: p.stock_quantity || "",
      categoryId: p.category_id ?? "",
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("请输入商品名称");
      return;
    }
    if (!formData.sku.trim()) {
      alert("SKU编码不能为空");
      return;
    }
    setFormSubmitting(true);
    try {
      if (editingId) {
        await callShopApi("products.update", {
          id: editingId,
          name: formData.name,
          sku: formData.sku,
          unit: formData.unit || "个",
          unitPrice: formData.unitPrice || "0",
          costPrice: formData.costPrice || "0",
          stockQuantity: formData.stockQuantity || "0",
          categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        });
      } else {
        await callShopApi("products.create", {
          name: formData.name,
          sku: formData.sku,
          unit: formData.unit || "个",
          unitPrice: formData.unitPrice || "0",
          costPrice: formData.costPrice || "0",
          stockQuantity: formData.stockQuantity || "0",
          categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        });
      }
      setShowForm(false);
      setEditingId(null);
      // Reset and reload
      setProducts([]);
      setPage(1);
      setHasMore(true);
      fetchProducts(1, true);
    } catch (e) {
      alert(editingId ? "更新失败" : "创建失败");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此商品吗？")) return;
    try {
      await callShopApi("products.delete", { id });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotal((prev) => prev - 1);
    } catch (e) {
      alert("删除失败");
    }
  };

  const handleRestock = async () => {
    if (!restockTarget) return;
    const qty = parseFloat(restockQuantity);
    if (!qty || qty <= 0) {
      alert("请输入有效的进货数量");
      return;
    }
    setRestockSubmitting(true);
    try {
      await callShopApi("products.restock", {
        productId: restockTarget.id,
        quantity: restockQuantity,
        notes: restockNotes || "",
      });
      setRestockTarget(null);
      setRestockQuantity("");
      setRestockNotes("");
      // Refresh list
      setProducts([]);
      setPage(1);
      fetchProducts(1, true);
    } catch (e) {
      alert("进货失败");
    } finally {
      setRestockSubmitting(false);
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

      <div className="mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索商品名称..."
          className="w-full max-w-md rounded-md border px-4 py-2 text-sm"
        />
      </div>

      {loading && products.length === 0 ? (
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
                  <th className="px-4 py-3 font-medium">分类</th>
                  <th className="px-4 py-3 font-medium">单位</th>
                  <th className="px-4 py-3 font-medium">进货价</th>
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
                    <td className="px-4 py-3 text-gray-500">
                      {p.category_name || "-"}
                    </td>
                    <td className="px-4 py-3">{p.unit}</td>
                    <td className="px-4 py-3">
                      ¥{parseFloat(p.cost_price || "0").toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      ¥{parseFloat(p.unit_price || "0").toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {parseFloat(p.stock_quantity || "0").toFixed(2)}
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
                        onClick={() =>
                          setRestockTarget({ id: p.id, name: p.name })
                        }
                        className="mr-2 text-green-600 hover:text-green-800"
                      >
                        进货
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
                      colSpan={9}
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
                <div className="grid grid-cols-4 gap-2 text-xs text-gray-500">
                  <div>单位: {p.unit}</div>
                  <div>进货: ¥{parseFloat(p.cost_price || "0").toFixed(2)}</div>
                  <div>售价: ¥{parseFloat(p.unit_price || "0").toFixed(2)}</div>
                  <div>
                    库存: {parseFloat(p.stock_quantity || "0").toFixed(2)}
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
                    onClick={() => setRestockTarget({ id: p.id, name: p.name })}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    进货
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

          {/* Load more sentinel */}
          <div ref={sentinelRef} className="h-px" />

          {loading && products.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            </div>
          )}

          {!hasMore && products.length > 0 && (
            <div className="py-4 text-center text-sm text-gray-400">
              已加载全部 {total} 条数据
            </div>
          )}
        </>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <Modal
          title={editingId ? "编辑商品" : "新增商品"}
          open
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          maxWidth="max-w-lg"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                商品名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="请输入商品名称"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  SKU编码 *
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="SKU编码"
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
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  进货价(元)
                </label>
                <input
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, costPrice: e.target.value })
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="如：8.00"
                  step="0.01"
                />
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
                  step="0.01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  库存数量 {editingId ? "(留空不变)" : ""}
                </label>
                <input
                  type="number"
                  value={formData.stockQuantity}
                  onChange={(e) =>
                    setFormData({ ...formData, stockQuantity: e.target.value })
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="请输入初始库存"
                  step="0.01"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  商品分类
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryId: e.target.value })
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">无分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={formSubmitting}
              className="rounded-lg bg-green-600 px-6 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {formSubmitting
                ? "提交中..."
                : editingId
                  ? "确认更新"
                  : "确认创建"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="rounded-lg border px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </Modal>
      )}

      {/* Restock Modal */}
      {restockTarget && (
        <Modal
          title={`进货 - ${restockTarget.name}`}
          open
          onClose={() => {
            setRestockTarget(null);
            setRestockQuantity("");
            setRestockNotes("");
          }}
          maxWidth="max-w-sm"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                进货数量
              </label>
              <input
                type="number"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="请输入进货数量"
                min="0.01"
                step="0.01"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">备注</label>
              <input
                type="text"
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="可选"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleRestock}
              disabled={restockSubmitting}
              className="rounded-lg bg-green-600 px-6 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {restockSubmitting ? "提交中..." : "确认进货"}
            </button>
            <button
              onClick={() => {
                setRestockTarget(null);
                setRestockQuantity("");
                setRestockNotes("");
              }}
              className="rounded-lg border px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
