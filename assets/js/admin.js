/* SIDDIQIYA Apparel — admin dashboard. Every action is authorised again in the database. */
(function () {
  'use strict';
  var SA = window.SA, SB = window.SB, F = window.SAFiles;
  var root = document.querySelector('[data-admin]');
  if (!root) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var toast = function (m) { window.SAStore.toast(m); };
  var fmt = function (d) { if (!d) return ''; try { return new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; } };
  var fmtD = function (d) { if (!d) return ''; try { return new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } };
  var money = function (c, v) { if (v == null || v === '') return '—'; return (c || 'USD') + ' ' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var colorName = function (k) { return SA.colors[k] ? SA.colors[k].name : (k || ''); };
  var sizesTxt = function (s) { return Object.keys(s || {}).map(function (k) { return k + ' ' + s[k]; }).join(', '); };
  var CATS = SA.categories;
  var COLOR_KEYS = Object.keys(SA.colors);
  var SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
  var SHAPES = ['crew', 'oversized', 'drop', 'polo', 'raglan', 'heavy'];
  var TEXTURES = ['jersey', 'jersey-fine', 'jersey-slub', 'jersey-heather', 'jersey-heavy', 'terry', 'pique', 'mesh', 'rib', 'fleece'];
  var ST = {
    rfq: ['pending', 'under_review', 'quotation_sent', 'negotiation', 'sample_requested', 'approved', 'rejected', 'cancelled'],
    sample: ['requested', 'approved', 'preparing', 'shipped', 'delivered', 'declined'],
    inquiry: ['new', 'in_progress', 'closed'],
    buyer: ['pending', 'verified', 'rejected', 'suspended'],
    order: ['received', 'awaiting_confirmation', 'sample_development', 'sample_approved', 'production_pending', 'in_production', 'quality_inspection', 'packing', 'ready_to_ship', 'shipped', 'delivered', 'completed', 'cancelled'],
    payment: ['unpaid', 'deposit_received', 'paid', 'refunded'],
    production: ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'],
    stage: ['pending', 'in_progress', 'done', 'skipped'],
    lead: ['new', 'contacted', 'interested', 'quotation_sent', 'negotiation', 'converted', 'lost'],
    shipment: ['preparing', 'dispatched', 'in_transit', 'delivered', 'exception'],
    supplier: ['active', 'on_hold', 'inactive'],
  };
  var LABEL = {
    pending: 'Pending', under_review: 'Under review', quotation_sent: 'Quotation sent', negotiation: 'Negotiation', sample_requested: 'Sample requested', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
    requested: 'Requested', preparing: 'Preparing', shipped: 'Shipped', delivered: 'Delivered', declined: 'Declined', new: 'New', in_progress: 'In progress', closed: 'Closed',
    verified: 'Verified', suspended: 'Suspended', received: 'Order received', awaiting_confirmation: 'Awaiting confirmation', sample_development: 'Sample development', sample_approved: 'Sample approved',
    production_pending: 'Production pending', in_production: 'In production', quality_inspection: 'Quality inspection', packing: 'Packing', ready_to_ship: 'Ready to ship', completed: 'Completed',
    unpaid: 'Unpaid', deposit_received: 'Deposit received', paid: 'Paid', refunded: 'Refunded', planned: 'Planned', on_hold: 'On hold', done: 'Done', skipped: 'Skipped',
    contacted: 'Contacted', interested: 'Interested', converted: 'Converted', lost: 'Lost', dispatched: 'Dispatched', in_transit: 'In transit', exception: 'Exception', active: 'Active', inactive: 'Inactive',
    draft: 'Draft', sent: 'Sent', superseded: 'Superseded', accepted: 'Accepted', pass: 'Pass', fail: 'Fail', na: 'N/A',
    order_confirmation: 'Order confirmation', material_procurement: 'Material procurement', fabric_preparation: 'Fabric preparation', cutting: 'Cutting', printing_embroidery: 'Printing / embroidery',
    stitching: 'Stitching', finishing: 'Finishing',
    super_admin: 'Super Admin', admin: 'Admin', sales_manager: 'Sales Manager', sales_rep: 'Sales Representative', production_manager: 'Production Manager', qc_manager: 'Quality Control Manager', shipping_manager: 'Shipping Manager', support: 'Support Staff',
    express_courier: 'Express courier', air_freight: 'Air freight', sea_freight: 'Sea freight', road: 'Road', buyer_pickup: 'Buyer pickup',
  };
  var L = function (s) { return LABEL[s] || s; };
  var badge = function (s) { return '<span class="status status--' + esc(s) + '">' + esc(L(s)) + '</span>'; };
  var NAV = [
    ['overview', 'Overview', null], ['rfqs', 'Quotations', 'quotes'], ['orders', 'Orders', 'orders'], ['production', 'Production & QC', 'production'],
    ['shipping', 'Shipping', 'shipping'], ['samples', 'Samples', 'samples'], ['inquiries', 'Inquiries', 'inquiries'], ['buyers', 'Buyers', 'buyers'],
    ['crm', 'CRM', 'crm'], ['suppliers', 'Suppliers', 'suppliers'], ['products', 'Products', 'catalog'], ['fabrics', 'Fabrics', 'catalog'],
    ['collections', 'Collections', 'catalog'], ['content', 'Website content', 'content'], ['reports', 'Reports', 'reports'], ['team', 'Users & roles', 'users'], ['system', 'System', 'settings'],
  ];
  var view = (location.hash.slice(1) || 'overview').split('/')[0];
  var ov = null, perms = [], role = null, catalogCache = null;
  var can = function (p) { return !p || role === 'super_admin' || perms.indexOf(p) > -1; };
  async function call(fn, args) { return SB.rpc(fn, args || {}); }

  /* ---------- shell ---------- */
  function shell() {
    root.innerHTML = '<div class="admin"><aside class="admin-nav"><a class="logo" href="/"><b>SIDDIQIYA</b><small>ADMIN</small></a><nav aria-label="Admin">' +
      NAV.filter(function (n) { return can(n[2]); }).map(function (n) { return '<a href="#' + n[0] + '" data-view="' + n[0] + '"' + (n[0] === view ? ' aria-current="page"' : '') + '>' + n[1] + '<span class="count" data-nav-count="' + n[0] + '"></span></a>'; }).join('') +
      '</nav><div class="admin-nav-foot"><span class="muted">' + esc((SB.user() || {}).email || '') + '<br>' + esc(L(role)) + '</span><button type="button" class="link" data-signout>Sign out</button></div></aside><main class="admin-main" data-main></main></div><div class="admin-drawer" data-drawer hidden></div>';
    $('[data-signout]', root).onclick = async function () { await SB.signOut(); location.reload(); };
  }
  function badges() {
    if (!ov) return;
    var set = function (k, n) { var el = $('[data-nav-count="' + k + '"]', root); if (el) { el.textContent = n || ''; el.setAttribute('data-n', n || 0); } };
    set('rfqs', ov.new_rfqs); set('samples', ov.new_samples); set('inquiries', ov.new_inquiries); set('buyers', (ov.pending_buyers || 0) + (ov.unread_messages || 0)); set('crm', ov.follow_ups_due);
  }
  var main = function () { return $('[data-main]', root); };
  function head(eyebrow, title, right) { return '<header class="admin-head"><div><p class="eyebrow">' + eyebrow + '</p><h1 class="h2">' + title + '</h1></div><div class="admin-head-actions">' + (right || '') + '</div></header>'; }
  function failBox(err) { main().innerHTML = '<div class="form-error" role="alert"><p>' + esc(SB.message(err)) + '</p><button class="btn btn--ghost btn--sm" type="button" data-reload>Reload</button></div>'; $('[data-reload]', root).onclick = route; }
  function table(cols, rows, empty) {
    if (!rows.length) return '<div class="empty-state"><p>' + (empty || 'Nothing here yet.') + '</p></div>';
    return '<div class="table-scroll"><table class="data-table admin-table"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  var link = function (i, text, isNew) { return '<button class="row-link" type="button" data-open="' + i + '">' + esc(text) + (isNew ? ' <i class="new-dot" title="New"></i>' : '') + '</button>'; };
  function dl(pairs) { return '<dl class="specs">' + pairs.filter(function (p) { return p[1] !== '' && p[1] != null && p[1] !== 'null'; }).map(function (p) { return '<div><dt>' + p[0] + '</dt><dd>' + p[1] + '</dd></div>'; }).join('') + '</dl>'; }
  function history(h) {
    if (!h || !h.length) return '';
    return '<h3 class="caps drawer-h">History</h3><ol class="timeline">' + h.map(function (x) { return '<li><span class="t-date">' + esc(fmt(x.at)) + '</span><b>' + (x.from === x.to ? 'Message to buyer' : esc(L(x.from || 'created')) + ' → ' + esc(L(x.to))) + '</b>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') + '</li>'; }).join('') + '</ol>';
  }
  function opts(list, cur, labelFn) { return list.map(function (x) { return '<option value="' + esc(x) + '"' + (x === cur ? ' selected' : '') + '>' + esc(labelFn ? labelFn(x) : L(x)) + '</option>'; }).join(''); }
  function inp(name, label, v, attrs) { return '<div class="field"><label for="e-' + name + '">' + label + '</label><input class="input" id="e-' + name + '" name="' + name + '" value="' + esc(v == null ? '' : v) + '" ' + (attrs || '') + '></div>'; }
  function area(name, label, v, attrs) { return '<div class="field"><label for="e-' + name + '">' + label + '</label><textarea class="input" id="e-' + name + '" name="' + name + '" ' + (attrs || '') + '>' + esc(v || '') + '</textarea></div>'; }
  function sel(name, label, list, v, labelFn, blank) { return '<div class="field"><label for="e-' + name + '">' + label + '</label><select class="input" id="e-' + name + '" name="' + name + '">' + (blank ? '<option value="">' + blank + '</option>' : '') + opts(list, v, labelFn) + '</select></div>'; }
  function check(name, label, on) { return '<label class="filter-check"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }
  function chips(name, all, selected, labelFn) {
    return '<div class="opts">' + all.map(function (v) { return '<label class="opt"><input type="checkbox" name="' + name + '" value="' + esc(v) + '"' + ((selected || []).indexOf(v) > -1 ? ' checked' : '') + '><span>' + (name === 'colors' ? '<i class="dot" style="background:' + SA.colors[v].hex + '"></i>' : '') + esc(labelFn ? labelFn(v) : v) + '</span></label>'; }).join('') + '</div>';
  }
  var checked = function (f, n) { return $$('input[name="' + n + '"]:checked', f).map(function (x) { return x.value; }); };
  var lines = function (f, n) { return f[n].value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
  var val = function (f, n) { return f[n] ? f[n].value.trim() : ''; };

  /* ---------- drawer ---------- */
  var drawerEsc = null;
  function drawer(html, onReady) {
    var d = $('[data-drawer]', root);
    d.innerHTML = '<div class="drawer-card" role="dialog" aria-modal="true" aria-label="Details"><button class="icon-btn drawer-close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' + html + '</div>';
    d.hidden = false;
    document.body.style.overflow = 'hidden';
    $('[data-close]', d).onclick = closeDrawer;
    d.onclick = function (e) { if (e.target === d) closeDrawer(); };
    if (drawerEsc) document.removeEventListener('keydown', drawerEsc);
    drawerEsc = function (e) { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', drawerEsc);
    $('.drawer-card', d).scrollTop = 0;
    if (onReady) onReady($('.drawer-card', d));
  }
  function closeDrawer() { var d = $('[data-drawer]', root); if (d) { d.hidden = true; d.innerHTML = ''; } document.body.style.overflow = ''; }
  async function submitWith(form, fn, after) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var b = e.submitter || form.querySelector('[type=submit]');
      var label = b.textContent;
      b.disabled = true; b.textContent = 'Saving…';
      try { var r = await fn(b); toast('Saved'); if (after) await after(r); else { closeDrawer(); route(); } }
      catch (err) { toast(SB.message(err)); }
      finally { if (document.body.contains(b)) { b.disabled = false; b.textContent = label; } }
    });
  }

  /* ---------- files ---------- */
  function fileList(files, opt) {
    opt = opt || {};
    if (!files || !files.length) return '<p class="muted" style="margin:0">No files yet.</p>';
    return '<ul class="doc-list">' + files.map(function (f) {
      return '<li><button type="button" class="row-link" data-file="' + esc(f.path) + '" data-name="' + esc(f.filename) + '">' + esc(f.filename) + '</button><span class="muted">' + esc(L(f.kind).replace(/_/g, ' ')) + ' · ' + F.size(f.size) + '</span>' +
        (opt.manage ? '<label class="filter-check small"><input type="checkbox" data-vis="' + f.id + '"' + (f.visible_to_buyer ? ' checked' : '') + '> Visible to buyer</label><button type="button" class="q-remove" data-del-file="' + f.id + '">Delete</button>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function uploader(entity, id, kinds) {
    if (!can(entity === 'qc' ? 'qc' : 'documents')) return '';
    return '<form class="doc-upload" data-upload="' + entity + ':' + id + '"><select class="input" name="kind">' + opts(kinds, kinds[0], function (k) { return k.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }) + '</select>' +
      '<input class="input" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.ai,.psd" required>' + (entity !== 'qc' ? '<label class="filter-check small"><input type="checkbox" name="visible"> Visible to buyer</label>' : '') + '<button class="btn btn--ghost btn--sm" type="submit">Upload</button></form>';
  }
  function bindFiles(scope, refresh) {
    $$('[data-file]', scope).forEach(function (b) { b.onclick = function () { F.open(b.dataset.file, b.dataset.name).catch(function (e) { toast(e.message); }); }; });
    $$('[data-vis]', scope).forEach(function (c) { c.onchange = function () { call('apparel_admin_file_visibility', { p_id: +c.dataset.vis, p_visible: c.checked }).then(function () { toast(c.checked ? 'Shared with buyer' : 'Hidden from buyer'); }).catch(function (e) { toast(SB.message(e)); c.checked = !c.checked; }); }; });
    $$('[data-del-file]', scope).forEach(function (b) { b.onclick = async function () {
      if (!window.confirm('Delete this file?')) return;
      try { var r = await call('apparel_admin_delete_file', { p_id: +b.dataset.delFile }); await SB.remove('apparel-files', [r.path]).catch(function () {}); toast('Deleted'); refresh(); } catch (e) { toast(SB.message(e)); }
    }; });
    $$('[data-upload]', scope).forEach(function (f) {
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var parts = f.dataset.upload.split(':'), file = f.file.files[0];
        if (!file) return;
        var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Uploading…';
        try {
          var up = await F.uploadDoc(parts[0], parts[1], file);
          await call('apparel_admin_add_file', { p: { entity: parts[0], entity_id: +parts[1], path: up.path, filename: up.filename, mime: up.mime, size: up.size, kind: f.kind.value, visible_to_buyer: !!(f.visible && f.visible.checked) } });
          toast('Uploaded'); refresh();
        } catch (err) { toast(err.message ? SB.message(err) : 'Upload failed'); b.disabled = false; b.textContent = 'Upload'; }
      });
    });
  }

  /* ---------- boot ---------- */
  async function boot() {
    if (!SB.user()) return loginForm();
    var me;
    try { me = await call('apparel_me'); } catch (err) {
      if (err.status === 401 || err.code === 'NOT_AUTHENTICATED') { await SB.signOut(); return loginForm(); }
      root.innerHTML = '<div class="wrap section--tight"><div class="form-error"><p>' + esc(SB.message(err)) + '</p></div></div>'; return;
    }
    if (!me.is_admin) {
      root.innerHTML = '<div class="wrap section--tight auth-wrap"><div class="panel-form"><h1 class="h3">No admin access</h1><p>' + esc(me.email) + ' is not a staff member of SIDDIQIYA Apparel.</p><div class="actions"><a class="btn" href="/account/">Go to buyer account</a><button class="btn btn--ghost" type="button" data-out>Sign out</button></div></div></div>';
      $('[data-out]', root).onclick = async function () { await SB.signOut(); location.reload(); };
      return;
    }
    try { ov = await call('apparel_admin_overview'); } catch (e) { ov = {}; }
    role = ov.role; perms = ov.perms || [];
    shell(); badges(); route();
  }
  function loginForm() {
    root.innerHTML = '<div class="wrap section--tight auth-wrap"><form class="panel-form form" data-admin-login novalidate><p class="eyebrow">SIDDIQIYA Apparel</p><h1 class="h3">Staff sign in</h1>' +
      '<div class="field"><label for="a-email">Email</label><input class="input" id="a-email" name="Email" type="email" autocomplete="email" required><span class="err"></span></div>' +
      '<div class="field"><label for="a-pass">Password</label><input class="input" id="a-pass" name="Password" type="password" autocomplete="current-password" required><span class="err"></span></div>' +
      '<button class="btn btn--block" type="submit">Sign in</button><div class="auth-links"><a class="link" href="/account/reset/">Forgot password?</a></div></form></div>';
    var f = $('[data-admin-login]', root);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!window.SAStore.validate(f)) return;
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Signing in…';
      try { await SB.signIn(f.Email.value.trim(), f.Password.value); boot(); }
      catch (err) { var box = f.querySelector('.form-error') || f.appendChild(Object.assign(document.createElement('div'), { className: 'form-error' })); box.textContent = SB.message(err); b.disabled = false; b.textContent = 'Sign in'; }
    });
  }
  window.addEventListener('hashchange', function () {
    view = (location.hash.slice(1) || 'overview').split('/')[0];
    $$('[data-view]', root).forEach(function (a) { if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    closeDrawer(); route();
  });
  async function refreshOv() { try { ov = await call('apparel_admin_overview'); badges(); } catch (e) { /* optional */ } }

  var VIEWS = {};
  async function route() {
    if (!main()) return;
    main().innerHTML = '<div class="portal-loading">Loading…</div>';
    var n = NAV.filter(function (x) { return x[0] === view; })[0];
    if (!n || !can(n[2])) view = 'overview';
    try { await refreshOv(); await VIEWS[view](); } catch (err) { failBox(err); }
  }

  /* ---------- overview ---------- */
  VIEWS.overview = function () {
    var o = ov || {};
    var vals = function (m) { var k = Object.keys(m || {}); return k.length ? k.map(function (c) { return money(c, m[c]); }).join('<br>') : money('USD', 0); };
    var card = function (label, n, hint, href, p) { return can(p) ? '<a class="portal-card stat" href="' + href + '"><span class="caps">' + label + '</span><b class="portal-num">' + n + '</b><p>' + hint + '</p></a>' : ''; };
    main().innerHTML = head('Dashboard', 'Overview', '<button class="btn btn--ghost btn--sm" type="button" data-refresh>Refresh</button>') +
      '<div class="portal-grid admin-stats">' +
      card('Buyers', o.buyers || 0, (o.new_buyers || 0) + ' new in 30 days · ' + (o.pending_buyers || 0) + ' pending', '#buyers', 'buyers') +
      card('Quotation requests', o.rfqs || 0, (o.pending_rfqs || 0) + ' open · ' + (o.approved_rfqs || 0) + ' approved', '#rfqs', 'quotes') +
      card('Active orders', o.active_orders || 0, (o.completed_orders || 0) + ' delivered or completed', '#orders', 'orders') +
      card('Production orders', o.production_orders || 0, 'planned, in progress or on hold', '#production', 'production') +
      card('Live products', o.products || 0, (o.hidden_products || 0) + ' hidden', '#products', 'catalog') +
      card('Follow-ups due', o.follow_ups_due || 0, 'CRM leads due today or overdue', '#crm', 'crm') +
      (can('quotes') ? '<div class="portal-card"><span class="caps">Quoted value (open + accepted)</span><b class="portal-num small">' + vals(o.quoted_value) + '</b><p>Quotations sent — not revenue</p></div>' : '') +
      (can('orders') ? '<div class="portal-card"><span class="caps">Confirmed order value</span><b class="portal-num small">' + vals(o.confirmed_order_value) + '</b><p>All orders except cancelled</p></div>' : '') +
      card('Inbox', (o.new_inquiries || 0) + (o.new_samples || 0) + (o.unread_messages || 0), (o.new_inquiries || 0) + ' inquiries · ' + (o.new_samples || 0) + ' samples · ' + (o.unread_messages || 0) + ' messages', '#inquiries', 'inquiries') +
      '</div>' +
      (can('quotes') ? '<h2 class="h3 sect-h">Quotation requests by status</h2><div class="status-row">' + ST.rfq.map(function (s) { return '<div>' + badge(s) + '<b>' + ((o.rfq_status || {})[s] || 0) + '</b></div>'; }).join('') + '</div>' : '') +
      (can('orders') ? '<h2 class="h3 sect-h">Orders by status</h2><div class="status-row">' + ST.order.filter(function (s) { return (o.order_status || {})[s]; }).map(function (s) { return '<div>' + badge(s) + '<b>' + o.order_status[s] + '</b></div>'; }).join('') + (Object.keys(o.order_status || {}).length ? '' : '<p class="muted">No orders yet.</p>') + '</div>' : '');
    $('[data-refresh]', root).onclick = route;
  };

  /* ---------- quotations ---------- */
  var filt = {};
  function filterBar(type, statuses, extra) {
    var f = filt[type] || {};
    return '<form class="admin-filters" data-filters><label>Status <select class="input" name="status"><option value="">All</option>' + opts(statuses, f.status) + '</select></label>' + (extra || '') +
      '<label>Search <input class="input" name="q" value="' + esc(f.q || '') + '" placeholder="Code, company, email…"></label></form>';
  }
  function bindFilter(type) {
    var f = $('[data-filters]', root);
    if (!f) return;
    var go = function () { filt[type] = { status: f.status.value, q: f.q.value.trim(), country: f.country ? f.country.value : '', from: f.from ? f.from.value : '', to: f.to ? f.to.value : '' }; route(); };
    f.onchange = go;
    f.q.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  }
  function matchQ(obj, q) { return !q || JSON.stringify(obj).toLowerCase().indexOf(q.toLowerCase()) > -1; }
  function inRange(d, f) { var t = String(d).slice(0, 10); return (!f.from || t >= f.from) && (!f.to || t <= f.to); }

  VIEWS.rfqs = async function () {
    var f = filt.rfqs || {};
    var rows = await call('apparel_admin_rfqs', { p_status: f.status || null });
    var countries = Array.from(new Set(rows.map(function (r) { return r.country || (r.buyer && r.buyer.country); }).filter(Boolean))).sort();
    rows = rows.filter(function (r) { return matchQ([r.code, r.buyer, r.contact_name], f.q) && (!f.country || (r.country || (r.buyer || {}).country) === f.country) && inRange(r.created_at, f); });
    main().innerHTML = head('Sales', 'Quotation requests') + filterBar('rfqs', ST.rfq, '<label>Country <select class="input" name="country"><option value="">All</option>' + opts(countries, f.country, String) + '</select></label><label>From <input class="input" type="date" name="from" value="' + esc(f.from || '') + '"></label><label>To <input class="input" type="date" name="to" value="' + esc(f.to || '') + '"></label>') +
      table(['Ref', 'Buyer', 'Country', 'Items', 'Pieces', 'Received', 'Latest quote', 'Status'], rows.map(function (r, i) {
        var q = r.quotes[0];
        return [link(i, r.code, !r.seen_by_admin), esc((r.buyer && r.buyer.company_name) || r.contact_name || '—'), esc(r.country || (r.buyer || {}).country || '—'), r.items.length,
          r.items.reduce(function (n, x) { return n + x.quantity; }, 0).toLocaleString(), fmtD(r.created_at), q ? esc(q.code + ' r' + q.revision) + '<br>' + badge(q.status) : '—', badge(r.status)];
      }), 'No quotation requests yet.');
    bindFilter('rfqs');
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () { rfqDetail(rows[+b.dataset.open]); }; });
  };

  function rfqDetail(r) {
    if (!r.seen_by_admin) call('apparel_admin_mark_seen', { p_kind: 'rfq', p_id: r.id }).then(refreshOv).catch(function () {});
    var b = r.buyer || {};
    var quotes = r.quotes.map(function (q) {
      return '<div class="quote-card"><header><b>' + esc(q.code) + ' · revision ' + q.revision + '</b>' + badge(q.status) + '</header>' +
        '<p class="muted">' + money(q.currency, q.total) + (q.valid_until ? ' · valid until ' + fmtD(q.valid_until) : '') + (q.sent_at ? ' · sent ' + fmtD(q.sent_at) : '') + '</p>' +
        (q.buyer_response ? '<p class="req-note">Buyer: ' + esc(q.buyer_response) + '</p>' : '') +
        '<div class="actions tight">' + (q.status === 'draft' ? '<button class="btn btn--sm" type="button" data-q-edit="' + q.id + '">Edit draft</button><button class="btn btn--ghost btn--sm" type="button" data-q-send="' + q.id + '">Send to buyer</button><button class="q-remove" type="button" data-q-del="' + q.id + '">Delete draft</button>' : '') +
        '<a class="btn btn--ghost btn--sm" href="/quotation/?id=' + q.id + '&from=admin" target="_blank" rel="noopener">View / PDF</a>' +
        ((q.status === 'accepted' || q.status === 'sent') && !r.order && can('orders') ? '<button class="btn btn--ghost btn--sm" type="button" data-q-order="' + q.id + '">Create order</button>' : '') + '</div></div>';
    }).join('');
    var hasDraft = r.quotes.some(function (q) { return q.status === 'draft'; });
    drawer('<h2 class="h3">' + esc(r.code) + ' ' + badge(r.status) + '</h2><p class="muted">' + fmt(r.created_at) + (r.order_type ? ' · ' + esc(r.order_type) : '') + '</p>' +
      dl([['Company', esc(b.company_name)], ['Contact', esc(r.contact_name || b.contact_person)], ['Email', b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' : ''],
        ['WhatsApp', r.whatsapp ? '<a href="https://wa.me/' + esc(String(r.whatsapp).replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + esc(r.whatsapp) + '</a>' : esc(b.phone)],
        ['Country', esc(r.country || b.country)], ['Website', esc(r.website || b.website)], ['Buyer status', b.status ? badge(b.status) : ''],
        ['Destination', esc(r.destination)], ['Target delivery', fmtD(r.target_date)], ['Budget', esc(r.budget)], ['Printing', esc(r.printing)], ['Embroidery', esc(r.embroidery)], ['Customisation', esc(r.customization)]]) +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Colour</th><th>Fabric</th><th>Sizes</th><th class="num">Pcs</th></tr></thead><tbody>' +
      r.items.map(function (i) { return '<tr><td><b>' + esc(i.product_name) + '</b><br><span class="muted">' + esc(i.product_id) + (i.fit ? ' · ' + esc(i.fit) : '') + '</span>' + (i.note ? '<br><span class="muted">' + esc(i.note) + '</span>' : '') + '</td><td>' + esc(colorName(i.color)) + '</td><td>' + esc(i.fabric) + (i.gsm ? ' · ' + i.gsm : '') + '</td><td>' + esc(sizesTxt(i.sizes) || '—') + '</td><td class="num">' + (i.quantity || 0).toLocaleString() + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (r.requirements ? '<h3 class="caps drawer-h">Instructions</h3><p class="pre">' + esc(r.requirements) + '</p>' : '') +
      '<h3 class="caps drawer-h">Buyer files</h3>' + fileList(r.files) +
      '<h3 class="caps drawer-h">Quotations</h3>' + (quotes || '<p class="muted" style="margin:0">No quotation prepared yet.</p>') +
      (!hasDraft ? '<div class="actions tight"><button class="btn btn--sm" type="button" data-q-new>' + (r.quotes.length ? 'Create revision ' + (r.quotes[0].revision + 1) : 'Prepare quotation') + '</button></div>' : '') +
      (r.order ? '<p class="portal-notice">Order <a href="#orders">' + esc(r.order.code) + '</a> · ' + esc(L(r.order.status)) + '</p>' : '') +
      '<form class="form" data-detail><h3 class="caps drawer-h">Status & notes</h3>' + sel('status', 'Status', ST.rfq, r.status) + area('message', 'Message to buyer <span class="muted">(shown in their account and emailed)</span>', '', 'maxlength="2000"') + area('note', 'Internal note <span class="muted">(staff only)</span>', r.admin_note, 'maxlength="2000"') + '<button class="btn" type="submit">Save</button></form>' + history(r.history),
    function (d) {
      bindFiles(d);
      var f = $('[data-detail]', d);
      submitWith(f, async function () {
        await call('apparel_admin_update_rfq', { p_id: r.id, p_status: f.status.value, p_note: val(f, 'note') || null });
        if (val(f, 'message')) await call('apparel_admin_message', { p_entity: 'rfq', p_id: r.id, p_note: val(f, 'message') });
      });
      var nb = $('[data-q-new]', d);
      if (nb) nb.onclick = function () { quoteEditor(r, r.quotes[0] ? Object.assign({}, r.quotes[0], { id: null }) : null); };
      $$('[data-q-edit]', d).forEach(function (x) { x.onclick = function () { quoteEditor(r, r.quotes.filter(function (q) { return q.id === +x.dataset.qEdit; })[0]); }; });
      $$('[data-q-send]', d).forEach(function (x) { x.onclick = async function () { if (!window.confirm('Send this quotation to the buyer? It cannot be edited afterwards.')) return; try { await call('apparel_admin_send_quote', { p_id: +x.dataset.qSend }); toast('Quotation sent'); closeDrawer(); route(); } catch (e) { toast(SB.message(e)); } }; });
      $$('[data-q-del]', d).forEach(function (x) { x.onclick = async function () { try { await call('apparel_admin_delete_quote', { p_id: +x.dataset.qDel }); toast('Draft deleted'); closeDrawer(); route(); } catch (e) { toast(SB.message(e)); } }; });
      $$('[data-q-order]', d).forEach(function (x) { x.onclick = async function () { if (!window.confirm('Create an order from this quotation?')) return; try { var o = await call('apparel_admin_create_order', { p_quote: +x.dataset.qOrder }); toast('Order ' + o.code + ' created'); location.hash = 'orders'; } catch (e) { toast(SB.message(e)); } }; });
    });
  }

  function quoteEditor(r, base) {
    var src = base && base.lines ? base.lines : r.items.map(function (i) { return { product_id: i.product_id, description: i.product_name + (i.color ? ' — ' + colorName(i.color) : '') + (i.gsm ? ', ' + i.gsm + ' GSM' : ''), color: i.color, sizes: i.sizes, quantity: i.quantity || 1, unit_price: '', tiers: [] }; });
    var q = base || {};
    var lineRow = function (l, i) {
      return '<div class="q-line" data-line><input class="input" name="d" value="' + esc(l.description) + '" placeholder="Description" maxlength="300" aria-label="Description"><input class="input" name="q" type="number" min="1" step="1" value="' + esc(l.quantity) + '" aria-label="Quantity"><input class="input" name="p" type="number" min="0" step="0.01" value="' + esc(l.unit_price) + '" placeholder="Unit price" aria-label="Unit price">' +
        '<input class="input" name="t" value="' + esc((l.tiers || []).map(function (t) { return t.min_qty + ':' + t.unit_price; }).join(', ')) + '" placeholder="Tiers e.g. 500:4.50, 1000:4.20" aria-label="Quantity price tiers"><output data-lt>—</output><button class="q-remove" type="button" data-rm-line aria-label="Remove line">×</button>' +
        '<input type="hidden" name="pid" value="' + esc(l.product_id || '') + '"><input type="hidden" name="c" value="' + esc(l.color || '') + '"><input type="hidden" name="s" value="' + esc(JSON.stringify(l.sizes || {})) + '"></div>';
    };
    drawer('<h2 class="h3">' + (q.id ? 'Edit ' + esc(q.code) + ' revision ' + q.revision : (r.quotes.length ? 'New revision for ' : 'Quotation for ') + esc(r.code)) + '</h2>' +
      '<form class="form" data-quote-form><div class="q-lines-head"><span>Description</span><span>Qty</span><span>Unit price</span><span>Quantity tiers (min qty:price)</span><span>Line total</span><span></span></div><div data-lines>' + src.map(lineRow).join('') + '</div>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-add-line>Add line</button>' +
      '<div class="form-row">' + sel('currency', 'Currency', ['USD', 'EUR', 'GBP'], q.currency || 'USD', String) + inp('valid_until', 'Valid until', q.valid_until || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), 'type="date"') + '</div>' +
      '<div class="form-row">' + inp('shipping_cost', 'Shipping charges', q.shipping_cost || 0, 'type="number" min="0" step="0.01"') + inp('discount', 'Discount', q.discount || 0, 'type="number" min="0" step="0.01"') + '</div>' +
      '<div class="form-row">' + inp('tax_percent', 'Tax %', q.tax_percent || 0, 'type="number" min="0" max="100" step="0.01"') + inp('incoterm', 'Incoterm', q.incoterm || 'FOB Phnom Penh', 'maxlength="40"') + '</div>' +
      '<div class="form-row">' + inp('lead_time', 'Lead time', q.lead_time, 'maxlength="120" placeholder="e.g. 30 days after sample approval"') + inp('payment_terms', 'Payment terms', q.payment_terms || '30% deposit, 70% before shipment', 'maxlength="400"') + '</div>' +
      area('notes', 'Notes shown on quotation', q.notes, 'maxlength="4000"') +
      '<div class="q-totals" data-totals></div><p class="hint">Totals are recalculated by the server when you save.</p>' +
      '<div class="actions tight"><button class="btn" type="submit" data-act="save">Save draft</button><button class="btn btn--ghost" type="submit" data-act="send">Save & send to buyer</button></div></form>',
    function (d) {
      var f = $('[data-quote-form]', d), box = $('[data-lines]', d);
      var parseTiers = function (s) { return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { var p = x.split(':'); return { min_qty: +p[0], unit_price: +p[1] }; }); };
      var recalc = function () {
        var sub = 0;
        $$('[data-line]', box).forEach(function (l) { var t = (+l.querySelector('[name=q]').value || 0) * (+l.querySelector('[name=p]').value || 0); sub += t; l.querySelector('[data-lt]').textContent = t ? t.toFixed(2) : '—'; });
        var disc = +f.discount.value || 0, ship = +f.shipping_cost.value || 0, taxp = +f.tax_percent.value || 0;
        var base = Math.max(sub - disc, 0) + ship, tax = Math.round(base * taxp) / 100;
        $('[data-totals]', d).innerHTML = dl([['Subtotal', money(f.currency.value, sub)], ['Discount', disc ? '− ' + money(f.currency.value, disc) : ''], ['Shipping', ship ? money(f.currency.value, ship) : ''], ['Tax', tax ? money(f.currency.value, tax) : ''], ['<b>Total</b>', '<b>' + money(f.currency.value, base + tax) + '</b>']]);
      };
      f.addEventListener('input', recalc);
      box.addEventListener('click', function (e) { if (e.target.matches('[data-rm-line]')) { e.target.closest('[data-line]').remove(); recalc(); } });
      $('[data-add-line]', d).onclick = function () { box.insertAdjacentHTML('beforeend', lineRow({ description: '', quantity: 1, unit_price: '', tiers: [] })); };
      recalc();
      submitWith(f, async function (btn) {
        var payload = {
          id: q.id || null, rfq_id: r.id, currency: f.currency.value, valid_until: f.valid_until.value, shipping_cost: f.shipping_cost.value, discount: f.discount.value, tax_percent: f.tax_percent.value,
          incoterm: val(f, 'incoterm'), lead_time: val(f, 'lead_time'), payment_terms: val(f, 'payment_terms'), notes: val(f, 'notes'),
          lines: $$('[data-line]', box).map(function (l) { return { product_id: l.querySelector('[name=pid]').value || null, description: l.querySelector('[name=d]').value.trim(), color: l.querySelector('[name=c]').value || null, sizes: JSON.parse(l.querySelector('[name=s]').value || '{}'), quantity: l.querySelector('[name=q]').value, unit_price: l.querySelector('[name=p]').value, tiers: parseTiers(l.querySelector('[name=t]').value) }; }),
        };
        var saved = await call('apparel_admin_save_quote', { p: payload });
        if (btn.dataset.act === 'send') { if (!window.confirm('Send ' + saved.code + ' revision ' + saved.revision + ' (' + money(saved.currency, saved.total) + ') to the buyer?')) return; await call('apparel_admin_send_quote', { p_id: saved.id }); }
      });
    });
  }

  /* ---------- orders ---------- */
  VIEWS.orders = async function () {
    var f = filt.orders || {};
    var rows = (await call('apparel_admin_orders', { p_status: f.status || null })).filter(function (o) { return matchQ([o.code, o.buyer, o.quote_code], f.q); });
    main().innerHTML = head('Operations', 'Orders') + filterBar('orders', ST.order) +
      table(['Order', 'Buyer', 'Quotation', 'Pieces', 'Total', 'Payment', 'Updated', 'Status'], rows.map(function (o, i) {
        return [link(i, o.code), esc((o.buyer || {}).company_name || '—'), esc(o.quote_code || '—'), o.lines.reduce(function (n, l) { return n + l.quantity; }, 0).toLocaleString(), money(o.currency, o.total), badge(o.payment_status), fmtD(o.updated_at), badge(o.status)];
      }), 'No orders yet. Orders are created from accepted quotations.');
    bindFilter('orders');
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () { orderDetail(rows[+b.dataset.open]); }; });
  };
  function orderDetail(o) {
    var b = o.buyer || {};
    var reopen = async function () { var all = await call('apparel_admin_orders', { p_status: null }); var x = all.filter(function (y) { return y.id === o.id; })[0]; if (x) orderDetail(x); };
    drawer('<h2 class="h3">' + esc(o.code) + ' ' + badge(o.status) + '</h2><p class="muted">' + fmt(o.created_at) + ' · from ' + esc(o.quote_code || '') + ' / ' + esc(o.rfq_code || '') + '</p>' +
      dl([['Company', esc(b.company_name)], ['Contact', esc(b.contact_person)], ['Email', b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' : ''], ['Total', '<b>' + money(o.currency, o.total) + '</b>'], ['Payment', badge(o.payment_status)]]) +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Colour</th><th>Sizes</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead><tbody>' +
      o.lines.map(function (l) { return '<tr><td>' + esc(l.product_name) + '</td><td>' + esc(colorName(l.color)) + '</td><td>' + esc(sizesTxt(l.sizes) || '—') + '</td><td class="num">' + l.quantity.toLocaleString() + '</td><td class="num">' + Number(l.unit_price).toFixed(2) + '</td><td class="num">' + Number(l.line_total).toFixed(2) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h3 class="caps drawer-h">Production</h3>' + (o.production.length ? o.production.map(function (p) { return '<p>' + esc(p.code) + ' ' + badge(p.status) + ' · ' + p.completed_qty + ' / ' + p.quantity + ' pcs' + (p.expected_completion ? ' · due ' + fmtD(p.expected_completion) : '') + '</p>'; }).join('') : '<p class="muted" style="margin:0">Not scheduled.</p>') +
      (can('production') && o.status !== 'cancelled' && !o.production.length ? '<button class="btn btn--ghost btn--sm" type="button" data-mk-prod>Create production order</button>' : '') +
      '<h3 class="caps drawer-h">Shipments</h3>' + (o.shipments.length ? o.shipments.map(function (s) { return '<p>' + esc(s.code) + ' ' + badge(s.status) + ' · ' + esc(L(s.method) || '') + ' ' + esc(s.provider || '') + ' ' + esc(s.tracking_number || '') + '</p>'; }).join('') : '<p class="muted" style="margin:0">No shipments yet.</p>') +
      (can('shipping') && o.status !== 'cancelled' ? '<button class="btn btn--ghost btn--sm" type="button" data-mk-ship>Add shipment</button>' : '') +
      '<h3 class="caps drawer-h">Documents</h3>' + fileList(o.documents, { manage: can('documents') }) + uploader('order', o.id, ['commercial_invoice', 'packing_list', 'certificate_of_origin', 'inspection_report', 'shipping_document', 'quotation', 'other']) +
      '<form class="form" data-detail><h3 class="caps drawer-h">Update order</h3><div class="form-row">' + sel('status', 'Order status', ST.order, o.status) + sel('payment_status', 'Payment status', ST.payment, o.payment_status) + '</div>' +
      inp('payment_info', 'Payment information', o.payment_info, 'maxlength="1000" placeholder="e.g. Deposit USD 495 received 12 Nov by bank transfer"') +
      '<div class="form-row">' + inp('shipping_method', 'Shipping method', o.shipping_method, 'maxlength="80"') + inp('delivery_address', 'Delivery address', o.delivery_address, 'maxlength="800"') + '</div>' +
      area('buyer_notes', 'Order notes <span class="muted">(visible to buyer)</span>', o.buyer_notes, 'maxlength="2000"') + area('message', 'Update message to buyer <span class="muted">(added to timeline, emailed)</span>', '', 'maxlength="2000"') +
      area('admin_note', 'Internal note', o.admin_note, 'maxlength="2000"') + '<button class="btn" type="submit">Save</button></form>' + history(o.history),
    function (d) {
      bindFiles(d, reopen);
      var f = $('[data-detail]', d);
      submitWith(f, function () { return call('apparel_admin_update_order', { p_id: o.id, p: { status: f.status.value, payment_status: f.payment_status.value, payment_info: val(f, 'payment_info'), shipping_method: val(f, 'shipping_method'), delivery_address: val(f, 'delivery_address'), buyer_notes: val(f, 'buyer_notes'), message: val(f, 'message'), admin_note: val(f, 'admin_note') } }); });
      var mp = $('[data-mk-prod]', d); if (mp) mp.onclick = function () { productionForm({ order_id: o.id, order: { code: o.code } }); };
      var ms = $('[data-mk-ship]', d); if (ms) ms.onclick = function () { shipmentForm({ order_id: o.id, destination: o.delivery_address, order: { code: o.code } }); };
    });
  }

  /* ---------- production & QC ---------- */
  VIEWS.production = async function () {
    var f = filt.production || {};
    var rows = (await call('apparel_admin_production_list', { p_status: f.status || null })).filter(function (p) { return matchQ([p.code, p.order, p.assigned_team], f.q); });
    main().innerHTML = head('Factory', 'Production & quality control') + filterBar('production', ST.production) +
      table(['Production', 'Order', 'Team', 'Progress', 'Due', 'Last QC', 'Status'], rows.map(function (p, i) {
        var done = p.stages.filter(function (s) { return s.status === 'done' || s.status === 'skipped'; }).length;
        var late = p.expected_completion && p.status !== 'completed' && p.expected_completion < new Date().toISOString().slice(0, 10);
        return [link(i, p.code), esc((p.order || {}).code) + '<br><span class="muted">' + esc((p.order || {}).company || '') + '</span>', esc(p.assigned_team || '—'),
          '<div class="progress" title="' + done + ' of 9 stages"><i style="width:' + Math.round(done / 9 * 100) + '%"></i></div><span class="muted">' + p.completed_qty + ' / ' + p.quantity + ' pcs</span>',
          (p.expected_completion ? fmtD(p.expected_completion) : '—') + (late ? ' <span class="status status--rejected">Late</span>' : ''), p.qc[0] ? badge(p.qc[0].result) : '—', badge(p.status)];
      }), 'No production orders. Create one from an order.');
    bindFilter('production');
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () { productionDetail(rows[+b.dataset.open]); }; });
  };
  function productionForm(p) {
    drawer('<h2 class="h3">' + (p.id ? 'Edit ' + esc(p.code) : 'New production order for ' + esc((p.order || {}).code || '')) + '</h2><form class="form" data-prod-form>' +
      (p.id ? sel('status', 'Status', ST.production, p.status) : '') +
      '<div class="form-row">' + inp('quantity', 'Production quantity', p.quantity, 'type="number" min="0"' + (p.id ? '' : ' placeholder="Defaults to order quantity"')) + inp('completed_qty', 'Completed quantity', p.completed_qty || 0, 'type="number" min="0"') + '</div>' +
      '<div class="form-row">' + inp('start_date', 'Start date', p.start_date, 'type="date"') + inp('expected_completion', 'Expected completion', p.expected_completion, 'type="date"') + '</div>' +
      (p.id ? inp('actual_completion', 'Actual completion', p.actual_completion, 'type="date"') : '') + inp('assigned_team', 'Assigned team', p.assigned_team, 'maxlength="120"') + area('notes', 'Production notes', p.notes, 'maxlength="4000"') +
      '<button class="btn" type="submit">Save</button></form>',
    function (d) {
      var f = $('[data-prod-form]', d);
      submitWith(f, function () {
        if (+f.completed_qty.value > +(f.quantity.value || Infinity)) throw new Error('Completed quantity cannot exceed production quantity.');
        return call('apparel_admin_save_production', { p: { id: p.id || null, order_id: p.order_id, status: f.status ? f.status.value : null, quantity: f.quantity.value, completed_qty: f.completed_qty.value, start_date: f.start_date.value, expected_completion: f.expected_completion.value, actual_completion: f.actual_completion ? f.actual_completion.value : '', assigned_team: val(f, 'assigned_team'), notes: val(f, 'notes') } });
      }, function () { closeDrawer(); location.hash === '#production' ? route() : (location.hash = 'production'); });
    });
  }
  function productionDetail(p) {
    var reopen = async function () { var all = await call('apparel_admin_production_list', { p_status: null }); var x = all.filter(function (y) { return y.id === p.id; })[0]; if (x) productionDetail(x); };
    var CHK = ['fabric', 'measurements', 'stitching', 'printing', 'color', 'finishing', 'packaging'];
    var CHKL = { fabric: 'Fabric quality', measurements: 'Measurements', stitching: 'Stitching quality', printing: 'Printing quality', color: 'Colour consistency', finishing: 'Finishing', packaging: 'Packaging' };
    drawer('<h2 class="h3">' + esc(p.code) + ' ' + badge(p.status) + '</h2><p class="muted">Order ' + esc((p.order || {}).code) + ' · ' + esc((p.order || {}).company || '') + '</p>' +
      dl([['Quantity', p.completed_qty + ' of ' + p.quantity + ' completed (' + (p.quantity - p.completed_qty) + ' pending)'], ['Start', fmtD(p.start_date)], ['Expected completion', fmtD(p.expected_completion)], ['Actual completion', fmtD(p.actual_completion)], ['Team', esc(p.assigned_team)], ['Notes', esc(p.notes)]]) +
      '<p>' + p.lines.map(function (l) { return esc(l.product_name) + ' · ' + esc(colorName(l.color)) + ' · ' + esc(sizesTxt(l.sizes)); }).join('<br>') + '</p>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-edit-prod>Edit production details</button>' +
      '<h3 class="caps drawer-h">Stages</h3><ol class="stage-list">' + p.stages.map(function (s) {
        return '<li><span class="stage-name">' + esc(L(s.stage)) + '</span><select class="input" data-stage="' + s.stage + '" aria-label="' + esc(L(s.stage)) + ' status">' + opts(ST.stage, s.status) + '</select><span class="muted">' + (s.completed_at ? 'Done ' + fmtD(s.completed_at) : s.started_at ? 'Started ' + fmtD(s.started_at) : '') + '</span></li>';
      }).join('') + '</ol>' +
      '<h3 class="caps drawer-h">Quality inspections</h3>' + (p.qc.length ? p.qc.map(function (q) {
        return '<div class="quote-card"><header><b>' + fmtD(q.inspected_on) + (q.inspector ? ' · ' + esc(q.inspector) : '') + '</b>' + badge(q.result) + '</header><p class="muted">Sample ' + (q.sample_size || '—') + ' · defects ' + q.defects_found + '</p>' +
          '<p>' + CHK.filter(function (k) { return q.checklist[k]; }).map(function (k) { return esc(CHKL[k]) + ': ' + badge(q.checklist[k]); }).join(' ') + '</p>' + (q.defects ? '<p class="pre">' + esc(q.defects) + '</p>' : '') + (q.notes ? '<p class="pre muted">' + esc(q.notes) + '</p>' : '') +
          fileList(q.photos) + uploader('qc', q.id, ['inspection_photo', 'inspection_report']) + '</div>';
      }).join('') : '<p class="muted" style="margin:0">No inspections recorded.</p>') +
      (can('qc') ? '<form class="form" data-qc-form><h3 class="caps drawer-h">Record inspection</h3><div class="qc-grid">' + CHK.map(function (k) { return '<label>' + CHKL[k] + '<select class="input" name="chk_' + k + '">' + opts(['pass', 'fail', 'na'], 'pass') + '</select></label>'; }).join('') + '</div>' +
        '<div class="form-row">' + inp('inspected_on', 'Date', new Date().toISOString().slice(0, 10), 'type="date"') + inp('inspector', 'Inspector', '', 'maxlength="120"') + '</div>' +
        '<div class="form-row">' + inp('sample_size', 'Sample size (pcs)', '', 'type="number" min="0"') + inp('defects_found', 'Defects found', 0, 'type="number" min="0"') + '</div>' +
        area('defects', 'Defect records', '', 'maxlength="4000" placeholder="e.g. 2 pcs uneven hem (size L)"') + area('notes', 'QC notes', '', 'maxlength="4000"') +
        sel('result', 'Result', ['pass', 'fail'], 'pass') + '<button class="btn" type="submit">Save inspection</button><p class="hint">Inspection photos can be uploaded after saving.</p></form>' : ''),
    function (d) {
      bindFiles(d, reopen);
      $('[data-edit-prod]', d).onclick = function () { productionForm(p); };
      $$('[data-stage]', d).forEach(function (s) { s.onchange = async function () { try { await call('apparel_admin_update_stage', { p_production: p.id, p_stage: s.dataset.stage, p_status: s.value, p_note: null }); toast('Stage updated'); reopen(); } catch (e) { toast(SB.message(e)); } }; });
      var qf = $('[data-qc-form]', d);
      if (qf) submitWith(qf, function () {
        var chk = {}; CHK.forEach(function (k) { chk[k] = qf['chk_' + k].value; });
        return call('apparel_admin_save_qc', { p: { production_id: p.id, inspected_on: qf.inspected_on.value, inspector: val(qf, 'inspector'), sample_size: qf.sample_size.value, defects_found: qf.defects_found.value, defects: val(qf, 'defects'), notes: val(qf, 'notes'), result: qf.result.value, checklist: chk } });
      }, reopen);
    });
  }

  /* ---------- shipping ---------- */
  VIEWS.shipping = async function () {
    var rows = await call('apparel_admin_shipments');
    main().innerHTML = head('Logistics', 'Shipping & export') + '<p class="hint" style="margin:-8px 0 20px">Tracking numbers are entered by staff; carrier tracking is not automated.</p>' +
      table(['Shipment', 'Order', 'Method', 'Carrier', 'Tracking', 'Dispatched', 'ETA', 'Status'], rows.map(function (s, i) {
        return [link(i, s.code), esc((s.order || {}).code), esc(L(s.method) || '—'), esc(s.provider || '—'), esc(s.tracking_number || '—'), fmtD(s.dispatch_date) || '—', fmtD(s.estimated_delivery) || '—', badge(s.status)];
      }), 'No shipments yet. Add one from an order.');
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () { shipmentForm(rows[+b.dataset.open]); }; });
  };
  function shipmentForm(s) {
    var reopen = async function () { var all = await call('apparel_admin_shipments'); var x = all.filter(function (y) { return y.id === s.id; })[0]; if (x) shipmentForm(x); };
    drawer('<h2 class="h3">' + (s.id ? esc(s.code) + ' ' + badge(s.status) : 'New shipment') + '</h2><p class="muted">Order ' + esc((s.order || {}).code || '') + '</p><form class="form" data-ship-form>' +
      '<div class="form-row">' + sel('status', 'Status', ST.shipment, s.status || 'preparing') + sel('method', 'Method', ['express_courier', 'air_freight', 'sea_freight', 'road', 'buyer_pickup'], s.method, null, 'Select…') + '</div>' +
      '<div class="form-row">' + inp('provider', 'Carrier / forwarder', s.provider, 'maxlength="80"') + inp('tracking_number', 'Tracking number', s.tracking_number, 'maxlength="80"') + '</div>' +
      inp('destination', 'Destination', s.destination, 'maxlength="200"') +
      '<div class="form-row">' + inp('dispatch_date', 'Dispatch date', s.dispatch_date, 'type="date"') + inp('estimated_delivery', 'Estimated delivery', s.estimated_delivery, 'type="date"') + '</div>' +
      '<div class="form-row">' + inp('cost', 'Shipping cost (internal)', s.cost, 'type="number" min="0" step="0.01"') + sel('currency', 'Currency', ['USD', 'EUR', 'GBP'], s.currency || 'USD', String) + '</div>' +
      area('notes', 'Shipping notes <span class="muted">(visible to buyer)</span>', s.notes, 'maxlength="2000"') + '<button class="btn" type="submit">Save shipment</button></form>' +
      (s.id ? '<h3 class="caps drawer-h">Shipping documents</h3>' + fileList(s.documents, { manage: can('documents') }) + uploader('shipment', s.id, ['commercial_invoice', 'packing_list', 'shipping_document', 'certificate_of_origin', 'inspection_report', 'other']) : ''),
    function (d) {
      bindFiles(d, reopen);
      var f = $('[data-ship-form]', d);
      submitWith(f, function () { return call('apparel_admin_save_shipment', { p: { id: s.id || null, order_id: s.order_id, status: f.status.value, method: f.method.value || null, provider: val(f, 'provider'), tracking_number: val(f, 'tracking_number'), destination: val(f, 'destination'), dispatch_date: f.dispatch_date.value, estimated_delivery: f.estimated_delivery.value, cost: f.cost.value, currency: f.currency.value, notes: val(f, 'notes') } }); },
        function () { closeDrawer(); location.hash === '#shipping' ? route() : (location.hash = 'shipping'); });
    });
  }

  /* ---------- samples, inquiries ---------- */
  VIEWS.samples = async function () {
    var f = filt.samples || {};
    var rows = (await call('apparel_admin_samples', { p_status: f.status || null })).filter(function (r) { return matchQ([r.code, r.buyer, r.product_name], f.q); });
    main().innerHTML = head('Sales', 'Sample requests') + filterBar('samples', ST.sample) +
      table(['Ref', 'Buyer', 'Item', 'Received', 'Status'], rows.map(function (r, i) { return [link(i, r.code, !r.seen_by_admin), esc((r.buyer || {}).company_name || (r.buyer || {}).contact_person || '—'), esc(r.product_name), fmtD(r.created_at), badge(r.status)]; }));
    bindFilter('samples');
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () {
      var r = rows[+b.dataset.open];
      if (!r.seen_by_admin) call('apparel_admin_mark_seen', { p_kind: 'sample', p_id: r.id }).then(refreshOv).catch(function () {});
      drawer('<h2 class="h3">' + esc(r.code) + ' ' + badge(r.status) + '</h2><p class="muted">' + fmt(r.created_at) + '</p>' + dl([['Buyer', esc((r.buyer || {}).company_name || (r.buyer || {}).contact_person)], ['Email', esc((r.buyer || {}).email)], ['Item', esc(r.product_name)], ['Colour / size', esc([colorName(r.color), r.size].filter(Boolean).join(' · '))], ['Fabric', esc([r.fabric, r.gsm ? r.gsm + ' GSM' : ''].filter(Boolean).join(' · '))], ['Deliver to', esc(r.delivery_address)], ['Buyer notes', esc(r.notes)]]) +
        '<form class="form" data-detail>' + sel('status', 'Status', ST.sample, r.status) + '<div class="form-row">' + inp('courier', 'Courier', r.courier, 'maxlength="80"') + inp('tracking', 'Tracking number', r.tracking_number, 'maxlength="80"') + '</div>' + area('message', 'Message to buyer', '', 'maxlength="2000"') + area('note', 'Internal note', r.admin_note, 'maxlength="2000"') + '<button class="btn" type="submit">Save</button></form>' + history(r.history),
      function (d) { var fm = $('[data-detail]', d); submitWith(fm, async function () { await call('apparel_admin_update_sample', { p_id: r.id, p_status: fm.status.value, p_courier: val(fm, 'courier') || null, p_tracking: val(fm, 'tracking') || null, p_note: val(fm, 'note') || null }); if (val(fm, 'message')) await call('apparel_admin_message', { p_entity: 'sample', p_id: r.id, p_note: val(fm, 'message') }); }); });
    }; });
  };
  VIEWS.inquiries = async function () {
    var f = filt.inquiries || {};
    var rows = (await call('apparel_admin_inquiries', { p_status: f.status || null })).filter(function (r) { return matchQ([r.code, r.subject, r.email, r.company, r.contact_name], f.q); });
    main().innerHTML = head('Sales', 'Inquiries') + filterBar('inquiries', ST.inquiry) +
      table(['Ref', 'Type', 'Subject', 'From', 'Country', 'Received', 'Status'], rows.map(function (r, i) { return [link(i, r.code, !r.seen_by_admin), esc(r.kind), esc(r.subject), esc(r.contact_name || r.email), esc(r.country || '—'), fmtD(r.created_at), badge(r.status)]; }));
    bindFilter('inquiries');
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () {
      var r = rows[+b.dataset.open], det = r.details || {};
      if (!r.seen_by_admin) call('apparel_admin_mark_seen', { p_kind: 'inquiry', p_id: r.id }).then(refreshOv).catch(function () {});
      drawer('<h2 class="h3">' + esc(r.code) + ' ' + badge(r.status) + '</h2><p class="muted">' + fmt(r.created_at) + ' · ' + esc(r.kind) + '</p>' +
        dl([['Subject', esc(r.subject)], ['Name', esc(r.contact_name)], ['Email', '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>'], ['Phone', r.phone ? '<a href="https://wa.me/' + esc(String(r.phone).replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + esc(r.phone) + '</a>' : ''], ['Company', esc(r.company)], ['Country', esc(r.country)], ['Message', r.message ? '<span class="pre">' + esc(r.message) + '</span>' : '']]) +
        (Object.keys(det).length ? '<h3 class="caps drawer-h">Submitted details</h3>' + dl(Object.keys(det).map(function (k) { return [esc(k), '<span class="pre">' + esc(det[k]) + '</span>']; })) : '') +
        '<form class="form" data-detail>' + sel('status', 'Status', ST.inquiry, r.status) + area('note', 'Internal note', r.admin_note, 'maxlength="2000"') + '<button class="btn" type="submit">Save</button></form>',
      function (d) { var fm = $('[data-detail]', d); submitWith(fm, function () { return call('apparel_admin_update_inquiry', { p_id: r.id, p_status: fm.status.value, p_note: val(fm, 'note') || null }); }); });
    }; });
  };

  /* ---------- buyers & messages ---------- */
  VIEWS.buyers = async function () {
    var f = filt.buyers || {};
    var rows = (await call('apparel_admin_buyers', { p_status: f.status || null })).filter(function (r) { return matchQ([r.company_name, r.contact_person, r.email, r.country], f.q); });
    main().innerHTML = head('Customers', 'Buyers', '<button class="btn btn--ghost btn--sm" type="button" data-csv>Export CSV</button>') + filterBar('buyers', ST.buyer) +
      table(['Company', 'Contact', 'Country', 'Type', 'Activity', 'Registered', 'Status'], rows.map(function (r, i) {
        return [link(i, r.company_name || r.contact_person, r.unread > 0), esc(r.contact_person) + '<br><span class="muted">' + esc(r.email) + '</span>', esc(r.country || '—'), esc(r.business_type || '—') + (r.wholesale_requested ? '<br><span class="muted">Wholesale</span>' : ''),
          r.rfq_count + ' RFQ · ' + r.order_count + ' orders' + (r.unread ? '<br><span class="status status--new">' + r.unread + ' unread</span>' : ''), fmtD(r.created_at), badge(r.status)];
      }));
    bindFilter('buyers');
    $('[data-csv]', root).onclick = function () { csv('buyers', ['company_name', 'contact_person', 'email', 'phone', 'country', 'business_type', 'est_volume', 'status', 'rfq_count', 'order_count', 'created_at'], rows); };
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () { buyerDetail(rows[+b.dataset.open]); }; });
  };
  async function buyerDetail(r) {
    var msgs = can('messages') ? await call('apparel_admin_messages', { p_buyer: r.user_id }) : [];
    drawer('<h2 class="h3">' + esc(r.company_name || r.contact_person) + ' ' + badge(r.status) + '</h2><p class="muted">Registered ' + fmt(r.created_at) + '</p>' +
      dl([['Contact', esc(r.contact_person)], ['Email', '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>'], ['Phone', esc(r.phone)], ['Country', esc(r.country)], ['Website', r.website ? '<a href="' + esc(r.website) + '" target="_blank" rel="noopener nofollow">' + esc(r.website) + '</a>' : ''], ['Business type', esc(r.business_type)], ['Est. volume', esc(r.est_volume)], ['Wholesale', r.wholesale_requested ? 'Requested' : 'Not requested'], ['Activity', r.rfq_count + ' RFQ · ' + r.order_count + ' orders · ' + r.sample_count + ' samples']]) +
      '<form class="form" data-detail>' + sel('status', 'Buyer status', ST.buyer, r.status) + area('note', 'Internal note', r.admin_note, 'maxlength="2000"') + '<button class="btn" type="submit">Save</button></form>' +
      (can('messages') ? '<h3 class="caps drawer-h">Support messages</h3><div class="chat">' + (msgs.length ? msgs.map(function (m) { return '<div class="msg' + (m.from_admin ? ' msg--me' : '') + '"><p>' + esc(m.body) + '</p><span>' + (m.from_admin ? esc(m.by || 'Staff') : 'Buyer') + ' · ' + fmt(m.created_at) + '</span></div>'; }).join('') : '<p class="muted">No messages yet.</p>') + '</div>' +
        '<form class="form" data-msg>' + area('body', 'Reply', '', 'maxlength="4000" required') + '<button class="btn btn--ghost" type="submit">Send message</button></form>' : ''),
    function (d) {
      var f = $('[data-detail]', d);
      submitWith(f, function () { return call('apparel_admin_update_buyer', { p_user: r.user_id, p_status: f.status.value, p_note: val(f, 'note') || null }); });
      var m = $('[data-msg]', d);
      if (m) submitWith(m, function () { if (!val(m, 'body')) throw new Error('Write a message first.'); return call('apparel_admin_send_message', { p_buyer: r.user_id, p_body: val(m, 'body') }); }, function () { r.unread = 0; buyerDetail(r); });
    });
  }

  /* ---------- CRM ---------- */
  VIEWS.crm = async function () {
    var f = filt.crm || {};
    var rows = (await call('apparel_admin_leads', { p_status: f.status || null })).filter(function (r) { return matchQ([r.code, r.company, r.contact_name, r.email, r.country], f.q); });
    var today = new Date().toISOString().slice(0, 10);
    var pipeline = ST.lead.map(function (s) { return '<div>' + badge(s) + '<b>' + rows.filter(function (r) { return r.status === s; }).length + '</b></div>'; }).join('');
    main().innerHTML = head('Sales', 'CRM — leads & pipeline', '<button class="btn btn--sm" type="button" data-new>New lead</button><button class="btn btn--ghost btn--sm" type="button" data-csv>Export CSV</button>') +
      '<div class="status-row" style="margin-bottom:20px">' + pipeline + '</div>' + filterBar('crm', ST.lead) +
      table(['Lead', 'Company / contact', 'Country', 'Source', 'Linked', 'Follow-up', 'Owner', 'Status'], rows.map(function (r, i) {
        var due = r.next_follow_up && r.next_follow_up <= today && ['converted', 'lost'].indexOf(r.status) === -1;
        return [link(i, r.code), esc(r.company || '—') + '<br><span class="muted">' + esc(r.contact_name || '') + ' ' + esc(r.email || '') + '</span>', esc(r.country || '—'), esc(r.source), r.rfq_count + ' RFQ · ' + r.order_count + ' orders · ' + r.inquiry_count + ' inq.',
          r.next_follow_up ? fmtD(r.next_follow_up) + (due ? ' <span class="status status--rejected">Due</span>' : '') : '—', esc(r.assigned_email || '—'), badge(r.status)];
      }), 'No leads yet. Leads are created automatically from registrations, inquiries and quotation requests.');
    bindFilter('crm');
    $('[data-new]', root).onclick = function () { leadForm({}); };
    $('[data-csv]', root).onclick = function () { csv('leads', ['code', 'company', 'contact_name', 'email', 'phone', 'country', 'source', 'status', 'assigned_email', 'next_follow_up', 'rfq_count', 'order_count', 'created_at'], rows); };
    $$('[data-open]', root).forEach(function (b) { b.onclick = async function () { try { leadForm(await call('apparel_admin_lead_detail', { p_id: rows[+b.dataset.open].id })); } catch (e) { toast(SB.message(e)); } }; });
  };
  function leadForm(l) {
    var list = function (title, arr, fn) { return '<h3 class="caps drawer-h">' + title + '</h3>' + (arr && arr.length ? '<ul class="doc-list">' + arr.map(fn).join('') + '</ul>' : '<p class="muted" style="margin:0">None.</p>'); };
    drawer('<h2 class="h3">' + (l.id ? esc(l.code) + ' ' + badge(l.status) : 'New lead') + '</h2><form class="form" data-lead-form>' +
      (l.id ? '' : inp('email', 'Email', '', 'type="email" maxlength="200"') + sel('source', 'Source', ['whatsapp', 'referral', 'trade_show', 'email', 'website', 'other'], 'whatsapp', function (x) { return x.replace(/_/g, ' '); })) +
      '<div class="form-row">' + inp('company', 'Company', l.company, 'maxlength="160"') + inp('contact_name', 'Contact', l.contact_name, 'maxlength="120"') + '</div>' +
      '<div class="form-row">' + inp('phone', 'Phone / WhatsApp', l.phone, 'maxlength="40"') + inp('country', 'Country', l.country, 'maxlength="80"') + '</div>' +
      '<div class="form-row">' + sel('status', 'Lead status', ST.lead, l.status || 'new') + inp('next_follow_up', 'Next follow-up', l.next_follow_up, 'type="date"') + '</div>' +
      inp('assigned_email', 'Assigned sales rep (staff email)', l.assigned_email || (l.assigned_to ? '' : ''), 'type="email" maxlength="200"') + area('notes', 'Notes', l.notes, 'maxlength="4000"') + '<button class="btn" type="submit">Save lead</button></form>' +
      (l.id ? '<form class="form" data-act-form><h3 class="caps drawer-h">Log communication</h3><div class="form-row">' + sel('kind', 'Type', ['call', 'email', 'whatsapp', 'meeting', 'note'], 'call') + '<div></div></div>' + area('body', 'Summary', '', 'maxlength="4000" required') + '<button class="btn btn--ghost" type="submit">Add to history</button></form>' +
        '<h3 class="caps drawer-h">Communication history</h3><ol class="timeline">' + (l.activities || []).map(function (a) { return '<li><span class="t-date">' + fmt(a.at) + (a.by ? ' · ' + esc(a.by) : '') + '</span><b>' + esc(a.kind) + '</b><p>' + esc(a.body) + '</p></li>'; }).join('') + '</ol>' +
        list('Quotation requests', l.rfqs, function (x) { return '<li>' + esc(x.code) + ' ' + badge(x.status) + ' <span class="muted">' + fmtD(x.created_at) + '</span></li>'; }) +
        list('Orders', l.orders, function (x) { return '<li>' + esc(x.code) + ' ' + badge(x.status) + ' <span class="muted">' + money(x.currency, x.total) + '</span></li>'; }) +
        list('Inquiries', l.inquiries, function (x) { return '<li>' + esc(x.code) + ' · ' + esc(x.subject) + ' ' + badge(x.status) + '</li>'; }) : ''),
    function (d) {
      var f = $('[data-lead-form]', d);
      submitWith(f, function () { return call('apparel_admin_save_lead', { p: { id: l.id || null, email: f.email ? val(f, 'email') : null, source: f.source ? f.source.value : null, company: val(f, 'company'), contact_name: val(f, 'contact_name'), phone: val(f, 'phone'), country: val(f, 'country'), status: f.status.value, next_follow_up: f.next_follow_up.value, assigned_email: val(f, 'assigned_email'), notes: val(f, 'notes') } }); });
      var a = $('[data-act-form]', d);
      if (a) submitWith(a, function () { return call('apparel_admin_add_activity', { p_lead: l.id, p_kind: a.kind.value, p_body: val(a, 'body') }); }, async function () { leadForm(await call('apparel_admin_lead_detail', { p_id: l.id })); });
    });
  }

  /* ---------- suppliers ---------- */
  VIEWS.suppliers = async function () {
    var rows = await call('apparel_admin_suppliers');
    main().innerHTML = head('Sourcing', 'Suppliers', '<button class="btn btn--sm" type="button" data-new>New supplier</button>') +
      table(['Supplier', 'Contact', 'Country', 'Materials', 'Payment terms', 'Status'], rows.map(function (s, i) { return [link(i, s.name) + (s.company ? '<br><span class="muted">' + esc(s.company) + '</span>' : ''), esc(s.contact_person || '') + '<br><span class="muted">' + esc(s.email || '') + ' ' + esc(s.phone || '') + '</span>', esc(s.country || '—'), esc((s.categories || []).join(', ') || '—'), esc(s.payment_terms || '—'), badge(s.status)]; }), 'No suppliers yet.');
    $('[data-new]', root).onclick = function () { supplierForm({}); };
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () { supplierForm(rows[+b.dataset.open]); }; });
  };
  function supplierForm(s) {
    var CATS_M = ['Fabric', 'Yarn', 'Trims', 'Labels', 'Packaging', 'Printing', 'Embroidery', 'Dyeing', 'Washing', 'Logistics'];
    drawer('<h2 class="h3">' + (s.id ? esc(s.name) : 'New supplier') + '</h2><form class="form" data-sup-form>' +
      '<div class="form-row">' + inp('name', 'Supplier name *', s.name, 'required maxlength="160"') + inp('company', 'Company', s.company, 'maxlength="160"') + '</div>' +
      '<div class="form-row">' + inp('contact_person', 'Contact person', s.contact_person, 'maxlength="120"') + inp('email', 'Email', s.email, 'type="email" maxlength="200"') + '</div>' +
      '<div class="form-row">' + inp('phone', 'Phone', s.phone, 'maxlength="40"') + inp('country', 'Country', s.country, 'maxlength="80"') + '</div>' +
      area('address', 'Address', s.address, 'maxlength="600"') + '<div class="field"><span class="field-label">Material categories</span>' + chips('categories', CATS_M, s.categories) + '</div>' +
      area('products', 'Products supplied', s.products, 'maxlength="2000"') + inp('payment_terms', 'Payment terms', s.payment_terms, 'maxlength="400"') + area('notes', 'Internal notes', s.notes, 'maxlength="4000"') +
      sel('status', 'Status', ST.supplier, s.status || 'active') + '<div class="actions tight"><button class="btn" type="submit">Save supplier</button>' + (s.id ? '<button class="q-remove" type="button" data-del>Delete supplier</button>' : '') + '</div></form>',
    function (d) {
      var f = $('[data-sup-form]', d);
      submitWith(f, function () { return call('apparel_admin_save_supplier', { p: { id: s.id || null, name: val(f, 'name'), company: val(f, 'company'), contact_person: val(f, 'contact_person'), email: val(f, 'email'), phone: val(f, 'phone'), country: val(f, 'country'), address: val(f, 'address'), categories: checked(f, 'categories'), products: val(f, 'products'), payment_terms: val(f, 'payment_terms'), notes: val(f, 'notes'), status: f.status.value } }); });
      var del = $('[data-del]', d);
      if (del) del.onclick = async function () { if (!window.confirm('Delete ' + s.name + '?')) return; try { await call('apparel_admin_delete_supplier', { p_id: s.id }); toast('Deleted'); closeDrawer(); route(); } catch (e) { toast(SB.message(e)); } };
    });
  }

  /* ---------- catalog ---------- */
  function catName(s) { var c = CATS.filter(function (x) { return x.slug === s; })[0]; return c ? c.name : s; }
  async function loadCatalog() { catalogCache = await call('apparel_admin_catalog'); return catalogCache; }
  function mediaPicker(folder, paths) {
    return '<div class="field"><span class="field-label">Images <span class="muted">(JPG, PNG or WebP, max 8 MB; first image is the main image)</span></span><ul class="media-list" data-media>' +
      (paths || []).map(function (p) { return mediaItem(p); }).join('') + '</ul><input class="input" type="file" accept=".jpg,.jpeg,.png,.webp" multiple data-media-input="' + folder + '"></div>';
  }
  function mediaItem(p) { return '<li data-path="' + esc(p) + '"><img src="' + esc(F.mediaUrl(p)) + '" alt="" loading="lazy"><div><button type="button" class="q-remove" data-mv="-1" aria-label="Move earlier">↑</button><button type="button" class="q-remove" data-mv="1" aria-label="Move later">↓</button><button type="button" class="q-remove" data-rm-media>Remove</button></div></li>'; }
  function bindMedia(d) {
    var list = $('[data-media]', d), input = $('[data-media-input]', d);
    if (!list) return;
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li'); if (!li) return;
      if (e.target.matches('[data-rm-media]')) li.remove();
      if (e.target.matches('[data-mv]')) { var dir = +e.target.dataset.mv; if (dir < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling); if (dir > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li); }
    });
    input.onchange = async function () {
      var files = Array.prototype.slice.call(input.files); input.value = '';
      for (var i = 0; i < files.length; i++) {
        try { toast('Uploading ' + files[i].name + '…'); var p = await F.uploadMedia(input.dataset.mediaInput, files[i]); list.insertAdjacentHTML('beforeend', mediaItem(p)); } catch (e) { toast(e.message ? SB.message(e) : 'Upload failed'); }
      }
    };
  }
  var mediaPaths = function (d) { return $$('[data-media] li', d).map(function (li) { return li.dataset.path; }); };
  function catalogList(kind, rows) {
    var live = function (on) { return on ? '<span class="status status--verified">Live</span>' : '<span class="status status--closed">Hidden</span>'; };
    var thumb = function (imgs) { return imgs && imgs.length ? '<img class="thumb-sm" src="' + esc(F.mediaUrl(imgs[0])) + '" alt="">' : ''; };
    if (kind === 'products') return table(['', 'ID / SKU', 'Name', 'Category', 'Collection', 'Fabric · GSM', 'Status'], rows.map(function (p, i) { return [thumb(p.images), esc(p.id) + '<br><span class="muted">' + esc(p.sku) + '</span>', link(i, p.name), esc(catName(p.category)), esc(p.collection || '—'), esc(p.fabric) + ' · ' + p.gsm, live(p.published) + (p.featured ? ' <span class="muted">Featured</span>' : '')]; }));
    if (kind === 'fabrics') return table(['', 'Slug', 'Name', 'Composition', 'GSM', 'Status'], rows.map(function (f, i) { return [thumb(f.images), esc(f.slug), link(i, f.name), esc(f.composition), esc(f.gsm.join(', ')), live(f.published)]; }));
    return table(['', 'Order', 'Name', 'Categories', 'Products', 'Status'], rows.map(function (c, i) { return [c.banner ? '<img class="thumb-sm" src="' + esc(F.mediaUrl(c.banner)) + '" alt="">' : '', c.sort, link(i, c.name), esc(c.categories.map(catName).join(', ')), catalogCache.products.filter(function (p) { return p.collection === c.slug; }).length, live(c.published)]; }));
  }
  function catalogView(kind) {
    return async function () {
      var data = await loadCatalog();
      var f = filt[kind] || {};
      var rows = data[kind].filter(function (x) { return matchQ([x.name, x.id, x.sku, x.slug], f.q); });
      main().innerHTML = head('Catalog', kind.charAt(0).toUpperCase() + kind.slice(1), '<button class="btn btn--sm" type="button" data-new>New ' + kind.slice(0, -1) + '</button>') +
        '<form class="admin-filters" data-filters><label>Search <input class="input" name="q" value="' + esc(f.q || '') + '" placeholder="Name, ID, SKU…"></label></form>' +
        '<p class="hint" style="margin:0 0 20px">Changes appear on the public website immediately.</p>' + catalogList(kind, rows);
      var ff = $('[data-filters]', root); ff.onsubmit = function (e) { e.preventDefault(); }; ff.q.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); filt[kind] = { q: ff.q.value.trim() }; route(); } };
      $('[data-new]', root).onclick = function () { editItem(kind, null); };
      $$('[data-open]', root).forEach(function (b) { b.onclick = function () { editItem(kind, rows[+b.dataset.open]); }; });
    };
  }
  VIEWS.products = catalogView('products'); VIEWS.fabrics = catalogView('fabrics'); VIEWS.collections = catalogView('collections');
  function editItem(kind, it) {
    var fabrics = catalogCache.fabrics.map(function (f) { return f.slug; });
    var cols = catalogCache.collections.map(function (c) { return c.slug; });
    var body;
    if (kind === 'products') {
      it = it || { colors: [], sizes: ['S', 'M', 'L', 'XL'], published: true, fit: 'Regular', shape: 'crew', gsm: 180, category: CATS[0].slug, fabric: fabrics[0], printing_options: ['Screen printing', 'DTG printing', 'DTF printing'], embroidery_options: ['Flat embroidery', '3D puff embroidery'], customizable: true, private_label: true, price_tiers: [], images: [] };
      body = '<h2 class="h3">' + (it.id ? 'Edit ' + esc(it.id) : 'New product') + '</h2><form class="form" data-edit-form>' +
        '<div class="form-row">' + inp('name', 'Product name *', it.name, 'required maxlength="120"') + inp('sku', 'SKU', it.sku, 'maxlength="40" placeholder="Generated if empty"') + '</div>' +
        '<div class="form-row">' + sel('category', 'Category', CATS.map(function (c) { return c.slug; }), it.category, catName) + sel('collection', 'Collection', cols, it.collection, null, 'None') + '</div>' +
        area('description', 'Description', it.description, 'maxlength="2000"') + mediaPicker('products/' + (it.id || 'new'), it.images) +
        '<h3 class="caps drawer-h">Technical specifications</h3><div class="form-row">' + sel('fabric', 'Fabric', fabrics, it.fabric) + inp('gsm', 'GSM *', it.gsm, 'type="number" min="80" max="500" required') + '</div>' +
        '<div class="form-row">' + inp('fit', 'Fit type', it.fit, 'maxlength="40"') + inp('weight_g', 'Product weight (g)', it.weight_g, 'type="number" min="0" max="5000"') + '</div>' +
        sel('shape', 'Silhouette (illustration used when no photos)', SHAPES, it.shape, String) +
        '<div class="field"><span class="field-label">Colours *</span>' + chips('colors', COLOR_KEYS, it.colors, colorName) + '</div>' + '<div class="field"><span class="field-label">Sizes *</span>' + chips('sizes', SIZES, it.sizes) + '</div>' +
        '<div class="form-row">' + area('printing_options', 'Printing options (one per line)', (it.printing_options || []).join('\n')) + area('embroidery_options', 'Embroidery options (one per line)', (it.embroidery_options || []).join('\n')) + '</div>' +
        '<h3 class="caps drawer-h">Manufacturing</h3><div class="form-row">' + inp('moq', 'Minimum order quantity', it.moq, 'maxlength="120" placeholder="e.g. 300 pcs per colour"') + inp('lead_time', 'Estimated production time', it.lead_time, 'maxlength="120"') + '</div>' +
        check('customizable', 'Customisation available', it.customizable) + check('private_label', 'Private label available', it.private_label) + area('manufacturing_notes', 'Manufacturing notes <span class="muted">(staff only)</span>', it.manufacturing_notes, 'maxlength="2000"') +
        '<h3 class="caps drawer-h">Pricing <span class="muted">(shown to verified wholesale buyers only; public shows "Price on request")</span></h3><div class="form-row">' + inp('wholesale_price', 'Wholesale price (USD / pc)', it.wholesale_price, 'type="number" min="0" step="0.01"') + inp('tiers', 'Quantity tiers (min qty:price)', (it.price_tiers || []).map(function (t) { return t.min_qty + ':' + t.unit_price; }).join(', '), 'placeholder="500:4.50, 1000:4.20"') + '</div>' +
        '<div class="form-row">' + inp('sort', 'Display order', it.sort, 'type="number"') + '<div></div></div>' + check('published', 'Published on website', it.published) + check('featured', 'Featured on homepage', it.featured) +
        '<div class="actions tight"><button class="btn" type="submit">Save product</button>' + (it.id ? '<a class="btn btn--ghost" href="/products/view/?id=' + esc(it.id) + '" target="_blank" rel="noopener">View</a><button class="q-remove" type="button" data-del>Delete product</button>' : '') + '</div></form>';
    } else if (kind === 'fabrics') {
      it = it || { gsm: [], applications: [], care: [], colors: [], published: true, texture: 'jersey', images: [] };
      body = '<h2 class="h3">' + (it.slug ? 'Edit ' + esc(it.name) : 'New fabric') + '</h2><form class="form" data-edit-form>' + inp('name', 'Fabric name *', it.name, 'required maxlength="80"') + inp('composition', 'Composition *', it.composition, 'required maxlength="160"') +
        '<div class="form-row">' + inp('gsm', 'GSM options * (comma separated)', (it.gsm || []).join(', '), 'required') + sel('texture', 'Texture illustration', TEXTURES, it.texture, String) + '</div>' +
        mediaPicker('fabrics/' + (it.slug || 'new'), it.images) + area('description', 'Description', it.description) + area('applications', 'Applications / technical notes (one per line)', (it.applications || []).join('\n')) + area('care', 'Care instructions (one per line)', (it.care || []).join('\n')) +
        '<div class="field"><span class="field-label">Available colours</span>' + chips('colors', COLOR_KEYS, it.colors, colorName) + '</div>' + inp('sort', 'Display order', it.sort, 'type="number"') + check('published', 'Published on website', it.published) +
        '<div class="actions tight"><button class="btn" type="submit">Save fabric</button>' + (it.slug ? '<button class="q-remove" type="button" data-del>Delete fabric</button>' : '') + '</div></form>';
    } else {
      it = it || { categories: [], published: true };
      var assigned = catalogCache.products.filter(function (p) { return it.slug && p.collection === it.slug; }).map(function (p) { return p.id; });
      body = '<h2 class="h3">' + (it.slug ? 'Edit ' + esc(it.name) : 'New collection') + '</h2><form class="form" data-edit-form>' + inp('name', 'Name *', it.name, 'required maxlength="80"') + inp('kicker', 'Kicker', it.kicker, 'maxlength="80"') + area('lead', 'Introduction', it.lead, 'maxlength="400"') +
        mediaPicker('collections/' + (it.slug || 'new'), it.banner ? [it.banner] : []) +
        '<div class="field"><span class="field-label">Categories shown in this collection</span>' + chips('categories', CATS.map(function (c) { return c.slug; }), it.categories, catName) + '</div>' +
        '<div class="field"><span class="field-label">Assigned products</span>' + chips('product_ids', catalogCache.products.map(function (p) { return p.id; }), assigned, function (id) { var p = catalogCache.products.filter(function (x) { return x.id === id; })[0]; return p.name; }) + '</div>' +
        inp('sort', 'Display order', it.sort, 'type="number"') + check('published', 'Published on website', it.published) +
        '<div class="actions tight"><button class="btn" type="submit">Save collection</button>' + (it.slug ? '<button class="q-remove" type="button" data-del>Delete collection</button>' : '') + '</div></form>';
    }
    drawer(body, function (d) {
      bindMedia(d);
      var f = $('[data-edit-form]', d);
      var tiers = function (s) { return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { var p = x.split(':'); return { min_qty: p[0], unit_price: p[1] }; }); };
      submitWith(f, function () {
        try { sessionStorage.removeItem('sa_catalog'); } catch (x) { /* ignore */ }
        if (kind === 'products') return call('apparel_admin_save_product', { p: { id: it.id || null, name: val(f, 'name'), sku: val(f, 'sku'), category: f.category.value, collection: f.collection.value || null, description: val(f, 'description'), images: mediaPaths(d), fabric: f.fabric.value, gsm: +f.gsm.value, fit: val(f, 'fit'), weight_g: f.weight_g.value, shape: f.shape.value, colors: checked(f, 'colors'), sizes: checked(f, 'sizes'), printing_options: lines(f, 'printing_options'), embroidery_options: lines(f, 'embroidery_options'), moq: val(f, 'moq') || null, lead_time: val(f, 'lead_time') || null, customizable: f.customizable.checked, private_label: f.private_label.checked, manufacturing_notes: val(f, 'manufacturing_notes'), wholesale_price: f.wholesale_price.value, price_tiers: tiers(f.tiers.value), sort: f.sort.value, published: f.published.checked, featured: f.featured.checked, print: it.print || '', finish: it.finish || '' } });
        if (kind === 'fabrics') return call('apparel_admin_save_fabric', { p: { slug: it.slug || null, name: val(f, 'name'), composition: val(f, 'composition'), gsm: f.gsm.value.split(/[\s,]+/).filter(Boolean), texture: f.texture.value, images: mediaPaths(d), description: val(f, 'description'), applications: lines(f, 'applications'), care: lines(f, 'care'), colors: checked(f, 'colors'), sort: f.sort.value, published: f.published.checked } });
        return call('apparel_admin_save_collection', { p: { slug: it.slug || null, name: val(f, 'name'), kicker: val(f, 'kicker'), lead: val(f, 'lead'), banner: mediaPaths(d)[0] || null, categories: checked(f, 'categories'), product_ids: checked(f, 'product_ids'), sort: f.sort.value, published: f.published.checked } });
      });
      var del = $('[data-del]', d);
      if (del) del.onclick = async function () {
        if (!window.confirm('Delete ' + (it.name || '') + '? This cannot be undone. To remove it from the website only, untick Published instead.')) return;
        try {
          if (kind === 'products') await call('apparel_admin_delete_product', { p_id: it.id });
          else if (kind === 'fabrics') await call('apparel_admin_delete_fabric', { p_slug: it.slug });
          else await call('apparel_admin_delete_collection', { p_slug: it.slug });
          toast('Deleted'); closeDrawer(); route();
        } catch (e) { toast(SB.message(e)); }
      };
    });
  }

  /* ---------- website content ---------- */
  VIEWS.content = async function () {
    var data = await call('apparel_admin_content');
    var c = data.content || {}, fx = data.fx || {};
    var hero = c.hero || {}, ann = c.announcements || {}, about = c.about || {}, contact = c.contact || {}, faq = c.faq || {}, notify = c.notify || {};
    main().innerHTML = head('Website', 'Website content') + '<p class="hint" style="margin:-8px 0 24px">Saved content replaces the built-in text on the live website. Leave a field empty to keep the default.</p>' +
      '<div class="content-grid">' +
      '<form class="panel-form form" data-c="hero"><h2 class="h3">Homepage hero</h2>' + inp('title', 'Headline', hero.title, 'maxlength="120" placeholder="Crafting the future of apparel."') + area('subtitle', 'Description', hero.subtitle, 'maxlength="300"') +
        mediaPicker('campaign', hero.image ? [hero.image] : []) + inp('image_alt', 'Photo description (for accessibility)', hero.image_alt, 'maxlength="160" placeholder="Model wearing the Box Oversized Tee in bone"') +
        '<p class="hint">Optional campaign photo (your own or licensed photography). It replaces the rendered garments in the homepage hero. Use a portrait image, at least 1200 px wide.</p><button class="btn btn--sm" type="submit">Save</button></form>' +
      '<form class="panel-form form" data-c="announcements"><h2 class="h3">Announcement bar</h2>' + area('items', 'Messages (one per line, max 4)', (ann.items || []).join('\n'), 'maxlength="400"') + '<button class="btn btn--sm" type="submit">Save</button></form>' +
      '<form class="panel-form form" data-c="about"><h2 class="h3">About us</h2>' + area('intro', 'Introduction', about.intro, 'maxlength="1200"') + '<button class="btn btn--sm" type="submit">Save</button></form>' +
      '<form class="panel-form form" data-c="contact"><h2 class="h3">Contact details</h2>' + inp('whatsapp', 'WhatsApp (display)', contact.whatsapp, 'maxlength="40" placeholder="+855 96 733 5609"') + inp('email', 'Public email', contact.email, 'type="email" maxlength="200"') + area('address', 'Address', contact.address, 'maxlength="300"') + '<button class="btn btn--sm" type="submit">Save</button></form>' +
      '<form class="panel-form form" data-c="faq"><h2 class="h3">FAQ</h2>' + area('items', 'Questions and answers — "Question? | Answer", one per line', (faq.items || []).map(function (x) { return x.q + ' | ' + x.a; }).join('\n'), 'maxlength="8000" rows="8"') + '<button class="btn btn--sm" type="submit">Save</button></form>' +
      (can('settings') ? '<form class="panel-form form" data-c="notify"><h2 class="h3">Admin notifications</h2>' + inp('email', 'Send new-request emails to', notify.email, 'type="email" maxlength="200" required') + '<p class="hint">Emails are queued and sent once the email provider is connected (see System).</p><button class="btn btn--sm" type="submit">Save</button></form>' +
        '<form class="panel-form form" data-fx><h2 class="h3">Display currencies</h2><p class="hint">Used only to show approximate EUR/GBP equivalents. Quotation amounts are never converted.</p><div class="form-row">' + inp('EUR', 'EUR per 1 USD', fx.EUR, 'type="number" min="0" step="0.000001"') + inp('GBP', 'GBP per 1 USD', fx.GBP, 'type="number" min="0" step="0.000001"') + '</div><button class="btn btn--sm" type="submit">Save rates</button></form>' : '') +
      '</div>';
    bindMedia($('[data-c="hero"]', root));
    $$('[data-c]', root).forEach(function (f) {
      submitWith(f, function () {
        var k = f.dataset.c, v;
        if (k === 'hero') v = { title: val(f, 'title'), subtitle: val(f, 'subtitle'), image: mediaPaths(f)[0] || null, image_alt: val(f, 'image_alt') };
        else if (k === 'announcements') v = { items: lines(f, 'items').slice(0, 4) };
        else if (k === 'about') v = { intro: val(f, 'intro') };
        else if (k === 'contact') v = { whatsapp: val(f, 'whatsapp'), email: val(f, 'email'), address: val(f, 'address') };
        else if (k === 'faq') v = { items: lines(f, 'items').map(function (l) { var p = l.split('|'); return { q: (p[0] || '').trim(), a: p.slice(1).join('|').trim() }; }).filter(function (x) { return x.q && x.a; }) };
        else v = { email: val(f, 'email') };
        try { sessionStorage.removeItem('sa_catalog'); } catch (x) { /* ignore */ }
        return call('apparel_admin_save_content', { p_key: k, p_value: v });
      }, function () {});
    });
    var fx2 = $('[data-fx]', root);
    if (fx2) submitWith(fx2, async function () { if (fx2.EUR.value) await call('apparel_admin_save_fx', { p_currency: 'EUR', p_rate: +fx2.EUR.value }); if (fx2.GBP.value) await call('apparel_admin_save_fx', { p_currency: 'GBP', p_rate: +fx2.GBP.value }); }, function () {});
  };

  /* ---------- reports ---------- */
  function csv(name, cols, rows) {
    var q = function (v) { v = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var text = [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(','); })).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    a.download = 'siddiqiya-' + name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }
  VIEWS.reports = async function () {
    var f = filt.reports || { from: new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
    var r = await call('apparel_admin_reports', { p_from: f.from, p_to: f.to });
    var pct = function (a, b) { return b ? Math.round(a / b * 100) + '%' : '—'; };
    var bars = function (arr, labelKey, valKey) { var max = Math.max.apply(null, arr.map(function (x) { return x[valKey]; }).concat([1])); return arr.length ? '<div class="bars">' + arr.map(function (x) { return '<div><span>' + esc(L(x[labelKey])) + '</span><i style="width:' + Math.max(2, x[valKey] / max * 100) + '%"></i><b>' + x[valKey] + '</b></div>'; }).join('') + '</div>' : '<p class="muted">No data in this period.</p>'; };
    var sect = function (title, body, exp) { return '<section class="report"><header><h2 class="h3">' + title + '</h2>' + (exp ? '<button class="link" type="button" data-exp="' + exp + '">CSV</button>' : '') + '</header>' + body + '</section>'; };
    var qc = r.quotation_conversion, pr = r.production, qa = r.quality, sh = r.shipping;
    main().innerHTML = head('Analytics', 'Reports', '<button class="btn btn--ghost btn--sm" type="button" data-print>Print / PDF</button>') +
      '<form class="admin-filters" data-range><label>From <input class="input" type="date" name="from" value="' + esc(f.from) + '"></label><label>To <input class="input" type="date" name="to" value="' + esc(f.to) + '"></label><button class="btn btn--sm" type="submit">Apply</button></form>' +
      '<div class="report-grid">' +
      sect('Quotation conversion', dl([['Requests', qc.requests], ['Quoted', qc.quoted + ' (' + pct(qc.quoted, qc.requests) + ')'], ['Approved', qc.approved + ' (' + pct(qc.approved, qc.requests) + ')'], ['Became orders', qc.ordered + ' (' + pct(qc.ordered, qc.requests) + ')'], ['Quoted value (sent/accepted)', r.quoted_value.map(function (x) { return money(x.currency, x.value); }).join('<br>') || '—']]) + '<p class="hint">Quoted value is not revenue.</p>') +
      sect('Monthly confirmed orders', r.monthly_orders.length ? table(['Month', 'Orders', 'Value'], r.monthly_orders.map(function (m) { return [m.month, m.orders, money(m.currency, m.value)]; })) : '<p class="muted">No orders in this period.</p>', 'monthly_orders') +
      sect('Orders by status', bars(r.orders_by_status, 'status', 'count')) +
      sect('Buyer registrations', bars(r.buyer_registrations, 'month', 'count'), 'buyer_registrations') +
      sect('Leads by source', bars(r.leads_by_source, 'source', 'count'), 'leads_by_source') +
      sect('Leads by status', bars(r.leads_by_status, 'status', 'count')) +
      sect('Inquiries by country', bars(r.inquiries_by_country.slice(0, 15), 'country', 'count'), 'inquiries_by_country') +
      sect('Product-wise inquiries', r.product_inquiries.length ? table(['Product', 'Requests', 'Pieces'], r.product_inquiries.slice(0, 15).map(function (p) { return [esc(p.product) + '<br><span class="muted">' + esc(p.product_id) + '</span>', p.requests, (p.pieces || 0).toLocaleString()]; })) : '<p class="muted">No requests in this period.</p>', 'product_inquiries') +
      sect('Production performance', dl([['Completed', pr.completed], ['On time', pr.on_time + ' of ' + pr.with_target + ' with a target (' + pct(pr.on_time, pr.with_target) + ')'], ['In progress now', pr.in_progress], ['Pieces completed', (pr.pieces_completed || 0).toLocaleString()]])) +
      sect('Quality inspections', dl([['Inspections', qa.inspections], ['Passed', qa.passed + ' (' + pct(qa.passed, qa.inspections) + ')'], ['Defects recorded', qa.defects]])) +
      sect('Shipping performance', dl([['Shipments', sh.shipments], ['Delivered', sh.delivered], ['Delivered by ETA', sh.on_time + ' of ' + sh.with_eta + ' (' + pct(sh.on_time, sh.with_eta) + ')'], ['Exceptions', sh.exceptions]])) +
      '</div>';
    var rf = $('[data-range]', root);
    rf.onsubmit = function (e) { e.preventDefault(); filt.reports = { from: rf.from.value, to: rf.to.value }; route(); };
    $('[data-print]', root).onclick = function () { window.print(); };
    $$('[data-exp]', root).forEach(function (b) { b.onclick = function () { var k = b.dataset.exp, rows = r[k]; csv(k, rows.length ? Object.keys(rows[0]) : ['empty'], rows); }; });
  };

  /* ---------- users & roles ---------- */
  VIEWS.team = async function () {
    var rows = await call('apparel_admin_team');
    var ROLES = ['super_admin', 'admin', 'sales_manager', 'sales_rep', 'production_manager', 'qc_manager', 'shipping_manager', 'support'];
    main().innerHTML = head('Access', 'Users & roles') +
      table(['Email', 'Role', 'Since', ''], rows.map(function (u) { return [esc(u.email), '<select class="input" data-role="' + esc(u.email) + '" aria-label="Role for ' + esc(u.email) + '">' + opts(ROLES, u.role) + '</select>', fmtD(u.created_at), '<button class="q-remove" type="button" data-remove="' + esc(u.email) + '">Remove access</button>']; })) +
      '<form class="panel-form form" data-add-staff style="margin-top:24px;max-width:560px"><h2 class="h3">Add staff member</h2><p class="hint">The person must first create an account at /account/register/.</p><div class="form-row">' + inp('email', 'Email', '', 'type="email" required') + sel('role', 'Role', ROLES, 'sales_rep') + '</div><button class="btn btn--sm" type="submit">Grant access</button></form>' +
      '<h2 class="h3 sect-h">Role permissions</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Role</th><th>Can access</th></tr></thead><tbody>' +
      [['Super Admin', 'Everything, including users & roles'], ['Admin', 'Everything except users & roles'], ['Sales Manager', 'Buyers, inquiries, samples, quotations, orders, CRM, documents, reports, messages'], ['Sales Representative', 'Buyers, inquiries, samples, quotations, CRM, messages'],
        ['Production Manager', 'Orders, production, quality control, suppliers, documents, reports'], ['Quality Control Manager', 'Production, quality control, documents'], ['Shipping Manager', 'Orders, shipping, documents, reports'], ['Support Staff', 'Buyers, inquiries, samples, messages']].map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td></tr>'; }).join('') + '</tbody></table></div>';
    $$('[data-role]', root).forEach(function (s) { s.onchange = async function () { try { await call('apparel_admin_set_role', { p_email: s.dataset.role, p_role: s.value }); toast('Role updated'); } catch (e) { toast(SB.message(e)); route(); } }; });
    $$('[data-remove]', root).forEach(function (b) { b.onclick = async function () { if (!window.confirm('Remove staff access for ' + b.dataset.remove + '?')) return; try { await call('apparel_admin_set_role', { p_email: b.dataset.remove, p_role: 'none' }); toast('Access removed'); route(); } catch (e) { toast(SB.message(e)); } }; });
    var af = $('[data-add-staff]', root);
    submitWith(af, function () { return call('apparel_admin_set_role', { p_email: val(af, 'email'), p_role: af.role.value }); }, route);
  };

  /* ---------- system ---------- */
  VIEWS.system = async function () {
    var em = await call('apparel_admin_email_status'), audit = await call('apparel_admin_audit', { p_limit: 200 });
    main().innerHTML = head('System', 'Email queue & audit log') +
      '<section class="report"><header><h2 class="h3">Transactional email</h2></header>' + dl([['Queued', em.pending], ['Sent', em.sent], ['Failed', em.failed]]) +
      (em.sent === 0 ? '<p class="portal-notice">Emails are being queued but no email provider is connected yet, so nothing has been sent. See DEPLOYMENT.md in the repository to connect Resend.</p>' : '') +
      table(['Time', 'To', 'Template', 'Status'], em.recent.map(function (e) { return [fmt(e.at), esc(e.to), esc(e.template), badge(e.status === 'pending' ? 'pending' : e.status === 'sent' ? 'delivered' : 'rejected') + (e.error ? '<br><span class="muted">' + esc(e.error) + '</span>' : '')]; }), 'No emails queued yet.') + '</section>' +
      '<section class="report"><header><h2 class="h3">Audit log</h2><button class="link" type="button" data-exp>CSV</button></header>' +
      table(['Time', 'User', 'Action', 'Record', 'Details'], audit.map(function (a) { return [fmt(a.at), esc(a.by || '—'), esc(a.action), esc(a.entity) + ' ' + esc(a.key || ''), '<span class="muted">' + esc(JSON.stringify(a.detail)) + '</span>']; }), 'No activity yet.') + '</section>';
    $('[data-exp]', root).onclick = function () { csv('audit', ['at', 'by', 'action', 'entity', 'key', 'detail'], audit); };
  };

  boot();
})();
