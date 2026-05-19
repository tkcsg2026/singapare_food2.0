# Singapore F&B Portal

A Next.js web application connecting Singapore's F&B industry — suppliers, chefs, and marketplace.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Supabase** (Database + Auth)
- **Tailwind CSS** + shadcn/ui
- **React Query**

## Getting Started

```sh
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schema in `supabase-schema.sql` via the SQL Editor
3. Copy your project URL and anon key to `.env.local`
4. Enable Email auth in Authentication > Providers

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (suppliers, marketplace, news, etc.)
│   ├── admin-dashboard/   # Admin panel
│   ├── dashboard/         # User dashboard + new item
│   ├── go/               # QR redirect controller
│   ├── login/            # Authentication
│   ├── marketplace/      # Marketplace pages
│   ├── news/             # Industry news
│   ├── register/         # Registration
│   └── suppliers/        # Supplier directory
├── components/            # React components
├── hooks/                # Custom hooks (auth, data fetching)
├── lib/                  # Supabase client, utilities
├── pages/                # Page components
├── types/                # TypeScript types
└── data/                 # Legacy mock data (for reference)
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — search, popular suppliers, marketplace preview |
| `/suppliers` | Supplier directory with filters |
| `/suppliers/[slug]` | Supplier detail with products, certifications |
| `/marketplace` | Chef flea market (Carousell-style) |
| `/marketplace/[slug]` | Item detail with image carousel |
| `/news` | Industry news articles |
| `/login` / `/register` | Supabase authentication |
| `/dashboard` | User listings, profile settings |
| `/dashboard/new-item` | Post new marketplace item |
| `/admin-dashboard` | Admin: suppliers, approvals, news, categories, QR, analytics |
| `/go` | QR redirect controller |

## Deploy to Vercel

1. Push to GitHub
2. Import in [vercel.com](https://vercel.com)
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for server-side admin APIs)
   - `OPENAI_API_KEY` (required for AI chatbot responses)
   - If you previously used `OPENAPI_API_KEY` or `openai_api_key`, it is still accepted, but migrate to `OPENAI_API_KEY`.
   - Optional: `OPENAI_MODEL` (default: `gpt-4o-mini`)
   - Optional: `OPENAI_API_BASE` (only if you use an OpenAI-compatible proxy)
4. Deploy

## Documentation

- Detailed wireframe (Japanese): `docs/wireframe-ja.md`
- Database schema: `supabase-schema.sql`
