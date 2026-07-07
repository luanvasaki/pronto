'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { ApiError, isValidPassword, resetPassword } from '@shift/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaForm />
    </Suspense>
  );
}

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-danger">Link de redefinição inválido.</p>
          <Link href="/esqueci-senha" className="text-sm font-medium text-primary underline underline-offset-2">
            Pedir um novo link
          </Link>
        </div>
      </main>
    );
  }

  const passwordsMatch = password === confirmPassword;
  const isValid = isValidPassword(password) && passwordsMatch;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting || !token) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      router.push('/entrar');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível redefinir sua senha.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Escolha uma nova senha</h1>
        </div>

        <Input
          id="password"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Input
          id="confirmPassword"
          label="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={confirmPassword.length > 0 && !passwordsMatch ? 'As senhas não coincidem.' : undefined}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        {error && (
          <Link href="/esqueci-senha" className="text-sm font-medium text-primary underline underline-offset-2">
            Pedir um novo link
          </Link>
        )}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Redefinir senha
        </Button>
      </form>
    </main>
  );
}
