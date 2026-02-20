-- Challenge Tracker — Supabase Schema
-- Run this in your Supabase SQL Editor

-- Challenges table: links a MetaCopier account to a prop firm challenge
create table if not exists challenges (
  id uuid default gen_random_uuid() primary key,
  metacopier_account_id text not null unique,
  alias text not null default '',
  prop_firm text not null,
  phase text not null default 'Phase 1',
  platform text not null default 'MT5',
  target_pct numeric not null default 8,
  owner text not null default '',
  login_number text not null default '',
  login_server text not null default '',
  created_at timestamptz default now()
);

-- Snapshots table: periodic balance/equity records for historical tracking
create table if not exists snapshots (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references challenges(id) on delete cascade not null,
  balance numeric not null default 0,
  equity numeric not null default 0,
  drawdown numeric not null default 0,
  unrealized_pnl numeric not null default 0,
  timestamp timestamptz default now()
);

.
-- Trades table: trade history per challenge
create table if not exists trades (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references challenges(id) on delete cascade not null,
  symbol text not null,
  side text not null,
  volume numeric not null default 0,
  open_price numeric not null default 0,
  close_price numeric,
  profit numeric not null default 0,
  swap numeric not null default 0,
  commission numeric not null default 0,
  open_time timestamptz,
  close_time timestamptz
);

-- Add columns added after initial schema
alter table challenges add column if not exists starting_balance numeric;
alter table challenges add column if not exists cost numeric;
alter table challenges add column if not exists daily_dd_pct numeric;
alter table challenges add column if not exists max_dd_pct numeric;

-- Indexes for performance
create index if not exists idx_snapshots_challenge on snapshots(challenge_id, timestamp desc);
create index if not exists idx_trades_challenge on trades(challenge_id, close_time desc);

-- Enable Row Level Security (open access — single user, no auth)
alter table challenges enable row level security;
alter table snapshots enable row level security;
alter table trades enable row level security;

-- Allow all operations (no auth needed)
create policy "Allow all on challenges" on challenges for all using (true) with check (true);
create policy "Allow all on snapshots" on snapshots for all using (true) with check (true);
create policy "Allow all on trades" on trades for all using (true) with check (true);
