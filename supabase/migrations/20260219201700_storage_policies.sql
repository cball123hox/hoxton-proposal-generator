-- ============================================================
-- 004: Storage buckets + RLS policies
-- ============================================================

-- 1. Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('slides', 'slides', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- proposals bucket may already exist; ensure it's private
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposals', 'proposals', false)
ON CONFLICT (id) DO NOTHING;

-- ── slides bucket policies ──────────────────────────────────
-- Public read (bucket is public, so objects are readable via public URL)
-- Only system_admin can insert / update / delete
CREATE POLICY "slides: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'slides'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "slides: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'slides'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "slides: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'slides'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'system_admin'
    )
  );

-- ── avatars bucket policies ─────────────────────────────────
-- Public read (bucket is public)
-- Users can insert/update/delete their own avatars (path starts with their user id)
CREATE POLICY "avatars: user insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: user update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: user delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── proposals bucket policies ───────────────────────────────
-- Users can read their own proposals (path = proposals/{user_id}/*)
CREATE POLICY "proposals: user read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proposals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all proposals
CREATE POLICY "proposals: admin read all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proposals'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'system_admin'
    )
  );

-- Service role handles inserts (PDF generation runs server-side)
-- No INSERT policy needed for authenticated users on proposals bucket
