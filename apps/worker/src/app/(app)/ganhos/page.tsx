/**
 * Placeholder de propósito — pagamento pela plataforma foi adiado pra
 * fase 2 (ver create-payment-gateway.ts no backend). Enquanto isso,
 * empresa e trabalhador acertam o pagamento direto, então não há saldo
 * real pra mostrar aqui.
 */
export default function GanhosPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Ganhos</h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="font-heading text-lg font-bold text-text">Em breve</p>
        <p className="max-w-xs text-sm text-text-secondary">
          Enquanto isso, combine o pagamento direto com a empresa ao concluir cada escala.
        </p>
      </div>
    </main>
  );
}
