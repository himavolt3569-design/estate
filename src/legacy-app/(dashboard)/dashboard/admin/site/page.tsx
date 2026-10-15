import type { Metadata } from 'next';

import { HeroImageControl } from '@/modules/platform/components/HeroImageControl';
import { getHeroImageUrl, listHeroImages } from '@/modules/platform/site-media';

import { PageHeader, Panel } from '../../components/PageHeader';

export const metadata: Metadata = { title: 'Site settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminSitePage() {
  const [current, history] = await Promise.all([getHeroImageUrl(), listHeroImages()]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform"
        title="Site settings"
        subtitle="Things that change what visitors see on the public site."
      />

      <Panel accent className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink-900">Home page background</h2>
        <p className="mt-1.5 mb-6 max-w-2xl text-sm leading-relaxed text-ink-600">
          The picture behind &ldquo;Find Your Dream Home&rdquo;. Changing it takes effect
          immediately. Nothing else about the hero moves.
        </p>

        <HeroImageControl current={current} history={history} />
      </Panel>
    </div>
  );
}
