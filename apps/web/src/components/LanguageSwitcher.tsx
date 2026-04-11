'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useLocaleStore } from '@/store/useLocaleStore';
import { locales, type Locale } from '@/i18n/config';

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;
  const { setLocale } = useLocaleStore();

  function switchLocale(newLocale: Locale) {
    if (newLocale === currentLocale) return;
    setLocale(newLocale);
    // Replace the locale segment in the current path
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  }

  return (
    <div className="flex gap-2 text-xs">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          className={locale === currentLocale ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
