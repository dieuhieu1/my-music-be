// Full-screen overlay that visually replaces the (app) shell for onboarding.
// The parent layout still renders but is hidden beneath this fixed layer.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
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
