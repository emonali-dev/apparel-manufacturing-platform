-- Guests (not signed in) can also leave sample and quotation requests; they are stored as inquiries.
alter table public.apparel_inquiries drop constraint if exists apparel_inquiries_kind_check;
alter table public.apparel_inquiries add constraint apparel_inquiries_kind_check check (kind in ('contact', 'service', 'wholesale', 'studio', 'newsletter', 'sample', 'rfq'));

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
  insert into public.apparel_inquiries (code, user_id, kind, subject, contact_name, email, company, country, phone, message, details)
  values ('INQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.apparel_inquiry_seq')::text, 4, '0'), auth.uid(), v_kind,
          public.apparel_clean(p ->> 'subject', 200), public.apparel_clean(p ->> 'contact_name', 120), v_email,
          public.apparel_clean(p ->> 'company', 160), public.apparel_clean(p ->> 'country', 80), public.apparel_clean(p ->> 'phone', 40),
          public.apparel_clean(p ->> 'message', 6000), v_details)
  returning * into v_row;
  return jsonb_build_object('code', v_row.code, 'created_at', v_row.created_at);
end $$;

