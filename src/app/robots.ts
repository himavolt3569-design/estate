import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated surfaces and anything that would let a crawler burn
        // through the search function are excluded.
        disallow: ['/dashboard/', '/login', '/register', '/auth/', '/api/', '/search?'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
