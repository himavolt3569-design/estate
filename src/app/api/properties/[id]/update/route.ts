import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, isVendor } from '@/lib/auth/session';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: propertyId } = await params;
    const user = await getSessionUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const vendor = isVendor(user.role);
    const admin = user.role === 'platform_admin';
    if (!vendor && !admin) return new NextResponse('Forbidden', { status: 403 });

    const formData = await request.formData();
    const supabase = await createClient();

    // 1. Verify property ownership or admin
    const { data: property, error: propCheckErr } = await supabase
      .from('properties')
      .select('owner_id')
      .eq('id', propertyId)
      .single();

    if (propCheckErr || !property) {
      return new NextResponse('Property not found', { status: 404 });
    }
    
    if (!admin && property.owner_id !== user.id) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 2. Update Property
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as 'residential' | 'commercial' | 'land';
    const transaction_type = formData.get('transaction_type') as 'sale' | 'rent' | 'lease';
    const subtype = formData.get('subtype') as 'house' | 'apartment' | 'residential_land' | 'office';
    const priceRaw = parseInt(formData.get('price') as string, 10);
    const price = priceRaw * 100;

    const address_line = formData.get('address_line') as string;
    const geom_lat = parseFloat(formData.get('geom_lat') as string);
    const geom_lng = parseFloat(formData.get('geom_lng') as string);
    const price_period = transaction_type !== 'sale' ? 'monthly' : null;

    const { error: propError } = await supabase
      .from('properties')
      .update({
        title,
        description,
        category,
        transaction_type,
        subtype,
        price,
        price_period,
        address_line,
        geom: `POINT(${geom_lng} ${geom_lat})`,
      } as any)
      .eq('id', propertyId);

    if (propError) {
      console.error('Failed to update property:', propError);
      return new NextResponse('Internal Error', { status: 500 });
    }

    // 3. Handle New Images (append)
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

    // 4. Handle Features (delete old and insert new)
    const featureIds = formData.getAll('feature_ids') as string[];
    
    // First remove all existing features
    await supabase.from('property_features').delete().eq('property_id', propertyId);
    
    // Insert new selected features
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

        // Try to insert feature
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

    // 6. Redirect to success or listings page
    return NextResponse.redirect(new URL('/dashboard/listings', request.url));

  } catch (err) {
    console.error('Error updating property:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
