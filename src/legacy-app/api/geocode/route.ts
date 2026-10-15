import { NextResponse } from 'next/server';

const NOMINATIM_HEADERS = {
  'User-Agent': 'Kitta-RealEstate/1.0 (ops@gharbeti.example)',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * GET /api/geocode?q=...        → forward geocode (address → coords)
 * GET /api/geocode?lat=...&lon=... → reverse geocode (coords → address)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  // --- Reverse geocode ---
  if (lat && lon) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'json');
      url.searchParams.set('lat', lat);
      url.searchParams.set('lon', lon);
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('email', 'ops@gharbeti.example');

      const res = await fetch(url.toString(), {
        headers: NOMINATIM_HEADERS,
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        return NextResponse.json({ display_name: '' }, { status: 502 });
      }

      const data = await res.json();
      return NextResponse.json({
        display_name: data.display_name || '',
        address: data.address || {},
      });
    } catch (err) {
      console.error('Reverse geocode error:', err);
      return NextResponse.json({ display_name: '' }, { status: 500 });
    }
  }

  // --- Forward geocode ---
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', q);
    url.searchParams.set('countrycodes', 'np');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('limit', '6');
    url.searchParams.set('email', 'ops@gharbeti.example');

    const res = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error('Nominatim responded with', res.status);
      return NextResponse.json([], { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Nominatim proxy error:', err);
    return NextResponse.json([], { status: 500 });
  }
}
