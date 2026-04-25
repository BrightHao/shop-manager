import { useAuth } from "../context/AuthContext";
import { callShopApi } from "../api/shop";
import { useState, useEffect, useRef } from "react";
import { formatDateTime } from "../utils/date";

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

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
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
                onClick={() => { onSelect(p); setSearch(p.name); setOpen(false); }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
              >
                {p.name}{" "}
                <span className="text-gray-400">¥{parseFloat(p.unit_price || "0").toFixed(2)}</span>
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
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const limit = 20;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await callShopApi("orders.list", { page, limit });
      if (res.data) {
        setOrders(res.data);
        setTotal(res.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">订单管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 sm:px-4 sm:py-2 sm:text-sm"
        >
          {showForm ? "取消" : "新增订单"}
        </button>
      </div>

      {showForm && (
        <NewOrderForm
          onCancel={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false);
            fetchOrders();
          }}
        />
      )}

      {editingOrderId && (
        <NewOrderForm
          orderId={editingOrderId}
          initialData={orders.find((o) => o.id === editingOrderId)}
          onCancel={() => setEditingOrderId(null)}
          onDone={() => {
            setEditingOrderId(null);
            fetchOrders();
          }}
        />
      )}

      {selectedOrder && (
        <OrderDetail
          id={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

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
                  <th className="px-4 py-3 font-medium">订单编号</th>
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
                {orders.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{o.order_no}</td>
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
                        onClick={() => setEditingOrderId(o.id)}
                        className="mr-2 text-green-600 hover:text-green-800"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setSelectedOrder(o.id)}
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
                              fetchOrders();
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
                ))}
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
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{o.order_no}</span>
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
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => setSelectedOrder(o.id)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    详情
                  </button>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="py-8 text-center text-gray-400">暂无订单数据</div>
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
    setSubmitting(true);
    try {
      if (isEdit) {
        await callShopApi("orders.update", {
          id: orderId,
          buyerName,
          buyerPhone,
          notes,
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
    <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
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

      {!isEdit && (
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
                onChange={(e) =>
                  updateItem(index, "totalPrice", e.target.value)
                }
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
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!isEdit && (
          <>
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
          </>
        )}
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

function OrderDetail({ id, onClose }: { id: number; onClose: () => void }) {
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
    <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold sm:text-lg">
          订单详情 - {order.order_no}
        </h2>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          关闭
        </button>
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
                      {parseFloat(item.quantity).toFixed(0)}
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
