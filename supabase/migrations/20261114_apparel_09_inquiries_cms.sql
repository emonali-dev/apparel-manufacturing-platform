-- SIDDIQIYA Apparel — inquiry pipeline statuses, follow-up fields, and CMS gallery / testimonials / social links.

-- ---------- inquiry statuses ----------
alter table public.apparel_inquiries drop constraint if exists apparel_inquiries_status_check;
update public.apparel_inquiries set status = case status when 'in_progress' then 'reviewing' when 'closed' then 'completed' else status end;
alter table public.apparel_inquiries add constraint apparel_inquiries_status_check
  check (status in ('new', 'reviewing', 'quotation_sent', 'negotiation', 'confirmed', 'completed', 'rejected'));
alter table public.apparel_inquiries
  add column if not exists follow_up date,
  add column if not exists quotation text check (char_length(quotation) <= 2000),
  add column if not exists product text check (char_length(product) <= 160),
  add column if not exists quantity int check (quantity between 0 and 10000000);

drop function if exists public.apparel_admin_update_inquiry(bigint, text, text);
create or replace function public.apparel_admin_update_inquiry(p_id bigint, p_status text, p_note text default null, p_quotation text default null, p_follow_up date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public.apparel_require('inquiries');
  select status into v_old from public.apparel_inquiries where id = p_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('new', 'reviewing', 'quotation_sent', 'negotiation', 'confirmed', 'completed', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_inquiries set status = p_status, admin_note = public.apparel_clean(p_note, 2000), quotation = public.apparel_clean(p_quotation, 2000),
    follow_up = p_follow_up, seen_by_admin = true, updated_at = now() where id = p_id;
  if v_old <> p_status then perform public.apparel_history_add('inquiry', p_id::text, v_old, p_status); end if;
  perform public.apparel_log('update_status', 'inquiry', p_id::text, jsonb_build_object('from', v_old, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

-- the admin list includes the status history of each inquiry
create or replace function public.apparel_admin_inquiries(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('inquiries');
  return coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('history', public.apparel_history('inquiry', i.id::text)) order by i.created_at desc)
    from (select * from public.apparel_inquiries where p_status is null or status = p_status order by created_at desc limit 1000) i), '[]'::jsonb);
end $$;

-- structured quote fields from the public request form are stored alongside the free-form details
create or replace function public.apparel_inquiry_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- forms send their visible labels as keys ("Product", "Product type", "Required quantity", "Estimated quantity (pieces)")
  new.product := coalesce(new.product, left(nullif(coalesce(new.details ->> 'Product', new.details ->> 'Product type'), ''), 160));
  begin new.quantity := coalesce(new.quantity, nullif(regexp_replace(coalesce(
    (select d.value from jsonb_each_text(coalesce(new.details, '{}'::jsonb)) d where d.key ilike '%quantity%' order by d.key limit 1), ''), '[^0-9]', '', 'g'), '')::int);
  exception when others then new.quantity := null; end;
  return new;
end $$;
drop trigger if exists apparel_inquiry_fields on public.apparel_inquiries;
create trigger apparel_inquiry_fields before insert on public.apparel_inquiries for each row execute function public.apparel_inquiry_fields();
revoke all on function public.apparel_inquiry_fields() from public, anon, authenticated;

create or replace function public.apparel_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return public.apparel_my_perms() || jsonb_build_object(
    'buyers', (select count(*) from public.apparel_buyers),
    'new_buyers', (select count(*) from public.apparel_buyers where created_at > now() - interval '30 days'),
    'pending_buyers', (select count(*) from public.apparel_buyers where status = 'pending'),
    'products', (select count(*) from public.apparel_products where published),
    'hidden_products', (select count(*) from public.apparel_products where not published),
    'rfqs', (select count(*) from public.apparel_rfqs),
    'new_rfqs', (select count(*) from public.apparel_rfqs where not seen_by_admin),
    'pending_rfqs', (select count(*) from public.apparel_rfqs where status in ('pending', 'under_review', 'negotiation', 'sample_requested')),
    'approved_rfqs', (select count(*) from public.apparel_rfqs where status = 'approved'),
    'active_orders', (select count(*) from public.apparel_orders where status not in ('delivered', 'completed', 'cancelled')),
    'completed_orders', (select count(*) from public.apparel_orders where status in ('delivered', 'completed')),
    'production_orders', (select count(*) from public.apparel_production where status in ('planned', 'in_progress', 'on_hold')),
    'new_samples', (select count(*) from public.apparel_samples where not seen_by_admin),
    'open_samples', (select count(*) from public.apparel_samples where status in ('requested', 'approved', 'preparing', 'shipped')),
    'new_inquiries', (select count(*) from public.apparel_inquiries where not seen_by_admin),
    'open_inquiries', (select count(*) from public.apparel_inquiries where status not in ('completed', 'rejected')),
    'unread_messages', (select count(*) from public.apparel_messages where not from_admin and read_at is null),
    'follow_ups_due', (select count(*) from public.apparel_leads where next_follow_up <= current_date and status not in ('converted', 'lost')),
    'quoted_value', coalesce((select jsonb_object_agg(currency, v) from (select q.currency, sum(q.total) v from public.apparel_quotes q
        where q.status in ('sent', 'accepted') group by q.currency) x), '{}'::jsonb),
    'confirmed_order_value', coalesce((select jsonb_object_agg(currency, v) from (select o.currency, sum(o.total) v from public.apparel_orders o
        where o.status <> 'cancelled' group by o.currency) x), '{}'::jsonb),
    'rfq_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.apparel_rfqs group by status) x), '{}'::jsonb),
    'order_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.apparel_orders group by status) x), '{}'::jsonb)
  );
end $$;

-- ---------- CMS: gallery, testimonials, social links ----------
create or replace function public.apparel_media_path_ok(p_paths jsonb)
returns text[] language plpgsql immutable set search_path = '' as $$
declare v text[] := '{}'; e text;
begin
  if jsonb_typeof(p_paths) is distinct from 'array' then return v; end if;
  for e in select jsonb_array_elements_text(p_paths) loop
    if e !~ '^(products|fabrics|collections|gallery|campaign)/[A-Za-z0-9._/-]{1,200}$' or e like '%..%' then raise exception 'INVALID_FILE'; end if;
    v := v || e;
    exit when array_length(v, 1) >= 12;
  end loop;
  return v;
end $$;

alter table public.apparel_content drop constraint if exists apparel_content_key_check;
alter table public.apparel_content add constraint apparel_content_key_check
  check (key in ('hero', 'announcements', 'about', 'contact', 'faq', 'seo', 'notify', 'gallery', 'testimonials', 'social'));

create or replace function public.apparel_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(p) - 'published' - 'manufacturing_notes' - 'wholesale_price' - 'price_tiers' order by p.sort, p.id) from public.apparel_products p where p.published), '[]'::jsonb),
    'hidden', coalesce((select jsonb_agg(p.id) from public.apparel_products p where not p.published), '[]'::jsonb),
    'fabrics', coalesce((select jsonb_agg(to_jsonb(f) - 'published' order by f.sort, f.slug) from public.apparel_fabrics f where f.published), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(to_jsonb(c) - 'published' order by c.sort, c.slug) from public.apparel_collections c where c.published), '[]'::jsonb),
    'content', coalesce((select jsonb_object_agg(c.key, c.value) from public.apparel_content c where c.key in ('hero', 'announcements', 'about', 'contact', 'faq', 'gallery', 'testimonials', 'social')), '{}'::jsonb),
    'fx', coalesce((select jsonb_object_agg(r.currency, r.per_usd) from public.apparel_fx_rates r), '{}'::jsonb)
  );
$$;

create or replace function public.apparel_admin_save_content(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e jsonb;
begin
  if p_key = 'notify' then perform public.apparel_require('settings'); else perform public.apparel_require('content'); end if;
  if p_key not in ('hero', 'announcements', 'about', 'contact', 'faq', 'seo', 'notify', 'gallery', 'testimonials', 'social') then raise exception 'INVALID_KEY'; end if;
  if p_value is null or char_length(p_value::text) > 20000 then raise exception 'INVALID_DETAILS'; end if;
  if p_key = 'notify' and coalesce(p_value ->> 'email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'EMAIL_REQUIRED'; end if;
  if p_key = 'social' then
    for e in select value from jsonb_each(p_value) loop
      if jsonb_typeof(e) <> 'string' or (e #>> '{}' <> '' and e #>> '{}' !~ '^https://[^\s<>"]+$') then raise exception 'INVALID_URL'; end if;
    end loop;
  end if;
  -- every image path is checked one by one (uploaded media paths, or an https:// address)
  if p_key = 'gallery' then
    if jsonb_array_length(coalesce(p_value -> 'items', '[]'::jsonb)) > 24 then raise exception 'INVALID_DETAILS'; end if;
    for e in select x -> 'image' from jsonb_array_elements(coalesce(p_value -> 'items', '[]'::jsonb)) x loop
      if coalesce(e #>> '{}', '') !~ '^https://[^\s<>"]+$' then perform public.apparel_media_path_ok(jsonb_build_array(coalesce(e #>> '{}', ''))); end if;
    end loop;
  end if;
  if p_key = 'hero' and coalesce(p_value ->> 'image', '') <> '' and p_value ->> 'image' !~ '^https://[^\s<>"]+$' then
    perform public.apparel_media_path_ok(jsonb_build_array(p_value ->> 'image'));
  end if;
  insert into public.apparel_content (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public.apparel_log('save', 'content', p_key);
  return jsonb_build_object('ok', true);
end $$;

-- grants for the new signature (everything else keeps its grants)
revoke all on function public.apparel_admin_update_inquiry(bigint, text, text, text, date) from public, anon, authenticated;
grant execute on function public.apparel_admin_update_inquiry(bigint, text, text, text, date) to authenticated;
revoke all on function public.apparel_admin_inquiries(text), public.apparel_admin_overview(), public.apparel_admin_save_content(text, jsonb) from public, anon;
grant execute on function public.apparel_admin_inquiries(text), public.apparel_admin_overview(), public.apparel_admin_save_content(text, jsonb) to authenticated;
revoke all on function public.apparel_catalog() from public;
grant execute on function public.apparel_catalog() to anon, authenticated;
