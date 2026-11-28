import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/chat', '/api/'],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
