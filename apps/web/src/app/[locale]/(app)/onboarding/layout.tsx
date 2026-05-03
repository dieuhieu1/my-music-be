import { unstable_setRequestLocale } from 'next-intl/server';

// Full-screen overlay that visually replaces the (app) shell for onboarding.
// The parent layout still renders but is hidden beneath this fixed layer.
export default function OnboardingLayout({ 
  children,
  params: { locale }
}: { 
  children: React.ReactNode;
  params: { locale: string };
}) {
  unstable_setRequestLocale(locale);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--charcoal)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}
