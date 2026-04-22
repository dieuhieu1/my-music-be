'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { paymentsApi } from '@/lib/api/payments.api';
import { usersApi } from '@/lib/api/users.api';
import { useAuthStore } from '@/store/useAuthStore';
import { PaymentResultCard } from '@/components/payment/PaymentResultCard';

function MoMoHandler() {
  const searchParams          = useSearchParams();
  const router                = useRouter();
  const { locale }            = useParams<{ locale: string }>();
  const { setUser }           = useAuthStore();
  const called                = useRef(false);

  const [status, setStatus]           = useState<'loading' | 'success' | 'error'>('loading');
  const [expiryDate, setExpiryDate]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | undefined>();

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = Object.fromEntries(searchParams.entries());

    const verify = async () => {
      try {
        await paymentsApi.verifyMomo(params);
        const meRes = await usersApi.getMe();
        const me    = meRes.data?.data ?? meRes.data;
        setUser(me);
        setExpiryDate(me.premiumExpiryDate ?? null);
        setStatus('success');
      } catch {
        // resultCode arrives as a string in URL params — cast for numeric comparison
        const resultCode = Number(params.resultCode);
        setErrorMsg(
          resultCode !== 0
            ? 'Your payment was declined by MoMo.'
            : 'Verification failed. Please contact support if your account was charged.',
        );
        setStatus('error');
      }
    };

    verify();
  }, [searchParams, setUser]);

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid rgba(232,184,75,0.12)',
        borderRadius: 16,
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
      }}>
        <PaymentResultCard
          status={status}
          expiryDate={expiryDate}
          errorMessage={errorMsg}
          onContinue={status === 'success' ? () => router.push(`/${locale}/profile/premium`) : undefined}
          onRetry={status === 'error'   ? () => router.push(`/${locale}/payment`)         : undefined}
        />
      </div>
    </div>
  );
}

function LoadingDisc() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <div
        className="vinyl-spin"
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, var(--surface-2), var(--charcoal))',
          border: '2px solid var(--gold-dim)',
        }}
      />
    </div>
  );
}

export default function MoMoReturnPage() {
  return (
    <Suspense fallback={<LoadingDisc />}>
      <MoMoHandler />
    </Suspense>
  );
}
