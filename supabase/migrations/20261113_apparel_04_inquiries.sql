-- SIDDIQIYA Apparel — inquiries (contact, service, wholesale, studio, newsletter)
-- plus buyer-visible admin messages on RFQs and samples.
-- Same pattern as 01/02: RLS on with no policies, access only via SECURITY DEFINER functions.

create sequence if not exists public.apparel_inquiry_seq;

create table if not exists public.apparel_inquiries (
  id bigint generated always as identity primary key,
  code text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('contact', 'service', 'wholesale', 'studio', 'newsletter')),
  subject text not null check (char_length(subject) between 2 and 200),
  contact_name text check (char_length(contact_name) <= 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and char_length(email) <= 200),
  company text check (char_length(company) <= 160),
  country text check (char_length(country) <= 80),
  phone text check (char_length(phone) <= 40),
  message text check (char_length(message) <= 6000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  admin_note text check (char_length(admin_note) <= 2000),
  seen_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists apparel_inquiries_status_idx on public.apparel_inquiries (status, created_at desc);
create index if not exists apparel_inquiries_email_idx on public.apparel_inquiries (lower(email), created_at desc);
create index if not exists apparel_inquiries_user_idx on public.apparel_inquiries (user_id, created_at desc);
alter table public.apparel_inquiries enable row level security;

alter table public.apparel_status_history drop constraint if exists apparel_status_history_entity_check;
alter table public.apparel_status_history add constraint apparel_status_history_entity_check check (entity in ('rfq', 'sample', 'buyer', 'inquiry'));

-- Guests and signed-in buyers can submit; rate limited per email and globally.
create or replace function public.apparel_submit_inquiry(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_kind text := public.apparel_clean(p ->> 'kind', 20);
  v_email text := lower(public.apparel_clean(p ->> 'email', 200));
  v_details jsonb := coalesce(p -> 'details', '{}'::jsonb);
  v_row public.apparel_inquiries;
begin
  if v_kind is null or v_kind not in ('contact', 'service', 'wholesale', 'studio', 'newsletter') then raise exception 'INVALID_KIND'; end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'EMAIL_REQUIRED'; end if;
  if public.apparel_clean(p ->> 'subject', 200) is null then raise exception 'SUBJECT_REQUIRED'; end if;
  if jsonb_typeof(v_details) <> 'object' or char_length(v_details::text) > 8000 then raise exception 'INVALID_DETAILS'; end if;
  if (select count(*) from public.apparel_inquiries i where lower(i.email) = v_email and i.created_at > now() - interval '10 minutes') >= 5 then raise exception 'RATE_LIMIT'; end if;
  if (select count(*) from public.apparel_inquiries i where i.created_at > now() - interval '10 minutes') >= 120 then raise exception 'RATE_LIMIT'; end if;
  insert into public.apparel_inquiries (code, user_id, kind, subject, contact_name, email, company, country, phone, message, details)
  values ('INQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_inquiry_seq')::text, 4, '0'), auth.uid(), v_kind,
          public.apparel_clean(p ->> 'subject', 200), public.apparel_clean(p ->> 'contact_name', 120), v_email,
          public.apparel_clean(p ->> 'company', 160), public.apparel_clean(p ->> 'country', 80), public.apparel_clean(p ->> 'phone', 40),
          public.apparel_clean(p ->> 'message', 6000), v_details)
  returning * into v_row;
  return jsonb_build_object('code', v_row.code, 'created_at', v_row.created_at);
end $$;

create or replace function public.apparel_admin_inquiries(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc)
    from (select * from public.apparel_inquiries where p_status is null or status = p_status order by created_at desc limit 300) i), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_update_inquiry(p_id bigint, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public.apparel_require_admin(false);
  select status into v_old from public.apparel_inquiries where id = p_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('new', 'in_progress', 'closed') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_inquiries set status = p_status, admin_note = public.apparel_clean(p_note, 2000), seen_by_admin = true, updated_at = now() where id = p_id;
  if v_old <> p_status then
    insert into public.apparel_status_history (entity, entity_key, from_status, to_status, actor) values ('inquiry', p_id::text, v_old, p_status, auth.uid());
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- A message the buyer sees in their portal timeline (e.g. a quotation summary or courier cost).
create or replace function public.apparel_admin_message(p_entity text, p_id bigint, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_status text; v_note text := public.apparel_clean(p_note, 2000);
begin
  perform public.apparel_require_admin(false);
  if v_note is null then raise exception 'MESSAGE_REQUIRED'; end if;
  if p_entity = 'rfq' then select status into v_status from public.apparel_rfqs where id = p_id;
  elsif p_entity = 'sample' then select status into v_status from public.apparel_samples where id = p_id;
  else raise exception 'INVALID_ENTITY'; end if;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  insert into public.apparel_status_history (entity, entity_key, from_status, to_status, note, actor)
  values (p_entity, p_id::text, v_status, v_status, v_note, auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return jsonb_build_object(
    'role', (select a.role from public.apparel_admins a where a.user_id = auth.uid()),
    'new_rfqs', (select count(*) from public.apparel_rfqs where not seen_by_admin),
    'open_rfqs', (select count(*) from public.apparel_rfqs where status in ('submitted', 'reviewing', 'quoted')),
    'orders', (select count(*) from public.apparel_rfqs where status in ('accepted', 'ordered')),
    'new_samples', (select count(*) from public.apparel_samples where not seen_by_admin),
    'open_samples', (select count(*) from public.apparel_samples where status in ('requested', 'approved', 'preparing', 'shipped')),
    'new_inquiries', (select count(*) from public.apparel_inquiries where not seen_by_admin),
    'open_inquiries', (select count(*) from public.apparel_inquiries where status <> 'closed'),
    'pending_buyers', (select count(*) from public.apparel_buyers where status = 'pending'),
    'buyers', (select count(*) from public.apparel_buyers),
    'products', (select count(*) from public.apparel_products where published),
    'hidden_products', (select count(*) from public.apparel_products where not published),
    'rfq_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.apparel_rfqs group by status) x), '{}'::jsonb)
  );
end $$;

create or replace function public.apparel_admin_mark_seen(p_kind text, p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  if p_kind = 'rfq' then update public.apparel_rfqs set seen_by_admin = true where id = p_id;
  elsif p_kind = 'sample' then update public.apparel_samples set seen_by_admin = true where id = p_id;
  elsif p_kind = 'inquiry' then update public.apparel_inquiries set seen_by_admin = true where id = p_id;
  end if;
end $$;

revoke all on function public.apparel_submit_inquiry(jsonb) from public, anon, authenticated;
revoke all on function public.apparel_admin_inquiries(text) from public, anon, authenticated;
revoke all on function public.apparel_admin_update_inquiry(bigint, text, text) from public, anon, authenticated;
revoke all on function public.apparel_admin_message(text, bigint, text) from public, anon, authenticated;
grant execute on function public.apparel_submit_inquiry(jsonb) to anon, authenticated;
grant execute on function public.apparel_admin_inquiries(text), public.apparel_admin_update_inquiry(bigint, text, text),
  public.apparel_admin_message(text, bigint, text) to authenticated;
