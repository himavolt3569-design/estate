import type { NextConfig } from 'next';

/**
 * Security headers that do not need a per-request nonce.
 * The CSP itself is set in middleware.ts, because a strict policy needs a fresh
 * nonce per response and next.config headers are static.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Geolocation is the only capability the product uses, and only from our
    // own origin ("Nearby" search). Everything else is denied outright.
    key: 'Permissions-Policy',
    value: [
      'geolocation=(self)',
      'camera=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'interest-cohort=()',
    ].join(', '),
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321').hostname;
  } catch {
    return 'localhost';
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    // Import only what is used from these packages rather than the barrel.
    optimizePackageImports: ['lucide-react', 'date-fns', 'framer-motion'],

    /*
     * Default is 1 MB, and the hero image upload used to sail past it — the
     * admin saw a raw Next.js "Body exceeded 1 MB limit" error.
     *
     * That upload now resizes in the browser first and lands well under a
     * megabyte, so this is headroom rather than the fix: an unusually detailed
     * photo that compresses badly should not fail, and the number is kept low
     * because every action body is buffered in server memory before it is
     * read. Anything genuinely large belongs in Storage, uploaded straight
     * from the browser the way property photos are.
     */
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },

  images: {
    // Storage renditions are already compressed and correctly sized by the
    // client-side pipeline (docs/01-architecture.md §6), so next/image is used
    // only for the few assets that genuinely benefit from it.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' },
      { protocol: 'http', hostname: 'localhost', port: '54321', pathname: '/storage/v1/object/public/**' },
    ],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // The worker must never be served stale, or a bad deploy becomes permanent.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ];
  },

  async redirects() {
    return [
      // The canonical listing URL carries its province and district for SEO.
      { source: '/property/:slug', destination: '/properties/:slug', permanent: true },
    ];
  },
};

export default nextConfig;
