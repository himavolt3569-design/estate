'use client';

import { useState } from 'react';

import { SelectMenu, type SelectOption } from '@/components/ui/select-menu';

/**
 * The filter bar is a plain GET form so a search is shareable and works without
 * JavaScript. Radix renders a hidden native <select> for `name`, so swapping the
 * paint does not cost the form anything: submitting still puts the value in the
 * query string.
 */
export function FilterSelect({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  options: SelectOption[];
}) {
  const [value, setValue] = useState(defaultValue ?? '');

  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 block">
        {label}
      </label>
      <SelectMenu
        id={id}
        name={id}
        value={value}
        onValueChange={setValue}
        options={options}
        ariaLabel={label}
        className="h-11"
      />
    </div>
  );
}
