'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { ApiError, isValidOtpCode, requestOtp, verifyOtp } from '@shift/shared';
import { Button } from '../../../components/ui/button';
import { Logo } from '../../../components/ui/logo';
import { OtpInput } from '../../../components/ui/otp-input';

const OTP_LENGTH = 6;
// Mesmo valor do COOLDOWN_MS do backend (request-otp.ts) — reenviar
// antes disso só resultaria em 429.
const RESEND_COOLDOWN_SECONDS = 60;

export default function CodigoPage() {
  return (
    <Suspense fallback={null}>
      <CodigoForm />
    </Suspense>
  );
}

function CodigoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsToResend, setSecondsToResend] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!phone) {
      router.replace('/entrar');
    }
  }, [phone, router]);

  useEffect(() => {
    if (secondsToResend <= 0) return;
    const timer = setInterval(() => setSecondsToResend((current) => current - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsToResend]);

  if (!phone) {
    return null;
  }

  // Reatribuído como `const` própria pro TypeScript carregar o tipo
  // estreitado (string, não string | null) pro closure do handleSubmit.
  const verifiedPhone: string = phone;
  const isValid = isValidOtpCode(code);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await verifyOtp(verifiedPhone, code);
      // Sempre manda pro cadastro por enquanto, mesmo pra quem loga de
      // novo — ainda não existe um jeito de checar se o perfil já foi
      // completado (isso entra quando existir GET /worker-profile).
      router.push('/cadastro');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o código.');
      setIsSubmitting(false);
    }
  }

  async function handleResend(): Promise<void> {
    if (isResending || secondsToResend > 0) return;

    setError(null);
    setIsResending(true);

    try {
      await requestOtp(verifiedPhone);
      setSecondsToResend(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível reenviar o código.');
    } finally {
      setIsResending(false);
    }
  }

  const resendLabel = `${Math.floor(secondsToResend / 60)}:${String(secondsToResend % 60).padStart(2, '0')}`;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Confirme seu número</h1>
          <p className="mt-1 text-[15px] leading-relaxed text-text-secondary">
            Enviamos um código de 6 dígitos para <strong className="text-text">{phone}</strong>.
          </p>
        </div>

        <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} disabled={isSubmitting} />

        {error && <p className="text-sm text-danger">{error}</p>}

        {secondsToResend > 0 ? (
          <p className="text-sm text-text-secondary">
            Reenviar código em <strong className="text-text-secondary">{resendLabel}</strong>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-left text-sm font-medium text-primary underline underline-offset-2 disabled:opacity-60"
          >
            {isResending ? 'Reenviando...' : 'Reenviar código'}
          </button>
        )}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Confirmar
        </Button>

        <Link
          href="/entrar"
          className="text-center text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
        >
          Trocar número
        </Link>
      </form>
    </main>
  );
}
