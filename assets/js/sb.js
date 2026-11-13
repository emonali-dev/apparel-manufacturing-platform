/* SIDDIQIYA Apparel — minimal Supabase client (Auth + RPC) with no external dependencies.
   Only the public project URL and publishable key live here; every permission is enforced
   in the database by SECURITY DEFINER functions. */
(function () {
  'use strict';
  var URL_ = 'https://ketzuhfolwhofrnliirf.supabase.co';
  var KEY = 'sb_publishable_APFwXGPzKjDbIkfa-UbVgw_gL22Zczo';
  var SK = 'sa_auth';
  var ERR = {
    NOT_AUTHENTICATED: 'Please sign in to continue.',
    NOT_AUTHORIZED: 'Your account does not have access to this.',
    PROFILE_REQUIRED: 'Please complete your buyer profile first.',
    ACCOUNT_SUSPENDED: 'This buyer account is suspended. Please contact us.',
    RATE_LIMIT: 'Too many requests in a short time. Please try again later.',
    ITEMS_REQUIRED: 'Add at least one product to your quote list.',
    TOO_MANY_ITEMS: 'A single request can include up to 50 items.',
    UNKNOWN_PRODUCT: 'One of the products is no longer available. Please remove it and try again.',
    INVALID_COLOR: 'Please choose a colour offered for this item.',
    INVALID_SIZE: 'Please choose a size offered for this item.',
    INVALID_FABRIC: 'Please choose a valid fabric.',
    INVALID_GSM: 'Please choose a valid fabric weight.',
    INVALID_QUANTITY: 'Quantities must be whole numbers.',
    ADDRESS_REQUIRED: 'Please enter a delivery address.',
    CONTACT_REQUIRED: 'Please enter a contact person.',
    WHOLESALE_FIELDS_REQUIRED: 'Company, country and business type are required for a wholesale account.',
    EMAIL_REQUIRED: 'Please enter a valid email address.',
    SUBJECT_REQUIRED: 'Please add a subject.',
    NAME_REQUIRED: 'Name is required.',
    COMPOSITION_REQUIRED: 'Composition is required.',
    GSM_REQUIRED: 'Add at least one GSM value.',
    COLORS_REQUIRED: 'Select at least one colour.',
    SIZES_REQUIRED: 'Select at least one size.',
    INVALID_CATEGORY: 'Choose a category.',
    MESSAGE_REQUIRED: 'Write a message first.',
    invalid_credentials: 'Email or password is incorrect.',
    user_already_exists: 'An account with this email already exists. Please sign in instead.',
    email_not_confirmed: 'Please confirm your email address first — check your inbox for the link.',
    weak_password: 'Please choose a stronger password (at least 8 characters).',
    over_email_send_rate_limit: 'Too many emails sent. Please wait a little and try again.',
  };

  function load() { try { return JSON.parse(localStorage.getItem(SK)); } catch (e) { return null; } }
  function store(s) { try { if (s) localStorage.setItem(SK, JSON.stringify(s)); else localStorage.removeItem(SK); } catch (e) { /* storage unavailable */ } }
  function fromAuth(d) {
    if (!d || !d.access_token) return null;
    return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: d.user ? { id: d.user.id, email: d.user.email, meta: d.user.user_metadata || {} } : null };
  }

  function fail(status, body) {
    var code = (body && (body.error_code || body.code)) || '';
    var raw = (body && (body.message || body.msg || body.error_description || body.error)) || ('Request failed (' + status + ')');
    var key = ERR[raw] ? raw : ERR[code] ? code : null;
    var e = new Error(key ? ERR[key] : raw);
    e.code = key || code || raw;
    e.status = status;
    return e;
  }

  async function http(path, opts, token) {
    var h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    var res;
    try {
      res = await fetch(URL_ + path, { method: opts.method || 'POST', headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    } catch (e) {
      var ne = new Error('Network error — please check your connection and try again.');
      ne.code = 'NETWORK';
      throw ne;
    }
    var text = await res.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) throw fail(res.status, data);
    return data;
  }

  var refreshing = null;
  async function token() {
    var s = load();
    if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    if (!refreshing) {
      refreshing = http('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } })
        .then(function (d) { var n = fromAuth(d); store(n); return n; })
        .catch(function (e) { if (e.status === 400 || e.status === 401) store(null); throw e; })
        .finally(function () { refreshing = null; });
    }
    var n = await refreshing;
    return n ? n.access_token : null;
  }

  var SB = {
    url: URL_,
    session: load,
    user: function () { var s = load(); return s && s.user; },
    async rpc(name, args) {
      var t = await token().catch(function () { return null; });
      return http('/rest/v1/rpc/' + name, { body: args || {} }, t);
    },
    async signUp(email, password, meta) {
      var d = await http('/auth/v1/signup', { body: { email: email, password: password, data: meta || {} } });
      var s = fromAuth(d);
      if (s) store(s);
      return { session: s, needsConfirmation: !s };
    },
    async signIn(email, password) {
      var s = fromAuth(await http('/auth/v1/token?grant_type=password', { body: { email: email, password: password } }));
      store(s);
      return s;
    },
    async signOut() {
      var t = await token().catch(function () { return null; });
      store(null);
      if (t) { try { await http('/auth/v1/logout', { body: {} }, t); } catch (e) { /* session already cleared locally */ } }
    },
    async recover(email, redirectTo) {
      return http('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo), { body: { email: email } });
    },
    async updatePassword(password) {
      var t = await token();
      if (!t) throw fail(401, { message: 'NOT_AUTHENTICATED' });
      return http('/auth/v1/user', { method: 'PUT', body: { password: password } }, t);
    },
    /** Reads tokens Supabase appends to the URL after an email link (recovery or confirmation). */
    async fromUrl() {
      var h = new URLSearchParams(location.hash.slice(1));
      if (!h.get('access_token')) return null;
      var tmp = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: +h.get('expires_at') || Math.floor(Date.now() / 1000) + (+h.get('expires_in') || 3600), user: null };
      store(tmp);
      try {
        var u = await http('/auth/v1/user', { method: 'GET' }, tmp.access_token);
        tmp.user = { id: u.id, email: u.email, meta: u.user_metadata || {} };
        store(tmp);
      } catch (e) { store(null); throw e; }
      history.replaceState(null, '', location.pathname + location.search);
      return { session: tmp, type: h.get('type') };
    },
    message: function (e) { return (e && e.message) || 'Something went wrong. Please try again.'; },
  };
  window.SB = SB;
})();
