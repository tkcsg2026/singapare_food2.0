-- ================================================================
-- new_all.sql
-- Combined incremental migrations. This is the only file to extend
-- for future schema changes — do not add new .sql files.
--
-- Sources (in dependency order):
--   1. shop_listings_migration.sql
--      Shop / Takeover board table + RLS
--   2. community_and_wanted_migration.sql
--      Available/Wanted sides + F&B Community forum
--   3. auto_post_migration.sql
--      news_articles tags, display_date, Instagram tracking
--
-- Idempotent: safe to re-run. Every CREATE / ALTER / POLICY uses
-- IF NOT EXISTS or DROP IF EXISTS.
--
-- Apply only via Supabase Dashboard → SQL Editor → paste → Run
-- when you explicitly choose to. Do not apply automatically.
-- Requires the base schema (profiles, marketplace_items,
-- news_articles) from supabase-complete.sql.
-- ================================================================


-- ================================================================
-- PART 1 — Shop Listings ("Shops for Rent / Takeover" board)
-- From: supabase/shop_listings_migration.sql
-- Must run before Part 2, which ALTERs this table.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.shop_listings (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug             text        UNIQUE NOT NULL,
  title            text        NOT NULL,
  listing_type     text        NOT NULL DEFAULT 'rent' CHECK (listing_type IN ('rent','takeover','both')),
  location         text        DEFAULT '',
  building         text        DEFAULT '',
  monthly_rent     text        DEFAULT '',
  floor_size       text        DEFAULT '',
  asking_price     text        DEFAULT '',
  lease_remaining  text        DEFAULT '',
  suitable_for     text        DEFAULT '',
  key_features     text[]      DEFAULT '{}',
  reason           text        DEFAULT '',
  description      text        DEFAULT '',
  image            text        DEFAULT '',
  images           text[]      DEFAULT '{}',
  seller_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_name      text        DEFAULT '',
  seller_whatsapp  text        DEFAULT '',
  status           text        DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason    text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.shop_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read approved" ON public.shop_listings;
DROP POLICY IF EXISTS "Users insert own"     ON public.shop_listings;
DROP POLICY IF EXISTS "Users update own"     ON public.shop_listings;
DROP POLICY IF EXISTS "Users delete own"     ON public.shop_listings;
CREATE POLICY "Public read approved" ON public.shop_listings FOR SELECT USING (
  status = 'approved' OR seller_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Non-admins can only create/keep rows in 'pending' state, so the admin
-- approval flow cannot be bypassed via direct PostgREST calls.
CREATE POLICY "Users insert own" ON public.shop_listings FOR INSERT
  WITH CHECK (
    (seller_id = auth.uid() AND status = 'pending') OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users update own" ON public.shop_listings FOR UPDATE USING (
  seller_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  (seller_id = auth.uid() AND status = 'pending') OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users delete own" ON public.shop_listings FOR DELETE USING (
  seller_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS shop_listings_created_at_idx ON public.shop_listings (created_at DESC);
CREATE INDEX IF NOT EXISTS shop_listings_status_idx     ON public.shop_listings (status);


-- ================================================================
-- PART 2 — Available / Wanted sides + F&B Community forum
-- From: supabase/community_and_wanted_migration.sql
-- ================================================================

-- ----------------------------------------------------------------
-- 2.1 Shop / Takeover - "Available" vs "Wanted" side
--     'available' = For Rent / Takeover (someone offering a space)
--     'wanted'    = Looking for Shop / Business
-- ----------------------------------------------------------------
ALTER TABLE public.shop_listings
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'available';

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shop_listings_post_type_check'
  ) THEN
    ALTER TABLE public.shop_listings
      ADD CONSTRAINT shop_listings_post_type_check
      CHECK (post_type IN ('available', 'wanted'));
  END IF;
END $do$;

CREATE INDEX IF NOT EXISTS shop_listings_post_type_idx
  ON public.shop_listings (post_type);


-- ----------------------------------------------------------------
-- 2.2 Used F&B Equipment - "Selling" vs "Wanted" side
--     'selling' = item offered for sale (all existing rows)
--     'wanted'  = someone looking to buy equipment
-- ----------------------------------------------------------------
ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'selling';

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_items_post_type_check'
  ) THEN
    ALTER TABLE public.marketplace_items
      ADD CONSTRAINT marketplace_items_post_type_check
      CHECK (post_type IN ('selling', 'wanted'));
  END IF;
END $do$;

CREATE INDEX IF NOT EXISTS marketplace_items_post_type_idx
  ON public.marketplace_items (post_type);


-- ----------------------------------------------------------------
-- 2.3 F&B Community - threads
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_threads (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title          text        NOT NULL,
  content        text        NOT NULL DEFAULT '',
  -- Fixed, small category set; free-form detail lives in `tags`.
  category       text        NOT NULL DEFAULT 'general',
  tags           text[]      NOT NULL DEFAULT '{}',
  author_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name    text        NOT NULL DEFAULT '',
  author_avatar  text        NOT NULL DEFAULT '',
  reply_count    integer     NOT NULL DEFAULT 0,
  view_count     integer     NOT NULL DEFAULT 0,
  -- Threads are ordered by this, so a thread with a new reply floats to the top.
  last_reply_at  timestamptz NOT NULL DEFAULT now(),
  pinned         boolean     NOT NULL DEFAULT false,
  locked         boolean     NOT NULL DEFAULT false,
  status         text        NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_threads_category_check'
  ) THEN
    ALTER TABLE public.community_threads
      ADD CONSTRAINT community_threads_category_check
      CHECK (category IN (
        'general',        -- General Discussion
        'suppliers',      -- Suppliers & Vendors
        'staff',          -- Staff & Hiring
        'shop',           -- Shop, Rent & Takeover
        'equipment',      -- Equipment & Operations
        'business',       -- Business & Marketing
        'collaboration'   -- Collaboration & Opportunities
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_threads_status_check'
  ) THEN
    ALTER TABLE public.community_threads
      ADD CONSTRAINT community_threads_status_check
      CHECK (status IN ('active', 'hidden', 'deleted'));
  END IF;
END $do$;

CREATE INDEX IF NOT EXISTS community_threads_last_reply_idx
  ON public.community_threads (pinned DESC, last_reply_at DESC);
CREATE INDEX IF NOT EXISTS community_threads_category_idx
  ON public.community_threads (category);
CREATE INDEX IF NOT EXISTS community_threads_status_idx
  ON public.community_threads (status);
CREATE INDEX IF NOT EXISTS community_threads_tags_idx
  ON public.community_threads USING gin (tags);


-- ----------------------------------------------------------------
-- 2.4 F&B Community - replies
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_replies (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id     uuid        NOT NULL REFERENCES public.community_threads(id) ON DELETE CASCADE,
  content       text        NOT NULL,
  author_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name   text        NOT NULL DEFAULT '',
  author_avatar text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_replies_status_check'
  ) THEN
    ALTER TABLE public.community_replies
      ADD CONSTRAINT community_replies_status_check
      CHECK (status IN ('active', 'deleted'));
  END IF;
END $do$;

CREATE INDEX IF NOT EXISTS community_replies_thread_idx
  ON public.community_replies (thread_id, created_at);


-- ----------------------------------------------------------------
-- 2.5 Keep reply_count / last_reply_at accurate
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_sync_thread_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  target uuid := COALESCE(NEW.thread_id, OLD.thread_id);
BEGIN
  UPDATE public.community_threads t
     SET reply_count = (
           SELECT COUNT(*) FROM public.community_replies r
            WHERE r.thread_id = target AND r.status = 'active'
         ),
         last_reply_at = COALESCE(
           (SELECT MAX(r.created_at) FROM public.community_replies r
             WHERE r.thread_id = target AND r.status = 'active'),
           t.created_at
         )
   WHERE t.id = target;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS community_replies_sync ON public.community_replies;
CREATE TRIGGER community_replies_sync
AFTER INSERT OR UPDATE OR DELETE ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.community_sync_thread_activity();


-- Atomic view counter so concurrent readers do not clobber each other.
CREATE OR REPLACE FUNCTION public.increment_community_thread_views(thread uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE public.community_threads
     SET view_count = view_count + 1
   WHERE id = thread;
$fn$;

GRANT EXECUTE ON FUNCTION public.increment_community_thread_views(uuid) TO anon, authenticated;


-- ----------------------------------------------------------------
-- 2.6 Row Level Security
--     Writes normally go through the API (service role), but these
--     policies keep direct PostgREST access safe too.
-- ----------------------------------------------------------------
ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active threads" ON public.community_threads;
DROP POLICY IF EXISTS "Users insert own threads"   ON public.community_threads;
DROP POLICY IF EXISTS "Users update own threads"   ON public.community_threads;
DROP POLICY IF EXISTS "Users delete own threads"   ON public.community_threads;

CREATE POLICY "Public read active threads" ON public.community_threads FOR SELECT USING (
  status = 'active' OR author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users insert own threads" ON public.community_threads FOR INSERT
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users update own threads" ON public.community_threads FOR UPDATE USING (
  author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users delete own threads" ON public.community_threads FOR DELETE USING (
  author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Public read active replies" ON public.community_replies;
DROP POLICY IF EXISTS "Users insert own replies"   ON public.community_replies;
DROP POLICY IF EXISTS "Users update own replies"   ON public.community_replies;
DROP POLICY IF EXISTS "Users delete own replies"   ON public.community_replies;

CREATE POLICY "Public read active replies" ON public.community_replies FOR SELECT USING (
  status = 'active' OR author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users insert own replies" ON public.community_replies FOR INSERT
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users update own replies" ON public.community_replies FOR UPDATE USING (
  author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users delete own replies" ON public.community_replies FOR DELETE USING (
  author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ================================================================
-- PART 3 — Auto-post (news_articles tags + Instagram tracking)
-- From: supabase/auto_post_migration.sql
-- ================================================================

-- 3.1 Make sure required base columns exist (in case migrating from an older
--     version of supabase-complete.sql)
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


-- 3.2 Tags array
-- auto_post.py writes DEFAULT_TAGS = ['F&B News', 'Singapore'] on every row.
-- The column DEFAULT mirrors this list so articles created manually from the
-- admin dashboard (which never sends a `tags` field) also receive the brand tags.
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


-- 3.3 Explicit display date
-- Some editors prefer setting a display_date that differs from published_at
-- (e.g. backdate an evergreen feature). We add the column but the site falls
-- back to published_at / created_at when it is NULL.
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS display_date timestamptz;


-- 3.4 Instagram cross-post tracking
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


-- 3.5 RLS: keep existing policies; service_role bypasses them anyway.
-- auto_post.py uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS. Public
-- readers continue to see only published rows via the existing policy.
-- (No changes required here — listed for clarity.)


-- 3.6 Storage: news image bucket
-- Reuses the existing public "logos" bucket. If a dedicated "news" bucket is
-- preferred, create it here and set SUPABASE_NEWS_BUCKET=news in the script
-- environment.
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ================================================================
-- VERIFY — fail the script if any required object is missing
-- ================================================================
DO $check$
DECLARE
  missing text[] := ARRAY[]::text[];
  news_cols text[] := ARRAY[
    'tags', 'display_date',
    'instagram_caption', 'instagram_posted', 'instagram_post_id',
    'instagram_posted_at', 'instagram_attempts', 'instagram_last_error'
  ];
  c text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'shop_listings'
  ) THEN
    missing := missing || 'table:shop_listings';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'shop_listings'
       AND column_name = 'post_type'
  ) THEN
    missing := missing || 'column:shop_listings.post_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'marketplace_items'
       AND column_name = 'post_type'
  ) THEN
    missing := missing || 'column:marketplace_items.post_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'community_threads'
  ) THEN
    missing := missing || 'table:community_threads';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'community_replies'
  ) THEN
    missing := missing || 'table:community_replies';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'community_sync_thread_activity'
  ) THEN
    missing := missing || 'function:community_sync_thread_activity';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'increment_community_thread_views'
  ) THEN
    missing := missing || 'function:increment_community_thread_views';
  END IF;

  FOREACH c IN ARRAY news_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'news_articles'
         AND column_name  = c
    ) THEN
      missing := missing || ('column:news_articles.' || c);
    END IF;
  END LOOP;

  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'new_all.sql: missing objects: %', missing;
  END IF;

  RAISE NOTICE 'new_all.sql OK — shop_listings, community, auto-post all present.';
END $check$;


-- Refresh PostgREST schema cache once, after every object is in place.
NOTIFY pgrst, 'reload schema';
