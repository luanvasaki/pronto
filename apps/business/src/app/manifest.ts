import type { MetadataRoute } from 'next';

/**
 * Gera /manifest.webmanifest automaticamente (convenção do App Router).
 * Ícones são placeholder — a identidade visual real ainda não existe.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pronto para empresas',
    short_name: 'Pronto Empresas',
    description: 'Publique vagas e gerencie candidatos em minutos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4F46E5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
