import { unstable_setRequestLocale } from 'next-intl/server';
import AdminLayoutClient from '@/components/layout/AdminLayoutClient';

export default function AdminLayout({ 
  children,
  params: { locale }
}: { 
  children: React.ReactNode;
  params: { locale: string };
}) {
  unstable_setRequestLocale(locale);
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
