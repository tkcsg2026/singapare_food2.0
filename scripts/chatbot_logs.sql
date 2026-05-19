-- Optional: chat assistant logging (enable with ENABLE_CHATBOT_LOGGING=true)
-- Run in Supabase SQL Editor if you want persisted chatbot analytics.

create table if not exists public.chatbot_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  session_id text not null,
  language text not null,
  user_message text not null,
  assistant_message text not null,
  source_type text not null check (source_type in ('faq', 'ai')),
  created_at timestamptz not null default now()
);

create index if not exists chatbot_logs_created_at_idx on public.chatbot_logs (created_at desc);
create index if not exists chatbot_logs_session_id_idx on public.chatbot_logs (session_id);

alter table public.chatbot_logs enable row level security;

-- No public policies: only service role (server) inserts/reads.

comment on table public.chatbot_logs is 'Optional site assistant exchanges; written by API with service role when ENABLE_CHATBOT_LOGGING=true';
