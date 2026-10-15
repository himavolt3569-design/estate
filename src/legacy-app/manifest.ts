import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kitta: Property in Nepal',
    short_name: 'Kitta',
    description:
      'Search houses, apartments and land across Nepal. Every listing carries a public record of what has been verified.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f4ec',
    theme_color: '#1c3d73',
    lang: 'en',
    dir: 'ltr',
    categories: ['business', 'lifestyle', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Search property', url: '/search' },
      { name: 'Saved properties', url: '/dashboard/saved' },
      { name: 'My listings', url: '/dashboard/listings' },
    ],
  };
}
