-- SIDDIQIYA Apparel — schema (all objects prefixed apparel_; no existing tables are touched)
-- RLS is enabled with NO policies: tables are only reachable through the
-- SECURITY DEFINER functions in 02_functions, which enforce every permission.

create table if not exists public.apparel_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin', 'admin', 'sales')),
  created_at timestamptz not null default now()
);

create table if not exists public.apparel_buyers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text check (char_length(company_name) <= 160),
  contact_person text not null check (char_length(contact_person) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  country text check (char_length(country) <= 80),
  website text check (char_length(website) <= 200),
  business_type text check (business_type in ('Individual Customer', 'Retailer', 'Wholesaler', 'Distributor', 'Fashion Brand', 'Importer')),
  est_volume text check (char_length(est_volume) <= 60),
  wholesale_requested boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'suspended')),
  admin_note text check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists apparel_buyers_status_idx on public.apparel_buyers (status, created_at desc);

create sequence if not exists public.apparel_rfq_seq;
create sequence if not exists public.apparel_sample_seq;

create table if not exists public.apparel_rfqs (
  id bigint generated always as identity primary key,
  code text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'quoted', 'accepted', 'ordered', 'declined', 'closed')),
  order_type text check (char_length(order_type) <= 60),
  destination text check (char_length(destination) <= 160),
  target_date date,
  requirements text check (char_length(requirements) <= 4000),
  admin_note text check (char_length(admin_note) <= 4000),
  seen_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists apparel_rfqs_user_idx on public.apparel_rfqs (user_id, created_at desc);
create index if not exists apparel_rfqs_status_idx on public.apparel_rfqs (status, created_at desc);

create table if not exists public.apparel_rfq_items (
  id bigint generated always as identity primary key,
  rfq_id bigint not null references public.apparel_rfqs (id) on delete cascade,
  product_id text not null check (char_length(product_id) <= 40),
  product_name text not null check (char_length(product_name) <= 160),
  color text check (char_length(color) <= 60),
  fabric text check (char_length(fabric) <= 80),
  gsm int check (gsm between 80 and 500),
  sizes jsonb not null default '{}'::jsonb,
  quantity int not null default 0 check (quantity between 0 and 10000000),
  note text check (char_length(note) <= 1000)
);
create index if not exists apparel_rfq_items_rfq_idx on public.apparel_rfq_items (rfq_id);

create table if not exists public.apparel_samples (
  id bigint generated always as identity primary key,
  code text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text check (char_length(product_id) <= 40),
  product_name text not null check (char_length(product_name) <= 160),
  kind text not null default 'product' check (kind in ('product', 'fabric')),
  color text check (char_length(color) <= 60),
  size text check (char_length(size) <= 20),
  fabric text check (char_length(fabric) <= 80),
  gsm int check (gsm between 80 and 500),
  delivery_address text not null check (char_length(delivery_address) between 5 and 600),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'approved', 'preparing', 'shipped', 'delivered', 'declined')),
  courier text check (char_length(courier) <= 80),
  tracking_number text check (char_length(tracking_number) <= 80),
  admin_note text check (char_length(admin_note) <= 2000),
  seen_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists apparel_samples_user_idx on public.apparel_samples (user_id, created_at desc);
create index if not exists apparel_samples_status_idx on public.apparel_samples (status, created_at desc);

create table if not exists public.apparel_status_history (
  id bigint generated always as identity primary key,
  entity text not null check (entity in ('rfq', 'sample', 'buyer')),
  entity_key text not null,
  from_status text,
  to_status text not null,
  note text check (char_length(note) <= 2000),
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists apparel_status_history_idx on public.apparel_status_history (entity, entity_key, created_at);

create table if not exists public.apparel_products (
  id text primary key check (id ~ '^PRD-[0-9]{4,6}$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  category text not null,
  fabric text not null,
  gsm int not null check (gsm between 80 and 500),
  fit text not null check (char_length(fit) <= 40),
  colors text[] not null default '{}',
  sizes text[] not null default '{}',
  description text check (char_length(description) <= 2000),
  moq text check (char_length(moq) <= 120),
  lead_time text check (char_length(lead_time) <= 120),
  shape text not null default 'crew' check (shape in ('crew', 'oversized', 'drop', 'polo', 'raglan', 'heavy')),
  print text not null default '',
  finish text not null default '',
  published boolean not null default true,
  featured boolean not null default false,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.apparel_fabrics (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  composition text not null check (char_length(composition) <= 160),
  gsm int[] not null default '{}',
  texture text not null default 'jersey',
  description text check (char_length(description) <= 2000),
  applications text[] not null default '{}',
  care text[] not null default '{}',
  colors text[] not null default '{}',
  published boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.apparel_collections (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  kicker text check (char_length(kicker) <= 80),
  lead text check (char_length(lead) <= 400),
  categories text[] not null default '{}',
  published boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['apparel_admins','apparel_buyers','apparel_rfqs','apparel_rfq_items','apparel_samples','apparel_status_history','apparel_products','apparel_fabrics','apparel_collections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.apparel_rfq_seq, public.apparel_sample_seq from anon, authenticated;

-- Super admin: the existing account for the owner's email (no hard-coded ids).
insert into public.apparel_admins (user_id, role)
select id, 'super_admin' from auth.users where lower(email) = 'emonali18198@gmail.com'
on conflict (user_id) do nothing;
