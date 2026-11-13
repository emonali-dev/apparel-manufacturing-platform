# Credentials checklist

| Item | Who provides it | Where it goes | Status |
|---|---|---|---|
| Supabase project access for deployments | Owner (reconnect the Supabase connector or run the CLI) | — | Needed to apply migrations 06–08 |
| Supabase publishable key | Already in `assets/js/sb.js` (public by design) | Website | Done |
| Super admin account | emonali18198@gmail.com | `apparel_admins` (super_admin) | Done |
| Auth redirect URL `https://app.hsdmj.com/**` | Owner, Supabase dashboard | Auth → URL configuration | To do |
| Resend API key | Owner, resend.com | `supabase secrets set RESEND_API_KEY` | To do |
| Verified sender domain + `MAIL_FROM` | Owner (DNS at your registrar) | Supabase secret | To do |
| `MAILER_SECRET` | Generate locally | Supabase secret + Vault | To do |
| Google Analytics 4 Measurement ID (optional) | Owner | `GA_MEASUREMENT_ID` at build time | Optional |
| WhatsApp number | +855 96 733 5609 (click-to-chat links only, no API) | `src/data.mjs` | Done |

Never paste keys into chat, issues or commits. Only the publishable key may appear in the website.
