/** DTOs for the admin control centre. */

export type AdminStats = {
  users_total: number;
  users_new_7d: number;
  users_suspended: number;
  vendors_total: number;
  properties_published: number;
  properties_pending: number;
  properties_total: number;
  reports_open: number;
  reports_overdue: number;
  payments_pending: number;
  enquiries_7d: number;
  verifications_pending: number;
};

export type ModerationItem = {
  id: string;
  title: string;
  reference_code: string;
  price: number;
  transaction_type: 'sale' | 'rent' | 'lease' | 'short_stay';
  category: string;
  subtype: string;
  address_line: string | null;
  created_at: string;
  status: string;
  owner: { id: string; full_name: string | null; role: string } | null;
  location: { name_en: string; name_ne: string | null } | null;
  images: Array<{
    storage_path: string;
    rendition_paths: Record<string, string> | null;
    is_cover: boolean;
  }>;
};

export type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  status: string;
  agency_id: string | null;
  identity_verified_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  last_seen_at: string | null;
};

export type ReportItem = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  detail: string | null;
  status: string;
  due_at: string;
  created_at: string;
  resolution: string | null;
  resolved_at: string | null;
  reporter: { id: string; full_name: string | null } | null;
};

export type PaymentReviewItem = {
  id: string;
  amount: number;
  purpose: string;
  reference: string | null;
  note: string | null;
  proof_path: string;
  status: string;
  created_at: string;
  property: { id: string; title: string; reference_code: string } | null;
  payer: { id: string; full_name: string | null } | null;
  payee: { id: string; full_name: string | null } | null;
};

export type AuditEntry = {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip: unknown;
  created_at: string;
};
