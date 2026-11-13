/* SIDDIQIYA Apparel — buyer sign-in, registration, password reset and portal. */
(function () {
  'use strict';
  var rpcArg = function (o) { return { p: o }; };
  var SA = window.SA, SB = window.SB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var store = function () { return window.SAStore; };
  var val = function (f, n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
  var colorName = function (k) { return SA.colors[k] ? SA.colors[k].name : (k || ''); };
  var fabricName = function (k) { var f = SA.fabrics.filter(function (x) { return x.slug === k; })[0]; return f ? f.name : (k || ''); };
  var fmtDate = function (d) { try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } };
  var STATUS = {
    pending: 'Pending', under_review: 'Under review', quotation_sent: 'Quotation sent', negotiation: 'Negotiation', sample_requested: 'Sample requested', approved: 'Approved', rejected: 'Not approved', cancelled: 'Cancelled',
    requested: 'Requested', preparing: 'Preparing', shipped: 'Shipped', delivered: 'Delivered', declined: 'Declined', verified: 'Verified', suspended: 'Suspended',
    sent: 'Awaiting your response', quote_open: 'Awaiting your response', expired: 'Expired', accepted: 'Accepted', superseded: 'Superseded',
    received: 'Order received', awaiting_confirmation: 'Awaiting confirmation', sample_development: 'Sample development', sample_approved: 'Sample approved', production_pending: 'Production pending',
    in_production: 'In production', quality_inspection: 'Quality inspection', packing: 'Packing', ready_to_ship: 'Ready to ship', completed: 'Completed',
    unpaid: 'Unpaid', deposit_received: 'Deposit received', paid: 'Paid', refunded: 'Refunded',
    planned: 'Planned', in_progress: 'In progress', on_hold: 'On hold', done: 'Done', skipped: 'Skipped',
    dispatched: 'Dispatched', in_transit: 'In transit', exception: 'Delivery exception',
    order_confirmation: 'Order confirmation', material_procurement: 'Materials', fabric_preparation: 'Fabric', cutting: 'Cutting', printing_embroidery: 'Printing / embroidery', stitching: 'Stitching', finishing: 'Finishing',
    express_courier: 'Express courier', air_freight: 'Air freight', sea_freight: 'Sea freight', road: 'Road', buyer_pickup: 'Buyer pickup',
  };
  var badge = function (s) { return '<span class="status status--' + esc(s) + '">' + esc(STATUS[s] || s) + '</span>'; };
  function formError(form, msg) {
    var box = form.querySelector('.form-error');
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; box.setAttribute('role', 'alert'); form.appendChild(box); }
    box.innerHTML = '<p>' + esc(msg) + '</p>';
  }
  function clearError(form) { var b = form.querySelector('.form-error'); if (b) b.remove(); }
  function setBusy(form, on, label) {
    var b = form.querySelector('[type="submit"]');
    if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = label || 'Please wait…'; b.disabled = true; }
    else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  }
  function fieldErr(form, name, msg) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    el.setAttribute('aria-invalid', 'true');
    var e = el.parentNode.querySelector('.err'); if (e) e.textContent = msg;
    el.focus();
  }
  function nextUrl() {
    var n = new URLSearchParams(location.search).get('next') || '/account/';
    return /^\/[a-z0-9\-/?=&]*$/i.test(n) && n.indexOf('//') === -1 ? n : '/account/';
  }
  function profilePayload(f, wholesale) {
    return {
      contact_person: val(f, 'Contact person'), company_name: val(f, 'Company'), phone: val(f, 'Phone'), country: val(f, 'Country'),
      website: val(f, 'Website'), business_type: val(f, 'Business type'), est_volume: val(f, 'Estimated volume'), wholesale_requested: !!wholesale,
    };
  }
  function checkWholesale(f, p) {
    if (!p.wholesale_requested) return true;
    if (!p.company_name) { fieldErr(f, 'Company', 'Required for a wholesale account.'); return false; }
    if (!p.country) { fieldErr(f, 'Country', 'Required for a wholesale account.'); return false; }
    if (!p.business_type) { fieldErr(f, 'Business type', 'Required for a wholesale account.'); return false; }
    return true;
  }

  /* ---------- sign in ---------- */
  var login = $('[data-login]');
  if (login) {
    if (SB.user()) location.replace(nextUrl());
    login.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError(login);
      if (!store().validate(login)) return;
      setBusy(login, true, 'Signing in…');
      try {
        await SB.signIn(val(login, 'Email'), login.querySelector('[name="Password"]').value);
        location.replace(nextUrl());
      } catch (err) { formError(login, SB.message(err)); setBusy(login, false); }
    });
  }

  /* ---------- register ---------- */
  var reg = $('[data-register]');
  if (reg) {
    if (SB.user()) location.replace('/account/');
    reg.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError(reg);
      if (!store().validate(reg)) return;
      var p1 = reg.querySelector('[name="Password"]').value, p2 = reg.querySelector('[name="Confirm password"]').value;
      if (p1.length < 8) { fieldErr(reg, 'Password', 'Use at least 8 characters.'); return; }
      if (p1 !== p2) { fieldErr(reg, 'Confirm password', 'Passwords do not match.'); return; }
      if (!reg.querySelector('[name="terms"]').checked) { formError(reg, 'Please accept the Terms and Privacy Policy.'); return; }
      var profile = profilePayload(reg, reg.querySelector('[name="wholesale"]').checked);
      if (!checkWholesale(reg, profile)) return;
      setBusy(reg, true, 'Creating account…');
      try {
        var r = await SB.signUp(val(reg, 'Email'), p1, { account_type: 'apparel_buyer', name: profile.contact_person, apparel_profile: profile });
        if (r.needsConfirmation) {
          reg.innerHTML = '<p class="eyebrow">Almost done</p><h2 class="h3">Confirm your email address</h2><p>We sent a confirmation link to <b>' + esc(val(reg, 'Email') || '') + '</b>. After confirming, sign in and your company profile will be saved automatically.</p><a class="btn" href="/account/login/">Go to sign in</a>';
          return;
        }
        await SB.rpc('apparel_save_buyer', rpcArg(profile));
        location.replace('/account/?welcome=1');
      } catch (err) { formError(reg, SB.message(err)); setBusy(reg, false); }
    });
  }

  /* ---------- password reset ---------- */
  var rec = $('[data-recover]'), np = $('[data-newpass]');
  if (rec) {
    SB.fromUrl().then(function (r) {
      if (r && r.type === 'recovery') { rec.hidden = true; np.hidden = false; }
    }).catch(function (err) { formError(rec, 'This reset link is invalid or has expired. Please request a new one.'); });
    rec.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError(rec);
      if (!store().validate(rec)) return;
      setBusy(rec, true, 'Sending…');
      try {
        await SB.recover(val(rec, 'Email'), location.origin + '/account/reset/');
        rec.innerHTML = '<p class="eyebrow">Check your inbox</p><p>If an account exists for that email, a password reset link is on its way. The link opens this page so you can choose a new password.</p><a class="link" href="/account/login/">Back to sign in</a>';
      } catch (err) { formError(rec, SB.message(err)); setBusy(rec, false); }
    });
    np.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError(np);
      var p1 = np.querySelector('[name="Password"]').value, p2 = np.querySelector('[name="Confirm password"]').value;
      if (p1.length < 8) { fieldErr(np, 'Password', 'Use at least 8 characters.'); return; }
      if (p1 !== p2) { fieldErr(np, 'Confirm password', 'Passwords do not match.'); return; }
      setBusy(np, true, 'Saving…');
      try { await SB.updatePassword(p1); location.replace('/account/'); } catch (err) { formError(np, SB.message(err)); setBusy(np, false); }
    });
  }

  /* ---------- portal ---------- */
  var portal = $('[data-portal]');
  if (!portal) return;
  var F = window.SAFiles;
  var TABS = ['overview', 'quotations', 'orders', 'samples', 'documents', 'messages', 'addresses', 'profile'];
  var tab = new URLSearchParams(location.search).get('tab') || 'overview';
  if (TABS.indexOf(tab) === -1) tab = 'overview';
  var me = null;
  var money = function (c, v) { return v == null ? '—' : (c || 'USD') + ' ' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var sizesTxt = function (s) { return Object.keys(s || {}).map(function (k) { return k + ' ' + s[k]; }).join(', '); };
  var ORDER_FLOW = ['received', 'awaiting_confirmation', 'sample_development', 'sample_approved', 'production_pending', 'in_production', 'quality_inspection', 'packing', 'ready_to_ship', 'shipped', 'delivered', 'completed'];

  async function boot() {
    try { await SB.fromUrl(); } catch (e) { /* ignore invalid link tokens */ }
    if (!SB.user()) { location.replace('/account/login/?next=/account/'); return; }
    try {
      me = await SB.rpc('apparel_me');
    } catch (err) {
      if (err.code === 'NOT_AUTHENTICATED' || err.status === 401) { await SB.signOut(); location.replace('/account/login/?next=/account/'); return; }
      portal.innerHTML = '<div class="form-error" role="alert"><p>' + esc(SB.message(err)) + '</p><button class="btn btn--ghost btn--sm" type="button" data-retry>Try again</button></div>';
      portal.querySelector('[data-retry]').onclick = function () { location.reload(); };
      return;
    }
    // A profile saved during sign-up but not yet stored (email confirmation flow).
    if (!me.buyer) {
      var meta = (SB.user().meta || {}).apparel_profile;
      if (meta && meta.contact_person) {
        try { await SB.rpc('apparel_save_buyer', rpcArg(meta)); me = await SB.rpc('apparel_me'); } catch (e) { /* show the profile form instead */ }
      }
    }
    render();
  }
  async function reload() { me = await SB.rpc('apparel_me'); render(); }
  function go(t) { tab = t; history.replaceState(null, '', '?tab=' + t); render(); window.scrollTo({ top: portal.getBoundingClientRect().top + window.scrollY - 120 }); }

  function unread() { return me.messages.filter(function (m) { return m.from_admin && !m.read_at; }).length; }
  function actionNeeded() { return me.rfqs.filter(function (r) { return r.quotes[0] && r.quotes[0].status === 'sent'; }).length; }

  function render() {
    var b = me.buyer;
    $('[data-portal-title]').textContent = b ? 'Welcome, ' + b.contact_person.split(' ')[0] : 'Complete your buyer profile';
    $('[data-portal-lead]').textContent = b ? (b.company_name || me.email) : 'Tell us about your company to start sending quotation and sample requests.';
    if (!b) tab = 'profile';
    var n = function (x) { return x ? ' <span class="count" data-n="' + x + '">' + x + '</span>' : ''; };
    var tabs = [['overview', 'Overview'], ['quotations', 'Quotations' + n(actionNeeded())], ['orders', 'Orders'], ['samples', 'Samples'], ['documents', 'Documents'],
      ['messages', 'Messages' + n(unread())], ['addresses', 'Addresses'], ['profile', 'Profile & settings']];
    portal.innerHTML = '<div class="portal">' +
      '<nav class="portal-nav" aria-label="Account sections">' + tabs.map(function (t) { return '<a href="?tab=' + t[0] + '" data-tab="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') +
      '<a href="/wishlist/">Wishlist</a>' + (me.is_admin ? '<a href="/admin/" class="portal-admin">Admin dashboard</a>' : '') +
      '<button type="button" class="portal-signout" data-signout>Sign out</button></nav>' +
      '<div class="portal-main" data-portal-main></div></div>';
    $$('[data-tab]', portal).forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); if (!me.buyer && a.dataset.tab !== 'profile') return; go(a.dataset.tab); });
    });
    $('[data-signout]', portal).addEventListener('click', async function () { await SB.signOut(); location.replace('/account/login/'); });
    var main = $('[data-portal-main]', portal);
    var V = { overview: overview, quotations: quotations, orders: orders, samples: samples, documents: documents, messages: messages, addresses: addresses, profile: profile };
    V[tab](main);
    $$('[data-file]', main).forEach(function (x) { x.onclick = function () { F.open(x.dataset.file, x.dataset.name).catch(function (e) { store().toast(e.message); }); }; });
  }

  function overview(main) {
    var b = me.buyer;
    var ws = b.wholesale_requested
      ? '<div class="portal-card"><span class="caps">Wholesale account</span>' + badge(b.status) + '<p>' + ({ pending: 'Our team is reviewing your company details. Wholesale pricing is shared once your account is verified.', verified: 'Your wholesale account is verified. Product pages show your trade prices and quotations include volume pricing.', rejected: 'We could not verify your wholesale application. Update your profile and resubmit, or contact us on WhatsApp.', suspended: 'This account is suspended. Please contact us.' }[b.status] || '') + '</p></div>'
      : '<div class="portal-card"><span class="caps">Wholesale account</span><p>You have a buyer account. Apply for wholesale pricing from your profile.</p><a class="link" href="?tab=profile" data-goto="profile">Apply for wholesale</a></div>';
    var open = me.rfqs.filter(function (r) { return ['pending', 'under_review', 'quotation_sent', 'negotiation', 'sample_requested'].indexOf(r.status) > -1; }).length;
    var activeO = me.orders.filter(function (o) { return ['completed', 'cancelled', 'delivered'].indexOf(o.status) === -1; }).length;
    var welcome = new URLSearchParams(location.search).get('welcome') ? '<div class="portal-notice">Your account is ready. Add styles to your quote list and send your first request for quotation.</div>' : '';
    var act = actionNeeded();
    main.innerHTML = welcome + (act ? '<div class="portal-notice">You have ' + act + ' quotation' + (act > 1 ? 's' : '') + ' waiting for your response. <a class="link" href="?tab=quotations" data-goto="quotations">Review now</a></div>' : '') +
      (unread() ? '<div class="portal-notice">New message from our team. <a class="link" href="?tab=messages" data-goto="messages">Read message</a></div>' : '') +
      '<div class="portal-grid">' + ws +
      '<div class="portal-card"><span class="caps">Quotations</span><b class="portal-num">' + open + '</b><p>open of ' + me.rfqs.length + ' total</p><a class="link" href="?tab=quotations" data-goto="quotations">View quotations</a></div>' +
      '<div class="portal-card"><span class="caps">Orders</span><b class="portal-num">' + activeO + '</b><p>active of ' + me.orders.length + ' total</p><a class="link" href="?tab=orders" data-goto="orders">Track orders</a></div>' +
      '<div class="portal-card"><span class="caps">Samples</span><b class="portal-num">' + me.samples.filter(function (s) { return ['requested', 'approved', 'preparing', 'shipped'].indexOf(s.status) > -1; }).length + '</b><p>in progress of ' + me.samples.length + ' total</p><a class="link" href="?tab=samples" data-goto="samples">Track samples</a></div></div>' +
      '<div class="actions"><a class="btn" href="/quote/">New quotation request</a><a class="btn btn--ghost" href="/products/">Browse products</a><a class="btn btn--ghost" href="/fabrics/">Request fabric samples</a></div>' +
      (me.orders.length ? '<h2 class="h3 sect-h">Latest order</h2>' + orderCard(me.orders[0]) : '') +
      (me.rfqs.length ? '<h2 class="h3 sect-h">Latest quotation request</h2>' + rfqCard(me.rfqs[0]) : '');
    bindQuotes(main);
  }

  function timeline(h) {
    if (!h || !h.length) return '';
    return '<details class="req-history"><summary>History (' + h.length + ')</summary><ol class="timeline">' + h.map(function (x) {
      var label = x.from === x.to ? 'Message from SIDDIQIYA Apparel' : (STATUS[x.to] || x.to);
      return '<li><span class="t-date">' + esc(fmtDate(x.at)) + '</span><b>' + esc(label) + '</b>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') + '</li>';
    }).join('') + '</ol></details>';
  }
  function files(list) {
    if (!list || !list.length) return '';
    return '<ul class="doc-list">' + list.map(function (f) { return '<li><button type="button" class="row-link" data-file="' + esc(f.path) + '" data-name="' + esc(f.filename) + '">' + esc(f.filename) + '</button><span class="muted">' + esc(String(f.kind).replace(/_/g, ' ')) + ' · ' + F.size(f.size) + '</span></li>'; }).join('') + '</ul>';
  }
  function quoteBlock(q, r) {
    var expired = q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10);
    var lines = q.lines.map(function (l) {
      return '<tr><td>' + esc(l.description) + (sizesTxt(l.sizes) ? '<br><span class="muted">' + esc(sizesTxt(l.sizes)) + '</span>' : '') +
        ((l.tiers || []).length ? '<br><span class="muted">Volume pricing: ' + l.tiers.map(function (t) { return t.min_qty.toLocaleString() + '+ pcs ' + Number(t.unit_price).toFixed(2); }).join(' · ') + '</span>' : '') +
        '</td><td class="num">' + Number(l.quantity).toLocaleString() + '</td><td class="num">' + Number(l.unit_price).toFixed(2) + '</td><td class="num">' + Number(l.line_total).toFixed(2) + '</td></tr>';
    }).join('');
    var tot = [['Subtotal', q.subtotal], ['Discount', q.discount > 0 ? -q.discount : null], ['Shipping', q.shipping_cost > 0 ? q.shipping_cost : null], ['Tax (' + Number(q.tax_percent) + '%)', q.tax_amount > 0 ? q.tax_amount : null]]
      .filter(function (x) { return x[1] != null; }).map(function (x) { return '<tr><td colspan="3" class="num">' + x[0] + '</td><td class="num">' + Number(x[1]).toFixed(2) + '</td></tr>'; }).join('') +
      '<tr class="total"><td colspan="3" class="num"><b>Total (' + esc(q.currency) + ')</b></td><td class="num"><b>' + Number(q.total).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</b></td></tr>';
    return '<div class="quote-card"><header><b>Quotation ' + esc(q.code) + ' · revision ' + q.revision + '</b>' + badge(q.status === 'sent' ? (expired ? 'expired' : 'quote_open') : q.status) + '</header>' +
      '<p class="muted">Sent ' + fmtDate(q.sent_at) + (q.valid_until ? ' · valid until ' + fmtDate(q.valid_until) : '') + (q.incoterm ? ' · ' + esc(q.incoterm) : '') + '</p>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit (' + esc(q.currency) + ')</th><th class="num">Amount</th></tr></thead><tbody>' + lines + tot + '</tbody></table></div>' +
      '<dl class="specs">' + [['Lead time', q.lead_time], ['Payment terms', q.payment_terms], ['Notes', q.notes]].filter(function (x) { return x[1]; }).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd class="pre">' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (q.buyer_response ? '<p class="req-note">Your response: ' + esc(q.buyer_response) + '</p>' : '') +
      '<div class="actions tight"><a class="btn btn--ghost btn--sm" href="/quotation/?id=' + q.id + '" target="_blank" rel="noopener">View / download PDF</a>' +
      (q.status === 'sent' && !expired ? '<button class="btn btn--sm" type="button" data-q-act="accept" data-q="' + q.id + '">Accept quotation</button><button class="btn btn--ghost btn--sm" type="button" data-q-act="negotiate" data-q="' + q.id + '">Request changes</button><button class="q-remove" type="button" data-q-act="reject" data-q="' + q.id + '">Decline</button>' : '') +
      (q.status === 'sent' && expired ? '<span class="muted">This quotation has expired — send us a message for an updated price.</span>' : '') + '</div></div>';
  }
  function rfqCard(r) {
    var rows = r.items.map(function (i) {
      return '<tr><td><b>' + esc(i.product_name) + '</b><br><span class="muted">' + esc(i.product_id) + (i.fit ? ' · ' + esc(i.fit) : '') + '</span>' + (i.note ? '<br><span class="muted">' + esc(i.note) + '</span>' : '') + '</td><td>' + esc(colorName(i.color)) + '</td><td>' + esc(fabricName(i.fabric)) + (i.gsm ? ' · ' + i.gsm + ' GSM' : '') + '</td><td>' + esc(sizesTxt(i.sizes) || '—') + '</td><td class="num">' + (i.quantity || 0).toLocaleString() + '</td></tr>';
    }).join('');
    var latest = r.quotes[0];
    return '<article class="req-card"><header><div><b>' + esc(r.code) + '</b><span class="muted"> · ' + esc(fmtDate(r.created_at)) + (r.order_type ? ' · ' + esc(r.order_type) : '') + '</span></div>' + badge(r.status) + '</header>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Colour</th><th>Fabric</th><th>Sizes</th><th class="num">Pieces</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (r.requirements ? '<p class="req-note">' + esc(r.requirements) + '</p>' : '') + files(r.files) +
      (latest ? quoteBlock(latest, r) : (['pending', 'under_review'].indexOf(r.status) > -1 ? '<p class="muted">Our sales team is preparing your quotation — usually within 1–2 business days.</p>' : '')) +
      (r.quotes.length > 1 ? '<details class="req-history"><summary>Earlier revisions (' + (r.quotes.length - 1) + ')</summary>' + r.quotes.slice(1).map(function (q) { return '<p>' + esc(q.code) + ' rev ' + q.revision + ' · ' + money(q.currency, q.total) + ' · ' + badge(q.status) + ' <a class="link" href="/quotation/?id=' + q.id + '" target="_blank" rel="noopener">View</a></p>'; }).join('') + '</details>' : '') +
      timeline(r.history) + '</article>';
  }
  function bindQuotes(main) {
    $$('[data-q-act]', main).forEach(function (b) {
      b.onclick = async function () {
        var act = b.dataset.qAct, msg = null;
        if (act === 'negotiate') { msg = window.prompt('What would you like us to change? (price, quantity, delivery date…)'); if (!msg || !msg.trim()) return; }
        else if (act === 'reject') { if (!window.confirm('Decline this quotation?')) return; msg = window.prompt('Optional: tell us why (helps us improve the offer)') || null; }
        else if (!window.confirm('Accept this quotation? Our team will confirm the order and send the proforma invoice.')) return;
        b.disabled = true;
        try { await SB.rpc('apparel_quote_respond', { p_quote: +b.dataset.q, p_action: act, p_message: msg }); store().toast(act === 'accept' ? 'Quotation accepted — we will be in touch shortly' : act === 'reject' ? 'Quotation declined' : 'Your request was sent to our team'); await reload(); }
        catch (e) { store().toast(SB.message(e)); b.disabled = false; }
      };
    });
  }
  function quotations(main) {
    if (!me.rfqs.length) { main.innerHTML = '<div class="empty-state"><p>No quotation requests yet.</p><a class="btn" href="/quote/">Build a quote list</a></div>'; return; }
    main.innerHTML = me.rfqs.map(rfqCard).join('');
    bindQuotes(main);
  }

  function orderCard(o) {
    var idx = ORDER_FLOW.indexOf(o.status);
    var SHOW = ['received', 'sample_development', 'in_production', 'quality_inspection', 'ready_to_ship', 'shipped', 'delivered'];
    var reached = SHOW.filter(function (s) { return ORDER_FLOW.indexOf(s) <= idx; });
    var steps = o.status === 'cancelled' ? '' : '<ol class="order-steps" aria-label="Order progress">' + SHOW.map(function (s) {
      var on = ORDER_FLOW.indexOf(s) <= idx, cur = s === reached[reached.length - 1];
      return '<li class="' + (on ? 'done' : '') + (cur ? ' now' : '') + '"' + (cur ? ' aria-current="step"' : '') + '><span>' + esc(STATUS[s]) + '</span></li>';
    }).join('') + '</ol>';
    var prod = o.production.map(function (p) {
      return '<div class="quote-card"><header><b>Production ' + esc(p.code) + '</b>' + badge(p.status) + '</header><p class="muted">' + p.completed_qty.toLocaleString() + ' of ' + p.quantity.toLocaleString() + ' pieces completed' + (p.expected_completion ? ' · expected ' + fmtDate(p.expected_completion) : '') + '</p>' +
        '<ol class="stage-pills">' + (p.stages || []).map(function (s) { return '<li class="st-' + esc(s.status) + '">' + esc(STATUS[s.stage] || s.stage) + '</li>'; }).join('') + '</ol></div>';
    }).join('');
    var ship = o.shipments.map(function (s) {
      return '<div class="quote-card"><header><b>Shipment ' + esc(s.code) + '</b>' + badge(s.status) + '</header><dl class="specs">' +
        [['Method', STATUS[s.method] || s.method], ['Carrier', s.provider], ['Tracking number', s.tracking_number], ['Destination', s.destination], ['Dispatched', s.dispatch_date ? fmtDate(s.dispatch_date) : ''], ['Estimated delivery', s.estimated_delivery ? fmtDate(s.estimated_delivery) : ''], ['Notes', s.notes]]
          .filter(function (x) { return x[1]; }).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
        (s.tracking_number ? '<p class="hint">Use the tracking number on the carrier\'s website for live status.</p>' : '') + files(s.documents) + '</div>';
    }).join('');
    return '<article class="req-card"><header><div><b>Order ' + esc(o.code) + '</b><span class="muted"> · ' + esc(fmtDate(o.created_at)) + ' · ' + esc(o.quote_code || '') + '</span></div>' + badge(o.status) + '</header>' + steps +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Colour</th><th>Sizes</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody>' +
      o.lines.map(function (l) { return '<tr><td>' + esc(l.product_name) + '</td><td>' + esc(colorName(l.color)) + '</td><td>' + esc(sizesTxt(l.sizes) || '—') + '</td><td class="num">' + l.quantity.toLocaleString() + '</td><td class="num">' + Number(l.line_total).toFixed(2) + '</td></tr>'; }).join('') +
      '<tr class="total"><td colspan="4" class="num"><b>Order total</b></td><td class="num"><b>' + money(o.currency, o.total) + '</b></td></tr></tbody></table></div>' +
      '<dl class="specs">' + [['Payment', STATUS[o.payment_status] || o.payment_status], ['Payment details', o.payment_info], ['Shipping method', o.shipping_method], ['Delivery address', o.delivery_address], ['Notes', o.buyer_notes]]
        .filter(function (x) { return x[1]; }).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd class="pre">' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
      prod + ship + (o.documents.length ? '<h3 class="caps drawer-h">Order documents</h3>' + files(o.documents) : '') + timeline(o.history) + '</article>';
  }
  function orders(main) {
    main.innerHTML = me.orders.length ? me.orders.map(orderCard).join('') : '<div class="empty-state"><p>No orders yet. Orders appear here after you accept a quotation and our team confirms it.</p><a class="btn" href="?tab=quotations" data-goto="quotations">View quotations</a></div>';
  }
  function samples(main) {
    if (!me.samples.length) { main.innerHTML = '<div class="empty-state"><p>No sample requests yet. Request samples from any product or fabric page.</p><a class="btn" href="/products/">Browse products</a></div>'; return; }
    main.innerHTML = me.samples.map(function (s) {
      return '<article class="req-card"><header><div><b>' + esc(s.code) + '</b><span class="muted"> · ' + esc(fmtDate(s.created_at)) + '</span></div>' + badge(s.status) + '</header>' +
        '<dl class="specs" style="margin:0"><div><dt>Item</dt><dd>' + esc(s.product_name) + '</dd></div><div><dt>Details</dt><dd>' + esc([colorName(s.color), s.size, s.fabric ? fabricName(s.fabric) : '', s.gsm ? s.gsm + ' GSM' : ''].filter(Boolean).join(' · ') || '—') + '</dd></div>' +
        '<div><dt>Deliver to</dt><dd>' + esc(s.delivery_address) + '</dd></div>' + (s.tracking_number ? '<div><dt>Tracking</dt><dd>' + esc((s.courier ? s.courier + ' · ' : '') + s.tracking_number) + '</dd></div>' : '') + '</dl>' + timeline(s.history) + '</article>';
    }).join('');
  }
  function documents(main) {
    var groups = [];
    me.orders.forEach(function (o) {
      var d = o.documents.slice();
      o.shipments.forEach(function (s) { d = d.concat(s.documents); });
      if (d.length) groups.push(['Order ' + o.code, d]);
    });
    me.rfqs.forEach(function (r) { if (r.files.length) groups.push(['Your files for ' + r.code, r.files]); });
    var quotes = [];
    me.rfqs.forEach(function (r) { r.quotes.forEach(function (q) { quotes.push('<li><a class="row-link" href="/quotation/?id=' + q.id + '" target="_blank" rel="noopener">Quotation ' + esc(q.code) + ' rev ' + q.revision + '</a><span class="muted">' + money(q.currency, q.total) + ' · ' + esc(STATUS[q.status] || q.status) + '</span></li>'); }); });
    main.innerHTML = (!groups.length && !quotes.length) ? '<div class="empty-state"><p>No documents yet. Quotations, invoices, packing lists and inspection reports appear here when our team shares them.</p></div>' :
      (quotes.length ? '<article class="req-card"><header><b>Quotations</b></header><ul class="doc-list">' + quotes.join('') + '</ul></article>' : '') +
      groups.map(function (g) { return '<article class="req-card"><header><b>' + esc(g[0]) + '</b></header>' + files(g[1]) + '</article>'; }).join('');
  }
  function messages(main) {
    main.innerHTML = '<article class="req-card"><header><b>Messages with SIDDIQIYA Apparel</b></header><div class="chat">' +
      (me.messages.length ? me.messages.map(function (m) { return '<div class="msg' + (m.from_admin ? '' : ' msg--me') + '"><p>' + esc(m.body) + '</p><span>' + (m.from_admin ? 'SIDDIQIYA Apparel' : 'You') + ' · ' + esc(fmtDate(m.created_at)) + '</span></div>'; }).join('') : '<p class="muted">No messages yet. Ask us anything about your quotations, samples or orders.</p>') +
      '</div><form class="form" data-msg novalidate><div class="field"><label for="m-body">Your message</label><textarea class="input" id="m-body" name="body" maxlength="4000" required></textarea><span class="err"></span></div><div class="actions tight"><button class="btn" type="submit">Send message</button><a class="btn btn--ghost" href="' + esc(store().waUrl('Hello SIDDIQIYA Apparel, this is ' + (me.buyer.company_name || me.buyer.contact_person) + ' (' + me.email + ').')) + '" target="_blank" rel="noopener">Chat on WhatsApp</a></div></form></article>';
    var f = $('[data-msg]', main);
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); clearError(f);
      if (!store().validate(f)) return;
      setBusy(f, true, 'Sending…');
      try { await SB.rpc('apparel_send_message', { p_body: f.body.value.trim() }); store().toast('Message sent'); await reload(); }
      catch (err) { formError(f, SB.message(err)); setBusy(f, false); }
    });
    var chat = $('.chat', main); chat.scrollTop = chat.scrollHeight;
  }
  function addresses(main) {
    var card = function (a) {
      return '<div class="portal-card"><span class="caps">' + esc(a.label || 'Address') + (a.is_default ? ' · Default' : '') + '</span><p class="pre">' + esc([a.recipient, a.company, a.line1, a.line2, [a.city, a.region, a.postal_code].filter(Boolean).join(', '), a.country, a.phone].filter(Boolean).join('\n')) + '</p>' +
        '<div class="actions tight"><button class="link" type="button" data-edit-addr="' + a.id + '">Edit</button>' + (a.is_default ? '' : '<button class="link" type="button" data-def-addr="' + a.id + '">Make default</button>') + '<button class="link" type="button" data-del-addr="' + a.id + '">Delete</button></div></div>';
    };
    main.innerHTML = '<div class="portal-grid">' + me.addresses.map(card).join('') + '</div>' + (me.addresses.length < 10 ? '<button class="btn" type="button" data-new-addr>Add address</button>' : '') + '<div data-addr-form></div>';
    var formFor = function (a) {
      a = a || {};
      var f = function (n, l, req) { return '<div class="field"><label for="ad-' + n + '">' + l + (req ? ' <span class="req">*</span>' : '') + '</label><input class="input" id="ad-' + n + '" name="' + n + '" value="' + esc(a[n] || '') + '"' + (req ? ' required' : '') + '><span class="err"></span></div>'; };
      var box = $('[data-addr-form]', main);
      box.innerHTML = '<form class="panel-form form" data-addr novalidate style="margin-top:24px"><h2 class="h3">' + (a.id ? 'Edit address' : 'New address') + '</h2><div class="form-row">' + f('label', 'Label (e.g. Warehouse)') + f('recipient', 'Recipient', true) + '</div>' + f('company', 'Company') + f('line1', 'Address line 1', true) + f('line2', 'Address line 2') +
        '<div class="form-row">' + f('city', 'City', true) + f('region', 'State / region') + '</div><div class="form-row">' + f('postal_code', 'Postal code') + f('country', 'Country', true) + '</div>' + f('phone', 'Phone') +
        '<label class="filter-check"><input type="checkbox" name="is_default"' + (a.is_default ? ' checked' : '') + '> Use as default delivery address</label><div class="actions tight"><button class="btn" type="submit">Save address</button><button class="btn btn--ghost" type="button" data-cancel>Cancel</button></div></form>';
      var fm = $('[data-addr]', box);
      fm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('[data-cancel]', fm).onclick = function () { box.innerHTML = ''; };
      fm.addEventListener('submit', async function (e) {
        e.preventDefault(); clearError(fm);
        if (!store().validate(fm)) return;
        var p = { id: a.id || null, is_default: fm.is_default.checked };
        ['label', 'recipient', 'company', 'line1', 'line2', 'city', 'region', 'postal_code', 'country', 'phone'].forEach(function (k) { p[k] = fm[k].value.trim(); });
        setBusy(fm, true, 'Saving…');
        try { await SB.rpc('apparel_save_address', rpcArg(p)); store().toast('Address saved'); await reload(); } catch (err) { formError(fm, SB.message(err)); setBusy(fm, false); }
      });
    };
    var byId = function (id) { return me.addresses.filter(function (a) { return a.id === +id; })[0]; };
    var nb = $('[data-new-addr]', main); if (nb) nb.onclick = function () { formFor(null); };
    $$('[data-edit-addr]', main).forEach(function (b) { b.onclick = function () { formFor(byId(b.dataset.editAddr)); }; });
    $$('[data-def-addr]', main).forEach(function (b) { b.onclick = async function () { try { await SB.rpc('apparel_save_address', rpcArg(Object.assign({}, byId(b.dataset.defAddr), { is_default: true }))); await reload(); } catch (e) { store().toast(SB.message(e)); } }; });
    $$('[data-del-addr]', main).forEach(function (b) { b.onclick = async function () { if (!window.confirm('Delete this address?')) return; try { await SB.rpc('apparel_delete_address', { p_id: +b.dataset.delAddr }); store().toast('Address deleted'); await reload(); } catch (e) { store().toast(SB.message(e)); } }; });
  }
  function opts(list, cur) { return '<option value="">Select…</option>' + list.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
  function profile(main) {
    var b = me.buyer || (SB.user().meta || {}).apparel_profile || {};
    var f = function (name, label, v, type, req) { return '<div class="field"><label for="p-' + name.replace(/\W/g, '') + '">' + label + (req ? ' <span class="req">*</span>' : '') + '</label><input class="input" id="p-' + name.replace(/\W/g, '') + '" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(v || '') + '"' + (req ? ' required' : '') + '><span class="err" aria-live="polite"></span></div>'; };
    var s = function (name, label, list, v) { return '<div class="field"><label for="p-' + name.replace(/\W/g, '') + '">' + label + '</label><select class="input" id="p-' + name.replace(/\W/g, '') + '" name="' + name + '">' + opts(list, v) + '</select><span class="err" aria-live="polite"></span></div>'; };
    main.innerHTML = '<form class="panel-form form" data-profile novalidate><h2 class="h3">Company profile</h2><p class="muted" style="margin:0">Signed in as ' + esc(me.email) + '</p>' +
      '<div class="form-row">' + f('Contact person', 'Contact person', b.contact_person, 'text', true) + f('Company', 'Company name', b.company_name) + '</div>' +
      '<div class="form-row">' + f('Phone', 'Phone / WhatsApp', b.phone, 'tel') + s('Country', 'Country', COUNTRIES, b.country) + '</div>' +
      '<div class="form-row">' + f('Website', 'Website', b.website, 'url') + s('Business type', 'Business type', TYPES, b.business_type) + '</div>' +
      s('Estimated volume', 'Estimated order volume', VOLUMES, b.est_volume) +
      '<label class="filter-check"><input type="checkbox" name="wholesale"' + (b.wholesale_requested !== false ? ' checked' : '') + (me.buyer && me.buyer.wholesale_requested ? ' disabled' : '') + '> ' + (me.buyer && me.buyer.wholesale_requested ? 'Wholesale application submitted' : 'Apply for a wholesale account') + '</label>' +
      '<button class="btn" type="submit">Save profile</button></form>' +
      (me.buyer ? '<form class="panel-form form" data-pass novalidate style="margin-top:24px"><h2 class="h3">Change password</h2><div class="form-row">' +
        '<div class="field"><label for="np1">New password</label><input class="input" id="np1" name="Password" type="password" autocomplete="new-password" minlength="8" required><span class="err"></span></div>' +
        '<div class="field"><label for="np2">Confirm new password</label><input class="input" id="np2" name="Confirm password" type="password" autocomplete="new-password" required><span class="err"></span></div></div>' +
        '<button class="btn btn--ghost" type="submit">Update password</button></form>' : '');
    var fm = $('[data-profile]', main);
    fm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError(fm);
      if (!store().validate(fm)) return;
      var cb = fm.querySelector('[name="wholesale"]');
      var p = profilePayload(fm, cb.checked || (me.buyer && me.buyer.wholesale_requested));
      if (!checkWholesale(fm, p)) return;
      setBusy(fm, true, 'Saving…');
      try {
        await SB.rpc('apparel_save_buyer', rpcArg(p));
        store().toast('Profile saved');
        me = await SB.rpc('apparel_me');
        go('overview');
      } catch (err) { formError(fm, SB.message(err)); setBusy(fm, false); }
    });
    var pf = $('[data-pass]', main);
    if (pf) pf.addEventListener('submit', async function (e) {
      e.preventDefault(); clearError(pf);
      var p1 = pf.querySelector('[name="Password"]').value, p2 = pf.querySelector('[name="Confirm password"]').value;
      if (p1.length < 8) { fieldErr(pf, 'Password', 'Use at least 8 characters.'); return; }
      if (p1 !== p2) { fieldErr(pf, 'Confirm password', 'Passwords do not match.'); return; }
      setBusy(pf, true, 'Saving…');
      try { await SB.updatePassword(p1); pf.reset(); store().toast('Password updated'); } catch (err) { formError(pf, SB.message(err)); }
      setBusy(pf, false);
    });
  }
  portal.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-goto]');
    if (!g) return;
    e.preventDefault();
    go(g.getAttribute('data-goto'));
  });
  var COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Netherlands', 'Italy', 'Spain', 'Sweden', 'Denmark', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Cambodia', 'Thailand', 'Vietnam', 'Bangladesh', 'India', 'Other'];
  var TYPES = ['Individual Customer', 'Retailer', 'Wholesaler', 'Distributor', 'Fashion Brand', 'Importer'];
  var VOLUMES = ['Under 500 pieces', '500–2,000 pieces', '2,000–10,000 pieces', '10,000+ pieces'];
  boot();
})();
