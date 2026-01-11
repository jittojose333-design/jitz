-- DANGER: This will delete existing data to fix the ID format issue.
-- Run this in Supabase SQL Editor to reset your tables.

DROP TABLE IF EXISTS public.expenses;
DROP TABLE IF EXISTS public.expense_categories;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.panchayats;

-- Now recreate them with the correct TEXT id type (to allow 'panch-xxx')

-- Table: Panchayats
create table public.panchayats (
  id text primary key,
  name text not null,
  contact_person text,
  phone text,
  district text,
  block text,
  nrega_gp text,
  board_prices jsonb default '{"type1": 0, "type2": 0, "type3": 0, "type4": 0}'::jsonb,
  vendors text[] default array[]::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: Orders
create table public.orders (
  id text primary key,
  date text not null,
  work_code text,
  work_name text,
  panchayat_id text references public.panchayats(id) on delete set null,
  panchayat_name text,
  items text,
  amount numeric,
  status text default 'Unpaid',
  is_placed boolean default false,
  payment_date text,
  verified_amount numeric,
  verified_date text,
  is_verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: Expense Categories
create table public.expense_categories (
  id text primary key,
  name text not null,
  sub_categories text[] default array[]::text[],
  is_panchayat_linked boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: Expenses
create table public.expenses (
  id text primary key,
  date text not null,
  description text,
  amount numeric not null,
  category_id text references public.expense_categories(id) on delete set null,
  category_name text,
  sub_category text,
  panchayat_id text references public.panchayats(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Restore RLS
alter table public.panchayats enable row level security;
alter table public.orders enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy "Enable all access for all users" on public.panchayats for all using (true) with check (true);
create policy "Enable all access for all users" on public.orders for all using (true) with check (true);
create policy "Enable all access for all users" on public.expense_categories for all using (true) with check (true);
create policy "Enable all access for all users" on public.expenses for all using (true) with check (true);
