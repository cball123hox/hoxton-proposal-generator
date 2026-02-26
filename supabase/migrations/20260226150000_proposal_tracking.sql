-- Proposal Tracking Links
-- Enables advisers to send proposals via unique tracking links with view analytics

-- ── proposal_links ──
create table if not exists public.proposal_links (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  token text not null unique,
  recipient_email text not null,
  recipient_name text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  allow_download boolean not null default true,
  sent_at timestamptz not null default now(),
  sent_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_proposal_links_proposal_id on public.proposal_links(proposal_id);
create unique index idx_proposal_links_token on public.proposal_links(token);

alter table public.proposal_links enable row level security;

-- Authenticated users can manage their own links
create policy "Users can view own links"
  on public.proposal_links for select
  to authenticated
  using (sent_by = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'system_admin'
  ));

create policy "Users can insert own links"
  on public.proposal_links for insert
  to authenticated
  with check (sent_by = auth.uid());

create policy "Users can update own links"
  on public.proposal_links for update
  to authenticated
  using (sent_by = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'system_admin'
  ));

create policy "Users can delete own links"
  on public.proposal_links for delete
  to authenticated
  using (sent_by = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'system_admin'
  ));

-- Anon users can read a link by token (for public viewer)
create policy "Anon can view link by token"
  on public.proposal_links for select
  to anon
  using (true);


-- ── link_views ──
create table if not exists public.link_views (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.proposal_links(id) on delete cascade,
  viewer_ip text,
  user_agent text,
  device_type text,
  referrer text,
  country text,
  is_unique_visitor boolean not null default true,
  session_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index idx_link_views_link_id on public.link_views(link_id);

alter table public.link_views enable row level security;

-- Anon can insert views (public viewer tracks views)
create policy "Anon can insert views"
  on public.link_views for insert
  to anon
  with check (true);

-- Authenticated users can view analytics for their own links
create policy "Users can view own link views"
  on public.link_views for select
  to authenticated
  using (exists (
    select 1 from public.proposal_links pl
    where pl.id = link_id
    and (pl.sent_by = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'system_admin'
    ))
  ));


-- ── slide_analytics ──
create table if not exists public.slide_analytics (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.link_views(id) on delete cascade,
  link_id uuid not null references public.proposal_links(id) on delete cascade,
  slide_index integer not null,
  slide_title text,
  time_entered timestamptz not null default now(),
  time_exited timestamptz,
  duration_seconds numeric
);

create index idx_slide_analytics_link_id on public.slide_analytics(link_id);
create index idx_slide_analytics_view_id on public.slide_analytics(view_id);

alter table public.slide_analytics enable row level security;

-- Anon can insert slide analytics (public viewer tracks slides)
create policy "Anon can insert slide analytics"
  on public.slide_analytics for insert
  to anon
  with check (true);

-- Authenticated users can view analytics for their own links
create policy "Users can view own slide analytics"
  on public.slide_analytics for select
  to authenticated
  using (exists (
    select 1 from public.proposal_links pl
    where pl.id = link_id
    and (pl.sent_by = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'system_admin'
    ))
  ));
