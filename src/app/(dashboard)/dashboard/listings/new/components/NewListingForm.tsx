'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select, Surface, Field } from '@/components/ui/primitives';
import { FadeIn } from '@/components/animations/FadeIn';
import { UploadCloud } from 'lucide-react';
import { AddressAutocomplete } from '@/components/map/AddressAutocomplete';
import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('@/components/map/LocationPickerMap'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-ink-50 animate-pulse rounded-xl" />,
});

export function NewListingForm({
  admin,
  owners,
  features,
}: {
  admin: boolean;
  owners: any[];
  features: any[];
}) {
  const [previews, setPreviews] = useState<{ id: string; url: string }[]>([]);
  const [coordinates, setCoordinates] = useState({ lat: 27.7172, lng: 85.3240 });
  const [address, setAddress] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Clean up old previews to avoid memory leaks
    previews.forEach((p) => URL.revokeObjectURL(p.url));

    const newPreviews = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(7),
      url: URL.createObjectURL(file),
    }));

    setPreviews(newPreviews);
  };

  return (
    <form action="/api/properties/create" method="POST" encType="multipart/form-data" className="space-y-8">
      <FadeIn delay={0.1}>
        <Surface className="p-8 space-y-6">
          <h2 className="text-display-sm font-semibold text-ink-900 border-b border-ink-100 pb-4">Basic Information</h2>
          
          {admin && (
            <Field label="Property Owner" htmlFor="owner_id" hint="As a Master Admin, you must select the owner of this property." required>
              <Select name="owner_id" id="owner_id" required>
                <option value="">Select an owner...</option>
                {owners.map(owner => (
                  <option key={owner.id} value={owner.id}>
                    {owner.full_name || owner.email || owner.id}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Title" htmlFor="title" required>
            <Input 
              type="text" 
              name="title" 
              id="title" 
              required 
              placeholder="e.g. Beautiful 3BHK house in Kathmandu"
            />
          </Field>

          <Field label="Description" htmlFor="description" required>
            <Textarea 
              name="description" 
              id="description" 
              rows={5} 
              required
              placeholder="Describe the property..."
            />
          </Field>
        </Surface>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Surface className="p-8 space-y-6">
          <h2 className="text-display-sm font-semibold text-ink-900 border-b border-ink-100 pb-4">Property Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Category" htmlFor="category" required>
              <Select name="category" id="category" required>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="land">Land</option>
              </Select>
            </Field>
            
            <Field label="Transaction Type" htmlFor="transaction_type" required>
              <Select name="transaction_type" id="transaction_type" required>
                <option value="sale">For Sale</option>
                <option value="rent">For Rent</option>
                <option value="lease">For Lease</option>
              </Select>
            </Field>

            <Field label="Subtype" htmlFor="subtype" required>
              <Select name="subtype" id="subtype" required>
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="residential_land">Plot/Land</option>
                <option value="office">Office Space</option>
              </Select>
            </Field>

            <Field label="Price (NPR)" htmlFor="price" required>
              <Input 
                type="number" 
                name="price" 
                id="price" 
                required 
                min="0"
                placeholder="25000000"
              />
            </Field>
          </div>
        </Surface>
      </FadeIn>

      <FadeIn delay={0.25}>
        <Surface className="p-8 space-y-6">
          <h2 className="text-display-sm font-semibold text-ink-900 border-b border-ink-100 pb-4">Location</h2>
          
          <Field label="Address Line" htmlFor="address_line" hint="Search for streets, hotels, schools, landmarks...">
            <AddressAutocomplete 
              value={address}
              onChange={setAddress}
              onSelectLocation={(lat, lng) => setCoordinates({ lat, lng })}
            />
          </Field>

          <Field label="Exact Location" htmlFor="geom_map" hint="Click on the map or drag the pin to set the exact property location." required>
            <LocationPickerMap 
              initialPosition={coordinates}
              onChange={setCoordinates}
              onAddressResolved={setAddress}
              className="h-[350px] w-full mt-2"
            />
            <input type="hidden" name="geom_lat" value={coordinates.lat} />
            <input type="hidden" name="geom_lng" value={coordinates.lng} />
          </Field>
        </Surface>
      </FadeIn>

      <FadeIn delay={0.3}>
        <Surface className="p-8 space-y-6">
          <h2 className="text-display-sm font-semibold text-ink-900 border-b border-ink-100 pb-4">Media</h2>
          
          <Field label="Upload Property Images" htmlFor="images" hint="You can select multiple files at once. First image will be the cover.">
            <div className="relative group rounded-xl overflow-hidden mt-2">
              <input 
                type="file" 
                name="images" 
                id="images" 
                multiple
                accept="image/jpeg, image/png, image/webp"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-ink-200 rounded-xl p-10 bg-ink-50/50 group-hover:bg-royal-50/50 group-hover:border-royal-300 transition-colors">
                <UploadCloud className="size-10 text-ink-400 group-hover:text-royal-500 mb-4 transition-colors" />
                <p className="text-sm font-medium text-ink-700">
                  <span className="text-royal-600 font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-ink-500 mt-2">SVG, PNG, JPG or WEBP</p>
              </div>
            </div>
          </Field>

          {previews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
              {previews.map((preview, index) => (
                <div key={preview.id} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-ink-200 shadow-sm transition-transform hover:scale-[1.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={`Preview ${index}`} className="absolute inset-0 w-full h-full object-cover" />
                  {index === 0 && (
                    <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-md font-medium shadow-sm">
                      Cover
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Surface>
      </FadeIn>

      <FadeIn delay={0.4}>
        <Surface className="p-8 space-y-6">
          <h2 className="text-display-sm font-semibold text-ink-900 border-b border-ink-100 pb-4">Amenities & Features</h2>
          
          {features.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {features.map((f: any) => (
                <label key={f.id} className="flex items-center gap-3 p-3 rounded-lg border border-ink-100 bg-ink-50/50 hover:bg-ink-50 transition-colors cursor-pointer shadow-sm group">
                  <input type="checkbox" name="feature_ids" value={f.id} className="w-5 h-5 rounded-md border-ink-300 text-royal-600 focus:ring-royal-500/30 transition-all cursor-pointer group-hover:border-royal-400" />
                  <span className="text-sm font-medium text-ink-800">{f.label_en}</span>
                </label>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Field label="Custom Amenities (comma separated)" htmlFor="new_features" hint="These will be created and saved for others to use as well.">
              <Input 
                type="text" 
                name="new_features" 
                id="new_features"
                placeholder="e.g. Swimming Pool, Solar Water Heater, Gym"
              />
            </Field>
          </div>
        </Surface>
      </FadeIn>

      <FadeIn delay={0.5} className="flex justify-end pt-4">
        <Button type="submit" size="lg" className="w-full sm:w-auto px-8 text-base">
          Create Listing
        </Button>
      </FadeIn>
    </form>
  );
}
