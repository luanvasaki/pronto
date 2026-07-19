'use client';

import { forgotPassword } from '@shift/shared';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const isValid = email.trim().length > 0;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // O backend sempre responde a mesma mensagem, exista ou não o
      // e-mail — não há caminho de erro diferente aqui de propósito.
      await forgotPassword(email);
    } finally {
      setSent(true);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        {sent ? (
          <div>
            <h1 className="font-heading text-2xl font-bold text-text">Verifique seu e-mail</h1>
            <p className="mt-1 text-[16px] text-text-secondary">
              Se existir uma conta com esse e-mail, enviamos um link de redefinição.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold text-text">Esqueceu sua senha?</h1>
              <p className="mt-1 text-[16px] text-text-secondary">
                Mandamos um link de redefinição pro seu e-mail.
              </p>
            </div>

            <Input
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
              Enviar link
            </Button>
          </form>
        )}

        <Link
          href="/entrar"
          className="text-center text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
        >
          Voltar pro login
        </Link>
      </div>
    </main>
  );
}
