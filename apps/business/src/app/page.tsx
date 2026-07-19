import Link from 'next/link';
import { InstallAppBanner } from '../components/ui/install-app-banner';
import { Logo } from '../components/ui/logo';

const COMPARISON_TODAY = [
  'Manda mensagem em grupos de WhatsApp e reza pra alguém responder.',
  'Não sabe se a pessoa é boa, pontual ou se vai aparecer.',
  'Combina o valor no susto, sem padrão, no dia.',
];

const COMPARISON_PRONTO = [
  'Publica a escala e recebe candidatos verificados.',
  'Vê nota, histórico e distância de cada candidato antes de aprovar.',
  'Vê o valor total da escala antes de publicar.',
];

const STEPS = [
  {
    number: '1',
    title: 'Publique a escala',
    description: 'Função, data, horário e local. Você vê o valor total estimado na hora.',
  },
  {
    number: '2',
    title: 'Escolha o profissional',
    description: 'Candidatos aparecem com nota e histórico. Compare e aprove.',
  },
  {
    number: '3',
    title: 'Confirme e acompanhe',
    description: 'A pessoa faz check-in e check-out pela escala. Vocês acertam o pagamento direto, depois.',
  },
];

const CATEGORIES = [
  'Garçom',
  'Bartender',
  'Auxiliar de cozinha',
  'Recepcionista',
  'Segurança de evento',
  'Limpeza',
];

const CheckIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3l2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6-4.6-4.1 6.1-.6L12 3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const TRUST_ITEMS = [
  {
    icon: CheckIcon,
    title: 'Verificado de verdade',
    description: 'Documento conferido antes do profissional aparecer disponível na plataforma.',
  },
  {
    icon: StarIcon,
    title: 'Avaliação dos dois lados',
    description: 'Você avalia o profissional e ele avalia sua empresa. Reputação real, dos dois lados.',
  },
  {
    icon: 'R$',
    title: 'Valor claro na tela',
    description: 'O valor total da escala aparece antes de você publicar. Sem surpresa depois.',
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

      <InstallAppBanner />

      <section className="flex flex-col items-center gap-6 px-5 py-14 text-center">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Contrate reforço em minutos</h1>
          <p className="mt-2 text-[16px] text-text-secondary">
            Publique vagas avulsas e encontre gente disponível perto de você.
          </p>
        </div>

        <Link
          href="/cadastro/conta"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-[16px] font-bold text-white shadow-[0_10px_26px_rgba(245,83,30,0.3)] transition hover:brightness-90"
        >
          Acessar minha empresa
        </Link>
      </section>

      <section className="px-5 py-14">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-7">
            <p className="text-xs font-semibold tracking-wide text-text-secondary uppercase">Hoje</p>
            <ul className="mt-4 flex flex-col gap-3">
              {COMPARISON_TODAY.map((item) => (
                <li key={item} className="flex gap-2.5 text-[16px] text-text-secondary">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-none text-danger"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-secondary p-7 text-background">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Com Pronto</p>
            <ul className="mt-4 flex flex-col gap-3">
              {COMPARISON_PRONTO.map((item) => (
                <li key={item} className="flex gap-2.5 text-[16px]">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-none text-success"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-secondary px-5 py-14 text-background">
        <h2 className="text-center font-heading text-2xl font-bold">Três passos. Uma escala coberta.</h2>
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="rounded-2xl bg-background/[0.06] p-6">
              <p className="font-heading text-3xl font-extrabold text-primary">{step.number}</p>
              <p className="mt-3 font-heading text-lg font-bold">{step.title}</p>
              <p className="mt-1.5 text-sm text-text-secondary">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-14">
        <h2 className="text-center font-heading text-2xl font-bold text-text">
          Todo tipo de reforço, uma plataforma.
        </h2>
        <div className="mx-auto mt-7 flex max-w-2xl flex-wrap justify-center gap-2.5">
          {CATEGORIES.map((category) => (
            <span
              key={category}
              className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text"
            >
              {category}
            </span>
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

      <section className="px-5 py-14">
        <div className="mx-auto max-w-2xl rounded-3xl bg-primary px-8 py-12 text-center">
          <h2 className="font-heading text-3xl font-extrabold text-white">Faltou gente? Já sabe.</h2>
          <p className="mt-3 text-[16px] text-white/90">
            Publique sua primeira escala hoje e sinta a diferença de resolver em minutos.
          </p>
          <Link
            href="/cadastro/conta"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-secondary px-6 py-3 text-[16px] font-bold text-background transition hover:brightness-125"
          >
            Acessar minha empresa
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
