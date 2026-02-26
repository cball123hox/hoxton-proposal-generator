-- Public Proposal Viewer: anon SELECT policies
-- Allows unauthenticated viewers to read slide data needed for the proposal viewer

-- ── Template data: anon can read (no sensitive data) ──

CREATE POLICY "Anon can read regions"
  ON public.regions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read intro_packs"
  ON public.intro_packs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read intro_slides"
  ON public.intro_slides FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read product_modules"
  ON public.product_modules FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read product_slides"
  ON public.product_slides FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read closing_packs"
  ON public.closing_packs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read closing_slides"
  ON public.closing_slides FOR SELECT
  TO anon
  USING (true);

-- ── Proposal links: anon can read (needed to validate token) ──

CREATE POLICY "Anon can read proposal_links"
  ON public.proposal_links FOR SELECT
  TO anon
  USING (true);

-- ── Proposals: anon can read only if linked via an active proposal_link ──

CREATE POLICY "Anon can read proposals with active links"
  ON public.proposals FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.proposal_links
      WHERE proposal_links.proposal_id = proposals.id
        AND proposal_links.is_active = true
    )
  );

-- ── Analytics: anon can INSERT + UPDATE (create views/slide records, then update exit times) ──

CREATE POLICY "Anon can insert link views"
  ON public.link_views FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update link views"
  ON public.link_views FOR UPDATE
  TO anon
  USING (true);

CREATE POLICY "Anon can read link views"
  ON public.link_views FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert slide analytics"
  ON public.slide_analytics FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update slide analytics"
  ON public.slide_analytics FOR UPDATE
  TO anon
  USING (true);
