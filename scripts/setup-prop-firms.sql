-- Run this in your Supabase SQL editor before running the scraper

create table if not exists prop_firms (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  slug text,
  website text,
  logo_url text,
  rating numeric,
  reviews_count integer,
  years_active integer,
  country text,

  -- Challenge structure
  phases integer,              -- 1, 2, or 0 for instant funding
  program_types text,          -- comma-separated: '1-step,2-step,instant' etc.
  instant_funding boolean default false,
  profit_target_p1 numeric,   -- % profit target phase 1
  profit_target_p2 numeric,   -- % profit target phase 2
  min_trading_days integer,
  max_trading_days integer,   -- null = no time limit

  -- Drawdown
  drawdown_type text,         -- 'trailing' or 'static'
  max_daily_loss_pct numeric,
  max_total_loss_pct numeric,

  -- Payout
  profit_split_pct integer,
  payout_frequency text,      -- 'weekly', 'biweekly', 'monthly', 'on-demand'
  min_payout_amount numeric,

  -- Rules
  ea_allowed boolean,
  copy_trading_allowed boolean,
  news_trading_allowed boolean,
  weekend_holding boolean,
  overnight_holding boolean,
  consistency_rule boolean,
  ip_restriction_notes text,
  multiple_accounts boolean,

  -- Assets
  forex boolean,
  crypto boolean,
  indices boolean,
  commodities boolean,
  futures boolean,
  stocks boolean,

  -- Platforms
  mt4 boolean,
  mt5 boolean,
  ctrader boolean,
  other_platforms text,

  -- Account sizes (JSON array of numbers)
  account_sizes jsonb,

  -- Pricing (approximate)
  fee_10k numeric,
  fee_25k numeric,
  fee_50k numeric,
  fee_100k numeric,

  -- Meta
  status text default 'active', -- 'active', 'inactive', 'unverified'
  notes text,
  last_scraped timestamptz,
  created_at timestamptz default now()
);

alter table prop_firms enable row level security;
create policy "Allow all" on prop_firms for all using (true);
-- Add program_types column if the table was already created
-- Run this in Supabase SQL editor if you already ran setup-prop-firms.sql before:
alter table prop_firms add column if not exists program_types text;
