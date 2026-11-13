-- SIDDIQIYA Apparel — platform modules (schema)
-- Roles & permissions, quotation statuses, priced quotations with revisions, orders, production,
-- quality control, suppliers, CRM, shipments, documents/files, buyer messages & addresses,
-- site content, FX display rates, audit log and an email outbox.
-- Same security model as 01–05: RLS on, no direct table access; SECURITY DEFINER functions only.

-- ---------- roles ----------
alter table public.apparel_admins drop constraint if exists apparel_admins_role_check;
update public.apparel_admins set role = 'sales_rep' where role = 'sales';
alter table public.apparel_admins add constraint apparel_admins_role_check check (role in
  ('super_admin', 'admin', 'sales_manager', 'sales_rep', 'production_manager', 'qc_manager', 'shipping_manager', 'support'));

create table if not exists public.apparel_role_permissions (
  role text not null,
  perm text not null check (perm in ('catalog', 'content', 'buyers', 'inquiries', 'samples', 'quotes', 'orders', 'production', 'qc',
                                     'suppliers', 'crm', 'shipping', 'documents', 'reports', 'users', 'settings', 'messages')),
  primary key (role, perm)
);
insert into public.apparel_role_permissions (role, perm)
select r, p from (values
  ('admin', array['catalog','content','buyers','inquiries','samples','quotes','orders','production','qc','suppliers','crm','shipping','documents','reports','settings','messages']),
  ('sales_manager', array['buyers','inquiries','samples','quotes','orders','crm','documents','reports','messages']),
  ('sales_rep', array['buyers','inquiries','samples','quotes','crm','messages']),
  ('production_manager', array['orders','production','qc','suppliers','documents','reports']),
  ('qc_manager', array['production','qc','documents']),
  ('shipping_manager', array['orders','shipping','documents','reports']),
  ('support', array['buyers','inquiries','samples','messages'])
) v(r, ps), unnest(ps) p
on conflict do nothing;

-- ---------- quotation request statuses ----------
alter table public.apparel_rfqs drop constraint if exists apparel_rfqs_status_check;
update public.apparel_rfqs set status = case status
  when 'submitted' then 'pending' when 'reviewing' then 'under_review' when 'quoted' then 'quotation_sent'
  when 'accepted' then 'approved' when 'ordered' then 'approved' when 'declined' then 'rejected' when 'closed' then 'cancelled' else status end;
alter table public.apparel_rfqs alter column status set default 'pending';
alter table public.apparel_rfqs add constraint apparel_rfqs_status_check check (status in
  ('pending', 'under_review', 'quotation_sent', 'negotiation', 'sample_requested', 'approved', 'rejected', 'cancelled'));
alter table public.apparel_rfqs
  add column if not exists contact_name text check (char_length(contact_name) <= 120),
  add column if not exists whatsapp text check (char_length(whatsapp) <= 40),
  add column if not exists website text check (char_length(website) <= 200),
  add column if not exists country text check (char_length(country) <= 80),
  add column if not exists budget text check (char_length(budget) <= 120),
  add column if not exists printing text check (char_length(printing) <= 300),
  add column if not exists embroidery text check (char_length(embroidery) <= 300),
  add column if not exists customization text check (char_length(customization) <= 1000),
  add column if not exists fingerprint text,
  add column if not exists assigned_to uuid references auth.users (id) on delete set null;
alter table public.apparel_rfq_items
  add column if not exists collection text check (char_length(collection) <= 60),
  add column if not exists fit text check (char_length(fit) <= 40);
create index if not exists apparel_rfqs_fp_idx on public.apparel_rfqs (user_id, fingerprint, created_at desc);

alter table public.apparel_status_history drop constraint if exists apparel_status_history_entity_check;
alter table public.apparel_status_history add constraint apparel_status_history_entity_check check (entity in
  ('rfq', 'sample', 'buyer', 'inquiry', 'quote', 'order', 'production', 'shipment'));

-- ---------- catalog extensions ----------
alter table public.apparel_products
  add column if not exists sku text,
  add column if not exists collection text,
  add column if not exists weight_g int check (weight_g between 0 and 5000),
  add column if not exists printing_options text[] not null default '{}',
  add column if not exists embroidery_options text[] not null default '{}',
  add column if not exists customizable boolean not null default true,
  add column if not exists private_label boolean not null default true,
  add column if not exists manufacturing_notes text check (char_length(manufacturing_notes) <= 2000),
  add column if not exists wholesale_price numeric(12, 2) check (wholesale_price >= 0),
  add column if not exists price_tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(price_tiers) = 'array'),
  add column if not exists images text[] not null default '{}',
  add column if not exists created_at timestamptz not null default now();
update public.apparel_products set sku = 'SA-' || upper(left(regexp_replace(category, '-t-shirts$', ''), 3)) || '-' || substr(id, 5) where sku is null;
alter table public.apparel_products alter column sku set not null;
create unique index if not exists apparel_products_sku_idx on public.apparel_products (sku);
update public.apparel_products set printing_options = array['Screen printing', 'DTG printing', 'DTF printing'] where printing_options = '{}';
update public.apparel_products set embroidery_options = array['Flat embroidery', '3D puff embroidery'] where embroidery_options = '{}';

alter table public.apparel_fabrics add column if not exists images text[] not null default '{}';
alter table public.apparel_collections add column if not exists banner text check (char_length(banner) <= 400);

-- ---------- priced quotations ----------
create sequence if not exists public.apparel_quote_seq;
create table if not exists public.apparel_quotes (
  id bigint generated always as identity primary key,
  code text not null,
  rfq_id bigint not null references public.apparel_rfqs (id) on delete cascade,
  revision int not null default 1 check (revision between 1 and 99),
  status text not null default 'draft' check (status in ('draft', 'sent', 'superseded', 'accepted', 'rejected')),
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'GBP')),
  subtotal numeric(14, 2) not null default 0,
  shipping_cost numeric(14, 2) not null default 0 check (shipping_cost >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  tax_amount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  incoterm text check (char_length(incoterm) <= 40),
  payment_terms text check (char_length(payment_terms) <= 400),
  lead_time text check (char_length(lead_time) <= 120),
  valid_until date,
  notes text check (char_length(notes) <= 4000),
  buyer_response text check (char_length(buyer_response) <= 2000),
  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, revision),
  unique (rfq_id, revision)
);
create table if not exists public.apparel_quote_lines (
  id bigint generated always as identity primary key,
  quote_id bigint not null references public.apparel_quotes (id) on delete cascade,
  position int not null default 0,
  product_id text check (char_length(product_id) <= 40),
  description text not null check (char_length(description) between 1 and 300),
  color text check (char_length(color) <= 60),
  sizes jsonb not null default '{}'::jsonb,
  quantity int not null check (quantity between 1 and 10000000),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(tiers) = 'array'),
  line_total numeric(14, 2) not null
);
create index if not exists apparel_quote_lines_q_idx on public.apparel_quote_lines (quote_id, position);
create index if not exists apparel_quotes_rfq_idx on public.apparel_quotes (rfq_id, revision desc);

-- ---------- orders ----------
create sequence if not exists public.apparel_order_seq;
create table if not exists public.apparel_orders (
  id bigint generated always as identity primary key,
  code text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  rfq_id bigint references public.apparel_rfqs (id) on delete set null,
  quote_id bigint references public.apparel_quotes (id) on delete set null,
  status text not null default 'received' check (status in ('received', 'awaiting_confirmation', 'sample_development', 'sample_approved',
    'production_pending', 'in_production', 'quality_inspection', 'packing', 'ready_to_ship', 'shipped', 'delivered', 'completed', 'cancelled')),
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'GBP')),
  total numeric(14, 2) not null default 0 check (total >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit_received', 'paid', 'refunded')),
  payment_info text check (char_length(payment_info) <= 1000),
  delivery_address text check (char_length(delivery_address) <= 800),
  shipping_method text check (char_length(shipping_method) <= 80),
  buyer_notes text check (char_length(buyer_notes) <= 2000),
  admin_note text check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists apparel_orders_user_idx on public.apparel_orders (user_id, created_at desc);
create index if not exists apparel_orders_status_idx on public.apparel_orders (status, created_at desc);
create table if not exists public.apparel_order_lines (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.apparel_orders (id) on delete cascade,
  position int not null default 0,
  product_id text, product_name text not null, color text,
  sizes jsonb not null default '{}'::jsonb,
  quantity int not null check (quantity >= 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null
);
create index if not exists apparel_order_lines_o_idx on public.apparel_order_lines (order_id, position);

-- ---------- production & quality ----------
create sequence if not exists public.apparel_production_seq;
create table if not exists public.apparel_production (
  id bigint generated always as identity primary key,
  code text not null unique,
  order_id bigint not null references public.apparel_orders (id) on delete cascade,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  quantity int not null check (quantity >= 0),
  completed_qty int not null default 0 check (completed_qty >= 0),
  start_date date, expected_completion date, actual_completion date,
  assigned_team text check (char_length(assigned_team) <= 120),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_qty <= quantity)
);
create index if not exists apparel_production_order_idx on public.apparel_production (order_id);
create table if not exists public.apparel_production_stages (
  production_id bigint not null references public.apparel_production (id) on delete cascade,
  position int not null,
  stage text not null check (stage in ('order_confirmation', 'material_procurement', 'fabric_preparation', 'cutting', 'printing_embroidery',
                                      'stitching', 'finishing', 'quality_inspection', 'packing')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped')),
  started_at timestamptz, completed_at timestamptz,
  note text check (char_length(note) <= 1000),
  primary key (production_id, stage)
);
create table if not exists public.apparel_qc (
  id bigint generated always as identity primary key,
  production_id bigint not null references public.apparel_production (id) on delete cascade,
  inspected_on date not null default current_date,
  inspector text check (char_length(inspector) <= 120),
  sample_size int check (sample_size >= 0),
  defects_found int not null default 0 check (defects_found >= 0),
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  defects text check (char_length(defects) <= 4000),
  result text not null check (result in ('pass', 'fail')),
  notes text check (char_length(notes) <= 4000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists apparel_qc_prod_idx on public.apparel_qc (production_id, created_at desc);

-- ---------- suppliers ----------
create table if not exists public.apparel_suppliers (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 160),
  company text check (char_length(company) <= 160),
  contact_person text check (char_length(contact_person) <= 120),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  phone text check (char_length(phone) <= 40),
  country text check (char_length(country) <= 80),
  address text check (char_length(address) <= 600),
  categories text[] not null default '{}',
  products text check (char_length(products) <= 2000),
  payment_terms text check (char_length(payment_terms) <= 400),
  notes text check (char_length(notes) <= 4000),
  status text not null default 'active' check (status in ('active', 'on_hold', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CRM ----------
create sequence if not exists public.apparel_lead_seq;
create table if not exists public.apparel_leads (
  id bigint generated always as identity primary key,
  code text not null unique,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  company text check (char_length(company) <= 160),
  contact_name text check (char_length(contact_name) <= 120),
  phone text check (char_length(phone) <= 40),
  country text check (char_length(country) <= 80),
  source text not null default 'website' check (source in ('website', 'rfq', 'registration', 'inquiry', 'whatsapp', 'referral', 'trade_show', 'email', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'interested', 'quotation_sent', 'negotiation', 'converted', 'lost')),
  assigned_to uuid references auth.users (id) on delete set null,
  next_follow_up date,
  notes text check (char_length(notes) <= 4000),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists apparel_leads_email_idx on public.apparel_leads (lower(email)) where email is not null;
create index if not exists apparel_leads_status_idx on public.apparel_leads (status, next_follow_up);
create table if not exists public.apparel_lead_activities (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.apparel_leads (id) on delete cascade,
  kind text not null check (kind in ('note', 'call', 'email', 'whatsapp', 'meeting', 'system')),
  body text not null check (char_length(body) between 1 and 4000),
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists apparel_lead_act_idx on public.apparel_lead_activities (lead_id, created_at desc);

-- ---------- shipping ----------
create sequence if not exists public.apparel_shipment_seq;
create table if not exists public.apparel_shipments (
  id bigint generated always as identity primary key,
  code text not null unique,
  order_id bigint not null references public.apparel_orders (id) on delete cascade,
  destination text check (char_length(destination) <= 200),
  method text check (method in ('express_courier', 'air_freight', 'sea_freight', 'road', 'buyer_pickup')),
  provider text check (char_length(provider) <= 80),
  tracking_number text check (char_length(tracking_number) <= 80),
  dispatch_date date, estimated_delivery date, delivered_on date,
  status text not null default 'preparing' check (status in ('preparing', 'dispatched', 'in_transit', 'delivered', 'exception')),
  cost numeric(14, 2) check (cost >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'GBP')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists apparel_shipments_order_idx on public.apparel_shipments (order_id);

-- ---------- files & documents (Supabase Storage) ----------
create table if not exists public.apparel_files (
  id bigint generated always as identity primary key,
  bucket text not null default 'apparel-files',
  path text not null unique check (char_length(path) <= 400),
  filename text not null check (char_length(filename) between 1 and 200),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/postscript', 'image/vnd.adobe.photoshop')),
  size_bytes int not null check (size_bytes between 1 and 26214400),
  entity text not null check (entity in ('rfq', 'order', 'shipment', 'qc', 'quote')),
  entity_id bigint not null,
  kind text not null default 'other' check (kind in ('artwork', 'logo', 'tech_pack', 'commercial_invoice', 'packing_list', 'shipping_document',
                                                     'certificate_of_origin', 'inspection_report', 'inspection_photo', 'quotation', 'other')),
  buyer_id uuid references auth.users (id) on delete set null,
  visible_to_buyer boolean not null default false,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists apparel_files_entity_idx on public.apparel_files (entity, entity_id);

-- ---------- buyer messages & addresses ----------
create table if not exists public.apparel_messages (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  from_admin boolean not null,
  sender uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists apparel_messages_buyer_idx on public.apparel_messages (buyer_id, created_at);
create table if not exists public.apparel_addresses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (char_length(label) <= 60),
  recipient text not null check (char_length(recipient) between 1 and 120),
  company text check (char_length(company) <= 160),
  line1 text not null check (char_length(line1) between 2 and 200),
  line2 text check (char_length(line2) <= 200),
  city text not null check (char_length(city) between 1 and 100),
  region text check (char_length(region) <= 100),
  postal_code text check (char_length(postal_code) <= 20),
  country text not null check (char_length(country) between 2 and 80),
  phone text check (char_length(phone) <= 40),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists apparel_addresses_user_idx on public.apparel_addresses (user_id);

-- ---------- site content, FX, audit, email ----------
create table if not exists public.apparel_content (
  key text primary key check (key in ('hero', 'announcements', 'about', 'contact', 'faq', 'seo', 'notify')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create table if not exists public.apparel_fx_rates (
  currency text primary key check (currency in ('EUR', 'GBP')),
  per_usd numeric(12, 6) not null check (per_usd > 0),
  updated_at timestamptz not null default now()
);
insert into public.apparel_fx_rates (currency, per_usd) values ('EUR', 0.92), ('GBP', 0.79) on conflict do nothing;
create table if not exists public.apparel_audit (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_key text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists apparel_audit_idx on public.apparel_audit (created_at desc);
create table if not exists public.apparel_email_outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  template text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists apparel_email_outbox_pending_idx on public.apparel_email_outbox (status, created_at) where status = 'pending';

do $$
declare t text;
begin
  foreach t in array array['apparel_role_permissions', 'apparel_quotes', 'apparel_quote_lines', 'apparel_orders', 'apparel_order_lines', 'apparel_production',
    'apparel_production_stages', 'apparel_qc', 'apparel_suppliers', 'apparel_leads', 'apparel_lead_activities', 'apparel_shipments', 'apparel_files',
    'apparel_messages', 'apparel_addresses', 'apparel_content', 'apparel_fx_rates', 'apparel_audit', 'apparel_email_outbox'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- storage buckets ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('apparel-files', 'apparel-files', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/postscript', 'image/vnd.adobe.photoshop']),
       ('apparel-media', 'apparel-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
