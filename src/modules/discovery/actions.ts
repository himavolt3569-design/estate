'use server';

import { searchProperties } from './queries';
import type { SearchFilters } from './types';

export async function fetchPropertiesAction(filters: SearchFilters, cursor?: string | null) {
  return searchProperties(filters, cursor, 8);
}
