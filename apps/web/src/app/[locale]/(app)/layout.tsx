import { unstable_setRequestLocale } from 'next-intl/server';
import AppLayoutClient from '@/components/layout/AppLayoutClient';

export default function AppLayout({ 
  children,
  params: { locale }
}: { 
  children: React.ReactNode;
  params: { locale: string };
}) {
  unstable_setRequestLocale(locale);
  return <AppLayoutClient>{children}</AppLayoutClient>;
}

