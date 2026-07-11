'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { GrowthChart } from '../../components/ui/growth-chart';
import {
  AdminGrowthMetrics,
  AdminMetrics,
  deleteDemoData,
  getAdminGrowthMetrics,
  getAdminMetrics,
} from '../../lib/admin-api';

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminOverviewPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [growth, setGrowth] = useState<AdminGrowthMetrics | null>(null);
  const [growthError, setGrowthError] = useState<string | null>(null);

  const [confirmingDemoDelete, setConfirmingDemoDelete] = useState(false);
  const [isDeletingDemoData, setIsDeletingDemoData] = useState(false);
  const [demoDeleteMessage, setDemoDeleteMessage] = useState<string | null>(null);
  const [demoDeleteError, setDemoDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getAdminMetrics()
      .then(setMetrics)
      .catch(() => setError('Não foi possível carregar as métricas.'))
      .finally(() => setIsLoading(false));
    getAdminGrowthMetrics()
      .then(setGrowth)
      .catch(() => setGrowthError('Não foi possível carregar os gráficos de crescimento.'));
  }, []);

  async function handleDeleteDemoData(): Promise<void> {
    if (!confirmingDemoDelete) {
      setConfirmingDemoDelete(true);
      return;
    }

    setDemoDeleteError(null);
    setDemoDeleteMessage(null);
    setIsDeletingDemoData(true);

    try {
      const result = await deleteDemoData();
      setDemoDeleteMessage(
        result.companiesRemoved === 0
          ? 'Não havia dados de demonstração pra remover.'
          : `${result.companiesRemoved} empresa(s) de demonstração removida(s).`,
      );
    } catch {
      setDemoDeleteError('Não foi possível remover os dados de demonstração.');
    } finally {
      setIsDeletingDemoData(false);
      setConfirmingDemoDelete(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando métricas...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8">
      {error && <p className="text-sm text-danger">{error}</p>}

      {metrics && (
        <section>
          <h2 className="font-heading text-lg font-bold text-text">Visão geral</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">
                {CURRENCY_FORMATTER.format(Number(metrics.payments.totalProcessed))}
              </p>
              <p className="mt-1 text-xs text-text-secondary">Processado (cobrado + liberado)</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.payments.countByStatus.pending}</p>
              <p className="mt-1 text-xs text-text-secondary">Pagamentos pendentes</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.payments.countByStatus.failed}</p>
              <p className="mt-1 text-xs text-text-secondary">Pagamentos falhos</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.workers.total}</p>
              <p className="mt-1 text-xs text-text-secondary">Trabalhadores cadastrados</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.workers.verified}</p>
              <p className="mt-1 text-xs text-text-secondary">Trabalhadores verificados</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.workers.active}</p>
              <p className="mt-1 text-xs text-text-secondary">Trabalharam em ao menos 1 escala</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.companies.total}</p>
              <p className="mt-1 text-xs text-text-secondary">Empresas cadastradas</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.companies.jobsPosted}</p>
              <p className="mt-1 text-xs text-text-secondary">Vagas publicadas</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.shifts.completed}</p>
              <p className="mt-1 text-xs text-text-secondary">Escalas concluídas (negócios fechados)</p>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-heading text-lg font-bold text-text">Crescimento</h2>
        <p className="mt-1 text-sm text-text-secondary">Últimas 8 semanas, mais recente à direita.</p>

        {growthError && <p className="mt-2 text-sm text-danger">{growthError}</p>}

        {growth && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GrowthChart title="Empresas" subtitle="Novos cadastros por semana" data={growth.companies} />
            <GrowthChart title="Trabalhadores" subtitle="Novos cadastros por semana" data={growth.workers} />
            <GrowthChart
              title="Negociações fechadas"
              subtitle="Escalas concluídas por semana"
              data={growth.dealsClosed}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold text-text">Dados de demonstração</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Remove de uma vez todas as empresas e vagas criadas só pra demonstrar o app (e tudo que veio delas —
          candidaturas, escalas, pagamentos, avaliações). Empresas de verdade não são afetadas.
        </p>

        {demoDeleteMessage && <p className="mt-2 text-sm text-success">{demoDeleteMessage}</p>}
        {demoDeleteError && <p className="mt-2 text-sm text-danger">{demoDeleteError}</p>}

        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            variant={confirmingDemoDelete ? 'danger' : 'outlined'}
            isLoading={isDeletingDemoData}
            onClick={handleDeleteDemoData}
          >
            {confirmingDemoDelete ? 'Confirmar remoção' : 'Remover dados de demonstração'}
          </Button>
          {confirmingDemoDelete && !isDeletingDemoData && (
            <button
              type="button"
              onClick={() => setConfirmingDemoDelete(false)}
              className="text-sm text-text-secondary underline underline-offset-2"
            >
              Cancelar
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
