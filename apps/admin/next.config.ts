import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @shift/shared vem do workspace como fonte TS, não como pacote
  // publicado — isso diz pro Next transpilar como se fosse código
  // próprio do app (sem isso ele ignora tudo dentro de node_modules).
  transpilePackages: ['@shift/shared'],

  // Proxy same-origin pro backend (Railway) — sem isso, front e back
  // ficam em domínios diferentes (cross-site) e o Safari/WebKit (todo
  // navegador no iPhone usa esse motor, é exigência da Apple) trata
  // cookie cross-site de forma bem mais restritiva que Chrome/Firefox
  // de verdade, causando login que "entra e sai" especificamente no
  // iPhone. Com o proxy, o navegador só vê o próprio domínio — não
  // precisa de domínio próprio pra resolver isso.
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN;
    if (!backendOrigin) return [];

    return [{ source: '/api/:path*', destination: `${backendOrigin}/:path*` }];
  },
};

export default nextConfig;
