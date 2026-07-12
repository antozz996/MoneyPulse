-- MoneyPulse Sprint 20 RLS preparation
--
-- These policies are prepared for a future Supabase Auth integration.
-- They are NOT applied automatically by the FastAPI backend today because
-- the current production path remains backend-mediated and uses application
-- JWTs rather than Supabase Auth JWT claims.
--
-- Apply only when:
-- 1. requests read/write these tables directly through Supabase; or
-- 2. the backend is updated to propagate compatible auth.uid() claims.

alter table if exists public.user_financial_profiles enable row level security;
alter table if exists public.accounts enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.recurring_events enable row level security;
alter table if exists public.budgets enable row level security;
alter table if exists public.goals enable row level security;

create policy if not exists "user_financial_profiles_owner_all"
on public.user_financial_profiles
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy if not exists "accounts_owner_all"
on public.accounts
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy if not exists "categories_owner_all"
on public.categories
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy if not exists "transactions_owner_all"
on public.transactions
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy if not exists "recurring_events_owner_all"
on public.recurring_events
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy if not exists "budgets_owner_all"
on public.budgets
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy if not exists "goals_owner_all"
on public.goals
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);
