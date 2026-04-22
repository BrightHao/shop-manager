'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">系统错误</h2>
            <p className="text-gray-500 mb-6 text-sm">
              {error.message || '发生了严重错误，请刷新页面。'}
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mx-auto"
            >
              <RotateCcw className="w-4 h-4" />
              刷新页面
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
