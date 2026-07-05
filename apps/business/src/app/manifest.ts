import type { MetadataRoute } from 'next';

/** Gera /manifest.webmanifest automaticamente (convenção do App Router). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pronto para empresas',
    short_name: 'Pronto Empresas',
    description: 'Publique vagas e gerencie candidatos em minutos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F4EE',
    theme_color: '#F5531E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
