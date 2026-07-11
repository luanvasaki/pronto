import Link from 'next/link';
import { Logo } from '../components/ui/logo';

const PERKS = [
  {
    title: 'Você escolhe',
    description: 'Aceita só as escalas que cabem na sua agenda. Sem chefe fixo.',
  },
  {
    title: 'Valor combinado, sem susto',
    description: 'O valor da escala já aparece antes de você aceitar — o acerto é direto com a empresa.',
  },
  {
    title: 'Constrói fama',
    description: 'Cada avaliação boa te coloca na frente da fila da próxima escala.',
  },
  {
    title: 'Perto de casa',
    description: 'Escalas filtradas por distância. Menos trânsito, mais trabalho.',
  },
];

const TRUST_ITEMS = [
  {
    icon: '✓',
    title: 'Verificação por documento',
    description: 'Envie seu documento uma vez — ele é conferido antes de você aparecer para as empresas.',
  },
  {
    icon: '★',
    title: 'Avaliação dos dois lados',
    description: 'Empresa avalia profissional e vice-versa. Reputação real, construída escala a escala.',
  },
  {
    icon: 'R$',
    title: 'Valor sempre visível',
    description: 'O valor da escala aparece na tela antes de você aceitar. Sem combinar no susto.',
  },
];

const FAQ = [
  {
    question: 'Como escolho as escalas que aparecem pra mim?',
    answer:
      'Você define suas categorias de trabalho e sua localização no cadastro — só aparecem escalas dessas categorias, perto de você.',
  },
  {
    question: 'Como confirmo que estou em uma escala?',
    answer: 'Você faz check-in ao chegar e check-out ao final, direto pelo celular, com sua localização.',
  },
  {
    question: 'Como eu recebo?',
    answer: 'O valor combinado aparece antes de você aceitar a vaga. O acerto do pagamento é feito direto com a empresa, depois que a escala termina.',
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <Logo />
        <Link href="/entrar" className="text-sm font-semibold text-text hover:text-primary">
          Entrar
        </Link>
      </nav>

      <section className="flex flex-col items-center gap-6 px-5 py-14 text-center">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Renda extra quando você quiser</h1>
          <p className="mt-2 text-[15px] text-text-secondary">
            Vagas de bares, eventos e hotéis pertinho de você.
          </p>
        </div>

        <Link
          href="/cadastro/conta"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(245,83,30,0.3)] transition hover:brightness-90"
        >
          Criar conta grátis
        </Link>
      </section>

      <section className="bg-secondary px-5 py-14 text-background">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {PERKS.map((perk) => (
            <div key={perk.title} className="rounded-2xl bg-background/[0.06] p-6">
              <p className="font-heading text-lg font-bold">{perk.title}</p>
              <p className="mt-2 text-sm text-text-secondary">{perk.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-14">
        <h2 className="text-center font-heading text-2xl font-bold text-text">Por que confiar</h2>
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-white">
                {item.icon}
              </div>
              <p className="mt-4 font-heading text-lg font-bold text-text">{item.title}</p>
              <p className="mt-1.5 text-sm text-text-secondary">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-2xl px-5 py-14">
        <h2 className="text-center font-heading text-2xl font-bold text-text">Perguntas frequentes</h2>
        <div className="mt-6 flex flex-col divide-y divide-border border-t border-border">
          {FAQ.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-[17px] font-bold text-text">
                {item.question}
                <span className="text-xl text-primary group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-5 py-14">
        <div className="mx-auto max-w-2xl rounded-3xl bg-primary px-8 py-12 text-center">
          <h2 className="font-heading text-3xl font-extrabold text-white">Bora trabalhar?</h2>
          <p className="mt-3 text-[17px] text-white/90">
            Crie sua conta e comece a ver escalas perto de você hoje mesmo.
          </p>
          <Link
            href="/cadastro/conta"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-secondary px-6 py-3 text-[15px] font-bold text-background transition hover:brightness-125"
          >
            Criar conta grátis
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-text-secondary">
        <Logo className="mx-auto mb-3 justify-center" />
        <p>© 2026 Pronto Tecnologia</p>
      </footer>
    </main>
  );
}
