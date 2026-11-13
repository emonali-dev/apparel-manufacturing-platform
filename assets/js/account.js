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
    submitted: 'Submitted', reviewing: 'Under review', quoted: 'Quotation sent', accepted: 'Accepted', ordered: 'Order confirmed', declined: 'Declined', closed: 'Closed',
    requested: 'Requested', approved: 'Approved', preparing: 'Preparing', shipped: 'Shipped', delivered: 'Delivered',
    pending: 'Under review', verified: 'Verified', rejected: 'Not approved', suspended: 'Suspended',
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
  var tab = new URLSearchParams(location.search).get('tab') || 'overview';
  var me = null;

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

  function render() {
    var b = me.buyer;
    $('[data-portal-title]').textContent = b ? 'Welcome, ' + b.contact_person.split(' ')[0] : 'Complete your buyer profile';
    $('[data-portal-lead]').textContent = b ? (b.company_name || me.email) : 'Tell us about your company to start sending quotation and sample requests.';
    if (!b) tab = 'profile';
    var tabs = [['overview', 'Overview'], ['quotations', 'Quotations (' + me.rfqs.length + ')'], ['samples', 'Samples (' + me.samples.length + ')'], ['profile', 'Profile']];
    portal.innerHTML = '<div class="portal">' +
      '<nav class="portal-nav" aria-label="Account sections">' + tabs.map(function (t) { return '<a href="?tab=' + t[0] + '" data-tab="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') +
      (me.is_admin ? '<a href="/admin/" class="portal-admin">Admin dashboard</a>' : '') +
      '<button type="button" class="portal-signout" data-signout>Sign out</button></nav>' +
      '<div class="portal-main" data-portal-main></div></div>';
    $$('[data-tab]', portal).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (!me.buyer && a.dataset.tab !== 'profile') return;
        tab = a.dataset.tab;
        history.replaceState(null, '', '?tab=' + tab);
        render();
      });
    });
    $('[data-signout]', portal).addEventListener('click', async function () { await SB.signOut(); location.replace('/account/login/'); });
    var main = $('[data-portal-main]', portal);
    if (tab === 'quotations') main.innerHTML = quotations();
    else if (tab === 'samples') main.innerHTML = samples();
    else if (tab === 'profile') { main.innerHTML = profileForm(); bindProfile(main); }
    else main.innerHTML = overview();
  }

  function overview() {
    var b = me.buyer;
    var ws = b.wholesale_requested
      ? '<div class="portal-card"><span class="caps">Wholesale account</span>' + badge(b.status) + '<p>' + ({ pending: 'Our team is reviewing your company details. Wholesale pricing is shared once your account is verified.', verified: 'Your wholesale account is verified. Quotations include trade pricing for your volumes.', rejected: 'We could not verify your wholesale application. Update your profile and resubmit, or contact us on WhatsApp.', suspended: 'This account is suspended. Please contact us.' }[b.status] || '') + '</p></div>'
      : '<div class="portal-card"><span class="caps">Wholesale account</span><p>You have a buyer account. Apply for wholesale pricing from your profile.</p><a class="link" href="?tab=profile" data-goto="profile">Apply for wholesale</a></div>';
    var open = me.rfqs.filter(function (r) { return ['submitted', 'reviewing', 'quoted'].indexOf(r.status) > -1; }).length;
    var openS = me.samples.filter(function (s) { return ['requested', 'approved', 'preparing', 'shipped'].indexOf(s.status) > -1; }).length;
    var welcome = new URLSearchParams(location.search).get('welcome') ? '<div class="portal-notice">Your account is ready. Add styles to your quote list and send your first request for quotation.</div>' : '';
    return welcome + '<div class="portal-grid">' + ws +
      '<div class="portal-card"><span class="caps">Quotations</span><b class="portal-num">' + open + '</b><p>open of ' + me.rfqs.length + ' total</p><a class="link" href="?tab=quotations" data-goto="quotations">View quotations</a></div>' +
      '<div class="portal-card"><span class="caps">Samples</span><b class="portal-num">' + openS + '</b><p>in progress of ' + me.samples.length + ' total</p><a class="link" href="?tab=samples" data-goto="samples">Track samples</a></div></div>' +
      '<div class="actions"><a class="btn" href="/quote/">New quotation request</a><a class="btn btn--ghost" href="/products/">Browse products</a><a class="btn btn--ghost" href="/fabrics/">Request fabric samples</a></div>' +
      (me.rfqs.length ? '<h2 class="h3" style="margin:40px 0 16px">Latest quotations</h2>' + me.rfqs.slice(0, 3).map(rfqCard).join('') : '');
  }

  function timeline(h) {
    if (!h || !h.length) return '';
    return '<ol class="timeline">' + h.map(function (x) {
      var label = x.from === x.to ? 'Message from SIDDIQIYA Apparel' : (STATUS[x.to] || x.to);
      return '<li><span class="t-date">' + esc(fmtDate(x.at)) + '</span><b>' + esc(label) + '</b>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') + '</li>';
    }).join('') + '</ol>';
  }
  function rfqCard(r) {
    var rows = r.items.map(function (i) {
      var sz = Object.keys(i.sizes || {}).map(function (k) { return k + ' ' + i.sizes[k]; }).join(', ');
      return '<tr><td><b>' + esc(i.product_name) + '</b><br><span class="muted">' + esc(i.product_id) + '</span></td><td>' + esc(colorName(i.color)) + '</td><td>' + esc(fabricName(i.fabric)) + (i.gsm ? ' · ' + i.gsm + ' GSM' : '') + '</td><td>' + esc(sz || '—') + '</td><td class="num">' + (i.quantity || 0).toLocaleString() + '</td></tr>';
    }).join('');
    return '<article class="req-card"><header><div><b>' + esc(r.code) + '</b><span class="muted"> · ' + esc(fmtDate(r.created_at)) + (r.order_type ? ' · ' + esc(r.order_type) : '') + '</span></div>' + badge(r.status) + '</header>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Colour</th><th>Fabric</th><th>Sizes</th><th class="num">Pieces</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (r.requirements ? '<p class="req-note">' + esc(r.requirements) + '</p>' : '') + timeline(r.history) + '</article>';
  }
  function quotations() {
    if (!me.rfqs.length) return '<div class="empty-state"><p>No quotation requests yet.</p><a class="btn" href="/quote/">Build a quote list</a></div>';
    return me.rfqs.map(rfqCard).join('');
  }
  function samples() {
    if (!me.samples.length) return '<div class="empty-state"><p>No sample requests yet. Request samples from any product or fabric page.</p><a class="btn" href="/products/">Browse products</a></div>';
    return me.samples.map(function (s) {
      return '<article class="req-card"><header><div><b>' + esc(s.code) + '</b><span class="muted"> · ' + esc(fmtDate(s.created_at)) + '</span></div>' + badge(s.status) + '</header>' +
        '<dl class="specs" style="margin:0"><div><dt>Item</dt><dd>' + esc(s.product_name) + '</dd></div><div><dt>Details</dt><dd>' + esc([colorName(s.color), s.size, s.fabric ? fabricName(s.fabric) : '', s.gsm ? s.gsm + ' GSM' : ''].filter(Boolean).join(' · ') || '—') + '</dd></div>' +
        '<div><dt>Deliver to</dt><dd>' + esc(s.delivery_address) + '</dd></div>' + (s.tracking_number ? '<div><dt>Tracking</dt><dd>' + esc((s.courier ? s.courier + ' · ' : '') + s.tracking_number) + '</dd></div>' : '') + '</dl>' + timeline(s.history) + '</article>';
    }).join('');
  }
  function opts(list, cur) { return '<option value="">Select…</option>' + list.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
  function profileForm() {
    var b = me.buyer || (SB.user().meta || {}).apparel_profile || {};
    var countries = $$('#portal-countries option').map(function (o) { return o.value; });
    var f = function (name, label, v, type, req) { return '<div class="field"><label for="p-' + name.replace(/\W/g, '') + '">' + label + (req ? ' <span class="req">*</span>' : '') + '</label><input class="input" id="p-' + name.replace(/\W/g, '') + '" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(v || '') + '"' + (req ? ' required' : '') + '><span class="err" aria-live="polite"></span></div>'; };
    var s = function (name, label, list, v) { return '<div class="field"><label for="p-' + name.replace(/\W/g, '') + '">' + label + '</label><select class="input" id="p-' + name.replace(/\W/g, '') + '" name="' + name + '">' + opts(list, v) + '</select><span class="err" aria-live="polite"></span></div>'; };
    return '<form class="panel-form form" data-profile novalidate><h2 class="h3">Company profile</h2><p class="muted" style="margin:0">Signed in as ' + esc(me.email) + '</p>' +
      '<div class="form-row">' + f('Contact person', 'Contact person', b.contact_person, 'text', true) + f('Company', 'Company name', b.company_name) + '</div>' +
      '<div class="form-row">' + f('Phone', 'Phone / WhatsApp', b.phone, 'tel') + s('Country', 'Country', COUNTRIES, b.country) + '</div>' +
      '<div class="form-row">' + f('Website', 'Website', b.website, 'url') + s('Business type', 'Business type', TYPES, b.business_type) + '</div>' +
      s('Estimated volume', 'Estimated order volume', VOLUMES, b.est_volume) +
      '<label class="filter-check"><input type="checkbox" name="wholesale"' + (b.wholesale_requested !== false ? ' checked' : '') + (me.buyer && me.buyer.wholesale_requested ? ' disabled' : '') + '> ' + (me.buyer && me.buyer.wholesale_requested ? 'Wholesale application submitted' : 'Apply for a wholesale account') + '</label>' +
      '<button class="btn" type="submit">Save profile</button></form>';
  }
  function bindProfile(main) {
    var f = $('[data-profile]', main);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError(f);
      if (!store().validate(f)) return;
      var cb = f.querySelector('[name="wholesale"]');
      var p = profilePayload(f, cb.checked || (me.buyer && me.buyer.wholesale_requested));
      if (!checkWholesale(f, p)) return;
      setBusy(f, true, 'Saving…');
      try {
        await SB.rpc('apparel_save_buyer', rpcArg(p));
        me = await SB.rpc('apparel_me');
        store().toast('Profile saved');
        tab = 'overview';
        history.replaceState(null, '', '?tab=overview');
        render();
      } catch (err) { formError(f, SB.message(err)); setBusy(f, false); }
    });
  }
  portal.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-goto]');
    if (!g) return;
    e.preventDefault();
    tab = g.getAttribute('data-goto');
    history.replaceState(null, '', '?tab=' + tab);
    render();
  });
  var COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Netherlands', 'Italy', 'Spain', 'Sweden', 'Denmark', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Cambodia', 'Thailand', 'Vietnam', 'Bangladesh', 'India', 'Other'];
  var TYPES = ['Individual Customer', 'Retailer', 'Wholesaler', 'Distributor', 'Fashion Brand', 'Importer'];
  var VOLUMES = ['Under 500 pieces', '500–2,000 pieces', '2,000–10,000 pieces', '10,000+ pieces'];
  boot();
})();
