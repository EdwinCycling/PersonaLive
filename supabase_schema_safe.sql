-- SAFE SCHEMA UPDATE
-- Dit script maakt ALLEEN de nieuwe 'scenarios' tabel aan.
-- Het raakt GEEN bestaande tabellen (zoals personas of users) aan.

-- Enable UUID extension (veilig om vaker te draaien, doet niks als het al bestaat)
create extension if not exists "uuid-ossp";

-- Create scenarios table (stores configurations)
-- We gebruiken IF NOT EXISTS om errors te voorkomen als de tabel al bestaat.
create table if not exists scenarios (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  -- We slaan de volledige configuratie op als JSONB.
  -- Dit is flexibel en breekt niet als we later velden toevoegen in de frontend.
  configuration jsonb not null, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for scenarios (veilig, zelfs als het al aan staat)
alter table scenarios enable row level security;

-- Policies (we droppen ze eerst voor de zekerheid om duplicaten/errors te voorkomen bij her-runnen)
drop policy if exists "Users can view own scenarios" on scenarios;
drop policy if exists "Users can insert own scenarios" on scenarios;
drop policy if exists "Users can update own scenarios" on scenarios;
drop policy if exists "Users can delete own scenarios" on scenarios;

-- Users can view their own scenarios
create policy "Users can view own scenarios"
  on scenarios for select
  using ( auth.uid() = user_id );

-- Users can insert their own scenarios
create policy "Users can insert own scenarios"
  on scenarios for insert
  with check ( auth.uid() = user_id );

-- Users can update their own scenarios
create policy "Users can update own scenarios"
  on scenarios for update
  using ( auth.uid() = user_id );

-- Users can delete their own scenarios
create policy "Users can delete own scenarios"
  on scenarios for delete
  using ( auth.uid() = user_id );
