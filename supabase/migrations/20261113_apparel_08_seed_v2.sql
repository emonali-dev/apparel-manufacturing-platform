-- SIDDIQIYA Apparel — catalog additions from the website (Fleece, Rib fabrics; Polo collection)
-- and the default admin-notification address. Idempotent: existing rows are left unchanged.
insert into public.apparel_fabrics (slug, name, composition, gsm, texture, description, applications, care, colors, sort) values
('fleece', 'Fleece', 'Cotton / polyester brushed-back fleece (80/20 or 60/40)', array[280, 320, 360]::int[], 'fleece',
 'A smooth face with a soft, brushed reverse that traps warmth. Used for heavier tees, sweatshirts and cold-season programmes.',
 array['Sweatshirts', 'Heavy long-sleeve tees', 'Cold-season merchandise']::text[], array['Machine wash cold, inside out', 'Do not tumble dry hot', 'Do not iron print']::text[],
 array['heather', 'black', 'navy', 'bone', 'olive']::text[], 9),
('rib', 'Rib Fabric', 'Cotton / elastane 1×1 or 2×2 rib knit', array[180, 200, 240]::int[], 'rib',
 'Vertical ribs that stretch and recover. Used for fitted tees, neck bands, cuffs and hems.',
 array['Fitted tees', 'Neck bands and cuffs', 'Layering pieces']::text[], array['Machine wash cold', 'Dry flat to keep shape', 'Cool iron']::text[],
 array['black', 'white', 'bone', 'charcoal', 'sage']::text[], 10)
on conflict (slug) do nothing;

insert into public.apparel_collections (slug, name, kicker, lead, categories, sort) values
('polo', 'Polo Collection', 'Collared classics', 'Pique and jersey polos with crisp collars and clean plackets for retail, clubs and corporate programmes.', array['polo-t-shirts']::text[], 6)
on conflict (slug) do nothing;
update public.apparel_products set collection = 'polo' where category = 'polo-t-shirts' and collection is null;

insert into public.apparel_content (key, value) values ('notify', jsonb_build_object('email', 'emonali18198@gmail.com'))
on conflict (key) do nothing;

alter table public.apparel_email_outbox drop constraint if exists apparel_email_outbox_status_check;
alter table public.apparel_email_outbox add constraint apparel_email_outbox_status_check check (status in ('pending', 'sending', 'sent', 'failed'));

-- ---------- email delivery worker (Edge Function apparel-mailer, service role only) ----------
create or replace function public.apparel_mailer_claim(p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  with c as (
    select id from public.apparel_email_outbox
    where status = 'pending' or (status = 'failed' and attempts < 5 and created_at > now() - interval '2 days')
    order by id limit least(greatest(coalesce(p_limit, 20), 1), 50) for update skip locked
  ), u as (
    update public.apparel_email_outbox o set status = 'sending', attempts = o.attempts + 1 from c where o.id = c.id
    returning o.id, o.to_email, o.template, o.data
  )
  select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) into v from u;
  return v;
end $$;

create or replace function public.apparel_mailer_done(p_id bigint, p_ok boolean, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update public.apparel_email_outbox set status = case when p_ok then 'sent' else 'failed' end,
    sent_at = case when p_ok then now() end, last_error = left(p_error, 500) where id = p_id;
$$;

-- 'sending' rows left behind by a crashed run are retried.
create or replace function public.apparel_mailer_reset_stuck()
returns void language sql security definer set search_path = '' as $$
  update public.apparel_email_outbox set status = 'failed', last_error = 'interrupted' where status = 'sending' and created_at < now() - interval '15 minutes';
$$;

revoke all on function public.apparel_mailer_claim(int), public.apparel_mailer_done(bigint, boolean, text), public.apparel_mailer_reset_stuck() from public, anon, authenticated;
grant execute on function public.apparel_mailer_claim(int), public.apparel_mailer_done(bigint, boolean, text), public.apparel_mailer_reset_stuck() to service_role;
