import { useAuth } from "../context/AuthContext";
import { callShopApi } from "../api/shop";
import { useState, useEffect } from "react";

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
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
                      {new Date(o.created_at).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedOrder(o.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        详情
                      </button>
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
                  <div>{new Date(o.created_at).toLocaleString("zh-CN")}</div>
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
}: {
  onCancel: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([
    { productId: "", quantity: "1", unitPrice: "", totalPrice: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      { productId: "", quantity: "1", unitPrice: "", totalPrice: "" },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
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
      await callShopApi("orders.create", {
        buyerName,
        buyerPhone,
        totalAmount,
        settlementStatus: "unsettled",
        settledAmount: "0",
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
      onDone();
    } catch (e) {
      alert("创建订单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold sm:text-lg">新增订单</h2>
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
          商品明细
        </label>
        {items.map((item, index) => (
          <div key={index} className="mb-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              placeholder="商品ID"
              value={item.productId}
              onChange={(e) => updateItem(index, "productId", e.target.value)}
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              placeholder="数量"
              value={item.quantity}
              onChange={(e) => updateItem(index, "quantity", e.target.value)}
              className="w-16 rounded-md border px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              placeholder="单价"
              value={item.unitPrice}
              onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
            />
            <span className="w-20 text-sm text-gray-600">
              ¥{item.totalPrice || "0"}
            </span>
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
        <button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? "提交中..." : "确认创建"}
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
          <span className="ml-2">
            {new Date(order.created_at).toLocaleString("zh-CN")}
          </span>
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
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">数量</th>
                  <th className="px-3 py-2">单价</th>
                  <th className="px-3 py-2">小计</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{item.product_name || "-"}</td>
                    <td className="px-3 py-2">{item.product_sku || "-"}</td>
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
