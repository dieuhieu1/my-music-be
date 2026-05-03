import { unstable_setRequestLocale } from 'next-intl/server';
import AuthLayoutClient from '@/components/layout/AuthLayoutClient';

export default function AuthLayout({ 
  children,
  params: { locale }
}: { 
  children: React.ReactNode;
  params: { locale: string };
}) {
  unstable_setRequestLocale(locale);
  return <AuthLayoutClient>{children}</AuthLayoutClient>;
}
