import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="font-heading text-3xl font-bold text-text">
          Contrate reforço em minutos
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">
          Publique vagas avulsas e encontre gente disponível perto de você.
        </p>
      </div>

      <Link
        href="/entrar"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-90"
      >
        Acessar minha empresa
      </Link>
    </main>
  );
}
