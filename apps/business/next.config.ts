import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @shift/shared vem do workspace como fonte TS, não como pacote
  // publicado — isso diz pro Next transpilar como se fosse código
  // próprio do app (sem isso ele ignora tudo dentro de node_modules).
  transpilePackages: ['@shift/shared'],
};

export default nextConfig;
