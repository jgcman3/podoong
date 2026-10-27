import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '포둥 · Podung',
    short_name: '포둥',
    description: '가족과 함께하는 육아 기록',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f9fc',
    theme_color: '#f7f9fc',
    icons: [
      {
        src: '/icons/podung-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/podung-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/podung-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
