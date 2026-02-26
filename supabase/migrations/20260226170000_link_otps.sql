-- OTP verification for public proposal viewer
-- Clients must verify their email via a 6-digit code before viewing proposals

create table if not exists public.link_otps (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.proposal_links(id) on delete cascade,
  code text not null,  -- SHA-256 hashed
  expires_at timestamptz not null,
  is_used boolean not null default false,
  attempts integer not null default 0,
  session_token text,  -- set when verified, used for session validation
  session_expires_at timestamptz,  -- 2 hours after verification
  created_at timestamptz not null default now()
);

create index idx_link_otps_link_id on public.link_otps(link_id);

alter table public.link_otps enable row level security;

-- Anon can insert (Edge Function creates OTPs via service role, but verify flow needs update)
create policy "Anon can insert link_otps"
  on public.link_otps for insert
  to anon
  with check (true);

-- Anon can update (to increment attempts, mark used)
create policy "Anon can update link_otps"
  on public.link_otps for update
  to anon
  using (true);

-- Anon can select (for verification checks)
create policy "Anon can select link_otps"
  on public.link_otps for select
  to anon
  using (true);

-- Authenticated users can read OTPs for their links (admin/analytics)
create policy "Authenticated can read link_otps"
  on public.link_otps for select
  to authenticated
  using (
    exists (
      select 1 from public.proposal_links pl
      where pl.id = link_otps.link_id
        and (pl.sent_by = auth.uid() or exists (
          select 1 from public.profiles where id = auth.uid() and role = 'system_admin'
        ))
    )
  );
