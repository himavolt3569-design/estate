import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/utils';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return [
    { url: `${origin}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/land-measurement`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/land-size`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/emi`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/agents`, changeFrequency: 'weekly', priority: 0.7 },
  ];
}
