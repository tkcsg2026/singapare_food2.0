-- ============================================================================
-- Auto-Post Supabase Migration — singapore_food2.0 (The Kitchen Connection)
-- ============================================================================
-- Purpose:
--   Extend the existing public.news_articles table with everything the
--   `auto_post.py` automation needs: tags, an explicit display date, and the
--   Instagram cross-posting tracking columns.
--
--   This file is the *single source of truth* for the auto-post schema and is
--   independent of supabase-complete.sql so it can be re-run on production
--   without touching seed data.
--
-- Safe to re-run. Every statement is idempotent.
-- Run with: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

-- ── 1. Make sure required base columns exist (in case migrating from an older
--      version of supabase-complete.sql) ─────────────────────────────────────
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS title          text  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_ja       text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS excerpt        text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS excerpt_ja     text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS content        text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS content_ja     text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS image          text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS category       text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS author         text  DEFAULT '',
  ADD COLUMN IF NOT EXISTS published      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at   timestamptz;


-- ── 2. Tags array ───────────────────────────────────────────────────────────
-- auto_post.py writes DEFAULT_TAGS = ['F&B News', 'Singapore'] on every row.
-- The column DEFAULT mirrors this list so articles created manually from the
-- admin dashboard (which never sends a `tags` field — see
-- src/pages/AdminDashboard.tsx :1896-1900) also receive the brand tags.
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY['F&B News', 'Singapore'];

-- Re-assert the default in case the column already existed with a different one.
ALTER TABLE public.news_articles
  ALTER COLUMN tags SET DEFAULT ARRAY['F&B News', 'Singapore'];

-- Backfill empty rows so existing seeded articles match.
UPDATE public.news_articles
   SET tags = ARRAY['F&B News', 'Singapore']
 WHERE tags IS NULL OR cardinality(tags) = 0;

CREATE INDEX IF NOT EXISTS news_articles_tags_gin
  ON public.news_articles USING gin (tags);


-- ── 3. Explicit display date ────────────────────────────────────────────────
-- Some editors prefer setting a display_date that differs from published_at
-- (e.g. backdate an evergreen feature). We add the column but the site falls
-- back to published_at / created_at when it is NULL.
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS display_date timestamptz;


-- ── 4. Instagram cross-post tracking ────────────────────────────────────────
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS instagram_caption    text,
  ADD COLUMN IF NOT EXISTS instagram_posted     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_post_id    text,
  ADD COLUMN IF NOT EXISTS instagram_posted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_attempts   integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instagram_last_error text;

-- Index that powers pick_for_instagram() — finds the next candidate fast.
CREATE INDEX IF NOT EXISTS news_articles_instagram_queue_idx
  ON public.news_articles (instagram_posted, published, category, published_at DESC)
  WHERE instagram_posted = false AND published = true;


-- ── 5. RLS: keep existing policies; service_role bypasses them anyway ───────
-- auto_post.py uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS. Public
-- readers continue to see only published rows via the existing policy from
-- supabase-complete.sql:312.
-- (No changes required here — listed for clarity.)


-- ── 6. Storage: news image bucket ───────────────────────────────────────────
-- Reuses the existing public "logos" bucket. If a dedicated "news" bucket is
-- preferred, create it here and set SUPABASE_NEWS_BUCKET=news in the script
-- environment.
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ── 7. Smoke check ──────────────────────────────────────────────────────────
DO $$
DECLARE
  required text[] := ARRAY[
    'tags', 'display_date',
    'instagram_caption', 'instagram_posted', 'instagram_post_id',
    'instagram_posted_at', 'instagram_attempts', 'instagram_last_error'
  ];
  missing  text[];
BEGIN
  SELECT array_agg(c)
    INTO missing
    FROM unnest(required) AS c
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'news_articles'
        AND column_name  = c
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'auto_post_migration: missing columns: %', missing;
  END IF;
  RAISE NOTICE 'auto_post_migration OK — all columns present.';
END $$;
