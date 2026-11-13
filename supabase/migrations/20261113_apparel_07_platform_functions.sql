-- SIDDIQIYA Apparel — platform modules (functions)
-- All access goes through these SECURITY DEFINER functions. Each admin function checks a permission
-- derived from the caller's role in apparel_admins; buyer functions only touch auth.uid()'s records.

-- ---------- permissions ----------
create or replace function public.apparel_role()
returns text language sql stable security definer set search_path = '' as $$
  select a.role from public.apparel_admins a where a.user_id = auth.uid();
$$;

create or replace function public.apparel_can(p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.apparel_admins a where a.user_id = auth.uid()
                 and (a.role = 'super_admin' or exists (select 1 from public.apparel_role_permissions rp where rp.role = a.role and rp.perm = p_perm)));
$$;

create or replace function public.apparel_require(p_perm text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.apparel_can(p_perm) then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
end $$;

-- Backwards compatible: p_catalog = needs catalog permission, otherwise any staff role.
create or replace function public.apparel_is_admin(p_catalog boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_catalog then public.apparel_can('catalog')
              else exists (select 1 from public.apparel_admins a where a.user_id = auth.uid()) end;
$$;

create or replace function public.apparel_my_perms()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', public.apparel_role(),
    'perms', case when public.apparel_role() = 'super_admin' then (select jsonb_agg(distinct perm) from public.apparel_role_permissions) || '["users"]'::jsonb
                  else coalesce((select jsonb_agg(rp.perm) from public.apparel_role_permissions rp where rp.role = public.apparel_role()), '[]'::jsonb) end);
$$;

-- ---------- helpers ----------
create or replace function public.apparel_log(p_action text, p_entity text, p_key text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.apparel_audit (actor, action, entity, entity_key, detail) values (auth.uid(), p_action, p_entity, p_key, coalesce(p_detail, '{}'::jsonb));
$$;

create or replace function public.apparel_history_add(p_entity text, p_key text, p_from text, p_to text, p_note text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.apparel_status_history (entity, entity_key, from_status, to_status, note, actor) values (p_entity, p_key, p_from, p_to, public.apparel_clean(p_note, 2000), auth.uid());
$$;

create or replace function public.apparel_email(p_to text, p_template text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_to is null or p_to !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then return; end if;
  insert into public.apparel_email_outbox (to_email, template, data) values (lower(p_to), p_template, coalesce(p_data, '{}'::jsonb));
end $$;

create or replace function public.apparel_notify_admins(p_template text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_to text;
begin
  select c.value ->> 'email' into v_to from public.apparel_content c where c.key = 'notify';
  if v_to is not null then perform public.apparel_email(v_to, p_template, p_data); end if;
end $$;

create or replace function public.apparel_user_email(p_uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select u.email from auth.users u where u.id = p_uid;
$$;

-- Create or update the CRM lead for an email address. Status only moves forward.
create or replace function public.apparel_touch_lead(p_email text, p_name text, p_company text, p_phone text, p_country text, p_source text,
                                                     p_user uuid, p_status text default null, p_note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint; v_status text;
  v_order text[] := array['new', 'contacted', 'interested', 'quotation_sent', 'negotiation', 'converted'];
begin
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then return null; end if;
  select id, status into v_id, v_status from public.apparel_leads where lower(email) = lower(p_email);
  if v_id is null then
    insert into public.apparel_leads (code, email, contact_name, company, phone, country, source, status, user_id)
    values ('LD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_lead_seq')::text, 4, '0'), lower(p_email),
            public.apparel_clean(p_name, 120), public.apparel_clean(p_company, 160), public.apparel_clean(p_phone, 40), public.apparel_clean(p_country, 80),
            case when p_source in ('website', 'rfq', 'registration', 'inquiry', 'whatsapp', 'referral', 'trade_show', 'email', 'other') then p_source else 'website' end,
            coalesce(p_status, 'new'), p_user)
    returning id into v_id;
  else
    update public.apparel_leads set
      contact_name = coalesce(contact_name, public.apparel_clean(p_name, 120)), company = coalesce(company, public.apparel_clean(p_company, 160)),
      phone = coalesce(phone, public.apparel_clean(p_phone, 40)), country = coalesce(country, public.apparel_clean(p_country, 80)),
      user_id = coalesce(user_id, p_user),
      status = case when p_status is not null and v_status <> 'lost' and array_position(v_order, p_status) > coalesce(array_position(v_order, v_status), 0) then p_status else status end,
      updated_at = now()
    where id = v_id;
  end if;
  if p_note is not null then insert into public.apparel_lead_activities (lead_id, kind, body, actor) values (v_id, 'system', left(p_note, 4000), auth.uid()); end if;
  return v_id;
end $$;

create or replace function public.apparel_order_advance(p_order bigint, p_to text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cur text;
  v_seq text[] := array['received', 'awaiting_confirmation', 'sample_development', 'sample_approved', 'production_pending', 'in_production',
                        'quality_inspection', 'packing', 'ready_to_ship', 'shipped', 'delivered', 'completed'];
begin
  select status into v_cur from public.apparel_orders where id = p_order for update;
  if v_cur is null or v_cur in ('cancelled', 'completed') then return; end if;
  if array_position(v_seq, p_to) > array_position(v_seq, v_cur) then
    update public.apparel_orders set status = p_to, updated_at = now() where id = p_order;
    perform public.apparel_history_add('order', p_order::text, v_cur, p_to, p_note);
  end if;
end $$;

-- Totals are always computed here, never trusted from the browser.
create or replace function public.apparel_quote_recalc(p_quote bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sub numeric(14, 2); q public.apparel_quotes;
begin
  select * into q from public.apparel_quotes where id = p_quote;
  select coalesce(sum(line_total), 0) into v_sub from public.apparel_quote_lines where quote_id = p_quote;
  update public.apparel_quotes set subtotal = v_sub,
    tax_amount = round((greatest(v_sub - q.discount, 0) + q.shipping_cost) * q.tax_percent / 100, 2),
    total = greatest(v_sub - q.discount, 0) + q.shipping_cost + round((greatest(v_sub - q.discount, 0) + q.shipping_cost) * q.tax_percent / 100, 2),
    updated_at = now()
  where id = p_quote;
end $$;

-- ---------- public catalog (no internal or wholesale fields) ----------
create or replace function public.apparel_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(p) - 'published' - 'manufacturing_notes' - 'wholesale_price' - 'price_tiers' order by p.sort, p.id) from public.apparel_products p where p.published), '[]'::jsonb),
    'hidden', coalesce((select jsonb_agg(p.id) from public.apparel_products p where not p.published), '[]'::jsonb),
    'fabrics', coalesce((select jsonb_agg(to_jsonb(f) - 'published' order by f.sort, f.slug) from public.apparel_fabrics f where f.published), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(to_jsonb(c) - 'published' order by c.sort, c.slug) from public.apparel_collections c where c.published), '[]'::jsonb),
    'content', coalesce((select jsonb_object_agg(c.key, c.value) from public.apparel_content c where c.key in ('hero', 'announcements', 'about', 'contact', 'faq')), '{}'::jsonb),
    'fx', coalesce((select jsonb_object_agg(r.currency, r.per_usd) from public.apparel_fx_rates r), '{}'::jsonb)
  );
$$;

-- Wholesale prices: only for verified buyers (and staff).
create or replace function public.apparel_buyer_prices()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if not exists (select 1 from public.apparel_buyers b where b.user_id = auth.uid() and b.status = 'verified') and not public.apparel_is_admin(false) then
    return '{}'::jsonb;
  end if;
  return coalesce((select jsonb_object_agg(p.id, jsonb_build_object('wholesale_price', p.wholesale_price, 'tiers', p.price_tiers))
    from public.apparel_products p where p.published and (p.wholesale_price is not null or jsonb_array_length(p.price_tiers) > 0)), '{}'::jsonb);
end $$;

-- ---------- buyer: registration hook into CRM ----------
create or replace function public.apparel_save_buyer(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_email text; v_exists boolean; v_old text;
  v_ws boolean := coalesce((p ->> 'wholesale_requested')::boolean, false);
  v_row public.apparel_buyers;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  select true, b.status into v_exists, v_old from public.apparel_buyers b where b.user_id = v_uid;
  if public.apparel_clean(p ->> 'contact_person', 120) is null or char_length(public.apparel_clean(p ->> 'contact_person', 120)) < 2 then raise exception 'CONTACT_REQUIRED'; end if;
  if v_ws and (public.apparel_clean(p ->> 'company_name', 160) is null or public.apparel_clean(p ->> 'country', 80) is null or public.apparel_clean(p ->> 'business_type', 40) is null) then
    raise exception 'WHOLESALE_FIELDS_REQUIRED';
  end if;
  insert into public.apparel_buyers as b (user_id, company_name, contact_person, email, phone, country, website, business_type, est_volume, wholesale_requested)
  values (v_uid, public.apparel_clean(p ->> 'company_name', 160), public.apparel_clean(p ->> 'contact_person', 120), lower(v_email),
          public.apparel_clean(p ->> 'phone', 40), public.apparel_clean(p ->> 'country', 80), public.apparel_clean(p ->> 'website', 200),
          public.apparel_clean(p ->> 'business_type', 40), public.apparel_clean(p ->> 'est_volume', 60), v_ws)
  on conflict (user_id) do update set
    company_name = excluded.company_name, contact_person = excluded.contact_person, phone = excluded.phone,
    country = excluded.country, website = excluded.website, business_type = excluded.business_type, est_volume = excluded.est_volume,
    wholesale_requested = b.wholesale_requested or excluded.wholesale_requested,
    status = case when b.status = 'rejected' and excluded.wholesale_requested then 'pending' else b.status end,
    updated_at = now()
  returning * into v_row;
  if v_exists is null then
    perform public.apparel_history_add('buyer', v_uid::text, null, 'pending', case when v_ws then 'Wholesale application submitted' else 'Account created' end);
    perform public.apparel_touch_lead(v_email, v_row.contact_person, v_row.company_name, v_row.phone, v_row.country, 'registration', v_uid, null, 'Buyer account registered');
    perform public.apparel_notify_admins('buyer_registered', jsonb_build_object('company', v_row.company_name, 'contact', v_row.contact_person, 'email', v_email, 'country', v_row.country, 'wholesale', v_ws));
  elsif v_old = 'rejected' and v_row.status = 'pending' then
    perform public.apparel_history_add('buyer', v_uid::text, 'rejected', 'pending', 'Wholesale application resubmitted');
  end if;
  return to_jsonb(v_row) - 'admin_note';
end $$;

-- ---------- buyer: quotation request ----------
create or replace function public.apparel_submit_rfq(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_items jsonb := p -> 'items'; v_item jsonb; v_prod public.apparel_products; v_rfq public.apparel_rfqs;
  v_sizes jsonb; v_key text; v_qty int; v_sum int; v_fabric text; v_gsm int; v_color text; v_date date; v_fp text; v_file jsonb;
  v_buyer public.apparel_buyers; v_email text; v_files int := 0; v_mime text; v_path text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into v_buyer from public.apparel_buyers b where b.user_id = v_uid;
  if v_buyer.user_id is null then raise exception 'PROFILE_REQUIRED'; end if;
  if v_buyer.status = 'suspended' then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (select count(*) from public.apparel_rfqs r where r.user_id = v_uid and r.created_at > now() - interval '24 hours') >= 20 then raise exception 'RATE_LIMIT'; end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) = 0 then raise exception 'ITEMS_REQUIRED'; end if;
  if jsonb_array_length(v_items) > 50 then raise exception 'TOO_MANY_ITEMS'; end if;
  v_fp := md5(v_items::text || coalesce(p ->> 'requirements', '') || coalesce(p ->> 'destination', ''));
  if exists (select 1 from public.apparel_rfqs r where r.user_id = v_uid and r.fingerprint = v_fp and r.created_at > now() - interval '10 minutes') then
    raise exception 'DUPLICATE_REQUEST';
  end if;
  begin v_date := nullif(p ->> 'target_date', '')::date; exception when others then v_date := null; end;
  if v_date is not null and v_date < current_date then raise exception 'INVALID_DATE'; end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  insert into public.apparel_rfqs (code, user_id, order_type, destination, target_date, requirements, contact_name, whatsapp, website, country, budget,
                                   printing, embroidery, customization, fingerprint)
  values ('RFQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_rfq_seq')::text, 4, '0'), v_uid,
          public.apparel_clean(p ->> 'order_type', 60), public.apparel_clean(p ->> 'destination', 160), v_date, public.apparel_clean(p ->> 'requirements', 4000),
          coalesce(public.apparel_clean(p ->> 'contact_name', 120), v_buyer.contact_person), public.apparel_clean(p ->> 'whatsapp', 40),
          public.apparel_clean(p ->> 'website', 200), coalesce(public.apparel_clean(p ->> 'country', 80), v_buyer.country),
          public.apparel_clean(p ->> 'budget', 120), public.apparel_clean(p ->> 'printing', 300), public.apparel_clean(p ->> 'embroidery', 300),
          public.apparel_clean(p ->> 'customization', 1000), v_fp)
  returning * into v_rfq;
  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_prod from public.apparel_products pr where pr.id = v_item ->> 'product_id' and pr.published;
    if v_prod.id is null then raise exception 'UNKNOWN_PRODUCT'; end if;
    v_color := public.apparel_clean(v_item ->> 'color', 60);
    if v_color is not null and not (v_color = any (v_prod.colors)) then raise exception 'INVALID_COLOR'; end if;
    v_fabric := coalesce(public.apparel_clean(v_item ->> 'fabric', 80), v_prod.fabric);
    if not exists (select 1 from public.apparel_fabrics f where f.slug = v_fabric) then raise exception 'INVALID_FABRIC'; end if;
    begin v_gsm := coalesce(nullif(v_item ->> 'gsm', '')::int, v_prod.gsm); exception when others then raise exception 'INVALID_GSM'; end;
    if v_gsm < 80 or v_gsm > 500 then raise exception 'INVALID_GSM'; end if;
    v_sizes := '{}'::jsonb; v_sum := 0;
    if jsonb_typeof(v_item -> 'sizes') = 'object' then
      for v_key in select jsonb_object_keys(v_item -> 'sizes') loop
        if not (v_key = any (array['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'])) then raise exception 'INVALID_SIZE'; end if;
        begin v_qty := (v_item -> 'sizes' ->> v_key)::int; exception when others then raise exception 'INVALID_QUANTITY'; end;
        if v_qty < 0 or v_qty > 1000000 then raise exception 'INVALID_QUANTITY'; end if;
        if v_qty > 0 then v_sizes := v_sizes || jsonb_build_object(v_key, v_qty); v_sum := v_sum + v_qty; end if;
      end loop;
    end if;
    if v_sum = 0 then
      begin v_sum := greatest(0, least(coalesce(nullif(v_item ->> 'quantity', '')::int, 0), 10000000)); exception when others then raise exception 'INVALID_QUANTITY'; end;
    end if;
    insert into public.apparel_rfq_items (rfq_id, product_id, product_name, color, fabric, gsm, sizes, quantity, note, collection, fit)
    values (v_rfq.id, v_prod.id, v_prod.name, v_color, v_fabric, v_gsm, v_sizes, v_sum, public.apparel_clean(v_item ->> 'note', 1000),
            coalesce(public.apparel_clean(v_item ->> 'collection', 60), v_prod.collection), coalesce(public.apparel_clean(v_item ->> 'fit', 40), v_prod.fit));
  end loop;
  -- Files already uploaded to storage under rfq/<uid>/…; only the caller's own objects can be attached.
  if jsonb_typeof(p -> 'files') = 'array' then
    if jsonb_array_length(p -> 'files') > 10 then raise exception 'TOO_MANY_FILES'; end if;
    for v_file in select * from jsonb_array_elements(p -> 'files') loop
      v_path := v_file ->> 'path'; v_mime := v_file ->> 'mime';
      if v_path is null or v_path not like 'rfq/' || v_uid::text || '/%' or v_path like '%..%' then raise exception 'INVALID_FILE'; end if;
      if not exists (select 1 from storage.objects o where o.bucket_id = 'apparel-files' and o.name = v_path) then raise exception 'FILE_NOT_UPLOADED'; end if;
      insert into public.apparel_files (bucket, path, filename, mime, size_bytes, entity, entity_id, kind, buyer_id, visible_to_buyer, uploaded_by)
      values ('apparel-files', v_path, coalesce(public.apparel_clean(v_file ->> 'filename', 200), 'file'), v_mime,
              coalesce(nullif(v_file ->> 'size', '')::int, 1), 'rfq', v_rfq.id,
              case when v_file ->> 'kind' in ('artwork', 'logo', 'tech_pack') then v_file ->> 'kind' else 'artwork' end, v_uid, true, v_uid);
      v_files := v_files + 1;
    end loop;
  end if;
  perform public.apparel_history_add('rfq', v_rfq.id::text, null, 'pending', 'Request for quotation submitted');
  perform public.apparel_touch_lead(v_email, v_buyer.contact_person, v_buyer.company_name, coalesce(v_rfq.whatsapp, v_buyer.phone), v_rfq.country, 'rfq', v_uid, 'interested', 'Quotation request ' || v_rfq.code);
  perform public.apparel_email(v_email, 'rfq_received', jsonb_build_object('code', v_rfq.code, 'name', v_rfq.contact_name, 'items', jsonb_array_length(v_items)));
  perform public.apparel_notify_admins('rfq_admin', jsonb_build_object('code', v_rfq.code, 'company', v_buyer.company_name, 'country', v_rfq.country, 'items', jsonb_array_length(v_items)));
  return jsonb_build_object('id', v_rfq.id, 'code', v_rfq.code, 'created_at', v_rfq.created_at, 'files', v_files);
end $$;

-- Guest inquiries also feed the CRM.
create or replace function public.apparel_submit_inquiry(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_kind text := public.apparel_clean(p ->> 'kind', 20);
  v_email text := lower(public.apparel_clean(p ->> 'email', 200));
  v_details jsonb := coalesce(p -> 'details', '{}'::jsonb);
  v_row public.apparel_inquiries;
begin
  if v_kind is null or v_kind not in ('contact', 'service', 'wholesale', 'studio', 'newsletter', 'sample', 'rfq') then raise exception 'INVALID_KIND'; end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'EMAIL_REQUIRED'; end if;
  if public.apparel_clean(p ->> 'subject', 200) is null then raise exception 'SUBJECT_REQUIRED'; end if;
  if jsonb_typeof(v_details) <> 'object' or char_length(v_details::text) > 8000 then raise exception 'INVALID_DETAILS'; end if;
  if (select count(*) from public.apparel_inquiries i where lower(i.email) = v_email and i.created_at > now() - interval '10 minutes') >= 5 then raise exception 'RATE_LIMIT'; end if;
  if (select count(*) from public.apparel_inquiries i where i.created_at > now() - interval '10 minutes') >= 120 then raise exception 'RATE_LIMIT'; end if;
  if exists (select 1 from public.apparel_inquiries i where lower(i.email) = v_email and i.subject = public.apparel_clean(p ->> 'subject', 200)
             and coalesce(i.message, '') = coalesce(public.apparel_clean(p ->> 'message', 6000), '') and i.created_at > now() - interval '2 minutes') then
    raise exception 'DUPLICATE_REQUEST';
  end if;
  insert into public.apparel_inquiries (code, user_id, kind, subject, contact_name, email, company, country, phone, message, details)
  values ('INQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_inquiry_seq')::text, 4, '0'), auth.uid(), v_kind,
          public.apparel_clean(p ->> 'subject', 200), public.apparel_clean(p ->> 'contact_name', 120), v_email,
          public.apparel_clean(p ->> 'company', 160), public.apparel_clean(p ->> 'country', 80), public.apparel_clean(p ->> 'phone', 40),
          public.apparel_clean(p ->> 'message', 6000), v_details)
  returning * into v_row;
  if v_kind <> 'newsletter' then
    perform public.apparel_touch_lead(v_email, v_row.contact_name, v_row.company, v_row.phone, v_row.country, case when v_kind = 'rfq' then 'rfq' else 'inquiry' end,
                                      auth.uid(), null, 'Inquiry ' || v_row.code || ': ' || v_row.subject);
    perform public.apparel_notify_admins('inquiry_admin', jsonb_build_object('code', v_row.code, 'kind', v_kind, 'subject', v_row.subject, 'email', v_email));
  end if;
  return jsonb_build_object('code', v_row.code, 'created_at', v_row.created_at);
end $$;

-- ---------- buyer portal ----------
create or replace function public.apparel_files_for(p_entity text, p_id bigint, p_buyer boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'path', f.path, 'filename', f.filename, 'mime', f.mime, 'size', f.size_bytes, 'kind', f.kind,
                                               'visible_to_buyer', f.visible_to_buyer, 'created_at', f.created_at) order by f.created_at), '[]'::jsonb)
  from public.apparel_files f where f.entity = p_entity and f.entity_id = p_id and (not p_buyer or f.visible_to_buyer);
$$;

create or replace function public.apparel_quote_json(p_quote bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select (to_jsonb(q) - 'created_by') || jsonb_build_object('lines',
    coalesce((select jsonb_agg(to_jsonb(l) - 'quote_id' order by l.position, l.id) from public.apparel_quote_lines l where l.quote_id = q.id), '[]'::jsonb))
  from public.apparel_quotes q where q.id = p_quote;
$$;

create or replace function public.apparel_order_json(p_order bigint, p_buyer boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select (to_jsonb(o) - case when p_buyer then 'admin_note' else '' end) || jsonb_build_object(
    'lines', coalesce((select jsonb_agg(to_jsonb(l) - 'order_id' order by l.position, l.id) from public.apparel_order_lines l where l.order_id = o.id), '[]'::jsonb),
    'history', public.apparel_history('order', o.id::text),
    'shipments', coalesce((select jsonb_agg((to_jsonb(s) - case when p_buyer then 'cost' else '' end) || jsonb_build_object('documents', public.apparel_files_for('shipment', s.id, p_buyer)) order by s.created_at) from public.apparel_shipments s where s.order_id = o.id), '[]'::jsonb),
    'production', coalesce((select jsonb_agg(jsonb_build_object('code', pr.code, 'status', pr.status, 'quantity', pr.quantity, 'completed_qty', pr.completed_qty,
        'expected_completion', pr.expected_completion,
        'stages', (select jsonb_agg(jsonb_build_object('stage', st.stage, 'status', st.status, 'completed_at', st.completed_at) order by st.position) from public.apparel_production_stages st where st.production_id = pr.id))
        || case when p_buyer then '{}'::jsonb else jsonb_build_object('id', pr.id) end) from public.apparel_production pr where pr.order_id = o.id), '[]'::jsonb),
    'documents', public.apparel_files_for('order', o.id, p_buyer),
    'quote_code', (select q.code || ' rev ' || q.revision from public.apparel_quotes q where q.id = o.quote_id),
    'rfq_code', (select r.code from public.apparel_rfqs r where r.id = o.rfq_id))
  from public.apparel_orders o where o.id = p_order;
$$;

create or replace function public.apparel_me()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'email', (select u.email from auth.users u where u.id = v_uid),
    'is_admin', public.apparel_is_admin(false),
    'buyer', (select to_jsonb(b) - 'admin_note' from public.apparel_buyers b where b.user_id = v_uid),
    'rfqs', coalesce((select jsonb_agg((to_jsonb(r) - 'admin_note' - 'seen_by_admin' - 'fingerprint' - 'assigned_to' - 'user_id') || jsonb_build_object(
        'items', coalesce((select jsonb_agg(to_jsonb(i) - 'rfq_id' order by i.id) from public.apparel_rfq_items i where i.rfq_id = r.id), '[]'::jsonb),
        'files', public.apparel_files_for('rfq', r.id, true),
        'quotes', coalesce((select jsonb_agg(public.apparel_quote_json(q.id) order by q.revision desc) from public.apparel_quotes q where q.rfq_id = r.id and q.status <> 'draft'), '[]'::jsonb),
        'history', public.apparel_history('rfq', r.id::text)) order by r.created_at desc)
      from public.apparel_rfqs r where r.user_id = v_uid), '[]'::jsonb),
    'samples', coalesce((select jsonb_agg((to_jsonb(s) - 'admin_note' - 'seen_by_admin' - 'user_id') || jsonb_build_object('history', public.apparel_history('sample', s.id::text)) order by s.created_at desc)
      from public.apparel_samples s where s.user_id = v_uid), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(public.apparel_order_json(o.id, true) order by o.created_at desc) from public.apparel_orders o where o.user_id = v_uid), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from_admin', m.from_admin, 'body', m.body, 'created_at', m.created_at, 'read_at', m.read_at) order by m.created_at)
      from public.apparel_messages m where m.buyer_id = v_uid), '[]'::jsonb),
    'addresses', coalesce((select jsonb_agg(to_jsonb(a) - 'user_id' order by a.is_default desc, a.id) from public.apparel_addresses a where a.user_id = v_uid), '[]'::jsonb)
  );
end $$;

create or replace function public.apparel_quote_respond(p_quote bigint, p_action text, p_message text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.apparel_quotes; r public.apparel_rfqs; v_new text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into q from public.apparel_quotes where id = p_quote for update;
  select * into r from public.apparel_rfqs where id = q.rfq_id;
  if q.id is null or r.user_id is distinct from auth.uid() then raise exception 'NOT_FOUND'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if p_action = 'accept' then
    if q.valid_until is not null and q.valid_until < current_date then raise exception 'QUOTE_EXPIRED'; end if;
    update public.apparel_quotes set status = 'accepted', buyer_response = public.apparel_clean(p_message, 2000), responded_at = now() where id = q.id;
    v_new := 'approved';
  elsif p_action = 'reject' then
    update public.apparel_quotes set status = 'rejected', buyer_response = public.apparel_clean(p_message, 2000), responded_at = now() where id = q.id;
    v_new := 'rejected';
  elsif p_action = 'negotiate' then
    if public.apparel_clean(p_message, 2000) is null then raise exception 'MESSAGE_REQUIRED'; end if;
    update public.apparel_quotes set buyer_response = public.apparel_clean(p_message, 2000), responded_at = now() where id = q.id;
    v_new := 'negotiation';
  else raise exception 'INVALID_ACTION'; end if;
  update public.apparel_rfqs set status = v_new, seen_by_admin = false, updated_at = now() where id = r.id;
  perform public.apparel_history_add('rfq', r.id::text, r.status, v_new, coalesce('Buyer: ' || public.apparel_clean(p_message, 1800), case p_action when 'accept' then 'Quotation accepted by buyer' when 'reject' then 'Quotation declined by buyer' end));
  perform public.apparel_touch_lead(public.apparel_user_email(auth.uid()), null, null, null, null, 'rfq', auth.uid(), case when v_new = 'negotiation' then 'negotiation' else null end, 'Quotation ' || q.code || ' rev ' || q.revision || ': ' || p_action);
  perform public.apparel_notify_admins('quote_response', jsonb_build_object('code', q.code, 'revision', q.revision, 'action', p_action, 'message', p_message));
  return jsonb_build_object('ok', true, 'status', v_new);
end $$;

create or replace function public.apparel_send_message(p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_body text := public.apparel_clean(p_body, 4000);
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if v_body is null then raise exception 'MESSAGE_REQUIRED'; end if;
  if (select count(*) from public.apparel_messages m where m.buyer_id = auth.uid() and not m.from_admin and m.created_at > now() - interval '10 minutes') >= 10 then raise exception 'RATE_LIMIT'; end if;
  insert into public.apparel_messages (buyer_id, from_admin, sender, body) values (auth.uid(), false, auth.uid(), v_body);
  update public.apparel_messages set read_at = now() where buyer_id = auth.uid() and from_admin and read_at is null;
  perform public.apparel_notify_admins('message_admin', jsonb_build_object('email', public.apparel_user_email(auth.uid()), 'body', left(v_body, 500)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_save_address(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; v_row public.apparel_addresses;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if v_id is null and (select count(*) from public.apparel_addresses where user_id = auth.uid()) >= 10 then raise exception 'TOO_MANY_ADDRESSES'; end if;
  if public.apparel_clean(p ->> 'recipient', 120) is null or public.apparel_clean(p ->> 'line1', 200) is null or public.apparel_clean(p ->> 'city', 100) is null or public.apparel_clean(p ->> 'country', 80) is null then
    raise exception 'ADDRESS_FIELDS_REQUIRED';
  end if;
  if coalesce((p ->> 'is_default')::boolean, false) then update public.apparel_addresses set is_default = false where user_id = auth.uid(); end if;
  if v_id is null then
    insert into public.apparel_addresses (user_id, label, recipient, company, line1, line2, city, region, postal_code, country, phone, is_default)
    values (auth.uid(), public.apparel_clean(p ->> 'label', 60), public.apparel_clean(p ->> 'recipient', 120), public.apparel_clean(p ->> 'company', 160),
            public.apparel_clean(p ->> 'line1', 200), public.apparel_clean(p ->> 'line2', 200), public.apparel_clean(p ->> 'city', 100), public.apparel_clean(p ->> 'region', 100),
            public.apparel_clean(p ->> 'postal_code', 20), public.apparel_clean(p ->> 'country', 80), public.apparel_clean(p ->> 'phone', 40),
            coalesce((p ->> 'is_default')::boolean, false) or not exists (select 1 from public.apparel_addresses where user_id = auth.uid()))
    returning * into v_row;
  else
    update public.apparel_addresses set label = public.apparel_clean(p ->> 'label', 60), recipient = public.apparel_clean(p ->> 'recipient', 120), company = public.apparel_clean(p ->> 'company', 160),
      line1 = public.apparel_clean(p ->> 'line1', 200), line2 = public.apparel_clean(p ->> 'line2', 200), city = public.apparel_clean(p ->> 'city', 100), region = public.apparel_clean(p ->> 'region', 100),
      postal_code = public.apparel_clean(p ->> 'postal_code', 20), country = public.apparel_clean(p ->> 'country', 80), phone = public.apparel_clean(p ->> 'phone', 40),
      is_default = coalesce((p ->> 'is_default')::boolean, is_default)
    where id = v_id and user_id = auth.uid() returning * into v_row;
    if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  return to_jsonb(v_row) - 'user_id';
end $$;

create or replace function public.apparel_delete_address(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  delete from public.apparel_addresses where id = p_id and user_id = auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin: overview & lists ----------
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
    'open_inquiries', (select count(*) from public.apparel_inquiries where status <> 'closed'),
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

create or replace function public.apparel_admin_rfqs(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('quotes');
  return coalesce((select jsonb_agg((to_jsonb(r) - 'fingerprint') || jsonb_build_object(
      'buyer', public.apparel_buyer_json(r.user_id),
      'items', coalesce((select jsonb_agg(to_jsonb(i) - 'rfq_id' order by i.id) from public.apparel_rfq_items i where i.rfq_id = r.id), '[]'::jsonb),
      'files', public.apparel_files_for('rfq', r.id, false),
      'quotes', coalesce((select jsonb_agg(public.apparel_quote_json(q.id) order by q.revision desc) from public.apparel_quotes q where q.rfq_id = r.id), '[]'::jsonb),
      'order', (select jsonb_build_object('id', o.id, 'code', o.code, 'status', o.status) from public.apparel_orders o where o.rfq_id = r.id order by o.id desc limit 1),
      'history', public.apparel_history('rfq', r.id::text)) order by r.created_at desc)
    from (select * from public.apparel_rfqs where p_status is null or status = p_status order by created_at desc limit 500) r), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_update_rfq(p_id bigint, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public.apparel_require('quotes');
  select status into v_old from public.apparel_rfqs where id = p_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('pending', 'under_review', 'quotation_sent', 'negotiation', 'sample_requested', 'approved', 'rejected', 'cancelled') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_rfqs set status = p_status, admin_note = public.apparel_clean(p_note, 4000), seen_by_admin = true, updated_at = now() where id = p_id;
  if v_old <> p_status then perform public.apparel_history_add('rfq', p_id::text, v_old, p_status); end if;
  perform public.apparel_log('update_status', 'rfq', p_id::text, jsonb_build_object('from', v_old, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_message(p_entity text, p_id bigint, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_status text; v_note text := public.apparel_clean(p_note, 2000); v_uid uuid;
begin
  if v_note is null then raise exception 'MESSAGE_REQUIRED'; end if;
  if p_entity = 'rfq' then perform public.apparel_require('quotes'); select status, user_id into v_status, v_uid from public.apparel_rfqs where id = p_id;
  elsif p_entity = 'sample' then perform public.apparel_require('samples'); select status, user_id into v_status, v_uid from public.apparel_samples where id = p_id;
  elsif p_entity = 'order' then perform public.apparel_require('orders'); select status, user_id into v_status, v_uid from public.apparel_orders where id = p_id;
  else raise exception 'INVALID_ENTITY'; end if;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  perform public.apparel_history_add(p_entity, p_id::text, v_status, v_status, v_note);
  perform public.apparel_email(public.apparel_user_email(v_uid), 'update_message', jsonb_build_object('entity', p_entity, 'message', v_note));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_buyers(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('buyers');
  return coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'rfq_count', (select count(*) from public.apparel_rfqs r where r.user_id = b.user_id),
      'order_count', (select count(*) from public.apparel_orders o where o.user_id = b.user_id),
      'sample_count', (select count(*) from public.apparel_samples s where s.user_id = b.user_id),
      'unread', (select count(*) from public.apparel_messages m where m.buyer_id = b.user_id and not m.from_admin and m.read_at is null)) order by b.created_at desc)
    from (select * from public.apparel_buyers where p_status is null or status = p_status order by created_at desc limit 1000) b), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_update_buyer(p_user uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text; v_email text;
begin
  perform public.apparel_require('buyers');
  select status, email into v_old, v_email from public.apparel_buyers where user_id = p_user for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('pending', 'verified', 'rejected', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_buyers set status = p_status, admin_note = public.apparel_clean(p_note, 2000), updated_at = now() where user_id = p_user;
  if v_old <> p_status then
    perform public.apparel_history_add('buyer', p_user::text, v_old, p_status);
    if p_status = 'verified' then perform public.apparel_email(v_email, 'buyer_verified', '{}'::jsonb); end if;
  end if;
  perform public.apparel_log('update_status', 'buyer', p_user::text, jsonb_build_object('from', v_old, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_samples(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('samples');
  return coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('buyer', public.apparel_buyer_json(s.user_id), 'history', public.apparel_history('sample', s.id::text)) order by s.created_at desc)
    from (select * from public.apparel_samples where p_status is null or status = p_status order by created_at desc limit 500) s), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_update_sample(p_id bigint, p_status text, p_courier text default null, p_tracking text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text; v_uid uuid; v_code text;
begin
  perform public.apparel_require('samples');
  select status, user_id, code into v_old, v_uid, v_code from public.apparel_samples where id = p_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('requested', 'approved', 'preparing', 'shipped', 'delivered', 'declined') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_samples set status = p_status, courier = public.apparel_clean(p_courier, 80), tracking_number = public.apparel_clean(p_tracking, 80),
    admin_note = public.apparel_clean(p_note, 2000), seen_by_admin = true, updated_at = now() where id = p_id;
  if v_old <> p_status then
    perform public.apparel_history_add('sample', p_id::text, v_old, p_status,
      case when p_status = 'shipped' and public.apparel_clean(p_tracking, 80) is not null then btrim(coalesce(public.apparel_clean(p_courier, 80), '') || ' ' || public.apparel_clean(p_tracking, 80)) end);
    perform public.apparel_email(public.apparel_user_email(v_uid), 'sample_status', jsonb_build_object('code', v_code, 'status', p_status, 'courier', p_courier, 'tracking', p_tracking));
  end if;
  perform public.apparel_log('update_status', 'sample', p_id::text, jsonb_build_object('from', v_old, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_inquiries(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('inquiries');
  return coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc)
    from (select * from public.apparel_inquiries where p_status is null or status = p_status order by created_at desc limit 500) i), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_update_inquiry(p_id bigint, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public.apparel_require('inquiries');
  select status into v_old from public.apparel_inquiries where id = p_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('new', 'in_progress', 'closed') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_inquiries set status = p_status, admin_note = public.apparel_clean(p_note, 2000), seen_by_admin = true, updated_at = now() where id = p_id;
  if v_old <> p_status then perform public.apparel_history_add('inquiry', p_id::text, v_old, p_status); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_mark_seen(p_kind text, p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  if p_kind = 'rfq' and public.apparel_can('quotes') then update public.apparel_rfqs set seen_by_admin = true where id = p_id;
  elsif p_kind = 'sample' and public.apparel_can('samples') then update public.apparel_samples set seen_by_admin = true where id = p_id;
  elsif p_kind = 'inquiry' and public.apparel_can('inquiries') then update public.apparel_inquiries set seen_by_admin = true where id = p_id;
  end if;
end $$;

-- ---------- admin: quotations ----------
create or replace function public.apparel_admin_save_quote(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint := nullif(p ->> 'id', '')::bigint; v_rfq bigint := nullif(p ->> 'rfq_id', '')::bigint; q public.apparel_quotes;
  v_line jsonb; v_pos int := 0; v_qty int; v_price numeric(12, 2); v_rev int; v_code text;
begin
  perform public.apparel_require('quotes');
  if jsonb_typeof(p -> 'lines') is distinct from 'array' or jsonb_array_length(p -> 'lines') = 0 then raise exception 'LINES_REQUIRED'; end if;
  if jsonb_array_length(p -> 'lines') > 60 then raise exception 'TOO_MANY_ITEMS'; end if;
  if v_id is not null then
    select * into q from public.apparel_quotes where id = v_id for update;
    if q.id is null then raise exception 'NOT_FOUND'; end if;
    if q.status <> 'draft' then raise exception 'QUOTE_LOCKED'; end if;
  else
    if not exists (select 1 from public.apparel_rfqs where id = v_rfq) then raise exception 'NOT_FOUND'; end if;
    select coalesce(max(revision), 0) + 1, max(code) into v_rev, v_code from public.apparel_quotes where rfq_id = v_rfq;
    if exists (select 1 from public.apparel_quotes where rfq_id = v_rfq and status = 'draft') then raise exception 'DRAFT_EXISTS'; end if;
    insert into public.apparel_quotes (code, rfq_id, revision, created_by)
    values (coalesce(v_code, 'QT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_quote_seq')::text, 4, '0')), v_rfq, v_rev, auth.uid())
    returning * into q;
  end if;
  update public.apparel_quotes set
    currency = case when p ->> 'currency' in ('USD', 'EUR', 'GBP') then p ->> 'currency' else 'USD' end,
    shipping_cost = coalesce(nullif(p ->> 'shipping_cost', '')::numeric, 0),
    discount = coalesce(nullif(p ->> 'discount', '')::numeric, 0),
    tax_percent = coalesce(nullif(p ->> 'tax_percent', '')::numeric, 0),
    incoterm = public.apparel_clean(p ->> 'incoterm', 40), payment_terms = public.apparel_clean(p ->> 'payment_terms', 400),
    lead_time = public.apparel_clean(p ->> 'lead_time', 120), valid_until = nullif(p ->> 'valid_until', '')::date,
    notes = public.apparel_clean(p ->> 'notes', 4000)
  where id = q.id;
  delete from public.apparel_quote_lines where quote_id = q.id;
  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    begin
      v_qty := (v_line ->> 'quantity')::int; v_price := (v_line ->> 'unit_price')::numeric(12, 2);
    exception when others then raise exception 'INVALID_LINE'; end;
    if v_qty is null or v_qty < 1 or v_price is null or v_price < 0 then raise exception 'INVALID_LINE'; end if;
    if public.apparel_clean(v_line ->> 'description', 300) is null then raise exception 'INVALID_LINE'; end if;
    insert into public.apparel_quote_lines (quote_id, position, product_id, description, color, sizes, quantity, unit_price, tiers, line_total)
    values (q.id, v_pos, public.apparel_clean(v_line ->> 'product_id', 40), public.apparel_clean(v_line ->> 'description', 300), public.apparel_clean(v_line ->> 'color', 60),
            case when jsonb_typeof(v_line -> 'sizes') = 'object' then v_line -> 'sizes' else '{}'::jsonb end, v_qty, v_price,
            case when jsonb_typeof(v_line -> 'tiers') = 'array' then v_line -> 'tiers' else '[]'::jsonb end, round(v_qty * v_price, 2));
    v_pos := v_pos + 1;
  end loop;
  perform public.apparel_quote_recalc(q.id);
  perform public.apparel_log('save', 'quote', q.id::text, jsonb_build_object('code', q.code, 'revision', q.revision));
  return public.apparel_quote_json(q.id);
end $$;

create or replace function public.apparel_admin_send_quote(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.apparel_quotes; r public.apparel_rfqs;
begin
  perform public.apparel_require('quotes');
  select * into q from public.apparel_quotes where id = p_id for update;
  if q.id is null then raise exception 'NOT_FOUND'; end if;
  if q.status <> 'draft' then raise exception 'QUOTE_LOCKED'; end if;
  if q.total <= 0 then raise exception 'QUOTE_EMPTY'; end if;
  select * into r from public.apparel_rfqs where id = q.rfq_id for update;
  update public.apparel_quotes set status = 'superseded' where rfq_id = q.rfq_id and status = 'sent';
  update public.apparel_quotes set status = 'sent', sent_at = now() where id = q.id;
  update public.apparel_rfqs set status = 'quotation_sent', seen_by_admin = true, updated_at = now() where id = r.id;
  perform public.apparel_history_add('rfq', r.id::text, r.status, 'quotation_sent', 'Quotation ' || q.code || ' revision ' || q.revision || ' sent: ' || q.currency || ' ' || to_char(q.total, 'FM999,999,999,990.00'));
  perform public.apparel_touch_lead(public.apparel_user_email(r.user_id), null, null, null, null, 'rfq', r.user_id, 'quotation_sent', 'Quotation ' || q.code || ' rev ' || q.revision || ' sent');
  perform public.apparel_email(public.apparel_user_email(r.user_id), 'quote_sent', jsonb_build_object('code', q.code, 'revision', q.revision, 'rfq', r.code, 'currency', q.currency, 'total', q.total, 'valid_until', q.valid_until));
  perform public.apparel_log('send', 'quote', q.id::text, jsonb_build_object('code', q.code, 'revision', q.revision, 'total', q.total));
  return public.apparel_quote_json(q.id);
end $$;

create or replace function public.apparel_admin_delete_quote(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('quotes');
  delete from public.apparel_quotes where id = p_id and status = 'draft';
  if not found then raise exception 'QUOTE_LOCKED'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin: orders ----------
create or replace function public.apparel_admin_create_order(p_quote bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.apparel_quotes; r public.apparel_rfqs; v_id bigint; v_code text;
begin
  perform public.apparel_require('orders');
  select * into q from public.apparel_quotes where id = p_quote;
  if q.id is null then raise exception 'NOT_FOUND'; end if;
  if q.status not in ('accepted', 'sent') then raise exception 'QUOTE_NOT_ACCEPTED'; end if;
  if exists (select 1 from public.apparel_orders where quote_id = q.id) then raise exception 'ORDER_EXISTS'; end if;
  select * into r from public.apparel_rfqs where id = q.rfq_id;
  v_code := 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_order_seq')::text, 4, '0');
  insert into public.apparel_orders (code, user_id, rfq_id, quote_id, status, currency, total, delivery_address)
  values (v_code, r.user_id, r.id, q.id, 'awaiting_confirmation', q.currency, q.total, r.destination)
  returning id into v_id;
  insert into public.apparel_order_lines (order_id, position, product_id, product_name, color, sizes, quantity, unit_price, line_total)
  select v_id, l.position, l.product_id, l.description, l.color, l.sizes, l.quantity, l.unit_price, l.line_total from public.apparel_quote_lines l where l.quote_id = q.id;
  if q.status = 'sent' then update public.apparel_quotes set status = 'accepted', responded_at = coalesce(responded_at, now()) where id = q.id; end if;
  if r.status <> 'approved' then
    update public.apparel_rfqs set status = 'approved', updated_at = now() where id = r.id;
    perform public.apparel_history_add('rfq', r.id::text, r.status, 'approved', 'Order ' || v_code || ' created');
  end if;
  perform public.apparel_history_add('order', v_id::text, null, 'awaiting_confirmation', 'Order created from quotation ' || q.code || ' rev ' || q.revision);
  perform public.apparel_touch_lead(public.apparel_user_email(r.user_id), null, null, null, null, 'rfq', r.user_id, 'converted', 'Order ' || v_code || ' created');
  perform public.apparel_email(public.apparel_user_email(r.user_id), 'order_created', jsonb_build_object('code', v_code, 'currency', q.currency, 'total', q.total));
  perform public.apparel_log('create', 'order', v_id::text, jsonb_build_object('code', v_code, 'quote', q.code));
  return public.apparel_order_json(v_id, false);
end $$;

create or replace function public.apparel_admin_orders(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('orders');
  return coalesce((select jsonb_agg(public.apparel_order_json(o.id, false) || jsonb_build_object('buyer', public.apparel_buyer_json(o.user_id)) order by o.created_at desc)
    from (select * from public.apparel_orders where p_status is null or status = p_status order by created_at desc limit 500) o), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_update_order(p_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.apparel_orders; v_status text := coalesce(p ->> 'status', '');
begin
  perform public.apparel_require('orders');
  select * into o from public.apparel_orders where id = p_id for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  if v_status not in ('received', 'awaiting_confirmation', 'sample_development', 'sample_approved', 'production_pending', 'in_production', 'quality_inspection',
                      'packing', 'ready_to_ship', 'shipped', 'delivered', 'completed', 'cancelled') then raise exception 'INVALID_STATUS'; end if;
  if coalesce(p ->> 'payment_status', o.payment_status) not in ('unpaid', 'deposit_received', 'paid', 'refunded') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_orders set status = v_status,
    payment_status = coalesce(p ->> 'payment_status', payment_status), payment_info = public.apparel_clean(p ->> 'payment_info', 1000),
    delivery_address = public.apparel_clean(p ->> 'delivery_address', 800), shipping_method = public.apparel_clean(p ->> 'shipping_method', 80),
    buyer_notes = public.apparel_clean(p ->> 'buyer_notes', 2000), admin_note = public.apparel_clean(p ->> 'admin_note', 2000), updated_at = now()
  where id = p_id;
  if o.status <> v_status then
    perform public.apparel_history_add('order', p_id::text, o.status, v_status, public.apparel_clean(p ->> 'message', 2000));
    perform public.apparel_email(public.apparel_user_email(o.user_id), 'order_status', jsonb_build_object('code', o.code, 'status', v_status, 'message', p ->> 'message'));
  elsif public.apparel_clean(p ->> 'message', 2000) is not null then
    perform public.apparel_history_add('order', p_id::text, v_status, v_status, public.apparel_clean(p ->> 'message', 2000));
  end if;
  perform public.apparel_log('update', 'order', p_id::text, jsonb_build_object('from', o.status, 'to', v_status, 'payment', p ->> 'payment_status'));
  return public.apparel_order_json(p_id, false);
end $$;

-- ---------- admin: production & QC ----------
create or replace function public.apparel_admin_production_list(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('production');
  return coalesce((select jsonb_agg(to_jsonb(pr) || jsonb_build_object(
      'order', (select jsonb_build_object('id', o.id, 'code', o.code, 'status', o.status, 'company', (select b.company_name from public.apparel_buyers b where b.user_id = o.user_id)) from public.apparel_orders o where o.id = pr.order_id),
      'lines', (select coalesce(jsonb_agg(jsonb_build_object('product_name', l.product_name, 'color', l.color, 'sizes', l.sizes, 'quantity', l.quantity) order by l.position), '[]'::jsonb) from public.apparel_order_lines l where l.order_id = pr.order_id),
      'stages', (select jsonb_agg(to_jsonb(s) - 'production_id' order by s.position) from public.apparel_production_stages s where s.production_id = pr.id),
      'qc', coalesce((select jsonb_agg((to_jsonb(q) - 'created_by') || jsonb_build_object('photos', public.apparel_files_for('qc', q.id, false)) order by q.created_at desc) from public.apparel_qc q where q.production_id = pr.id), '[]'::jsonb)) order by pr.created_at desc)
    from (select * from public.apparel_production where p_status is null or status = p_status order by created_at desc limit 500) pr), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_save_production(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint := nullif(p ->> 'id', '')::bigint; v_order bigint := nullif(p ->> 'order_id', '')::bigint; v_row public.apparel_production; v_old text;
  v_stages text[] := array['order_confirmation', 'material_procurement', 'fabric_preparation', 'cutting', 'printing_embroidery', 'stitching', 'finishing', 'quality_inspection', 'packing'];
  v_qty int; v_done int;
begin
  perform public.apparel_require('production');
  begin v_qty := nullif(p ->> 'quantity', '')::int; v_done := coalesce(nullif(p ->> 'completed_qty', '')::int, 0); exception when others then raise exception 'INVALID_QUANTITY'; end;
  if v_id is null then
    if not exists (select 1 from public.apparel_orders where id = v_order and status <> 'cancelled') then raise exception 'NOT_FOUND'; end if;
    v_qty := coalesce(v_qty, (select sum(quantity) from public.apparel_order_lines where order_id = v_order), 0);
    insert into public.apparel_production (code, order_id, quantity, completed_qty, start_date, expected_completion, assigned_team, notes)
    values ('PRO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_production_seq')::text, 4, '0'), v_order, v_qty, least(v_done, v_qty),
            nullif(p ->> 'start_date', '')::date, nullif(p ->> 'expected_completion', '')::date, public.apparel_clean(p ->> 'assigned_team', 120), public.apparel_clean(p ->> 'notes', 4000))
    returning * into v_row;
    insert into public.apparel_production_stages (production_id, position, stage) select v_row.id, i, v_stages[i] from generate_subscripts(v_stages, 1) i;
    perform public.apparel_history_add('production', v_row.id::text, null, 'planned', 'Production order created');
    perform public.apparel_order_advance(v_order, 'production_pending', 'Production order ' || v_row.code || ' planned');
  else
    select status into v_old from public.apparel_production where id = v_id for update;
    if v_old is null then raise exception 'NOT_FOUND'; end if;
    if coalesce(p ->> 'status', v_old) not in ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled') then raise exception 'INVALID_STATUS'; end if;
    update public.apparel_production set status = coalesce(p ->> 'status', status), quantity = coalesce(v_qty, quantity),
      completed_qty = least(v_done, coalesce(v_qty, quantity)),
      start_date = nullif(p ->> 'start_date', '')::date, expected_completion = nullif(p ->> 'expected_completion', '')::date,
      actual_completion = case when coalesce(p ->> 'status', status) = 'completed' then coalesce(nullif(p ->> 'actual_completion', '')::date, actual_completion, current_date) else nullif(p ->> 'actual_completion', '')::date end,
      assigned_team = public.apparel_clean(p ->> 'assigned_team', 120), notes = public.apparel_clean(p ->> 'notes', 4000), updated_at = now()
    where id = v_id returning * into v_row;
    if v_old <> v_row.status then
      perform public.apparel_history_add('production', v_id::text, v_old, v_row.status);
      if v_row.status = 'in_progress' then perform public.apparel_order_advance(v_row.order_id, 'in_production', 'Production started'); end if;
      if v_row.status = 'completed' then perform public.apparel_order_advance(v_row.order_id, 'quality_inspection', 'Production completed'); end if;
    end if;
  end if;
  perform public.apparel_log('save', 'production', v_row.id::text, jsonb_build_object('status', v_row.status, 'completed', v_row.completed_qty));
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_update_stage(p_production bigint, p_stage text, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pr public.apparel_production;
begin
  perform public.apparel_require('production');
  if p_status not in ('pending', 'in_progress', 'done', 'skipped') then raise exception 'INVALID_STATUS'; end if;
  update public.apparel_production_stages set status = p_status, note = public.apparel_clean(p_note, 1000),
    started_at = case when p_status in ('in_progress', 'done') then coalesce(started_at, now()) else started_at end,
    completed_at = case when p_status = 'done' then coalesce(completed_at, now()) when p_status = 'pending' then null else completed_at end
  where production_id = p_production and stage = p_stage;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_pr from public.apparel_production where id = p_production;
  if p_status in ('in_progress', 'done') and v_pr.status = 'planned' then
    update public.apparel_production set status = 'in_progress', start_date = coalesce(start_date, current_date), updated_at = now() where id = p_production;
    perform public.apparel_history_add('production', p_production::text, 'planned', 'in_progress');
    perform public.apparel_order_advance(v_pr.order_id, 'in_production', 'Production started');
  end if;
  if p_stage = 'quality_inspection' and p_status = 'in_progress' then perform public.apparel_order_advance(v_pr.order_id, 'quality_inspection', null); end if;
  if p_stage = 'packing' and p_status = 'in_progress' then perform public.apparel_order_advance(v_pr.order_id, 'packing', null); end if;
  if p_stage = 'packing' and p_status = 'done' then
    update public.apparel_production set status = 'completed', actual_completion = coalesce(actual_completion, current_date), completed_qty = quantity, updated_at = now() where id = p_production and status <> 'completed';
    perform public.apparel_order_advance(v_pr.order_id, 'ready_to_ship', 'Production and packing completed');
  end if;
  perform public.apparel_log('stage', 'production', p_production::text, jsonb_build_object('stage', p_stage, 'status', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_save_qc(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.apparel_qc; v_key text; v_chk jsonb := '{}'::jsonb;
begin
  perform public.apparel_require('qc');
  if not exists (select 1 from public.apparel_production where id = nullif(p ->> 'production_id', '')::bigint) then raise exception 'NOT_FOUND'; end if;
  if p ->> 'result' not in ('pass', 'fail') then raise exception 'RESULT_REQUIRED'; end if;
  if jsonb_typeof(p -> 'checklist') = 'object' then
    for v_key in select jsonb_object_keys(p -> 'checklist') loop
      if v_key in ('fabric', 'measurements', 'stitching', 'printing', 'color', 'finishing', 'packaging') and p -> 'checklist' ->> v_key in ('pass', 'fail', 'na') then
        v_chk := v_chk || jsonb_build_object(v_key, p -> 'checklist' ->> v_key);
      end if;
    end loop;
  end if;
  insert into public.apparel_qc (production_id, inspected_on, inspector, sample_size, defects_found, checklist, defects, result, notes, created_by)
  values ((p ->> 'production_id')::bigint, coalesce(nullif(p ->> 'inspected_on', '')::date, current_date), public.apparel_clean(p ->> 'inspector', 120),
          nullif(p ->> 'sample_size', '')::int, coalesce(nullif(p ->> 'defects_found', '')::int, 0), v_chk, public.apparel_clean(p ->> 'defects', 4000), p ->> 'result',
          public.apparel_clean(p ->> 'notes', 4000), auth.uid())
  returning * into v_row;
  perform public.apparel_log('inspect', 'qc', v_row.id::text, jsonb_build_object('production', v_row.production_id, 'result', v_row.result));
  return to_jsonb(v_row) - 'created_by';
end $$;

-- ---------- admin: suppliers ----------
create or replace function public.apparel_admin_suppliers()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('suppliers');
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.status, s.name) from public.apparel_suppliers s), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_save_supplier(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; v_row public.apparel_suppliers;
begin
  perform public.apparel_require('suppliers');
  if public.apparel_clean(p ->> 'name', 160) is null then raise exception 'NAME_REQUIRED'; end if;
  if public.apparel_clean(p ->> 'email', 200) is not null and public.apparel_clean(p ->> 'email', 200) !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'EMAIL_REQUIRED'; end if;
  if v_id is null then
    insert into public.apparel_suppliers (name) values (public.apparel_clean(p ->> 'name', 160)) returning * into v_row;
    v_id := v_row.id;
  end if;
  update public.apparel_suppliers set name = public.apparel_clean(p ->> 'name', 160), company = public.apparel_clean(p ->> 'company', 160),
    contact_person = public.apparel_clean(p ->> 'contact_person', 120), email = lower(public.apparel_clean(p ->> 'email', 200)), phone = public.apparel_clean(p ->> 'phone', 40),
    country = public.apparel_clean(p ->> 'country', 80), address = public.apparel_clean(p ->> 'address', 600), categories = public.apparel_text_array(p -> 'categories', null, 20),
    products = public.apparel_clean(p ->> 'products', 2000), payment_terms = public.apparel_clean(p ->> 'payment_terms', 400), notes = public.apparel_clean(p ->> 'notes', 4000),
    status = case when p ->> 'status' in ('active', 'on_hold', 'inactive') then p ->> 'status' else 'active' end, updated_at = now()
  where id = v_id returning * into v_row;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  perform public.apparel_log('save', 'supplier', v_id::text, jsonb_build_object('name', v_row.name));
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_delete_supplier(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('suppliers');
  delete from public.apparel_suppliers where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.apparel_log('delete', 'supplier', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin: CRM ----------
create or replace function public.apparel_admin_leads(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('crm');
  return coalesce((select jsonb_agg(to_jsonb(l) || jsonb_build_object(
      'assigned_email', public.apparel_user_email(l.assigned_to),
      'rfq_count', (select count(*) from public.apparel_rfqs r where r.user_id = l.user_id),
      'order_count', (select count(*) from public.apparel_orders o where o.user_id = l.user_id),
      'inquiry_count', (select count(*) from public.apparel_inquiries i where lower(i.email) = lower(l.email)),
      'last_activity', (select max(a.created_at) from public.apparel_lead_activities a where a.lead_id = l.id)) order by l.updated_at desc)
    from (select * from public.apparel_leads where p_status is null or status = p_status order by updated_at desc limit 1000) l), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_lead_detail(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.apparel_leads;
begin
  perform public.apparel_require('crm');
  select * into l from public.apparel_leads where id = p_id;
  if l.id is null then raise exception 'NOT_FOUND'; end if;
  return to_jsonb(l) || jsonb_build_object(
    'activities', coalesce((select jsonb_agg(jsonb_build_object('kind', a.kind, 'body', a.body, 'at', a.created_at, 'by', public.apparel_user_email(a.actor)) order by a.created_at desc) from public.apparel_lead_activities a where a.lead_id = l.id), '[]'::jsonb),
    'buyer', public.apparel_buyer_json(l.user_id),
    'rfqs', coalesce((select jsonb_agg(jsonb_build_object('code', r.code, 'status', r.status, 'created_at', r.created_at) order by r.created_at desc) from public.apparel_rfqs r where l.user_id is not null and r.user_id = l.user_id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('code', o.code, 'status', o.status, 'currency', o.currency, 'total', o.total) order by o.created_at desc) from public.apparel_orders o where l.user_id is not null and o.user_id = l.user_id), '[]'::jsonb),
    'inquiries', coalesce((select jsonb_agg(jsonb_build_object('code', i.code, 'subject', i.subject, 'status', i.status, 'created_at', i.created_at) order by i.created_at desc) from public.apparel_inquiries i where lower(i.email) = lower(l.email)), '[]'::jsonb));
end $$;

create or replace function public.apparel_admin_save_lead(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; v_row public.apparel_leads; v_old text; v_assignee uuid;
begin
  perform public.apparel_require('crm');
  if p ->> 'status' is not null and p ->> 'status' not in ('new', 'contacted', 'interested', 'quotation_sent', 'negotiation', 'converted', 'lost') then raise exception 'INVALID_STATUS'; end if;
  if public.apparel_clean(p ->> 'assigned_email', 200) is not null then
    select a.user_id into v_assignee from public.apparel_admins a join auth.users u on u.id = a.user_id where lower(u.email) = lower(p ->> 'assigned_email');
    if v_assignee is null then raise exception 'UNKNOWN_STAFF'; end if;
  end if;
  if v_id is null then
    if public.apparel_clean(p ->> 'email', 200) is null and public.apparel_clean(p ->> 'company', 160) is null then raise exception 'NAME_REQUIRED'; end if;
    if public.apparel_clean(p ->> 'email', 200) is not null and exists (select 1 from public.apparel_leads where lower(email) = lower(p ->> 'email')) then raise exception 'LEAD_EXISTS'; end if;
    insert into public.apparel_leads (code, email, source) values ('LD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_lead_seq')::text, 4, '0'),
      lower(public.apparel_clean(p ->> 'email', 200)), case when p ->> 'source' in ('website', 'rfq', 'registration', 'inquiry', 'whatsapp', 'referral', 'trade_show', 'email', 'other') then p ->> 'source' else 'other' end)
    returning id into v_id;
  end if;
  select status into v_old from public.apparel_leads where id = v_id;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  update public.apparel_leads set company = public.apparel_clean(p ->> 'company', 160), contact_name = public.apparel_clean(p ->> 'contact_name', 120),
    phone = public.apparel_clean(p ->> 'phone', 40), country = public.apparel_clean(p ->> 'country', 80),
    status = coalesce(p ->> 'status', status), assigned_to = v_assignee, next_follow_up = nullif(p ->> 'next_follow_up', '')::date,
    notes = public.apparel_clean(p ->> 'notes', 4000), updated_at = now()
  where id = v_id returning * into v_row;
  if v_old <> v_row.status then insert into public.apparel_lead_activities (lead_id, kind, body, actor) values (v_id, 'system', 'Status: ' || v_old || ' → ' || v_row.status, auth.uid()); end if;
  perform public.apparel_log('save', 'lead', v_id::text, jsonb_build_object('status', v_row.status));
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_add_activity(p_lead bigint, p_kind text, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('crm');
  if p_kind not in ('note', 'call', 'email', 'whatsapp', 'meeting') then raise exception 'INVALID_KIND'; end if;
  if public.apparel_clean(p_body, 4000) is null then raise exception 'MESSAGE_REQUIRED'; end if;
  insert into public.apparel_lead_activities (lead_id, kind, body, actor) values (p_lead, p_kind, public.apparel_clean(p_body, 4000), auth.uid());
  update public.apparel_leads set updated_at = now(), status = case when status = 'new' and p_kind in ('call', 'email', 'whatsapp', 'meeting') then 'contacted' else status end where id = p_lead;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin: shipping ----------
create or replace function public.apparel_admin_shipments()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('shipping');
  return coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('order', (select jsonb_build_object('id', o.id, 'code', o.code, 'status', o.status) from public.apparel_orders o where o.id = s.order_id),
      'documents', public.apparel_files_for('shipment', s.id, false)) order by s.created_at desc) from public.apparel_shipments s), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_save_shipment(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; v_row public.apparel_shipments; v_old text; o public.apparel_orders; v_status text := coalesce(p ->> 'status', 'preparing');
begin
  perform public.apparel_require('shipping');
  if v_status not in ('preparing', 'dispatched', 'in_transit', 'delivered', 'exception') then raise exception 'INVALID_STATUS'; end if;
  if p ->> 'method' is not null and p ->> 'method' not in ('express_courier', 'air_freight', 'sea_freight', 'road', 'buyer_pickup') then raise exception 'INVALID_METHOD'; end if;
  if v_id is null then
    select * into o from public.apparel_orders where id = nullif(p ->> 'order_id', '')::bigint;
    if o.id is null or o.status = 'cancelled' then raise exception 'NOT_FOUND'; end if;
    insert into public.apparel_shipments (code, order_id) values ('SHP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_shipment_seq')::text, 4, '0'), o.id) returning id into v_id;
  end if;
  select status into v_old from public.apparel_shipments where id = v_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  update public.apparel_shipments set destination = public.apparel_clean(p ->> 'destination', 200), method = nullif(p ->> 'method', ''), provider = public.apparel_clean(p ->> 'provider', 80),
    tracking_number = public.apparel_clean(p ->> 'tracking_number', 80), dispatch_date = nullif(p ->> 'dispatch_date', '')::date, estimated_delivery = nullif(p ->> 'estimated_delivery', '')::date,
    delivered_on = case when v_status = 'delivered' then coalesce(nullif(p ->> 'delivered_on', '')::date, current_date) else nullif(p ->> 'delivered_on', '')::date end,
    status = v_status, cost = nullif(p ->> 'cost', '')::numeric, currency = case when p ->> 'currency' in ('USD', 'EUR', 'GBP') then p ->> 'currency' else 'USD' end,
    notes = public.apparel_clean(p ->> 'notes', 2000), updated_at = now()
  where id = v_id returning * into v_row;
  select * into o from public.apparel_orders where id = v_row.order_id;
  if v_old <> v_status or v_old = 'preparing' and v_status = 'preparing' and nullif(p ->> 'id', '') is null then
    perform public.apparel_history_add('shipment', v_id::text, case when nullif(p ->> 'id', '') is null then null else v_old end, v_status);
    if v_status in ('dispatched', 'in_transit') then perform public.apparel_order_advance(o.id, 'shipped', 'Shipment ' || v_row.code || coalesce(' · ' || v_row.provider, '') || coalesce(' · ' || v_row.tracking_number, '')); end if;
    if v_status = 'delivered' then perform public.apparel_order_advance(o.id, 'delivered', 'Shipment ' || v_row.code || ' delivered'); end if;
    if v_status <> 'preparing' then
      perform public.apparel_email(public.apparel_user_email(o.user_id), 'shipment_update', jsonb_build_object('order', o.code, 'shipment', v_row.code, 'status', v_status, 'provider', v_row.provider, 'tracking', v_row.tracking_number, 'eta', v_row.estimated_delivery));
    end if;
  end if;
  perform public.apparel_log('save', 'shipment', v_id::text, jsonb_build_object('status', v_status));
  return to_jsonb(v_row);
end $$;

-- ---------- documents ----------
create or replace function public.apparel_admin_add_file(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_entity text := p ->> 'entity'; v_id bigint := nullif(p ->> 'entity_id', '')::bigint; v_buyer uuid; v_path text := p ->> 'path'; v_row public.apparel_files;
begin
  if v_entity = 'qc' then perform public.apparel_require('qc'); else perform public.apparel_require('documents'); end if;
  if v_path is null or v_path not like 'docs/' || v_entity || '/' || v_id::text || '/%' or v_path like '%..%' then raise exception 'INVALID_FILE'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'apparel-files' and o.name = v_path) then raise exception 'FILE_NOT_UPLOADED'; end if;
  if v_entity = 'order' then select user_id into v_buyer from public.apparel_orders where id = v_id;
  elsif v_entity = 'shipment' then select o.user_id into v_buyer from public.apparel_shipments s join public.apparel_orders o on o.id = s.order_id where s.id = v_id;
  elsif v_entity = 'rfq' then select user_id into v_buyer from public.apparel_rfqs where id = v_id;
  elsif v_entity = 'qc' then if not exists (select 1 from public.apparel_qc where id = v_id) then raise exception 'NOT_FOUND'; end if;
  else raise exception 'INVALID_ENTITY'; end if;
  if v_entity <> 'qc' and v_buyer is null and not exists (select 1 from public.apparel_orders where id = v_id) and v_entity = 'order' then raise exception 'NOT_FOUND'; end if;
  insert into public.apparel_files (bucket, path, filename, mime, size_bytes, entity, entity_id, kind, buyer_id, visible_to_buyer, uploaded_by)
  values ('apparel-files', v_path, coalesce(public.apparel_clean(p ->> 'filename', 200), 'file'), p ->> 'mime', coalesce(nullif(p ->> 'size', '')::int, 1), v_entity, v_id,
          case when p ->> 'kind' in ('commercial_invoice', 'packing_list', 'shipping_document', 'certificate_of_origin', 'inspection_report', 'inspection_photo', 'quotation', 'other') then p ->> 'kind' else 'other' end,
          v_buyer, coalesce((p ->> 'visible_to_buyer')::boolean, false) and v_entity <> 'qc', auth.uid())
  returning * into v_row;
  perform public.apparel_log('upload', 'file', v_row.id::text, jsonb_build_object('entity', v_entity, 'entity_id', v_id, 'kind', v_row.kind));
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_file_visibility(p_id bigint, p_visible boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('documents');
  update public.apparel_files set visible_to_buyer = p_visible and entity <> 'qc' where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_delete_file(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_path text;
begin
  perform public.apparel_require('documents');
  delete from public.apparel_files where id = p_id and entity <> 'rfq' returning path into v_path;
  if v_path is null then raise exception 'NOT_FOUND'; end if;
  perform public.apparel_log('delete', 'file', p_id::text, jsonb_build_object('path', v_path));
  return jsonb_build_object('ok', true, 'path', v_path);
end $$;

-- Storage access check used by storage.objects policies.
create or replace function public.apparel_file_readable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_name like 'rfq/' || auth.uid()::text || '/%'
    or public.apparel_can('documents') or public.apparel_can('quotes') or public.apparel_can('qc')
    or exists (select 1 from public.apparel_files f where f.path = p_name and f.visible_to_buyer and f.buyer_id = auth.uid()));
$$;
create or replace function public.apparel_file_writable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    (p_name like 'rfq/' || auth.uid()::text || '/%' and p_name not like '%..%')
    or (p_name like 'docs/%' and (public.apparel_can('documents') or (p_name like 'docs/qc/%' and public.apparel_can('qc')))));
$$;

-- ---------- admin: buyer messages ----------
create or replace function public.apparel_admin_messages(p_buyer uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('messages');
  update public.apparel_messages set read_at = now() where buyer_id = p_buyer and not from_admin and read_at is null;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from_admin', m.from_admin, 'body', m.body, 'created_at', m.created_at, 'by', public.apparel_user_email(m.sender)) order by m.created_at)
    from public.apparel_messages m where m.buyer_id = p_buyer), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_send_message(p_buyer uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_body text := public.apparel_clean(p_body, 4000);
begin
  perform public.apparel_require('messages');
  if v_body is null then raise exception 'MESSAGE_REQUIRED'; end if;
  if not exists (select 1 from public.apparel_buyers where user_id = p_buyer) then raise exception 'NOT_FOUND'; end if;
  insert into public.apparel_messages (buyer_id, from_admin, sender, body) values (p_buyer, true, auth.uid(), v_body);
  perform public.apparel_email(public.apparel_user_email(p_buyer), 'message_buyer', jsonb_build_object('body', left(v_body, 500)));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin: catalog ----------
create or replace function public.apparel_admin_catalog()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.sort, p.id) from public.apparel_products p), '[]'::jsonb),
    'fabrics', coalesce((select jsonb_agg(to_jsonb(f) order by f.sort, f.slug) from public.apparel_fabrics f), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort, c.slug) from public.apparel_collections c), '[]'::jsonb));
end $$;

create or replace function public.apparel_media_path_ok(p_paths jsonb)
returns text[] language plpgsql immutable set search_path = '' as $$
declare v text[] := '{}'; e text;
begin
  if jsonb_typeof(p_paths) is distinct from 'array' then return v; end if;
  for e in select jsonb_array_elements_text(p_paths) loop
    if e !~ '^(products|fabrics|collections)/[A-Za-z0-9._/-]{1,200}$' or e like '%..%' then raise exception 'INVALID_FILE'; end if;
    v := v || e;
    exit when array_length(v, 1) >= 12;
  end loop;
  return v;
end $$;

create or replace function public.apparel_admin_save_product(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id text := public.apparel_clean(p ->> 'id', 20); v_name text := public.apparel_clean(p ->> 'name', 120); v_slug text; v_sku text := upper(public.apparel_clean(p ->> 'sku', 40));
  v_colors text[] := array['black','white','bone','sand','stone','charcoal','heather','navy','olive','sage','brick','forest','cobalt','washed','clay'];
  v_cats text[] := array['basic-t-shirts','oversized-t-shirts','drop-shoulder-t-shirts','streetwear-t-shirts','graphic-t-shirts','polo-t-shirts','sports-t-shirts','premium-cotton-t-shirts','organic-cotton-t-shirts','vintage-wash-t-shirts','heavyweight-t-shirts','custom-printed-t-shirts'];
  v_row public.apparel_products; v_tiers jsonb := '[]'::jsonb; v_t jsonb;
begin
  perform public.apparel_require('catalog');
  if v_name is null or char_length(v_name) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if not ((p ->> 'category') = any (v_cats)) then raise exception 'INVALID_CATEGORY'; end if;
  if not exists (select 1 from public.apparel_fabrics f where f.slug = p ->> 'fabric') then raise exception 'INVALID_FABRIC'; end if;
  if public.apparel_clean(p ->> 'collection', 60) is not null and not exists (select 1 from public.apparel_collections c where c.slug = p ->> 'collection') then raise exception 'INVALID_COLLECTION'; end if;
  if v_sku is not null and v_sku !~ '^[A-Z0-9-]{3,40}$' then raise exception 'INVALID_SKU'; end if;
  if jsonb_typeof(p -> 'price_tiers') = 'array' then
    for v_t in select * from jsonb_array_elements(p -> 'price_tiers') loop
      if (v_t ->> 'min_qty') !~ '^\d{1,7}$' or (v_t ->> 'unit_price') !~ '^\d{1,9}(\.\d{1,2})?$' then raise exception 'INVALID_TIER'; end if;
      v_tiers := v_tiers || jsonb_build_array(jsonb_build_object('min_qty', (v_t ->> 'min_qty')::int, 'unit_price', (v_t ->> 'unit_price')::numeric(12, 2)));
    end loop;
  end if;
  if v_id is null then
    v_id := 'PRD-' || lpad((coalesce((select max(substr(id, 5)::int) from public.apparel_products), 0) + 1)::text, 4, '0');
    v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.apparel_products where slug = v_slug) then v_slug := v_slug || '-' || lower(replace(v_id, 'PRD-', '')); end if;
    v_sku := coalesce(v_sku, 'SA-' || upper(left(regexp_replace(p ->> 'category', '-t-shirts$', ''), 3)) || '-' || substr(v_id, 5));
  else
    select slug, coalesce(v_sku, sku) into v_slug, v_sku from public.apparel_products where id = v_id;
    if v_slug is null then raise exception 'NOT_FOUND'; end if;
  end if;
  if exists (select 1 from public.apparel_products where sku = v_sku and id <> v_id) then raise exception 'SKU_EXISTS'; end if;
  insert into public.apparel_products as t (id, slug, sku, name, category, collection, fabric, gsm, fit, colors, sizes, description, moq, lead_time, shape, print, finish,
    weight_g, printing_options, embroidery_options, customizable, private_label, manufacturing_notes, wholesale_price, price_tiers, images, published, featured, sort, updated_at)
  values (v_id, v_slug, v_sku, v_name, p ->> 'category', public.apparel_clean(p ->> 'collection', 60), p ->> 'fabric', (p ->> 'gsm')::int, coalesce(public.apparel_clean(p ->> 'fit', 40), 'Regular'),
          public.apparel_text_array(p -> 'colors', v_colors, 15), public.apparel_text_array(p -> 'sizes', array['XXS','XS','S','M','L','XL','XXL','3XL','4XL','5XL'], 10),
          public.apparel_clean(p ->> 'description', 2000), public.apparel_clean(p ->> 'moq', 120), public.apparel_clean(p ->> 'lead_time', 120),
          case when p ->> 'shape' in ('crew', 'oversized', 'drop', 'polo', 'raglan', 'heavy') then p ->> 'shape' else 'crew' end,
          coalesce(p ->> 'print', ''), coalesce(p ->> 'finish', ''), nullif(p ->> 'weight_g', '')::int,
          public.apparel_text_array(p -> 'printing_options', null, 10), public.apparel_text_array(p -> 'embroidery_options', null, 10),
          coalesce((p ->> 'customizable')::boolean, true), coalesce((p ->> 'private_label')::boolean, true), public.apparel_clean(p ->> 'manufacturing_notes', 2000),
          nullif(p ->> 'wholesale_price', '')::numeric(12, 2), v_tiers, public.apparel_media_path_ok(p -> 'images'),
          coalesce((p ->> 'published')::boolean, true), coalesce((p ->> 'featured')::boolean, false), coalesce(nullif(p ->> 'sort', '')::int, 999), now())
  on conflict (id) do update set name = excluded.name, sku = excluded.sku, category = excluded.category, collection = excluded.collection, fabric = excluded.fabric,
    gsm = excluded.gsm, fit = excluded.fit, colors = excluded.colors, sizes = excluded.sizes, description = excluded.description, moq = excluded.moq,
    lead_time = excluded.lead_time, shape = excluded.shape, weight_g = excluded.weight_g, printing_options = excluded.printing_options,
    embroidery_options = excluded.embroidery_options, customizable = excluded.customizable, private_label = excluded.private_label,
    manufacturing_notes = excluded.manufacturing_notes, wholesale_price = excluded.wholesale_price, price_tiers = excluded.price_tiers, images = excluded.images,
    published = excluded.published, featured = excluded.featured, sort = coalesce(nullif(p ->> 'sort', '')::int, t.sort), updated_at = now()
  returning * into v_row;
  if array_length(v_row.colors, 1) is null then raise exception 'COLORS_REQUIRED'; end if;
  if array_length(v_row.sizes, 1) is null then raise exception 'SIZES_REQUIRED'; end if;
  perform public.apparel_log('save', 'product', v_id, jsonb_build_object('published', v_row.published));
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_delete_product(p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('catalog');
  delete from public.apparel_products where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.apparel_log('delete', 'product', p_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_save_fabric(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.apparel_fabrics; v_gsm int[];
begin
  perform public.apparel_require('catalog');
  if public.apparel_clean(p ->> 'name', 80) is null then raise exception 'NAME_REQUIRED'; end if;
  if public.apparel_clean(p ->> 'composition', 160) is null then raise exception 'COMPOSITION_REQUIRED'; end if;
  select coalesce(array_agg(distinct g::int order by g::int), '{}') into v_gsm from jsonb_array_elements_text(coalesce(p -> 'gsm', '[]'::jsonb)) g where g ~ '^\d{2,3}$' and g::int between 80 and 500;
  if array_length(v_gsm, 1) is null then raise exception 'GSM_REQUIRED'; end if;
  insert into public.apparel_fabrics as t (slug, name, composition, gsm, texture, description, applications, care, colors, images, published, sort, updated_at)
  values (coalesce(public.apparel_clean(p ->> 'slug', 60), trim(both '-' from regexp_replace(lower(p ->> 'name'), '[^a-z0-9]+', '-', 'g'))),
          public.apparel_clean(p ->> 'name', 80), public.apparel_clean(p ->> 'composition', 160), v_gsm,
          case when p ->> 'texture' in ('jersey','jersey-fine','jersey-slub','jersey-heather','jersey-heavy','terry','pique','mesh','rib','fleece') then p ->> 'texture' else 'jersey' end,
          public.apparel_clean(p ->> 'description', 2000), public.apparel_text_array(p -> 'applications', null, 12), public.apparel_text_array(p -> 'care', null, 12),
          public.apparel_text_array(p -> 'colors', array['black','white','bone','sand','stone','charcoal','heather','navy','olive','sage','brick','forest','cobalt','washed','clay'], 15),
          public.apparel_media_path_ok(p -> 'images'), coalesce((p ->> 'published')::boolean, true), coalesce(nullif(p ->> 'sort', '')::int, 999), now())
  on conflict (slug) do update set name = excluded.name, composition = excluded.composition, gsm = excluded.gsm, texture = excluded.texture,
    description = excluded.description, applications = excluded.applications, care = excluded.care, colors = excluded.colors, images = excluded.images,
    published = excluded.published, sort = coalesce(nullif(p ->> 'sort', '')::int, t.sort), updated_at = now()
  returning * into v_row;
  perform public.apparel_log('save', 'fabric', v_row.slug);
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_delete_fabric(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('catalog');
  if exists (select 1 from public.apparel_products where fabric = p_slug) then raise exception 'FABRIC_IN_USE'; end if;
  delete from public.apparel_fabrics where slug = p_slug;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.apparel_log('delete', 'fabric', p_slug);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_save_collection(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.apparel_collections; v_banner text := public.apparel_clean(p ->> 'banner', 400);
begin
  perform public.apparel_require('catalog');
  if public.apparel_clean(p ->> 'name', 80) is null then raise exception 'NAME_REQUIRED'; end if;
  if v_banner is not null and (v_banner !~ '^collections/[A-Za-z0-9._/-]{1,200}$' or v_banner like '%..%') then raise exception 'INVALID_FILE'; end if;
  insert into public.apparel_collections as t (slug, name, kicker, lead, categories, banner, published, sort, updated_at)
  values (coalesce(public.apparel_clean(p ->> 'slug', 60), trim(both '-' from regexp_replace(lower(p ->> 'name'), '[^a-z0-9]+', '-', 'g'))),
          public.apparel_clean(p ->> 'name', 80), public.apparel_clean(p ->> 'kicker', 80), public.apparel_clean(p ->> 'lead', 400),
          public.apparel_text_array(p -> 'categories', array['basic-t-shirts','oversized-t-shirts','drop-shoulder-t-shirts','streetwear-t-shirts','graphic-t-shirts','polo-t-shirts','sports-t-shirts','premium-cotton-t-shirts','organic-cotton-t-shirts','vintage-wash-t-shirts','heavyweight-t-shirts','custom-printed-t-shirts'], 12),
          v_banner, coalesce((p ->> 'published')::boolean, true), coalesce(nullif(p ->> 'sort', '')::int, 999), now())
  on conflict (slug) do update set name = excluded.name, kicker = excluded.kicker, lead = excluded.lead, categories = excluded.categories, banner = excluded.banner,
    published = excluded.published, sort = coalesce(nullif(p ->> 'sort', '')::int, t.sort), updated_at = now()
  returning * into v_row;
  if jsonb_typeof(p -> 'product_ids') = 'array' then
    update public.apparel_products set collection = null where collection = v_row.slug and not (id = any (array(select jsonb_array_elements_text(p -> 'product_ids'))));
    update public.apparel_products set collection = v_row.slug where id = any (array(select jsonb_array_elements_text(p -> 'product_ids')));
  end if;
  perform public.apparel_log('save', 'collection', v_row.slug);
  return to_jsonb(v_row);
end $$;

create or replace function public.apparel_admin_delete_collection(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('catalog');
  update public.apparel_products set collection = null where collection = p_slug;
  delete from public.apparel_collections where slug = p_slug;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.apparel_log('delete', 'collection', p_slug);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin: content, FX, team, audit ----------
create or replace function public.apparel_admin_content()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require_admin(false);
  return jsonb_build_object('content', coalesce((select jsonb_object_agg(key, value) from public.apparel_content), '{}'::jsonb),
                            'fx', coalesce((select jsonb_object_agg(currency, per_usd) from public.apparel_fx_rates), '{}'::jsonb));
end $$;

create or replace function public.apparel_admin_save_content(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_key = 'notify' then perform public.apparel_require('settings'); else perform public.apparel_require('content'); end if;
  if p_key not in ('hero', 'announcements', 'about', 'contact', 'faq', 'seo', 'notify') then raise exception 'INVALID_KEY'; end if;
  if p_value is null or char_length(p_value::text) > 20000 then raise exception 'INVALID_DETAILS'; end if;
  if p_key = 'notify' and coalesce(p_value ->> 'email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'EMAIL_REQUIRED'; end if;
  insert into public.apparel_content (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public.apparel_log('save', 'content', p_key);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_save_fx(p_currency text, p_rate numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.apparel_require('settings');
  if p_currency not in ('EUR', 'GBP') or p_rate is null or p_rate <= 0 or p_rate > 100 then raise exception 'INVALID_RATE'; end if;
  insert into public.apparel_fx_rates (currency, per_usd, updated_at) values (p_currency, p_rate, now())
  on conflict (currency) do update set per_usd = excluded.per_usd, updated_at = now();
  perform public.apparel_log('save', 'fx', p_currency, jsonb_build_object('rate', p_rate));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_team()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('users');
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'role', a.role, 'created_at', a.created_at) order by a.created_at)
    from public.apparel_admins a join auth.users u on u.id = a.user_id), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_set_role(p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  perform public.apparel_require('users');
  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email));
  if v_uid is null then raise exception 'USER_NOT_FOUND'; end if;
  if p_role = 'none' then
    if v_uid = auth.uid() then raise exception 'CANNOT_REMOVE_SELF'; end if;
    delete from public.apparel_admins where user_id = v_uid;
  else
    if p_role not in ('super_admin', 'admin', 'sales_manager', 'sales_rep', 'production_manager', 'qc_manager', 'shipping_manager', 'support') then raise exception 'INVALID_ROLE'; end if;
    if v_uid = auth.uid() and p_role <> 'super_admin' then raise exception 'CANNOT_REMOVE_SELF'; end if;
    insert into public.apparel_admins (user_id, role) values (v_uid, p_role) on conflict (user_id) do update set role = excluded.role;
  end if;
  perform public.apparel_log('set_role', 'user', v_uid::text, jsonb_build_object('email', p_email, 'role', p_role));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apparel_admin_audit(p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('settings');
  return coalesce((select jsonb_agg(jsonb_build_object('at', a.created_at, 'by', public.apparel_user_email(a.actor), 'action', a.action, 'entity', a.entity, 'key', a.entity_key, 'detail', a.detail) order by a.created_at desc)
    from (select * from public.apparel_audit order by created_at desc limit least(greatest(p_limit, 1), 1000)) a), '[]'::jsonb);
end $$;

create or replace function public.apparel_admin_email_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.apparel_require('settings');
  return jsonb_build_object(
    'pending', (select count(*) from public.apparel_email_outbox where status = 'pending'),
    'sent', (select count(*) from public.apparel_email_outbox where status = 'sent'),
    'failed', (select count(*) from public.apparel_email_outbox where status = 'failed'),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('to', e.to_email, 'template', e.template, 'status', e.status, 'at', e.created_at, 'error', e.last_error) order by e.created_at desc)
      from (select * from public.apparel_email_outbox order by created_at desc limit 30) e), '[]'::jsonb));
end $$;

-- ---------- reports (actual records; quoted values are reported separately from orders) ----------
create or replace function public.apparel_admin_reports(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz := coalesce(p_from, current_date - 365)::timestamptz; t timestamptz := (coalesce(p_to, current_date) + 1)::timestamptz;
begin
  perform public.apparel_require('reports');
  return jsonb_build_object(
    'range', jsonb_build_object('from', f::date, 'to', (t - interval '1 day')::date),
    'buyer_registrations', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'count', n) order by m) from (select to_char(created_at, 'YYYY-MM') m, count(*) n from public.apparel_buyers where created_at >= f and created_at < t group by 1) x), '[]'::jsonb),
    'leads_by_source', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'count', n) order by n desc) from (select source, count(*) n from public.apparel_leads where created_at >= f and created_at < t group by 1) x), '[]'::jsonb),
    'leads_by_status', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc) from (select status, count(*) n from public.apparel_leads where created_at >= f and created_at < t group by 1) x), '[]'::jsonb),
    'inquiries_by_country', coalesce((select jsonb_agg(jsonb_build_object('country', c, 'count', n) order by n desc) from (
        select coalesce(nullif(country, ''), 'Unknown') c, count(*) n from (
          select country, created_at from public.apparel_inquiries where kind <> 'newsletter' union all select country, created_at from public.apparel_rfqs) u
        where created_at >= f and created_at < t group by 1) x), '[]'::jsonb),
    'product_inquiries', coalesce((select jsonb_agg(jsonb_build_object('product_id', product_id, 'product', product_name, 'requests', n, 'pieces', q) order by n desc, q desc) from (
        select i.product_id, max(i.product_name) product_name, count(distinct i.rfq_id) n, sum(i.quantity) q from public.apparel_rfq_items i join public.apparel_rfqs r on r.id = i.rfq_id
        where r.created_at >= f and r.created_at < t group by i.product_id limit 50) x), '[]'::jsonb),
    'quotation_conversion', jsonb_build_object(
        'requests', (select count(*) from public.apparel_rfqs where created_at >= f and created_at < t),
        'quoted', (select count(distinct q.rfq_id) from public.apparel_quotes q join public.apparel_rfqs r on r.id = q.rfq_id where q.status <> 'draft' and r.created_at >= f and r.created_at < t),
        'approved', (select count(*) from public.apparel_rfqs where status = 'approved' and created_at >= f and created_at < t),
        'ordered', (select count(distinct o.rfq_id) from public.apparel_orders o join public.apparel_rfqs r on r.id = o.rfq_id where r.created_at >= f and r.created_at < t)),
    'quoted_value', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'value', v)) from (select currency, sum(total) v from public.apparel_quotes where status in ('sent', 'accepted') and sent_at >= f and sent_at < t group by 1) x), '[]'::jsonb),
    'monthly_orders', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'currency', c, 'orders', n, 'value', v) order by m, c) from (
        select to_char(created_at, 'YYYY-MM') m, currency c, count(*) n, sum(total) v from public.apparel_orders where status <> 'cancelled' and created_at >= f and created_at < t group by 1, 2) x), '[]'::jsonb),
    'orders_by_status', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', n)) from (select status, count(*) n from public.apparel_orders where created_at >= f and created_at < t group by 1) x), '[]'::jsonb),
    'production', jsonb_build_object(
        'completed', (select count(*) from public.apparel_production where status = 'completed' and actual_completion >= f::date and actual_completion < t::date),
        'on_time', (select count(*) from public.apparel_production where status = 'completed' and actual_completion >= f::date and actual_completion < t::date and expected_completion is not null and actual_completion <= expected_completion),
        'with_target', (select count(*) from public.apparel_production where status = 'completed' and actual_completion >= f::date and actual_completion < t::date and expected_completion is not null),
        'in_progress', (select count(*) from public.apparel_production where status in ('planned', 'in_progress', 'on_hold')),
        'pieces_completed', (select coalesce(sum(completed_qty), 0) from public.apparel_production where updated_at >= f and updated_at < t)),
    'quality', jsonb_build_object(
        'inspections', (select count(*) from public.apparel_qc where inspected_on >= f::date and inspected_on < t::date),
        'passed', (select count(*) from public.apparel_qc where result = 'pass' and inspected_on >= f::date and inspected_on < t::date),
        'defects', (select coalesce(sum(defects_found), 0) from public.apparel_qc where inspected_on >= f::date and inspected_on < t::date)),
    'shipping', jsonb_build_object(
        'shipments', (select count(*) from public.apparel_shipments where created_at >= f and created_at < t),
        'delivered', (select count(*) from public.apparel_shipments where status = 'delivered' and created_at >= f and created_at < t),
        'on_time', (select count(*) from public.apparel_shipments where status = 'delivered' and estimated_delivery is not null and delivered_on <= estimated_delivery and created_at >= f and created_at < t),
        'with_eta', (select count(*) from public.apparel_shipments where status = 'delivered' and estimated_delivery is not null and created_at >= f and created_at < t),
        'exceptions', (select count(*) from public.apparel_shipments where status = 'exception' and created_at >= f and created_at < t))
  );
end $$;

-- ---------- grants ----------
do $$
declare r record;
begin
  for r in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'apparel%' loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
grant execute on function public.apparel_catalog() to anon, authenticated;
grant execute on function public.apparel_submit_inquiry(jsonb) to anon, authenticated;
grant execute on function public.apparel_is_admin(boolean), public.apparel_can(text), public.apparel_file_readable(text), public.apparel_file_writable(text) to authenticated;
grant execute on function
  public.apparel_me(), public.apparel_save_buyer(jsonb), public.apparel_submit_rfq(jsonb), public.apparel_request_sample(jsonb), public.apparel_buyer_prices(),
  public.apparel_quote_respond(bigint, text, text), public.apparel_send_message(text), public.apparel_save_address(jsonb), public.apparel_delete_address(bigint),
  public.apparel_my_perms(),
  public.apparel_admin_overview(), public.apparel_admin_rfqs(text), public.apparel_admin_update_rfq(bigint, text, text), public.apparel_admin_message(text, bigint, text),
  public.apparel_admin_buyers(text), public.apparel_admin_update_buyer(uuid, text, text), public.apparel_admin_samples(text), public.apparel_admin_update_sample(bigint, text, text, text, text),
  public.apparel_admin_inquiries(text), public.apparel_admin_update_inquiry(bigint, text, text), public.apparel_admin_mark_seen(text, bigint),
  public.apparel_admin_save_quote(jsonb), public.apparel_admin_send_quote(bigint), public.apparel_admin_delete_quote(bigint),
  public.apparel_admin_create_order(bigint), public.apparel_admin_orders(text), public.apparel_admin_update_order(bigint, jsonb),
  public.apparel_admin_production_list(text), public.apparel_admin_save_production(jsonb), public.apparel_admin_update_stage(bigint, text, text, text), public.apparel_admin_save_qc(jsonb),
  public.apparel_admin_suppliers(), public.apparel_admin_save_supplier(jsonb), public.apparel_admin_delete_supplier(bigint),
  public.apparel_admin_leads(text), public.apparel_admin_lead_detail(bigint), public.apparel_admin_save_lead(jsonb), public.apparel_admin_add_activity(bigint, text, text),
  public.apparel_admin_shipments(), public.apparel_admin_save_shipment(jsonb),
  public.apparel_admin_add_file(jsonb), public.apparel_admin_file_visibility(bigint, boolean), public.apparel_admin_delete_file(bigint),
  public.apparel_admin_messages(uuid), public.apparel_admin_send_message(uuid, text),
  public.apparel_admin_catalog(), public.apparel_admin_save_product(jsonb), public.apparel_admin_delete_product(text), public.apparel_admin_save_fabric(jsonb),
  public.apparel_admin_delete_fabric(text), public.apparel_admin_save_collection(jsonb), public.apparel_admin_delete_collection(text),
  public.apparel_admin_content(), public.apparel_admin_save_content(text, jsonb), public.apparel_admin_save_fx(text, numeric),
  public.apparel_admin_team(), public.apparel_admin_set_role(text, text), public.apparel_admin_audit(int), public.apparel_admin_email_status(),
  public.apparel_admin_reports(date, date)
to authenticated;

-- ---------- storage policies (bucket apparel-files is private; apparel-media is public-read) ----------
drop policy if exists apparel_files_read on storage.objects;
drop policy if exists apparel_files_insert on storage.objects;
drop policy if exists apparel_files_delete on storage.objects;
drop policy if exists apparel_media_insert on storage.objects;
drop policy if exists apparel_media_update on storage.objects;
drop policy if exists apparel_media_delete on storage.objects;
create policy apparel_files_read on storage.objects for select to authenticated using (bucket_id = 'apparel-files' and public.apparel_file_readable(name));
create policy apparel_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'apparel-files' and public.apparel_file_writable(name));
create policy apparel_files_delete on storage.objects for delete to authenticated using (bucket_id = 'apparel-files' and public.apparel_can('documents'));
create policy apparel_media_insert on storage.objects for insert to authenticated with check (bucket_id = 'apparel-media' and public.apparel_can('catalog'));
create policy apparel_media_update on storage.objects for update to authenticated using (bucket_id = 'apparel-media' and public.apparel_can('catalog'));
create policy apparel_media_delete on storage.objects for delete to authenticated using (bucket_id = 'apparel-media' and public.apparel_can('catalog'));
