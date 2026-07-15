import type { MetadataRoute } from 'next';

/** Gera /manifest.webmanifest automaticamente (convenção do App Router). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pronto — vagas de trabalho avulso',
    short_name: 'Pronto',
    description: 'Encontre vagas de trabalho avulso perto de você.',
    // App instalado pula a landing de marketing e abre direto no login
    // (que redireciona pra /inicio sozinho se a sessão ainda for válida).
    start_url: '/entrar',
    display: 'standalone',
    background_color: '#F7F4EE',
    theme_color: '#F5531E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
