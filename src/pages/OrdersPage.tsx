import { useAuth } from "../context/AuthContext";
import { callShopApi } from "../api/shop";
import { useState, useEffect, useRef, useCallback } from "react";
import { formatDateTime } from "../utils/date";
import Modal from "../components/Modal";

interface OrderItem {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  quantity: string;
  unit_price: string;
  total_price: string;
}

interface Order {
  id: number;
  order_no: string;
  buyer_name: string;
  buyer_phone: string;
  total_amount: string;
  settlement_status: string;
  settled_amount: string;
  notes: string;
  created_at: string;
  items?: string[];
  fullItems?: OrderItem[];
}

interface ProductOption {
  id: number;
  name: string;
  unit_price: string;
}

function ProductSearch({
  value,
  products,
  onSelect,
}: {
  value: string;
  products: ProductOption[];
  onSelect: (p: ProductOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered.length === 1) {
            onSelect(filtered[0]);
            setSearch(filtered[0].name);
            setOpen(false);
          }
        }}
        placeholder="搜索商品名称..."
        className="w-40 rounded-md border px-2 py-1.5 text-sm"
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-md border bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">无匹配商品</div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelect(p);
                  setSearch(p.name);
                  setOpen(false);
                }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
              >
                {p.name}{" "}
                <span className="text-gray-400">
                  ¥{parseFloat(p.unit_price || "0").toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editOrderData, setEditOrderData] = useState<Order | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">(
    "all",
  );
  const [productKeyword, setProductKeyword] = useState("");
  const limit = 20;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchOrders = useCallback(
    async (pageNum: number, reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await callShopApi("orders.list", {
          page: pageNum,
          limit,
          ...(paymentFilter !== "all" && { paymentStatus: paymentFilter }),
          ...(productKeyword && { productKeyword }),
        });
        if (res.data) {
          setOrders((prev) => (reset ? res.data : [...prev, ...res.data]));
          setTotal(res.total || 0);
          setHasMore((res.data as Order[]).length >= limit);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [loading, paymentFilter, productKeyword, limit],
  );

  // Initial load and filter change
  useEffect(() => {
    setPage(1);
    setOrders([]);
    setHasMore(true);
    fetchOrders(1, true);
  }, [paymentFilter, productKeyword]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchOrders(nextPage);
        }
      },
      { rootMargin: "100px" },
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, fetchOrders]);

  const handleEdit = async (orderId: number) => {
    try {
      const order = await callShopApi("orders.get", { id: orderId });
      if (order) {
        setEditingOrderId(orderId);
        setEditOrderData(order);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">订单管理</h1>
        <div className="flex items-center gap-2">
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value as "all" | "paid" | "unpaid");
            }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">全部</option>
            <option value="paid">已付款</option>
            <option value="unpaid">未付款</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 sm:px-4 sm:py-2 sm:text-sm"
          >
            {showForm ? "取消" : "新增订单"}
          </button>
        </div>
      </div>

      {/* Product search */}
      <div className="mb-4">
        <input
          type="text"
          value={productKeyword}
          onChange={(e) => setProductKeyword(e.target.value)}
          placeholder="按商品名称搜索订单..."
          className="w-full max-w-md rounded-md border px-4 py-2 text-sm"
        />
      </div>

      {showForm && (
        <Modal title="新增订单" open onClose={() => setShowForm(false)}>
          <NewOrderForm
            onCancel={() => setShowForm(false)}
            onDone={() => {
              setShowForm(false);
              setOrders([]);
              setPage(1);
              fetchOrders(1, true);
            }}
          />
        </Modal>
      )}

      {editingOrderId && editOrderData && (
        <Modal
          title="修改订单"
          open
          onClose={() => {
            setEditingOrderId(null);
            setEditOrderData(null);
          }}
        >
          <NewOrderForm
            orderId={editingOrderId}
            initialData={editOrderData}
            onCancel={() => {
              setEditingOrderId(null);
              setEditOrderData(null);
            }}
            onDone={() => {
              setEditingOrderId(null);
              setEditOrderData(null);
              setOrders([]);
              setPage(1);
              fetchOrders(1, true);
            }}
          />
        </Modal>
      )}

      {detailOrderId && (
        <Modal title="订单详情" open onClose={() => setDetailOrderId(null)}>
          <OrderDetail id={detailOrderId} />
        </Modal>
      )}

      {loading && orders.length === 0 ? (
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
                  <th className="px-4 py-3 font-medium">买家</th>
                  <th className="px-4 py-3 font-medium">联系电话</th>
                  <th className="px-4 py-3 font-medium">金额</th>
                  <th className="px-4 py-3 font-medium">结算状态</th>
                  <th className="px-4 py-3 font-medium">备注</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const productNames = o.items?.join("、") || o.order_no;
                  const truncated =
                    productNames.length > 7
                      ? productNames.slice(0, 7) + "..."
                      : productNames;
                  return (
                    <tr key={o.id} className="border-t hover:bg-gray-50">
                      <td
                        className="max-w-[150px] truncate px-4 py-3 font-medium"
                        title={productNames}
                      >
                        {truncated}
                      </td>
                      <td className="px-4 py-3">{o.buyer_name || "-"}</td>
                      <td className="px-4 py-3">{o.buyer_phone || "-"}</td>
                      <td className="px-4 py-3">
                        ¥{parseFloat(o.total_amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            o.settlement_status === "settled"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {o.settlement_status === "settled"
                            ? "已结算"
                            : "未结算"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {o.notes
                          ? o.notes.length > 20
                            ? o.notes.substring(0, 20) + "..."
                            : o.notes
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(o.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleEdit(o.id)}
                          className="mr-2 text-green-600 hover:text-green-800"
                        >
                          修改
                        </button>
                        <button
                          onClick={() => setDetailOrderId(o.id)}
                          className="mr-2 text-blue-600 hover:text-blue-800"
                        >
                          详情
                        </button>
                        {o.settlement_status !== "settled" && (
                          <button
                            onClick={async () => {
                              if (!confirm("确认此订单已付款？")) return;
                              try {
                                await callShopApi("orders.pay", { id: o.id });
                                setPage(1);
                                setOrders([]);
                                fetchOrders(1, true);
                              } catch (e) {
                                alert("付款操作失败");
                              }
                            }}
                            className="text-orange-600 hover:text-orange-800"
                          >
                            已付款
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      暂无订单数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {orders.map((o) => {
              const productNames = o.items?.join("、") || o.order_no;
              const truncated =
                productNames.length > 7
                  ? productNames.slice(0, 7) + "..."
                  : productNames;
              return (
                <div
                  key={o.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className="max-w-[200px] truncate font-medium"
                      title={productNames}
                    >
                      {truncated}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        o.settlement_status === "settled"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {o.settlement_status === "settled" ? "已结算" : "未结算"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>买家: {o.buyer_name || "-"}</div>
                    <div>电话: {o.buyer_phone || "-"}</div>
                    <div className="font-medium text-gray-700">
                      ¥{parseFloat(o.total_amount).toFixed(2)}
                    </div>
                    <div>{formatDateTime(o.created_at)}</div>
                  </div>
                  <div className="mt-3 flex justify-end gap-3">
                    <button
                      onClick={() => handleEdit(o.id)}
                      className="text-sm text-green-600 hover:text-green-800"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setDetailOrderId(o.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      详情
                    </button>
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && (
              <div className="py-8 text-center text-gray-400">暂无订单数据</div>
            )}
          </div>

          {/* Load more sentinel */}
          <div ref={sentinelRef} className="h-px" />

          {loading && orders.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            </div>
          )}

          {!hasMore && orders.length > 0 && (
            <div className="py-4 text-center text-sm text-gray-400">
              已加载全部 {total} 条数据
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewOrderForm({
  onCancel,
  onDone,
  orderId,
  initialData,
}: {
  onCancel: () => void;
  onDone: () => void;
  orderId?: number | null;
  initialData?: Order | null;
}) {
  const { user } = useAuth();
  const isEdit = !!orderId;
  const [buyerName, setBuyerName] = useState(initialData?.buyer_name || "");
  const [buyerPhone, setBuyerPhone] = useState(initialData?.buyer_phone || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [isPaid, setIsPaid] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [items, setItems] = useState([
    {
      productId: "",
      productName: "",
      quantity: "1",
      unitPrice: "",
      totalPrice: "",
    },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Initialize items from existing order when editing
  useEffect(() => {
    if (isEdit && initialData?.fullItems && initialData.fullItems.length > 0) {
      setItems(
        initialData.fullItems.map((item: any) => ({
          productId: item.product_id || "",
          productName: item.product_name || "",
          quantity: item.quantity ? String(item.quantity) : "1",
          unitPrice: item.unit_price || "",
          totalPrice: item.total_price || "",
        })),
      );
      setBuyerName(initialData.buyer_name || "");
      setBuyerPhone(initialData.buyer_phone || "");
      setNotes(initialData.notes || "");
      setIsPaid(initialData.settlement_status === "settled");
    }
  }, [isEdit, initialData]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await callShopApi("products.list", { page: 1, limit: 200 });
        if (res.data) setProducts(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        productName: "",
        quantity: "1",
        unitPrice: "",
        totalPrice: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "productId") {
      const product = products.find((p) => p.id === parseInt(value));
      if (product) {
        updated[index].unitPrice = product.unit_price || "";
        updated[index].productName = product.name || "";
        const qty = parseFloat(updated[index].quantity) || 0;
        const price = parseFloat(product.unit_price) || 0;
        updated[index].totalPrice = (qty * price).toFixed(2);
      }
    }
    if (field === "quantity" || field === "unitPrice") {
      const qty =
        field === "quantity"
          ? parseFloat(value)
          : parseFloat(updated[index].quantity);
      const price =
        field === "unitPrice"
          ? parseFloat(value)
          : parseFloat(updated[index].unitPrice);
      if (!isNaN(qty) && !isNaN(price)) {
        updated[index].totalPrice = (qty * price).toFixed(2);
      }
    }
    if (field === "totalPrice") {
      const total = parseFloat(value);
      const qty = parseFloat(updated[index].quantity);
      if (!isNaN(total) && !isNaN(qty) && qty > 0) {
        updated[index].unitPrice = (total / qty).toFixed(2);
      }
    }
    setItems(updated);
  };

  const totalAmount = items
    .reduce((sum, item) => sum + parseFloat(item.totalPrice || "0"), 0)
    .toFixed(2);

  const handleSubmit = async () => {
    if (!buyerName.trim()) {
      alert("请输入买家名称");
      return;
    }
    const validItems = items.filter((item) => item.productId);
    if (validItems.length === 0) {
      alert("请至少选择一个商品");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await callShopApi("orders.update", {
          id: orderId,
          buyerName,
          buyerPhone,
          notes,
          totalAmount,
          settlementStatus: isPaid ? "settled" : "unsettled",
          settledAmount: isPaid ? totalAmount : "0",
          items: items
            .filter((item) => item.productId)
            .map((item) => ({
              productId: parseInt(item.productId),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
        });
      } else {
        await callShopApi("orders.create", {
          buyerName,
          buyerPhone,
          totalAmount,
          settlementStatus: isPaid ? "settled" : "unsettled",
          settledAmount: isPaid ? totalAmount : "0",
          notes,
          createdBy: user?.uid,
          items: items
            .filter((item) => item.productId)
            .map((item) => ({
              productId: parseInt(item.productId),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
        });
      }
      onDone();
    } catch (e) {
      alert(isEdit ? "更新失败" : "创建订单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {isEdit && (
        <div className="mb-3 rounded bg-red-50 px-3 py-2">
          <p className="text-sm text-red-600">
            当前为修改订单，如需出库请新增订单
          </p>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold sm:text-lg">
          {isEdit ? "编辑订单" : "新增订单"}
        </h2>
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          取消
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600">买家名称</label>
          <input
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="请输入买家名称"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">联系电话</label>
          <input
            type="text"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="请输入联系电话"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">备注</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="可选"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-600">
          商品明细（选择商品后自动填入单价）
        </label>
        {loadingProducts && (
          <span className="text-sm text-gray-400">加载商品中...</span>
        )}
        {items.map((item, index) => (
          <div key={index} className="mb-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-500">商品</label>
            <ProductSearch
              value={item.productName}
              products={products}
              onSelect={(product) => {
                const updated = [...items];
                updated[index] = {
                  ...updated[index],
                  productId: String(product.id),
                  productName: product.name,
                  unitPrice: product.unit_price || "",
                  totalPrice: String(
                    (
                      (parseFloat(updated[index].quantity) || 0) *
                      parseFloat(product.unit_price || "")
                    ).toFixed(2),
                  ),
                };
                setItems(updated);
              }}
            />
            <label className="text-sm text-gray-500">数量</label>
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => updateItem(index, "quantity", e.target.value)}
              className="w-16 rounded-md border px-2 py-1.5 text-sm"
            />
            <label className="text-sm text-gray-500">单价</label>
            <input
              type="number"
              value={item.unitPrice}
              onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
            />
            <label className="text-sm text-gray-500">总价</label>
            <input
              type="number"
              value={item.totalPrice}
              onChange={(e) => updateItem(index, "totalPrice", e.target.value)}
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
            />
            {items.length > 1 && (
              <button
                onClick={() => removeItem(index)}
                className="text-red-500"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addItem}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          + 添加商品
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">合计: ¥{totalAmount}</span>
        <label className="flex items-center gap-1 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="rounded border-gray-300"
          />
          已付款
        </label>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? "提交中..." : isEdit ? "确认更新" : "确认创建"}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function OrderDetail({ id }: { id: number }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callShopApi("orders.get", { id })
      .then((res) => {
        if (res) setOrder(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return <div className="py-4 text-center text-gray-400">加载中...</div>;
  if (!order)
    return <div className="py-4 text-center text-gray-400">未找到订单</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold sm:text-lg">
          订单详情 - {order.order_no}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-gray-500">买家:</span>
          <span className="ml-2">{order.buyer_name || "-"}</span>
        </div>
        <div>
          <span className="text-gray-500">电话:</span>
          <span className="ml-2">{order.buyer_phone || "-"}</span>
        </div>
        <div>
          <span className="text-gray-500">总金额:</span>
          <span className="ml-2 font-medium">
            ¥{parseFloat(order.total_amount).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">结算状态:</span>
          <span className="ml-2">
            {order.settlement_status === "settled" ? "已结算" : "未结算"}
          </span>
        </div>
        <div>
          <span className="text-gray-500">备注:</span>
          <span className="ml-2">{order.notes || "-"}</span>
        </div>
        <div>
          <span className="text-gray-500">创建时间:</span>
          <span className="ml-2">{formatDateTime(order.created_at)}</span>
        </div>
      </div>

      {order.items && order.items.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium text-gray-700">商品明细</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">商品</th>
                  <th className="px-3 py-2">数量</th>
                  <th className="px-3 py-2">单价</th>
                  <th className="px-3 py-2">小计</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{item.product_name || "-"}</td>
                    <td className="px-3 py-2">
                      {parseFloat(item.quantity).toFixed(2)}
                      {item.product_unit ? ` ${item.product_unit}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      ¥{parseFloat(item.unit_price).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      ¥{parseFloat(item.total_price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
