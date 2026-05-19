# Kitchenware hub

## What this is

- **`/kitchenware`** lists **your curated retailer URLs** with a retail-style card layout.
- **Logos** load from Clearbit’s public logo endpoint where available; otherwise initials are shown.
- **Card backgrounds** and **“Ideas & inspiration”** tiles use **Unsplash** (royalty-free stock), **not** scraped product photos from retailers.

## Why we don’t import their catalog into `marketplace_items`

Copying product images, descriptions, and prices from IKEA, Le Creuset, etc. into your database typically **violates those sites’ terms and copyright/trademark law**. The marketplace is for **your users’ listings**, not mirroring third-party catalogues.

## “Database” option

If you need this data queryable server-side, use the JSON API:

- `GET /api/kitchenware` → `{ retailers, showcase, updated }`

You can later sync that JSON into your own Supabase table (e.g. `curated_retailers`) **without** storing their copyrighted product shots—only URLs and your own short blurbs.

## Adding or editing retailers

Edit:

- `src/data/kitchenwareRetailers.ts`
- `src/data/kitchenwareShowcase.ts`

Then redeploy.
