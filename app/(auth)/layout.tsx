import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Toaster } from 'sonner';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <>
      {children}
      <Toaster position="top-center" />
    </>
  );
}
