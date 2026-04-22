import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-gray-300 mb-4">404</p>
        <h2 className="text-2xl font-bold mb-2">页面不存在</h2>
        <p className="text-gray-500 mb-6 text-sm">
          找不到该页面，请检查地址或返回首页。
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
