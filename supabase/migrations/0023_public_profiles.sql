-- =============================================================================
-- 0023 — Public seller profiles
--
-- profiles has no anon SELECT policy, deliberately: the table carries phone
-- numbers, identity-verification timestamps and account status, none of which
-- belong to the public. That left no way at all to show a seller to a visitor,
-- which is part of why avatars never appeared outside the owner's own settings
-- page.
--
-- The answer is the same one get_property_public() uses: a SECURITY DEFINER
-- projection that returns a fixed, safe column list, rather than a policy that
-- opens the table and then tries to hide columns.
--
-- A profile is public only if the person has at least one live listing. Being
-- registered is not consent to having a public page; offering property to the
-- public is.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'id', pr.id,
    'name', pr.full_name,
    'avatarUrl', pr.avatar_url,
    'bio', pr.bio,
    'role', pr.role,
    'identityVerified', pr.identity_verified_at is not null,
    'memberSince', pr.created_at,
    'agency', (
      select jsonb_build_object(
        'id', ag.id, 'name', ag.name, 'slug', ag.slug,
        'logoUrl', ag.logo_url, 'verified', ag.verified_at is not null
      )
      from public.agencies ag where ag.id = pr.agency_id
    ),
    'listingCount', (
      select count(*)
        from public.properties p
       where p.owner_id = pr.id
         and p.status = 'published'
         and p.deleted_at is null
         and (p.expires_at is null or p.expires_at > now())
    ),
    'verifiedListingCount', (
      select count(*)
        from public.properties p
       where p.owner_id = pr.id
         and p.status = 'published'
         and p.deleted_at is null
         and p.verified_at is not null
         and (p.expires_at is null or p.expires_at > now())
    )
  )
  from public.profiles pr
  where pr.id = p_user_id
    and pr.deleted_at is null
    and pr.status = 'active'
    -- Only people who actually offer property to the public have a public page.
    and exists (
      select 1 from public.properties p
       where p.owner_id = pr.id
         and p.status = 'published'
         and p.deleted_at is null
         and (p.expires_at is null or p.expires_at > now())
    );
$$;

comment on function public.get_public_profile is
  'Safe public projection of a seller. Excludes phone, email, status and '
  'identity documents. Returns null for anyone with no live listing.';

grant execute on function public.get_public_profile(uuid) to anon, authenticated;
