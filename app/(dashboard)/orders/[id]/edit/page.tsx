import OrderForm from '@/components/orders/OrderForm';

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderForm orderId={parseInt(id)} />;
}
