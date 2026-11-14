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
    DUPLICATE_REQUEST: 'This request was already sent a moment ago — check your account before sending it again.',
    INVALID_DATE: 'The target date must be in the future.',
    INVALID_FILE: 'One of the files could not be attached. Please upload it again.',
    INVALID_URL: 'Enter full web addresses starting with https://',
    INVALID_KEY: 'This content section cannot be saved.',
    FILE_NOT_UPLOADED: 'A file did not finish uploading. Please upload it again.',
    TOO_MANY_FILES: 'Attach up to 10 files per request.',
    QUOTE_NOT_OPEN: 'This quotation can no longer be changed.',
    QUOTE_EXPIRED: 'This quotation has expired. Ask us for an updated quotation.',
    QUOTE_LOCKED: 'This quotation has been sent and can no longer be edited. Create a new revision instead.',
    QUOTE_EMPTY: 'Add at least one priced line before sending.',
    DRAFT_EXISTS: 'A draft revision already exists for this request.',
    LINES_REQUIRED: 'Add at least one line.',
    INVALID_LINE: 'Each line needs a description, a quantity of at least 1 and a price.',
    QUOTE_NOT_ACCEPTED: 'The quotation must be sent or accepted before creating an order.',
    ORDER_EXISTS: 'An order already exists for this quotation.',
    ADDRESS_FIELDS_REQUIRED: 'Recipient, address line, city and country are required.',
    TOO_MANY_ADDRESSES: 'You can save up to 10 addresses.',
    FABRIC_IN_USE: 'This fabric is used by products. Change those products first.',
    SKU_EXISTS: 'Another product already uses this SKU.',
    INVALID_SKU: 'SKU may contain letters, numbers and dashes (3–40 characters).',
    INVALID_TIER: 'Price tiers need a whole minimum quantity and a price.',
    INVALID_COLLECTION: 'Choose an existing collection.',
    USER_NOT_FOUND: 'No account exists with that email. Ask them to register first.',
    CANNOT_REMOVE_SELF: 'You cannot remove or downgrade your own super admin access.',
    UNKNOWN_STAFF: 'That email is not a staff member.',
    LEAD_EXISTS: 'A lead with this email already exists.',
    RESULT_REQUIRED: 'Choose pass or fail.',
    INVALID_RATE: 'Enter a valid exchange rate.',
    INVALID_METHOD: 'Choose a shipping method.',
    NOT_FOUND: 'Record not found.',
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
    /** Upload a file to Supabase Storage. Path is relative to the bucket. */
    async upload(bucket, path, file, contentType) {
      var t = await token();
      if (!t) throw fail(401, { message: 'NOT_AUTHENTICATED' });
      var res;
      try {
        res = await fetch(URL_ + '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), {
          method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': contentType, 'x-upsert': 'false', 'cache-control': '3600' }, body: file,
        });
      } catch (e) { var ne = new Error('Upload failed — please check your connection.'); ne.code = 'NETWORK'; throw ne; }
      if (!res.ok) { var b = null; try { b = await res.json(); } catch (e) { /* ignore */ } throw fail(res.status, b || { message: 'Upload failed (' + res.status + ')' }); }
      return { path: path };
    },
    /** Download a private file the signed-in user is allowed to read; returns a Blob. */
    async download(bucket, path) {
      var t = await token();
      var res = await fetch(URL_ + '/storage/v1/object/authenticated/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), { headers: { apikey: KEY, Authorization: 'Bearer ' + t } });
      if (!res.ok) throw fail(res.status, { message: res.status === 404 || res.status === 400 ? 'File not found or not shared with you.' : 'Download failed (' + res.status + ')' });
      return res.blob();
    },
    async remove(bucket, paths) {
      var t = await token();
      return http('/storage/v1/object/' + bucket, { method: 'DELETE', body: { prefixes: paths } }, t);
    },
    publicUrl: function (bucket, path) { return URL_ + '/storage/v1/object/public/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'); },
    message: function (e) { return (e && e.message) || 'Something went wrong. Please try again.'; },
  };
  window.SB = SB;
})();
