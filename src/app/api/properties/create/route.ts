import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, isVendor } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const vendor = isVendor(user.role);
    const admin = user.role === 'platform_admin';
    if (!vendor && !admin) return new NextResponse('Forbidden', { status: 403 });

    const formData = await request.formData();
    const supabase = await createClient();

    // 1. Determine Owner
    let ownerId = user.id;
    if (admin) {
      const selectedOwner = formData.get('owner_id') as string;
      if (!selectedOwner) return new NextResponse('Admin must select an owner', { status: 400 });
      ownerId = selectedOwner;
    }

    // 2. Insert Property
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as 'residential' | 'commercial' | 'land';
    const transaction_type = formData.get('transaction_type') as 'sale' | 'rent' | 'lease';
    const subtype = formData.get('subtype') as 'house' | 'apartment' | 'residential_land' | 'office';
    const priceRaw = parseInt(formData.get('price') as string, 10);
    const price = priceRaw * 100; // Convert NPR to paisa

    const address_line = formData.get('address_line') as string;
    const geom_lat = parseFloat(formData.get('geom_lat') as string);
    const geom_lng = parseFloat(formData.get('geom_lng') as string);

    const { data: loc } = await supabase.from('locations').select('id').eq('slug', 'kathmandu').single();
    const location_id = loc?.id;

    const slug = `${(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const reference_code = `P-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    const price_period = transaction_type !== 'sale' ? 'monthly' : null;

    const { data: property, error: propError } = await supabase
      .from('properties')
      .insert({
        owner_id: ownerId,
        listed_by_role: admin ? 'property_owner' : (user?.role || 'property_owner'),
        title,
        description,
        category,
        transaction_type,
        subtype,
        price,
        price_period,
        status: 'draft',
        location_id,
        address_line,
        reference_code,
        slug,
        geom: `POINT(${geom_lng} ${geom_lat})`,
      } as any)
      .select('id')
      .single();

    if (propError || !property) {
      console.error('Failed to insert property:', propError);
      return new NextResponse('Internal Error', { status: 500 });
    }

    const propertyId = property.id;

    // 3. Handle Images
    const images = formData.getAll('images') as File[];
    const validImages = images.filter(img => img.size > 0);
    
    for (const img of validImages) {
      const ext = img.name.split('.').pop();
      const filename = `${crypto.randomUUID()}.${ext}`;
      const path = `${propertyId}/${filename}`;
      
      const { error: uploadError } = await supabase.storage
        .from('property-media')
        .upload(path, img);

      if (!uploadError) {
        await supabase.from('property_images').insert({
          property_id: propertyId,
          storage_path: path
        });
      } else {
        console.error('Image upload failed:', uploadError);
      }
    }

    // 4. Handle Existing Features
    const featureIds = formData.getAll('feature_ids') as string[];
    if (featureIds.length > 0) {
      const featureInserts = featureIds.map(fid => ({
        property_id: propertyId,
        feature_id: fid
      }));
      await supabase.from('property_features').insert(featureInserts);
    }

    // 5. Handle New Features (Multi-tenant dynamic creation)
    const newFeaturesRaw = formData.get('new_features') as string;
    if (newFeaturesRaw && newFeaturesRaw.trim() !== '') {
      const newFeatureNames = newFeaturesRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);
      
      for (const name of newFeatureNames) {
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!key) continue;

        // Try to insert feature, ignore if duplicate key
        const { data: feature, error: featureErr } = await supabase
          .from('features')
          .insert({
            key,
            label_en: name,
            category: 'general'
          })
          .select('id')
          .single();

        let featureId = feature?.id;
        
        // If it already existed (unique constraint violation), fetch it
        if (featureErr && featureErr.code === '23505') {
          const { data: existing } = await supabase
            .from('features')
            .select('id')
            .eq('key', key)
            .single();
          featureId = existing?.id;
        }

        if (featureId) {
          await supabase.from('property_features').insert({
            property_id: propertyId,
            feature_id: featureId
          });
        }
      }
    }

    // 6. Redirect to success or edit page
    return NextResponse.redirect(new URL('/dashboard/listings', request.url));

  } catch (err) {
    console.error('Error creating property:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
