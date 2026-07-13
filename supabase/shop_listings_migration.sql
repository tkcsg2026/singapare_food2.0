-- ================================================================
-- Shop Listings migration — "Shops for Rent / Takeover" board
-- Idempotent: safe to run multiple times.
-- Apply via Supabase Dashboard → SQL Editor → paste → Run,
-- or: node scripts/run-shop-listings-sql.mjs
-- (requires DB_PASSWORD and SUPABASE_PROJECT_REF env vars)
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

-- RLS policies (drop-first idempotent pattern, mirrors marketplace_items)
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

-- Refresh PostgREST schema cache immediately (avoids "table not found in schema cache" errors).
NOTIFY pgrst, 'reload schema';
