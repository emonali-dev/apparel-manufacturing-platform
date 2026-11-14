# Deployment

The platform has two parts:

| Part | Where | How it is deployed |
|---|---|---|
| Website, buyer portal, admin dashboard (static HTML/CSS/JS) | GitHub Pages, branch `main`, domain `app.hsdmj.com` (CNAME) | `node src/build.mjs`, commit, push `main` |
| Database, auth, storage, business logic | Supabase project `ketzuhfolwhofrnliirf` (shared; every object is prefixed `apparel_`) | SQL migrations in `supabase/migrations/` |
| Transactional email | Supabase Edge Function `apparel-mailer` + Resend | `supabase functions deploy apparel-mailer` |

`hsdmj.com` (the main site) is a separate project and is never touched by this repository.

## 1. Database migrations (in order)

```
20261113_apparel_01_schema.sql          base tables (live)
20261113_apparel_02_functions.sql       base RPCs (live)
20261113_apparel_03_seed.sql            catalog seed (live)
20261113_apparel_04_inquiries.sql       guest inquiries (live)
20261113_apparel_05_guest_kinds.sql     (live)
20261113_apparel_06_platform_schema.sql roles, quotations, orders, production, QC, suppliers, CRM, shipping, files, messages, addresses, CMS, FX, audit, email outbox, storage buckets
20261113_apparel_07_platform_functions.sql  all RPCs + storage policies
20261113_apparel_08_seed_v2.sql         Fleece, Rib, Polo collection, notification address, mailer RPCs
```

06–08 are additive: existing rows are kept, old RFQ statuses are mapped to the new ones
(`submitted→pending`, `reviewing→under_review`, `quoted→quotation_sent`, `accepted→approved`, `ordered→approved`, `declined→rejected`, `closed→cancelled`).

**Deploy 06–08 and the new front end together.** The old admin/portal code uses the old status names.

Before applying: take a backup (see BACKUP_RECOVERY.md). After applying:

1. Run `supabase/tests/platform_test.sql` — it runs inside a transaction and rolls back; it must print `ALL PLATFORM TESTS PASSED`.
2. Run the Supabase security and performance advisors and confirm there are no new `apparel_` warnings.

## 2. Website

```
node src/build.mjs                 # regenerates every page; GA_MEASUREMENT_ID=G-XXXX node src/build.mjs to enable analytics
python3 -m http.server 8765        # preview
git push origin main               # GitHub Pages publishes within ~1 minute
```

## 3. Supabase Auth settings (dashboard → Authentication → URL configuration)

- Add `https://app.hsdmj.com/**` to **Redirect URLs** (password reset and email confirmation links).
- Site URL of the shared project stays as it is (other apps use it).

## 4. Email (Resend)

1. Create a Resend account, verify a sending domain (DNS records are added at your DNS provider — this repository never changes DNS).
2. Set secrets (from your own terminal, not in chat):
   ```
   supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="SIDDIQIYA Apparel <sales@yourdomain>" MAILER_SECRET=<random>
   # (apparel-mailer is already deployed; it answers 403 until MAILER_SECRET is set)
   ```
3. Schedule the worker every minute (SQL editor; uses pg_cron + pg_net):
   ```sql
   select cron.schedule('apparel-mailer', '* * * * *', $$
     select net.http_post(url := 'https://ketzuhfolwhofrnliirf.supabase.co/functions/v1/apparel-mailer',
       headers := jsonb_build_object('x-mailer-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'apparel_mailer_secret')));
   $$);
   ```
   (store the same MAILER_SECRET in Vault as `apparel_mailer_secret` first).
4. Admin → System shows queued / sent / failed counts. Until step 3 is done, emails stay queued and nothing is sent.

## 5. Staff accounts

The person registers at `/account/register/`; a Super Admin then grants a role in Admin → Users & roles.
