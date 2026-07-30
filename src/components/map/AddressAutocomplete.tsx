'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/primitives';
import { MapPin, Loader2 } from 'lucide-react';

export type AddressSuggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

export function AddressAutocomplete({
  value,
  onChange,
  onSelectLocation,
  defaultValue,
}: {
  value?: string;
  onChange?: (val: string) => void;
  onSelectLocation: (lat: number, lng: number) => void;
  defaultValue?: string;
}) {
  const [query, setQuery] = useState(defaultValue || '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 3 || !isOpen) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Proxy through our own API route to avoid CORS/CSP issues
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (e) {
        console.error('Address search failed:', e);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [query, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    if (onChange) onChange(val);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    setQuery(suggestion.display_name);
    setIsOpen(false);
    onSelectLocation(parseFloat(suggestion.lat), parseFloat(suggestion.lon));
    if (onChange) onChange(suggestion.display_name);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        type="text"
        name="address_line"
        id="address_line"
        value={value !== undefined ? value : query}
        onChange={handleInputChange}
        onFocus={() => { if (query.length > 2) setIsOpen(true); }}
        placeholder="Search schools, hotels, landmarks, streets..."
        autoComplete="off"
      />
      
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-[100] w-full mt-1.5 bg-white border border-ink-200 rounded-xl shadow-raised max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-ink-500">
              <Loader2 className="size-4 animate-spin" />
              Searching places...
            </div>
          ) : (
            <ul className="py-1">
              {suggestions.map((s: any, i: number) => (
                <li 
                  key={`${s.lat}-${s.lon}-${i}`} 
                  className="px-4 py-3 hover:bg-royal-50 cursor-pointer text-sm text-ink-700 flex items-start gap-3 transition-colors"
                  onClick={() => handleSelect(s)}
                >
                  <MapPin className="size-4 text-royal-500 mt-0.5 shrink-0" />
                  <span className="leading-snug">{s.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
