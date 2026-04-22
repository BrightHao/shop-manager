import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '店铺管理系统',
  description: '商品管理、订单管理、账单汇总',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
