/* SIDDIQIYA Apparel — printable quotation (buyer or staff). "Save as PDF" uses the browser's print dialog. */
(function () {
  'use strict';
  var SA = window.SA, SB = window.SB;
  var box = document.querySelector('[data-quotation]');
  if (!box) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var d = function (x) { if (!x) return ''; try { return new Date(x + (String(x).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return x; } };
  var n2 = function (v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var colorName = function (k) { return SA.colors[k] ? SA.colors[k].name : (k || ''); };
  var sizesTxt = function (s) { return Object.keys(s || {}).map(function (k) { return k + ' ' + s[k]; }).join(', '); };
  var id = +new URLSearchParams(location.search).get('id');
  function fail(msg) { box.innerHTML = '<div class="form-error" role="alert"><p>' + esc(msg) + '</p><a class="link" href="/account/?tab=quotations">Back to your quotations</a></div>'; }

  async function boot() {
    if (!id) return fail('No quotation selected.');
    if (!SB.user()) { location.replace('/account/login/?next=' + encodeURIComponent('/quotation/?id=' + id)); return; }
    var q = null, rfq = null, buyer = null;
    try {
      var me = await SB.rpc('apparel_me');
      me.rfqs.forEach(function (r) { r.quotes.forEach(function (x) { if (x.id === id) { q = x; rfq = r; buyer = me.buyer; buyer.email = me.email; } }); });
      if (!q && me.is_admin) {
        var all = await SB.rpc('apparel_admin_rfqs', { p_status: null });
        all.forEach(function (r) { r.quotes.forEach(function (x) { if (x.id === id) { q = x; rfq = r; buyer = r.buyer || {}; } }); });
      }
    } catch (e) { return fail(SB.message(e)); }
    if (!q) return fail('Quotation not found, or it has not been shared with your account.');
    render(q, rfq, buyer || {});
  }

  function render(q, r, b) {
    document.title = 'Quotation ' + q.code + ' rev ' + q.revision + ' — SIDDIQIYA Apparel';
    var draft = q.status === 'draft';
    var lines = q.lines.map(function (l, i) {
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(l.description) + '</b>' + (l.product_id ? '<br><span class="muted">' + esc(l.product_id) + (l.color ? ' · ' + esc(colorName(l.color)) : '') + '</span>' : '') +
        (sizesTxt(l.sizes) ? '<br><span class="muted">Sizes: ' + esc(sizesTxt(l.sizes)) + '</span>' : '') +
        ((l.tiers || []).length ? '<br><span class="muted">Volume pricing: ' + l.tiers.map(function (t) { return Number(t.min_qty).toLocaleString() + '+ pcs @ ' + n2(t.unit_price); }).join(' · ') + '</span>' : '') +
        '</td><td class="num">' + Number(l.quantity).toLocaleString() + '</td><td class="num">' + n2(l.unit_price) + '</td><td class="num">' + n2(l.line_total) + '</td></tr>';
    }).join('');
    var tot = [['Subtotal', q.subtotal, true], ['Discount', q.discount > 0 ? -q.discount : null], ['Shipping', q.shipping_cost > 0 ? q.shipping_cost : null], ['Tax (' + Number(q.tax_percent) + '%)', q.tax_amount > 0 ? q.tax_amount : null]]
      .filter(function (x) { return x[1] != null; }).map(function (x) { return '<tr><td colspan="4" class="num">' + x[0] + '</td><td class="num">' + n2(x[1]) + '</td></tr>'; }).join('');
    box.innerHTML = '<div class="quote-toolbar no-print"><a class="link" href="' + (location.search.indexOf('admin') > -1 ? '/admin/#rfqs' : '/account/?tab=quotations') + '" data-back>← Back</a><button class="btn btn--sm" type="button" data-print>Print / Save as PDF</button></div>' +
      '<article class="quote-doc">' + (draft ? '<p class="quote-draft">Draft — not yet sent to the buyer</p>' : '') +
      '<header class="quote-doc-head"><div><b class="quote-brand">SIDDIQIYA</b><span class="caps">Apparel</span><p>' + 'Phnom Penh, Cambodia 120101' + '<br>WhatsApp +855 96 733 5609<br>app.hsdmj.com</p></div>' +
      '<div class="quote-doc-meta"><h1 class="h2">Quotation</h1><dl><div><dt>Number</dt><dd>' + esc(q.code) + ' · rev ' + q.revision + '</dd></div><div><dt>Request</dt><dd>' + esc(r.code) + '</dd></div><div><dt>Date</dt><dd>' + d(q.sent_at || q.created_at) + '</dd></div>' + (q.valid_until ? '<div><dt>Valid until</dt><dd>' + d(q.valid_until) + '</dd></div>' : '') + '</dl></div></header>' +
      '<section class="quote-doc-to"><span class="caps">Prepared for</span><p><b>' + esc(b.company_name || b.contact_person || '') + '</b><br>' + esc(r.contact_name || b.contact_person || '') + '<br>' + esc(b.email || '') + (r.country || b.country ? '<br>' + esc(r.country || b.country) : '') + '</p></section>' +
      '<table class="data-table quote-doc-table"><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Unit (' + esc(q.currency) + ')</th><th class="num">Amount (' + esc(q.currency) + ')</th></tr></thead><tbody>' + lines + tot +
      '<tr class="total"><td colspan="4" class="num"><b>Total ' + esc(q.currency) + '</b></td><td class="num"><b>' + n2(q.total) + '</b></td></tr></tbody></table>' +
      '<dl class="specs quote-doc-terms">' + [['Incoterm', q.incoterm], ['Lead time', q.lead_time], ['Payment terms', q.payment_terms], ['Notes', q.notes]].filter(function (x) { return x[1]; }).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd class="pre">' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<p class="quote-doc-foot">Prices are per piece unless stated. Bulk production starts after written order confirmation and approval of a pre-production sample. This quotation is valid until the date shown above. SIDDIQIYA Apparel is a SIDDIQIYA Technology company.</p></article>';
    box.querySelector('[data-print]').onclick = function () { window.print(); };
  }
  boot();
})();
