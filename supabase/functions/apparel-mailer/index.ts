// SIDDIQIYA Apparel — transactional email worker.
// Reads queued emails from apparel_email_outbox (via service-role-only RPCs) and sends them with Resend.
// Secrets (set with `supabase secrets set`, never committed):
//   RESEND_API_KEY   – Resend API key
//   MAIL_FROM        – verified sender, e.g. "SIDDIQIYA Apparel <sales@hsdmj.com>"
//   MAILER_SECRET    – shared secret the scheduler sends in the x-mailer-secret header
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge runtime.
const SITE = 'https://app.hsdmj.com';
const env = (k: string) => Deno.env.get(k) ?? '';

type Mail = { id: number; to_email: string; template: string; data: Record<string, unknown> };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const label = (s: unknown) => String(s ?? '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const money = (c: unknown, v: unknown) => `${c ?? 'USD'} ${Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function render(m: Mail): { subject: string; lines: string[]; cta?: [string, string] } | null {
  const d = m.data as Record<string, any>;
  const account: [string, string] = ['Open your buyer account', `${SITE}/account/`];
  const admin: [string, string] = ['Open the admin dashboard', `${SITE}/admin/`];
  switch (m.template) {
    case 'rfq_received': return { subject: `We received your quotation request ${d.code}`, lines: [`Hello ${d.name ?? ''},`, `Thank you for your request for quotation <b>${esc(d.code)}</b> (${esc(d.items)} item(s)). Our sales team will reply with pricing, MOQ and lead time, usually within 1–2 business days.`], cta: ['Track your request', `${SITE}/account/?tab=quotations`] };
    case 'quote_sent': return { subject: `Your quotation ${d.code} (rev ${d.revision}) is ready`, lines: [`Your quotation for request ${esc(d.rfq)} is ready: <b>${esc(money(d.currency, d.total))}</b>${d.valid_until ? `, valid until ${esc(d.valid_until)}` : ''}.`, 'You can accept it, request changes or decline it from your account.'], cta: ['Review quotation', `${SITE}/account/?tab=quotations`] };
    case 'order_created': return { subject: `Order ${d.code} confirmed`, lines: [`Your order <b>${esc(d.code)}</b> (${esc(money(d.currency, d.total))}) has been created. You can follow production and shipping in your account.`], cta: ['Track your order', `${SITE}/account/?tab=orders`] };
    case 'order_status': return { subject: `Order ${d.code}: ${label(d.status)}`, lines: [`Your order <b>${esc(d.code)}</b> is now: <b>${esc(label(d.status))}</b>.`, d.message ? esc(d.message) : ''], cta: ['Track your order', `${SITE}/account/?tab=orders`] };
    case 'shipment_update': return { subject: `Shipment ${d.shipment} for order ${d.order}: ${label(d.status)}`, lines: [`Shipment <b>${esc(d.shipment)}</b> is <b>${esc(label(d.status))}</b>.`, [d.provider && `Carrier: ${esc(d.provider)}`, d.tracking && `Tracking number: ${esc(d.tracking)}`, d.eta && `Estimated delivery: ${esc(d.eta)}`].filter(Boolean).join('<br>')], cta: ['View shipment', `${SITE}/account/?tab=orders`] };
    case 'sample_status': return { subject: `Sample request ${d.code}: ${label(d.status)}`, lines: [`Your sample request <b>${esc(d.code)}</b> is now <b>${esc(label(d.status))}</b>.`, d.tracking ? `Tracking: ${esc(d.courier ?? '')} ${esc(d.tracking)}` : ''], cta: ['View samples', `${SITE}/account/?tab=samples`] };
    case 'update_message': return { subject: 'An update from SIDDIQIYA Apparel', lines: [esc(d.message)], cta: account };
    case 'message_buyer': return { subject: 'New message from SIDDIQIYA Apparel', lines: [esc(d.body)], cta: ['Reply in your account', `${SITE}/account/?tab=messages`] };
    case 'buyer_verified': return { subject: 'Your wholesale account is verified', lines: ['Your SIDDIQIYA Apparel wholesale account has been verified. Product pages now show your trade prices when you are signed in.'], cta: account };
    case 'rfq_admin': return { subject: `New RFQ ${d.code} — ${d.company ?? ''} (${d.country ?? ''})`, lines: [`New quotation request <b>${esc(d.code)}</b> from ${esc(d.company)} (${esc(d.country)}), ${esc(d.items)} item(s).`], cta: admin };
    case 'inquiry_admin': return { subject: `New ${d.kind} inquiry ${d.code}`, lines: [`<b>${esc(d.subject)}</b> from ${esc(d.email)} (${esc(d.code)}).`], cta: admin };
    case 'buyer_registered': return { subject: `New buyer registration: ${d.company ?? d.contact ?? ''}`, lines: [`${esc(d.contact)} — ${esc(d.company)} (${esc(d.country)}), ${esc(d.email)}.${d.wholesale ? ' Wholesale verification requested.' : ''}`], cta: admin };
    case 'quote_response': return { subject: `Buyer response on ${d.code} rev ${d.revision}: ${d.action}`, lines: [`Action: <b>${esc(d.action)}</b>`, d.message ? esc(d.message) : ''], cta: admin };
    case 'message_admin': return { subject: `New buyer message from ${d.email}`, lines: [esc(d.body)], cta: admin };
    default: return null;
  }
}

function html(r: NonNullable<ReturnType<typeof render>>) {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:32px 24px"><p style="font:600 20px Georgia,serif;letter-spacing:.06em;margin:0 0 24px">SIDDIQIYA <span style="font:600 10px Helvetica,Arial;letter-spacing:.3em;color:#9a7b3c">APPAREL</span></p>
<div style="background:#fff;border:1px solid #e5e1d8;padding:28px">${r.lines.filter(Boolean).map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;white-space:pre-line">${l}</p>`).join('')}
${r.cta ? `<p style="margin:22px 0 0"><a href="${r.cta[1]}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;font:600 12px Helvetica,Arial;letter-spacing:.12em;text-transform:uppercase">${r.cta[0]}</a></p>` : ''}</div>
<p style="font-size:12px;color:#777;margin:20px 0 0">SIDDIQIYA Apparel · Phnom Penh, Cambodia · WhatsApp +855 96 733 5609</p></div></body></html>`;
}

async function rpc(name: string, args: unknown) {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

Deno.serve(async (req) => {
  if (!env('MAILER_SECRET') || req.headers.get('x-mailer-secret') !== env('MAILER_SECRET')) return new Response('Forbidden', { status: 403 });
  if (!env('RESEND_API_KEY') || !env('MAIL_FROM')) return new Response('Email provider not configured', { status: 503 });
  await rpc('apparel_mailer_reset_stuck', {});
  const batch: Mail[] = await rpc('apparel_mailer_claim', { p_limit: 25 });
  let sent = 0, failed = 0;
  for (const m of batch) {
    const r = render(m);
    if (!r) { await rpc('apparel_mailer_done', { p_id: m.id, p_ok: false, p_error: 'unknown template ' + m.template }); failed++; continue; }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env('MAIL_FROM'), to: [m.to_email], subject: r.subject, html: html(r), reply_to: env('MAIL_REPLY_TO') || undefined }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await rpc('apparel_mailer_done', { p_id: m.id, p_ok: true, p_error: null }); sent++;
    } catch (e) {
      await rpc('apparel_mailer_done', { p_id: m.id, p_ok: false, p_error: String((e as Error).message) }); failed++;
    }
  }
  return Response.json({ claimed: batch.length, sent, failed });
});
