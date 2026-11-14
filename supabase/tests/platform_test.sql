-- End-to-end test of the apparel platform functions. Runs in a transaction and rolls back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/platform_test.sql
begin;
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated, anon;
do $$
declare
  sa uuid := gen_random_uuid(); b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid(); rep uuid := gen_random_uuid(); qc uuid := gen_random_uuid(); shipm uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (sa, 't-super@example.test'), (b1, 't-buyer1@example.test'), (b2, 't-buyer2@example.test'),
    (rep, 't-rep@example.test'), (qc, 't-qc@example.test'), (shipm, 't-ship@example.test');
  insert into public.apparel_admins (user_id, role) values (sa, 'super_admin'), (rep, 'sales_rep'), (qc, 'qc_manager'), (shipm, 'shipping_manager');
  insert into t_ids values ('sa', sa), ('b1', b1), ('b2', b2), ('rep', rep), ('qc', qc), ('ship', shipm);
end $$;

create or replace function pg_temp.as_user(k text) returns void language plpgsql as $$
begin
  if k = 'anon' then perform set_config('request.jwt.claims', '{"role":"anon"}', true); execute 'set local role anon';
  else perform set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where t_ids.k = as_user.k), 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end if;
end $$;
create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm not like '%' || code || '%' then raise exception 'expected % got %: %', code, sqlerrm, sql; end if;
end $$;
grant execute on function pg_temp.as_user(text), pg_temp.expect_error(text, text) to anon, authenticated;

-- 1. buyer registers, uploads artwork and submits an RFQ
select pg_temp.as_user('b1');
select public.apparel_save_buyer('{"contact_person":"Buyer One","company_name":"One GmbH","country":"Germany","business_type":"Fashion Brand","wholesale_requested":true}');
insert into storage.objects (bucket_id, name, owner) values ('apparel-files', 'rfq/' || auth.uid() || '/a1-logo.png', auth.uid());
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name, owner) values ('apparel-files', 'rfq/00000000-0000-0000-0000-000000000000/x.png', auth.uid())$$, 'row-level security');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name, owner) values ('apparel-files', 'docs/order/1/x.pdf', auth.uid())$$, 'row-level security');
do $$ declare r jsonb; begin
  r := public.apparel_submit_rfq(jsonb_build_object('order_type', 'Bulk order', 'destination', 'Hamburg, Germany', 'whatsapp', '+49 151 000000', 'budget', 'USD 5/pc',
        'printing', 'Screen print front', 'embroidery', 'Left chest logo', 'target_date', (current_date + 60)::text,
        'items', jsonb_build_array(jsonb_build_object('product_id', 'PRD-0003', 'color', 'black', 'sizes', jsonb_build_object('M', 100, 'L', 200)),
                                   jsonb_build_object('product_id', 'PRD-0011', 'color', 'navy', 'fabric', 'pique', 'gsm', 220, 'sizes', jsonb_build_object('M', 50))),
        'files', jsonb_build_array(jsonb_build_object('path', 'rfq/' || auth.uid() || '/a1-logo.png', 'filename', 'logo.png', 'mime', 'image/png', 'size', 2048, 'kind', 'logo'))));
  insert into t_ids values ('rfq', r ->> 'id');
  if (r ->> 'files')::int <> 1 then raise exception 'file not attached'; end if;
end $$;
select pg_temp.expect_error($$select public.apparel_submit_rfq(jsonb_build_object('order_type', 'Bulk order', 'destination', 'Hamburg, Germany', 'whatsapp', '+49 151 000000', 'budget', 'USD 5/pc', 'printing', 'Screen print front', 'embroidery', 'Left chest logo', 'target_date', (current_date + 60)::text, 'items', jsonb_build_array(jsonb_build_object('product_id', 'PRD-0003', 'color', 'black', 'sizes', jsonb_build_object('M', 100, 'L', 200)), jsonb_build_object('product_id', 'PRD-0011', 'color', 'navy', 'fabric', 'pique', 'gsm', 220, 'sizes', jsonb_build_object('M', 50)))))$$, 'DUPLICATE_REQUEST');
select pg_temp.expect_error($$select public.apparel_submit_rfq('{"items":[{"product_id":"PRD-0001"}],"files":[{"path":"rfq/00000000-0000-0000-0000-000000000000/x.png","mime":"image/png"}]}')$$, 'INVALID_FILE');
select pg_temp.expect_error($$select public.apparel_admin_overview()$$, 'NOT_AUTHORIZED');
select pg_temp.expect_error($$select count(*) from public.apparel_quotes$$, 'permission denied');
reset role;

-- 2. other buyer cannot see buyer 1's data or files
select pg_temp.as_user('b2');
select public.apparel_save_buyer('{"contact_person":"Buyer Two"}');
do $$ declare me jsonb := public.apparel_me(); begin
  if jsonb_array_length(me -> 'rfqs') <> 0 then raise exception 'isolation: rfqs leaked'; end if;
  if (select count(*) from storage.objects where bucket_id = 'apparel-files') <> 0 then raise exception 'isolation: storage objects visible'; end if;
end $$;
select pg_temp.expect_error($$select public.apparel_quote_respond(1, 'accept', null)$$, 'NOT_FOUND');
reset role;

-- 3. sales rep: can quote, cannot manage catalog / production / users
select pg_temp.as_user('rep');
select pg_temp.expect_error($$select public.apparel_admin_save_product('{"name":"X","category":"basic-t-shirts","fabric":"pique","gsm":180,"colors":["black"],"sizes":["M"]}')$$, 'NOT_AUTHORIZED');
select pg_temp.expect_error($$select public.apparel_admin_production_list(null)$$, 'NOT_AUTHORIZED');
select pg_temp.expect_error($$select public.apparel_admin_team()$$, 'NOT_AUTHORIZED');
do $$ declare q jsonb; v_rfq bigint := (select v from t_ids where k = 'rfq')::bigint; r jsonb; begin
  r := public.apparel_admin_rfqs(null);
  if jsonb_array_length(r -> 0 -> 'files') <> 1 then raise exception 'rep should see rfq files'; end if;
  if (select count(*) from storage.objects where bucket_id = 'apparel-files' and name in (select x ->> 'path' from jsonb_array_elements(r -> 0 -> 'files') x)) <> 1 then raise exception 'rep should read rfq artwork'; end if;
  q := public.apparel_admin_save_quote(jsonb_build_object('rfq_id', v_rfq, 'currency', 'USD', 'shipping_cost', 120, 'discount', 50, 'tax_percent', 0,
        'incoterm', 'FOB Phnom Penh', 'valid_until', (current_date + 30)::text, 'payment_terms', '30% deposit, 70% before shipment',
        'lines', jsonb_build_array(jsonb_build_object('product_id', 'PRD-0003', 'description', 'Box Oversized Tee — Black', 'quantity', 300, 'unit_price', 4.80,
                                                      'tiers', jsonb_build_array(jsonb_build_object('min_qty', 500, 'unit_price', 4.5))),
                                   jsonb_build_object('product_id', 'PRD-0011', 'description', 'Classic Pique Polo — Navy', 'quantity', 50, 'unit_price', 7.25))));
  -- 300*4.80 + 50*7.25 = 1440 + 362.50 = 1802.50; -50 discount; +120 shipping = 1872.50
  if (q ->> 'total')::numeric <> 1872.50 or (q ->> 'subtotal')::numeric <> 1802.50 then raise exception 'quote totals wrong: %', q; end if;
  insert into t_ids values ('quote1', q ->> 'id');
  q := public.apparel_admin_send_quote((q ->> 'id')::bigint);
  -- revision 2
  q := public.apparel_admin_save_quote(jsonb_build_object('rfq_id', v_rfq, 'currency', 'USD', 'shipping_cost', 120, 'tax_percent', 10,
        'lines', jsonb_build_array(jsonb_build_object('description', 'Box Oversized Tee — Black', 'product_id', 'PRD-0003', 'quantity', 300, 'unit_price', 4.60))));
  if (q ->> 'revision')::int <> 2 or (q ->> 'total')::numeric <> 1650.00 then raise exception 'revision wrong: %', q; end if;
  perform public.apparel_admin_send_quote((q ->> 'id')::bigint);
  insert into t_ids values ('quote2', q ->> 'id');
  if (select x ->> 'status' from jsonb_array_elements(public.apparel_admin_rfqs(null) -> 0 -> 'quotes') x where (x ->> 'revision')::int = 1) <> 'superseded' then raise exception 'rev1 not superseded'; end if;
end $$;
select pg_temp.expect_error($$select public.apparel_admin_save_quote(jsonb_build_object('id', (select v from t_ids where k = 'quote2'), 'lines', '[{"description":"x","quantity":1,"unit_price":1}]'::jsonb))$$, 'QUOTE_LOCKED');
reset role;

-- 4. buyer negotiates, then accepts revision 2
select pg_temp.as_user('b1');
do $$ declare me jsonb; begin
  me := public.apparel_me();
  if me -> 'rfqs' -> 0 ->> 'status' <> 'quotation_sent' then raise exception 'buyer status %', me -> 'rfqs' -> 0 ->> 'status'; end if;
  if jsonb_array_length(me -> 'rfqs' -> 0 -> 'quotes') <> 2 or (me -> 'rfqs' -> 0 -> 'quotes' -> 0 ->> 'revision')::int <> 2 then raise exception 'buyer quotes'; end if;
  if me::text like '%admin_note%' or me::text like '%fingerprint%' then raise exception 'internal fields leaked'; end if;
  perform public.apparel_quote_respond((select v from t_ids where k = 'quote2')::bigint, 'negotiate', 'Can you do 4.40 at 300 pcs?');
  perform public.apparel_quote_respond((select v from t_ids where k = 'quote2')::bigint, 'accept', null);
  me := public.apparel_me();
  if me -> 'rfqs' -> 0 ->> 'status' <> 'approved' then raise exception 'not approved'; end if;
  perform public.apparel_send_message('Hello, when can production start?');
  perform public.apparel_save_address('{"label":"Warehouse","recipient":"Buyer One","line1":"Hafenstr. 1","city":"Hamburg","country":"Germany"}');
end $$;
select pg_temp.expect_error($$select public.apparel_quote_respond((select v from t_ids where k = 'quote1')::bigint, 'accept', null)$$, 'QUOTE_NOT_OPEN');
reset role;

-- 5. super admin: order → production → QC → shipment → documents
select pg_temp.as_user('sa');
do $$ declare o jsonb; pr jsonb; s jsonb; v_order bigint; v_pr bigint; begin
  o := public.apparel_admin_create_order((select v from t_ids where k = 'quote2')::bigint);
  v_order := (o ->> 'id')::bigint; insert into t_ids values ('order', v_order);
  if (o ->> 'total')::numeric <> 1650.00 or jsonb_array_length(o -> 'lines') <> 1 then raise exception 'order copy wrong %', o; end if;
  pr := public.apparel_admin_save_production(jsonb_build_object('order_id', v_order, 'expected_completion', (current_date + 20)::text, 'assigned_team', 'Line A'));
  v_pr := (pr ->> 'id')::bigint; insert into t_ids values ('prod', v_pr);
  if (pr ->> 'quantity')::int <> 300 then raise exception 'production qty'; end if;
  perform public.apparel_admin_update_stage(v_pr, 'cutting', 'in_progress', null);
  if public.apparel_admin_orders(null) -> 0 ->> 'status' <> 'in_production' then raise exception 'order not advanced to in_production'; end if;
  insert into storage.objects (bucket_id, name, owner) values ('apparel-files', 'docs/order/' || v_order || '/ci.pdf', auth.uid());
  perform public.apparel_admin_add_file(jsonb_build_object('entity', 'order', 'entity_id', v_order, 'path', 'docs/order/' || v_order || '/ci.pdf', 'filename', 'Commercial invoice.pdf', 'mime', 'application/pdf', 'size', 5000, 'kind', 'commercial_invoice', 'visible_to_buyer', true));
  insert into storage.objects (bucket_id, name, owner) values ('apparel-files', 'docs/order/' || v_order || '/internal.pdf', auth.uid());
  perform public.apparel_admin_add_file(jsonb_build_object('entity', 'order', 'entity_id', v_order, 'path', 'docs/order/' || v_order || '/internal.pdf', 'filename', 'Costing.pdf', 'mime', 'application/pdf', 'size', 5000, 'kind', 'other', 'visible_to_buyer', false));
  perform public.apparel_admin_send_message((select v from t_ids where k = 'b1')::uuid, 'Production started on Line A.');
  perform public.apparel_admin_set_role('t-buyer2@example.test', 'support');
  perform public.apparel_admin_set_role('t-buyer2@example.test', 'none');
  perform public.apparel_admin_save_content('hero', '{"title":"Crafting the future of apparel.","subtitle":"Test"}');
  perform public.apparel_admin_save_content('notify', '{"email":"sales@example.test"}');
end $$;
select pg_temp.expect_error($$select public.apparel_admin_set_role('t-super@example.test', 'admin')$$, 'CANNOT_REMOVE_SELF');
reset role;

-- 6. QC manager records an inspection; cannot touch orders
select pg_temp.as_user('qc');
do $$ declare v_pr bigint := (select v from t_ids where k = 'prod')::bigint; q jsonb; begin
  q := public.apparel_admin_save_qc(jsonb_build_object('production_id', v_pr, 'inspector', 'QC Lead', 'sample_size', 80, 'defects_found', 1, 'result', 'pass',
        'checklist', jsonb_build_object('fabric', 'pass', 'measurements', 'pass', 'stitching', 'pass', 'printing', 'pass', 'color', 'pass', 'finishing', 'pass', 'packaging', 'na', 'bogus', 'pass')));
  if q -> 'checklist' ? 'bogus' then raise exception 'checklist not filtered'; end if;
  insert into storage.objects (bucket_id, name, owner) values ('apparel-files', 'docs/qc/' || (q ->> 'id') || '/photo1.jpg', auth.uid());
  perform public.apparel_admin_add_file(jsonb_build_object('entity', 'qc', 'entity_id', (q ->> 'id')::bigint, 'path', 'docs/qc/' || (q ->> 'id') || '/photo1.jpg', 'filename', 'photo1.jpg', 'mime', 'image/jpeg', 'size', 900, 'kind', 'inspection_photo', 'visible_to_buyer', true));
  perform public.apparel_admin_update_stage(v_pr, 'packing', 'done', null);
end $$;
select pg_temp.expect_error($$select public.apparel_admin_orders(null)$$, 'NOT_AUTHORIZED');
reset role;

-- 7. shipping manager dispatches and delivers
select pg_temp.as_user('ship');
do $$ declare s jsonb; v_order bigint := (select v from t_ids where k = 'order')::bigint; begin
  s := public.apparel_admin_save_shipment(jsonb_build_object('order_id', v_order, 'method', 'sea_freight', 'provider', 'Maersk', 'destination', 'Hamburg', 'status', 'preparing'));
  s := public.apparel_admin_save_shipment(jsonb_build_object('id', s ->> 'id', 'method', 'sea_freight', 'provider', 'Maersk', 'tracking_number', 'MSKU1234567', 'dispatch_date', current_date::text, 'estimated_delivery', (current_date + 30)::text, 'status', 'dispatched', 'cost', 850));
  if (select x -> 'order' ->> 'status' from jsonb_array_elements(public.apparel_admin_shipments()) x limit 1) <> 'shipped' then raise exception 'order not shipped'; end if;
  s := public.apparel_admin_save_shipment(jsonb_build_object('id', s ->> 'id', 'method', 'sea_freight', 'provider', 'Maersk', 'tracking_number', 'MSKU1234567', 'estimated_delivery', (current_date + 30)::text, 'status', 'delivered', 'cost', 850));
  if (select x -> 'order' ->> 'status' from jsonb_array_elements(public.apparel_admin_shipments()) x limit 1) <> 'delivered' then raise exception 'order not delivered'; end if;
end $$;
select pg_temp.expect_error($$select public.apparel_admin_leads(null)$$, 'NOT_AUTHORIZED');
reset role;

-- 8. buyer sees order progress, permitted documents only, no internal cost
select pg_temp.as_user('b1');
do $$ declare me jsonb := public.apparel_me(); o jsonb := me -> 'orders' -> 0; begin
  if o ->> 'status' <> 'delivered' then raise exception 'buyer order status %', o ->> 'status'; end if;
  if jsonb_array_length(o -> 'documents') <> 1 or o -> 'documents' -> 0 ->> 'filename' <> 'Commercial invoice.pdf' then raise exception 'buyer documents %', o -> 'documents'; end if;
  if o -> 'shipments' -> 0 ? 'cost' or o ? 'admin_note' then raise exception 'internal order fields leaked'; end if;
  if jsonb_array_length(o -> 'production' -> 0 -> 'stages') <> 9 then raise exception 'stages'; end if;
  if (select count(*) from storage.objects where name like 'docs/order/%') <> 1 then raise exception 'buyer storage visibility: %', (select count(*) from storage.objects where name like 'docs/order/%'); end if;
  if (select count(*) from storage.objects where name like 'docs/qc/%') <> 0 then raise exception 'qc photos visible to buyer'; end if;
  if jsonb_array_length(me -> 'messages') <> 2 or jsonb_array_length(me -> 'addresses') <> 1 then raise exception 'messages/addresses'; end if;
  if (public.apparel_buyer_prices())::text <> '{}' then raise exception 'unverified buyer got prices'; end if;
end $$;
reset role;

-- 9. CRM, reports, overview, audit (super admin)
select pg_temp.as_user('sa');
do $$ declare l jsonb; r jsonb; o jsonb; v_lead bigint; begin
  l := public.apparel_admin_leads(null);
  select (x ->> 'id')::bigint into v_lead from jsonb_array_elements(l) x where x ->> 'email' = 't-buyer1@example.test';
  if v_lead is null then raise exception 'lead not created'; end if;
  if (select x ->> 'status' from jsonb_array_elements(l) x where (x ->> 'id')::bigint = v_lead) <> 'converted' then raise exception 'lead not converted'; end if;
  perform public.apparel_admin_add_activity(v_lead, 'call', 'Discussed next season.');
  perform public.apparel_admin_save_lead(jsonb_build_object('id', v_lead, 'status', 'converted', 'company', 'One GmbH', 'next_follow_up', (current_date + 7)::text, 'assigned_email', 't-rep@example.test'));
  r := public.apparel_admin_lead_detail(v_lead);
  if jsonb_array_length(r -> 'orders') <> 1 or jsonb_array_length(r -> 'rfqs') <> 1 then raise exception 'lead links'; end if;
  r := public.apparel_admin_reports(current_date - 30, current_date);
  if (r -> 'quotation_conversion' ->> 'ordered')::int <> 1 or (r -> 'quality' ->> 'passed')::int <> 1 or (r -> 'shipping' ->> 'on_time')::int <> 1 then raise exception 'reports %', r; end if;
  o := public.apparel_admin_overview();
  if (o -> 'confirmed_order_value' ->> 'USD')::numeric <> 1650.00 or (o ->> 'completed_orders')::int <> 1 then raise exception 'overview %', o; end if;
  if jsonb_array_length(public.apparel_admin_audit(50)) < 5 then raise exception 'audit'; end if;
  if (public.apparel_admin_email_status() ->> 'pending')::int < 6 then raise exception 'email outbox only %', public.apparel_admin_email_status() ->> 'pending'; end if;
  perform public.apparel_admin_update_buyer((select v from t_ids where k = 'b1')::uuid, 'verified', null);
  perform public.apparel_admin_save_product('{"id":"PRD-0003","name":"Box Oversized Tee","category":"oversized-t-shirts","fabric":"heavyweight-cotton","gsm":240,"colors":["sand","black"],"sizes":["M","L"],"wholesale_price":"4.20","price_tiers":[{"min_qty":"500","unit_price":"3.95"}],"manufacturing_notes":"secret note","sku":"SA-OVR-0003"}');
end $$;
reset role;

-- 10. public catalog never exposes internal pricing; verified buyer gets wholesale prices
select pg_temp.as_user('anon');
do $$ declare c jsonb := public.apparel_catalog(); begin
  if c::text like '%secret note%' or c::text like '%wholesale_price%' or c::text like '%price_tiers%' then raise exception 'catalog leaks internal fields'; end if;
  if c -> 'content' -> 'hero' ->> 'title' is null then raise exception 'content missing'; end if;
end $$;
select pg_temp.expect_error($$select public.apparel_buyer_prices()$$, 'permission denied');
reset role;
select pg_temp.as_user('b1');
do $$ begin
  if (public.apparel_buyer_prices() -> 'PRD-0003' ->> 'wholesale_price')::numeric <> 4.20 then raise exception 'verified buyer prices'; end if;
end $$;
reset role;

-- 11. guest wholesale inquiry → admin pipeline; CMS gallery / testimonials / social
select pg_temp.as_user('anon');
do $$ declare r jsonb; begin
  r := public.apparel_submit_inquiry('{"kind":"wholesale","subject":"Wholesale inquiry","email":"guest@example.test","contact_name":"Guest","country":"France","details":{"Product":"Oversized T-Shirts","Quantity":"1,200 pcs"}}');
  insert into t_ids values ('inq', r ->> 'code');
end $$;
select pg_temp.expect_error($$select public.apparel_admin_inquiries(null)$$, 'permission denied');
reset role;
select pg_temp.as_user('rep');
do $$ declare l jsonb; i jsonb; begin
  l := public.apparel_admin_inquiries(null);
  select x into i from jsonb_array_elements(l) x where x ->> 'code' = (select v from t_ids where k = 'inq');
  if i ->> 'product' <> 'Oversized T-Shirts' or (i ->> 'quantity')::int <> 1200 then raise exception 'inquiry fields %', i; end if;
  insert into t_ids values ('inqid', i ->> 'id');
  perform public.apparel_admin_update_inquiry((i ->> 'id')::bigint, 'quotation_sent', 'Called buyer', 'USD 4.20/pc FOB, 1,200 pcs', current_date + 3);
  i := (select x from jsonb_array_elements(public.apparel_admin_inquiries('quotation_sent')) x where x ->> 'code' = (select v from t_ids where k = 'inq'));
  if i ->> 'quotation' is null or jsonb_array_length(i -> 'history') <> 1 then raise exception 'inquiry update %', i; end if;
end $$;
select pg_temp.expect_error($$select public.apparel_admin_update_inquiry((select v from t_ids where k = 'inqid')::bigint, 'closed')$$, 'INVALID_STATUS');
select pg_temp.expect_error($$select public.apparel_admin_save_content('testimonials', '{"items":[]}')$$, 'NOT_AUTHORIZED');
reset role;
select pg_temp.as_user('sa');
select public.apparel_admin_save_content('testimonials', '{"items":[{"quote":"Q","name":"N","company":"C"}]}');
select public.apparel_admin_save_content('gallery', '{"items":[{"image":"gallery/abc-cutting.jpg","caption":"Cutting room"}]}');
select public.apparel_admin_save_content('social', '{"instagram":"https://instagram.com/siddiqiya","facebook":""}');
select pg_temp.expect_error($$select public.apparel_admin_save_content('social', '{"instagram":"javascript:alert(1)"}')$$, 'INVALID_URL');
select pg_temp.expect_error($$select public.apparel_admin_save_content('gallery', '{"items":[{"image":"../x.jpg"}]}')$$, 'INVALID_FILE');
reset role;
select pg_temp.as_user('anon');
do $$ declare c jsonb := public.apparel_catalog(); begin
  if c -> 'content' -> 'gallery' -> 'items' -> 0 ->> 'caption' <> 'Cutting room' or c -> 'content' -> 'social' ->> 'instagram' is null then raise exception 'cms content %', c -> 'content'; end if;
end $$;
reset role;

select 'ALL PLATFORM TESTS PASSED' as result;
rollback;
