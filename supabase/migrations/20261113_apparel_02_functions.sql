-- SIDDIQIYA Apparel — API functions. Every read and write goes through these.

create or replace function public.apparel_is_admin(p_catalog boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.apparel_admins a
    where a.user_id = auth.uid() and (not p_catalog or a.role in ('super_admin', 'admin'))
  );
$$;

create or replace function public.apparel_require_admin(p_catalog boolean default false)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.apparel_is_admin(p_catalog) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
end $$;

create or replace function public.apparel_clean(p text, p_max int)
returns text language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max), '');
$$;

-- Public catalog (published records only)
create or replace function public.apparel_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(p) - 'published' order by p.sort, p.id) from public.apparel_products p where p.published), '[]'::jsonb),
    'hidden', coalesce((select jsonb_agg(p.id) from public.apparel_products p where not p.published), '[]'::jsonb),
    'fabrics', coalesce((select jsonb_agg(to_jsonb(f) - 'published' order by f.sort, f.slug) from public.apparel_fabrics f where f.published), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(to_jsonb(c) - 'published' order by c.sort, c.slug) from public.apparel_collections c where c.published), '[]'::jsonb)
  );
$$;

create or replace function public.apparel_history(p_entity text, p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('from', h.from_status, 'to', h.to_status, 'note', h.note, 'at', h.created_at) order by h.created_at), '[]'::jsonb)
  from public.apparel_status_history h where h.entity = p_entity and h.entity_key = p_key;
$$;

-- Signed-in user's portal data
create or replace function public.apparel_me()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'email', (select u.email from auth.users u where u.id = v_uid),
    'is_admin', public.apparel_is_admin(false),
    'buyer', (select to_jsonb(b) - 'admin_note' from public.apparel_buyers b where b.user_id = v_uid),
    'rfqs', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'code', r.code, 'status', r.status, 'order_type', r.order_type, 'destination', r.destination,
        'target_date', r.target_date, 'requirements', r.requirements, 'created_at', r.created_at, 'updated_at', r.updated_at,
        'items', coalesce((select jsonb_agg(to_jsonb(i) - 'rfq_id' order by i.id) from public.apparel_rfq_items i where i.rfq_id = r.id), '[]'::jsonb),
        'history', public.apparel_history('rfq', r.id::text)) order by r.created_at desc)
      from public.apparel_rfqs r where r.user_id = v_uid), '[]'::jsonb),
    'samples', coalesce((select jsonb_agg((to_jsonb(s) - 'admin_note' - 'seen_by_admin' - 'user_id') || jsonb_build_object('history', public.apparel_history('sample', s.id::text)) order by s.created_at desc)
      from public.apparel_samples s where s.user_id = v_uid), '[]'::jsonb)
  );
end $$;

-- Buyer profile / wholesale application
create or replace function public.apparel_save_buyer(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_exists boolean;
  v_old text;
  v_ws boolean := coalesce((p ->> 'wholesale_requested')::boolean, false);
  v_row public.apparel_buyers;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  select true, b.status into v_exists, v_old from public.apparel_buyers b where b.user_id = v_uid;
  if public.apparel_clean(p ->> 'contact_person', 120) is null then raise exception 'CONTACT_REQUIRED'; end if;
  if v_ws and (public.apparel_clean(p ->> 'company_name', 160) is null or public.apparel_clean(p ->> 'country', 80) is null or public.apparel_clean(p ->> 'business_type', 40) is null) then
    raise exception 'WHOLESALE_FIELDS_REQUIRED';
  end if;
  insert into public.apparel_buyers as b (user_id, company_name, contact_person, email, phone, country, website, business_type, est_volume, wholesale_requested)
  values (v_uid, public.apparel_clean(p ->> 'company_name', 160), public.apparel_clean(p ->> 'contact_person', 120), lower(v_email),
          public.apparel_clean(p ->> 'phone', 40), public.apparel_clean(p ->> 'country', 80), public.apparel_clean(p ->> 'website', 200),
          public.apparel_clean(p ->> 'business_type', 40), public.apparel_clean(p ->> 'est_volume', 60), v_ws)
  on conflict (user_id) do update set
    company_name = excluded.company_name, contact_person = excluded.contact_person, phone = excluded.phone,
    country = excluded.country, website = excluded.website, business_type = excluded.business_type,
    est_volume = excluded.est_volume,
    wholesale_requested = b.wholesale_requested or excluded.wholesale_requested,
    status = case when b.status = 'rejected' and excluded.wholesale_requested then 'pending' else b.status end,
    updated_at = now()
  returning * into v_row;
  if v_exists is null then
    insert into public.apparel_status_history (entity, entity_key, from_status, to_status, note, actor)
    values ('buyer', v_uid::text, null, 'pending', case when v_ws then 'Wholesale application submitted' else 'Account created' end, v_uid);
  elsif v_old = 'rejected' and v_row.status = 'pending' then
    insert into public.apparel_status_history (entity, entity_key, from_status, to_status, note, actor)
    values ('buyer', v_uid::text, 'rejected', 'pending', 'Wholesale application resubmitted', v_uid);
  end if;
  return to_jsonb(v_row) - 'admin_note';
end $$;

-- Consolidated RFQ
create or replace function public.apparel_submit_rfq(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_items jsonb := p -> 'items';
  v_item jsonb;
  v_prod public.apparel_products;
  v_rfq public.apparel_rfqs;
  v_sizes jsonb;
  v_key text;
  v_qty int;
  v_sum int;
  v_fabric text;
  v_gsm int;
  v_color text;
  v_date date;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if not exists (select 1 from public.apparel_buyers b where b.user_id = v_uid) then raise exception 'PROFILE_REQUIRED'; end if;
  if exists (select 1 from public.apparel_buyers b where b.user_id = v_uid and b.status = 'suspended') then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (select count(*) from public.apparel_rfqs r where r.user_id = v_uid and r.created_at > now() - interval '24 hours') >= 20 then raise exception 'RATE_LIMIT'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'ITEMS_REQUIRED'; end if;
  if jsonb_array_length(v_items) > 50 then raise exception 'TOO_MANY_ITEMS'; end if;
  begin v_date := nullif(p ->> 'target_date', '')::date; exception when others then v_date := null; end;
  insert into public.apparel_rfqs (code, user_id, order_type, destination, target_date, requirements)
  values ('RFQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_rfq_seq')::text, 4, '0'), v_uid,
          public.apparel_clean(p ->> 'order_type', 60), public.apparel_clean(p ->> 'destination', 160), v_date, public.apparel_clean(p ->> 'requirements', 4000))
  returning * into v_rfq;
  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_prod from public.apparel_products pr where pr.id = v_item ->> 'product_id' and pr.published;
    if v_prod.id is null then raise exception 'UNKNOWN_PRODUCT'; end if;
    v_color := public.apparel_clean(v_item ->> 'color', 60);
    if v_color is not null and not (v_color = any (v_prod.colors)) then raise exception 'INVALID_COLOR'; end if;
    v_fabric := coalesce(public.apparel_clean(v_item ->> 'fabric', 80), v_prod.fabric);
    if not exists (select 1 from public.apparel_fabrics f where f.slug = v_fabric) then raise exception 'INVALID_FABRIC'; end if;
    v_gsm := coalesce(nullif(v_item ->> 'gsm', '')::int, v_prod.gsm);
    if v_gsm < 80 or v_gsm > 500 then raise exception 'INVALID_GSM'; end if;
    v_sizes := '{}'::jsonb; v_sum := 0;
    if jsonb_typeof(v_item -> 'sizes') = 'object' then
      for v_key in select jsonb_object_keys(v_item -> 'sizes') loop
        if not (v_key = any (array['XXS','XS','S','M','L','XL','XXL','3XL','4XL','5XL'])) then raise exception 'INVALID_SIZE'; end if;
        v_qty := (v_item -> 'sizes' ->> v_key)::int;
        if v_qty < 0 or v_qty > 1000000 then raise exception 'INVALID_QUANTITY'; end if;
        if v_qty > 0 then v_sizes := v_sizes || jsonb_build_object(v_key, v_qty); v_sum := v_sum + v_qty; end if;
      end loop;
    end if;
    if v_sum = 0 then v_sum := greatest(0, least(coalesce(nullif(v_item ->> 'quantity', '')::int, 0), 10000000)); end if;
    insert into public.apparel_rfq_items (rfq_id, product_id, product_name, color, fabric, gsm, sizes, quantity, note)
    values (v_rfq.id, v_prod.id, v_prod.name, v_color, v_fabric, v_gsm, v_sizes, v_sum, public.apparel_clean(v_item ->> 'note', 1000));
  end loop;
  insert into public.apparel_status_history (entity, entity_key, from_status, to_status, note, actor)
  values ('rfq', v_rfq.id::text, null, 'submitted', 'Request for quotation submitted', v_uid);
  return jsonb_build_object('id', v_rfq.id, 'code', v_rfq.code, 'created_at', v_rfq.created_at);
end $$;

-- Sample request (product or fabric)
create or replace function public.apparel_request_sample(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_kind text := coalesce(p ->> 'kind', 'product');
  v_prod public.apparel_products;
  v_fab public.apparel_fabrics;
  v_row public.apparel_samples;
  v_name text; v_pid text; v_fabric text; v_gsm int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if not exists (select 1 from public.apparel_buyers b where b.user_id = v_uid) then raise exception 'PROFILE_REQUIRED'; end if;
  if (select count(*) from public.apparel_samples s where s.user_id = v_uid and s.created_at > now() - interval '24 hours') >= 10 then raise exception 'RATE_LIMIT'; end if;
  if public.apparel_clean(p ->> 'delivery_address', 600) is null or char_length(public.apparel_clean(p ->> 'delivery_address', 600)) < 5 then raise exception 'ADDRESS_REQUIRED'; end if;
  v_gsm := nullif(p ->> 'gsm', '')::int;
  if v_kind = 'product' then
    select * into v_prod from public.apparel_products pr where pr.id = p ->> 'product_id' and pr.published;
    if v_prod.id is null then raise exception 'UNKNOWN_PRODUCT'; end if;
    v_name := v_prod.name; v_pid := v_prod.id; v_fabric := v_prod.fabric; v_gsm := coalesce(v_gsm, v_prod.gsm);
    if public.apparel_clean(p ->> 'color', 60) is not null and not (p ->> 'color' = any (v_prod.colors)) then raise exception 'INVALID_COLOR'; end if;
    if public.apparel_clean(p ->> 'size', 20) is not null and not (p ->> 'size' = any (v_prod.sizes)) then raise exception 'INVALID_SIZE'; end if;
  elsif v_kind = 'fabric' then
    select * into v_fab from public.apparel_fabrics f where f.slug = p ->> 'fabric' and f.published;
    if v_fab.slug is null then raise exception 'INVALID_FABRIC'; end if;
    v_name := v_fab.name || ' fabric swatch'; v_fabric := v_fab.slug;
    if v_gsm is not null and not (v_gsm = any (v_fab.gsm)) then raise exception 'INVALID_GSM'; end if;
  else
    raise exception 'INVALID_KIND';
  end if;
  insert into public.apparel_samples (code, user_id, product_id, product_name, kind, color, size, fabric, gsm, delivery_address, notes)
  values ('SMP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_sample_seq')::text, 4, '0'), v_uid, v_pid, v_name, v_kind,
          public.apparel_clean(p ->> 'color', 60), public.apparel_clean(p ->> 'size', 20), v_fabric, v_gsm,
          public.apparel_clean(p ->> 'delivery_address', 600), public.apparel_clean(p ->> 'notes', 1000))
  returning * into v_row;
  insert into public.apparel_status_history (entity, entity_key, from_status, to_status, note, actor)
  values ('sample', v_row.id::text, null, 'requested', 'Sample requested', v_uid);
  return jsonb_build_object('id', v_row.id, 'code', v_row.code, 'created_at', v_row.created_at);
end $$;

/* ---------------- Admin ---------------- */

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
    'pending_buyers', (select count(*) from public.apparel_buyers where status = 'pending'),
    'buyers', (select count(*) from public.apparel_buyers),
    'products', (select count(*) from public.apparel_products where published),
    'hidden_products', (select count(*) from public.apparel_products where not published),
    'rfq_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.apparel_rfqs group by status) x), '{}'::jsonb)
  );
end $$;

create or replace function public.apparel_buyer_json(p_uid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(b) from public.apparel_buyers b where b.user_id = p_uid;
$$;

create or replace function public.apparel_admin_rfqs(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'buyer', public.apparel_buyer_json(r.user_id),
      'items', coalesce((select jsonb_agg(to_jsonb(i) - 'rfq_id' order by i.id) from public.apparel_rfq_items i where i.rfq_id = r.id), '[]'::jsonb),
      'history', public.apparel_history('rfq', r.id::text)) order by r.created_at desc)
    from (select * from public.apparel_rfqs where p_status is null or status = p_status order by created_at desc limit 300) r), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_samples(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('buyer', public.apparel_buyer_json(s.user_id), 'history', public.apparel_history('sample', s.id::text)) order by s.created_at desc)
    from (select * from public.apparel_samples where p_status is null or status = p_status order by created_at desc limit 300) s), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_buyers(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'rfq_count', (select count(*) from public.apparel_rfqs r where r.user_id = b.user_id),
      'sample_count', (select count(*) from public.apparel_samples s where s.user_id = b.user_id)) order by b.created_at desc)
    from (select * from public.apparel_buyers where p_status is null or status = p_status order by created_at desc limit 500) b), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_update_rfq(p_id bigint, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public.apparel_require_admin(false);
  select status into v_old from public.apparel_rfqs where id = p_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('submitted', 'reviewing', 'quoted', 'accepted', 'ordered', 'declined', 'closed') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_rfqs set status = p_status, admin_note = public.apparel_clean(p_note, 4000), seen_by_admin = true, updated_at = now() where id = p_id;
  if v_old <> p_status then
    insert into public.apparel_status_history (entity, entity_key, from_status, to_status, actor) values ('rfq', p_id::text, v_old, p_status, auth.uid());
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_update_sample(p_id bigint, p_status text, p_courier text default null, p_tracking text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public.apparel_require_admin(false);
  select status into v_old from public.apparel_samples where id = p_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('requested', 'approved', 'preparing', 'shipped', 'delivered', 'declined') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_samples set status = p_status, courier = public.apparel_clean(p_courier, 80), tracking_number = public.apparel_clean(p_tracking, 80),
    admin_note = public.apparel_clean(p_note, 2000), seen_by_admin = true, updated_at = now() where id = p_id;
  if v_old <> p_status then
    insert into public.apparel_status_history (entity, entity_key, from_status, to_status, note, actor)
    values ('sample', p_id::text, v_old, p_status, case when p_status = 'shipped' and public.apparel_clean(p_tracking, 80) is not null then 'Tracking: ' || public.apparel_clean(p_courier, 80) || ' ' || public.apparel_clean(p_tracking, 80) end, auth.uid());
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_update_buyer(p_user uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public.apparel_require_admin(false);
  select status into v_old from public.apparel_buyers where user_id = p_user for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('pending', 'verified', 'rejected', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_buyers set status = p_status, admin_note = public.apparel_clean(p_note, 2000), updated_at = now() where user_id = p_user;
  if v_old <> p_status then
    insert into public.apparel_status_history (entity, entity_key, from_status, to_status, actor) values ('buyer', p_user::text, v_old, p_status, auth.uid());
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_mark_seen(p_kind text, p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  if p_kind = 'rfq' then update public.apparel_rfqs set seen_by_admin = true where id = p_id;
  elsif p_kind = 'sample' then update public.apparel_samples set seen_by_admin = true where id = p_id;
  end if;
end $$;

create or replace function public.apparel_admin_catalog()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.sort, p.id) from public.apparel_products p), '[]'::jsonb),
    'fabrics', coalesce((select jsonb_agg(to_jsonb(f) order by f.sort, f.slug) from public.apparel_fabrics f), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort, c.slug) from public.apparel_collections c), '[]'::jsonb));
end $$;

create or replace function public.apparel_text_array(p jsonb, p_allowed text[] default null, p_max int default 40)
returns text[] language plpgsql immutable set search_path = '' as $$
declare v text[] := '{}'; e text;
begin
  if jsonb_typeof(p) <> 'array' then return v; end if;
  for e in select jsonb_array_elements_text(p) loop
    e := public.apparel_clean(e, 200);
    if e is null then continue; end if;
    if p_allowed is not null and not (e = any (p_allowed)) then raise exception 'INVALID_VALUE: %', e; end if;
    if not (e = any (v)) then v := v || e; end if;
    exit when array_length(v, 1) >= p_max;
  end loop;
  return v;
end $$;

create or replace function public.apparel_admin_save_product(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id text := public.apparel_clean(p ->> 'id', 20);
  v_name text := public.apparel_clean(p ->> 'name', 120);
  v_slug text;
  v_colors text[] := array['black','white','bone','sand','stone','charcoal','heather','navy','olive','sage','brick','forest','cobalt','washed','clay'];
  v_cats text[] := array['basic-t-shirts','oversized-t-shirts','drop-shoulder-t-shirts','streetwear-t-shirts','graphic-t-shirts','polo-t-shirts','sports-t-shirts','premium-cotton-t-shirts','organic-cotton-t-shirts','vintage-wash-t-shirts','heavyweight-t-shirts','custom-printed-t-shirts'];
  v_row public.apparel_products;
begin
  perform public.apparel_require_admin(true);
  if v_name is null or char_length(v_name) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if not ((p ->> 'category') = any (v_cats)) then raise exception 'INVALID_CATEGORY'; end if;
  if not exists (select 1 from public.apparel_fabrics f where f.slug = p ->> 'fabric') then raise exception 'INVALID_FABRIC'; end if;
  if v_id is null then
    v_id := 'PRD-' || lpad((coalesce((select max(substr(id, 5)::int) from public.apparel_products), 0) + 1)::text, 4, '0');
    v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.apparel_products where slug = v_slug) then v_slug := v_slug || '-' || lower(replace(v_id, 'PRD-', '')); end if;
  else
    select slug into v_slug from public.apparel_products where id = v_id;
    if v_slug is null then raise exception 'NOT_FOUND'; end if;
  end if;
  insert into public.apparel_products as t (id, slug, name, category, fabric, gsm, fit, colors, sizes, description, moq, lead_time, shape, print, finish, published, featured, sort, updated_at)
  values (v_id, v_slug, v_name, p ->> 'category', p ->> 'fabric', (p ->> 'gsm')::int, coalesce(public.apparel_clean(p ->> 'fit', 40), 'Regular'),
          public.apparel_text_array(p -> 'colors', v_colors, 15),
          public.apparel_text_array(p -> 'sizes', array['XXS','XS','S','M','L','XL','XXL','3XL','4XL','5XL'], 10),
          public.apparel_clean(p ->> 'description', 2000), public.apparel_clean(p ->> 'moq', 120), public.apparel_clean(p ->> 'lead_time', 120),
          coalesce(nullif(p ->> 'shape', ''), 'crew'), coalesce(p ->> 'print', ''), coalesce(p ->> 'finish', ''),
          coalesce((p ->> 'published')::boolean, true), coalesce((p ->> 'featured')::boolean, false), coalesce((p ->> 'sort')::int, 999), now())
  on conflict (id) do update set name = excluded.name, category = excluded.category, fabric = excluded.fabric, gsm = excluded.gsm, fit = excluded.fit,
    colors = excluded.colors, sizes = excluded.sizes, description = excluded.description, moq = excluded.moq, lead_time = excluded.lead_time,
    shape = excluded.shape, published = excluded.published, featured = excluded.featured, updated_at = now()
  returning * into v_row;
  if array_length(v_row.colors, 1) is null then raise exception 'COLORS_REQUIRED'; end if;
  if array_length(v_row.sizes, 1) is null then raise exception 'SIZES_REQUIRED'; end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_save_fabric(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.apparel_fabrics; v_gsm int[];
begin
  perform public.apparel_require_admin(true);
  if public.apparel_clean(p ->> 'name', 80) is null then raise exception 'NAME_REQUIRED'; end if;
  if public.apparel_clean(p ->> 'composition', 160) is null then raise exception 'COMPOSITION_REQUIRED'; end if;
  select coalesce(array_agg(distinct g::int order by g::int), '{}') into v_gsm from jsonb_array_elements_text(coalesce(p -> 'gsm', '[]'::jsonb)) g where g ~ '^\d{2,3}$' and g::int between 80 and 500;
  if array_length(v_gsm, 1) is null then raise exception 'GSM_REQUIRED'; end if;
  insert into public.apparel_fabrics as t (slug, name, composition, gsm, texture, description, applications, care, colors, published, sort, updated_at)
  values (coalesce(public.apparel_clean(p ->> 'slug', 60), trim(both '-' from regexp_replace(lower(p ->> 'name'), '[^a-z0-9]+', '-', 'g'))),
          public.apparel_clean(p ->> 'name', 80), public.apparel_clean(p ->> 'composition', 160), v_gsm,
          case when p ->> 'texture' in ('jersey','jersey-fine','jersey-slub','jersey-heather','jersey-heavy','terry','pique','mesh') then p ->> 'texture' else 'jersey' end,
          public.apparel_clean(p ->> 'description', 2000), public.apparel_text_array(p -> 'applications', null, 12), public.apparel_text_array(p -> 'care', null, 12),
          public.apparel_text_array(p -> 'colors', array['black','white','bone','sand','stone','charcoal','heather','navy','olive','sage','brick','forest','cobalt','washed','clay'], 15),
          coalesce((p ->> 'published')::boolean, true), coalesce((p ->> 'sort')::int, 999), now())
  on conflict (slug) do update set name = excluded.name, composition = excluded.composition, gsm = excluded.gsm, texture = excluded.texture,
    description = excluded.description, applications = excluded.applications, care = excluded.care, colors = excluded.colors,
    published = excluded.published, updated_at = now()
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_save_collection(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.apparel_collections;
begin
  perform public.apparel_require_admin(true);
  if public.apparel_clean(p ->> 'name', 80) is null then raise exception 'NAME_REQUIRED'; end if;
  insert into public.apparel_collections as t (slug, name, kicker, lead, categories, published, sort, updated_at)
  values (coalesce(public.apparel_clean(p ->> 'slug', 60), trim(both '-' from regexp_replace(lower(p ->> 'name'), '[^a-z0-9]+', '-', 'g'))),
          public.apparel_clean(p ->> 'name', 80), public.apparel_clean(p ->> 'kicker', 80), public.apparel_clean(p ->> 'lead', 400),
          public.apparel_text_array(p -> 'categories', array['basic-t-shirts','oversized-t-shirts','drop-shoulder-t-shirts','streetwear-t-shirts','graphic-t-shirts','polo-t-shirts','sports-t-shirts','premium-cotton-t-shirts','organic-cotton-t-shirts','vintage-wash-t-shirts','heavyweight-t-shirts','custom-printed-t-shirts'], 12),
          coalesce((p ->> 'published')::boolean, true), coalesce((p ->> 'sort')::int, 999), now())
  on conflict (slug) do update set name = excluded.name, kicker = excluded.kicker, lead = excluded.lead, categories = excluded.categories,
    published = excluded.published, updated_at = now()
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- Permissions: nothing is callable unless granted here.
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'apparel\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.apparel_catalog() to anon, authenticated;
grant execute on function public.apparel_me(), public.apparel_save_buyer(jsonb), public.apparel_submit_rfq(jsonb), public.apparel_request_sample(jsonb),
  public.apparel_admin_overview(), public.apparel_admin_rfqs(text), public.apparel_admin_samples(text), public.apparel_admin_buyers(text),
  public.apparel_admin_update_rfq(bigint, text, text), public.apparel_admin_update_sample(bigint, text, text, text, text),
  public.apparel_admin_update_buyer(uuid, text, text), public.apparel_admin_mark_seen(text, bigint), public.apparel_admin_catalog(),
  public.apparel_admin_save_product(jsonb), public.apparel_admin_save_fabric(jsonb), public.apparel_admin_save_collection(jsonb)
  to authenticated;
