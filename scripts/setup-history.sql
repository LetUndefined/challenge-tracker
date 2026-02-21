-- Run this in your Supabase SQL editor to create the challenge history table

create table if not exists challenge_history (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references challenges(id) on delete set null,
  alias text not null,
  prop_firm text not null,
  phase text not null,
  outcome text not null check (outcome in ('Passed', 'Failed', 'Abandoned')),
  starting_balance numeric default 0,
  final_balance numeric default 0,
  payout_received numeric default 0,
  started_at date,
  ended_at date,
  duration_days integer generated always as (
    case when started_at is not null and ended_at is not null
    then (ended_at - started_at)::integer
    else null end
  ) stored,
  notes text,
  created_at timestamptz default now()
);

alter table challenge_history enable row level security;
create policy "Allow all" on challenge_history for all using (true);
