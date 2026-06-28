-- Petal database schema
-- Run this in the Supabase SQL editor (Database > SQL Editor) on a fresh project.

create extension if not exists "uuid-ossp";

-- One row per user, created right after sign-up / onboarding.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  conditions text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- One row per day a user logs something.
create table if not exists symptom_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  mood smallint check (mood between 0 and 10),
  energy smallint check (energy between 0 and 10),
  sleep_hours numeric(4,1),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

-- Individual symptom + severity entries belonging to a log.
create table if not exists symptom_entries (
  id uuid primary key default uuid_generate_v4(),
  log_id uuid not null references symptom_logs (id) on delete cascade,
  symptom_key text not null,
  severity smallint not null check (severity between 0 and 10),
  body_region text
);

-- Subscription state, kept in sync by the Stripe webhook handler.
create table if not exists subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'free' check (status in ('free', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz
);

create index if not exists symptom_logs_user_date_idx on symptom_logs (user_id, log_date desc);
create index if not exists symptom_entries_log_idx on symptom_entries (log_id);

-- Row Level Security: every table is locked to its owning user.
alter table profiles enable row level security;
alter table symptom_logs enable row level security;
alter table symptom_entries enable row level security;
alter table subscriptions enable row level security;

create policy "Users manage their own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users manage their own logs"
  on symptom_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage entries on their own logs"
  on symptom_entries for all
  using (
    exists (
      select 1 from symptom_logs
      where symptom_logs.id = symptom_entries.log_id
      and symptom_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from symptom_logs
      where symptom_logs.id = symptom_entries.log_id
      and symptom_logs.user_id = auth.uid()
    )
  );

create policy "Users view their own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Only the service-role key (used by the Stripe webhook, never the browser)
-- can write subscription rows, so no insert/update policy is granted here.
