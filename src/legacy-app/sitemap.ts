import type { MetadataRoute } from 'next';

import { createClient } from '@/lib/supabase/server';

export const revalidate = 3600;

/**
 * Published listings plus the province landing pages. Reads through the
 * RLS-bound client, so the sitemap physically cannot contain a draft. The same
 * policy that hides it from visitors hides it from this query.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/search`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/how-verification-works`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  try {
    const supabase = await createClient();

    const { data: provinces } = await supabase
      .from('locations')
      .select('slug')
      .eq('level', 'province')
      .eq('is_active', true);

    const provinceRoutes: MetadataRoute.Sitemap = (provinces ?? []).map((p) => ({
      url: `${base}/search?location_path=nepal.${p.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    // Capped: a sitemap file may hold 50,000 URLs, and past that we would need
    // a sitemap index. That split arrives with real listing volume.
    const { data: properties } = await supabase
      .from('properties')
      .select('slug, updated_at, location_id, locations!inner(slug, path)')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(45000);

    const propertyRoutes: MetadataRoute.Sitemap = (properties ?? []).flatMap((row) => {
      const location = row.locations as unknown as { slug: string; path: string } | null;
      if (!location) return [];
      const province = location.path.split('.')[1] ?? 'nepal';
      return [
        {
          url: `${base}/properties/${province}/${location.slug}/${row.slug}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        },
      ];
    });

    return [...staticRoutes, ...provinceRoutes, ...propertyRoutes];
  } catch {
    // A sitemap that 500s is worse than a small one.
    return staticRoutes;
  }
}
