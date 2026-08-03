-- ─────────────────────────────────────────────────────────────
-- Cibo — cloud backend schema (Postgres / Supabase)
-- Offline-first: the app runs entirely on IndexedDB. This schema
-- mirrors the local model to enable auth, realtime family sync,
-- storage of receipt/product images and push notifications.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- Households group members who share pantry, shopping and planner.
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'La mia casa',
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  color text default '#34c798',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Helper: is the current user a member of a household?
create or replace function is_member(h uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from household_members m
    where m.household_id = h and m.user_id = auth.uid()
  );
$$;

-- ── Pantry ──────────────────────────────────────────────────
create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  brand text,
  category text not null,
  location text not null check (location in ('fridge', 'freezer', 'pantry')),
  quantity numeric not null default 0,
  unit text not null,
  initial_quantity numeric not null default 0,
  purchase_date timestamptz,
  expiry_date timestamptz,
  price numeric,
  barcode text,
  image_url text,
  nutrition jsonb,
  nutrition_basis text default 'per100g',
  unit_weight_g numeric,
  allergens text[],
  opened boolean default false,
  opened_date timestamptz,
  store text,
  updated_at timestamptz not null default now()
);
create index on pantry_items (household_id);
create index on pantry_items (household_id, expiry_date);
create index on pantry_items (household_id, category);

-- ── Shopping ────────────────────────────────────────────────
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category text not null,
  quantity numeric not null default 1,
  unit text not null default 'pcs',
  checked boolean not null default false,
  auto boolean not null default false,
  reason text,
  est_price numeric,
  created_at timestamptz not null default now()
);
create index on shopping_items (household_id);

-- ── Recipes ─────────────────────────────────────────────────
create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  title text not null,
  description text,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  minutes int not null default 20,
  difficulty text not null default 'easy',
  servings int not null default 2,
  nutrition jsonb not null,
  tags text[] default '{}',
  image_url text,
  source text not null default 'user',
  favorite boolean default false,
  created_at timestamptz not null default now()
);
create index on recipes (household_id);

-- ── Meal planner ────────────────────────────────────────────
create table planned_meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references recipes(id) on delete set null,
  title text not null,
  servings int not null default 1,
  nutrition jsonb,
  cooked boolean default false
);
create index on planned_meals (household_id, date);

-- ── Logs ────────────────────────────────────────────────────
create table waste_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category text not null,
  quantity numeric not null,
  unit text not null,
  reason text not null,
  est_value numeric not null default 0,
  co2 numeric not null default 0,
  date date not null default current_date
);
create index on waste_logs (household_id, date);

create table consumption_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  quantity numeric not null,
  unit text not null,
  nutrition jsonb,
  saved_value numeric default 0,
  date date not null default current_date
);
create index on consumption_logs (household_id, date);

-- ── Per-user diet profile ───────────────────────────────────
create table diet_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── Push subscriptions (Web Push / FCM) ─────────────────────
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security: data is scoped to the user's household.
-- ─────────────────────────────────────────────────────────────
alter table households enable row level security;
alter table household_members enable row level security;
alter table pantry_items enable row level security;
alter table shopping_items enable row level security;
alter table recipes enable row level security;
alter table planned_meals enable row level security;
alter table waste_logs enable row level security;
alter table consumption_logs enable row level security;
alter table diet_profiles enable row level security;
alter table push_subscriptions enable row level security;

create policy "members read household" on households
  for select using (is_member(id));
create policy "members manage membership" on household_members
  for all using (is_member(household_id)) with check (is_member(household_id));

-- Generic household-scoped policy applied to shared tables.
do $$
declare t text;
begin
  foreach t in array array[
    'pantry_items','shopping_items','recipes','planned_meals','waste_logs','consumption_logs'
  ] loop
    execute format($f$
      create policy "household rw" on %I
        for all using (is_member(household_id)) with check (is_member(household_id));
    $f$, t);
  end loop;
end $$;

create policy "own diet profile" on diet_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own push subs" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: broadcast changes to family members.
alter publication supabase_realtime add table
  pantry_items, shopping_items, planned_meals, recipes;
