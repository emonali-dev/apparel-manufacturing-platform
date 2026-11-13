/* SIDDIQIYA Apparel — file validation and storage helpers (artwork, documents, product media). */
(function () {
  'use strict';
  var MAX = 25 * 1024 * 1024;
  var MEDIA_MAX = 8 * 1024 * 1024;
  var EXT = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
    ai: 'ai', psd: 'image/vnd.adobe.photoshop', eps: 'application/postscript',
  };
  function hex(b, n) { return Array.prototype.slice.call(b, 0, n).map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function ascii(b, from, to) { return String.fromCharCode.apply(null, Array.prototype.slice.call(b, from, to)); }

  /** Checks extension, size and the file's real signature. Resolves to { mime } or rejects with a readable message. */
  async function inspect(file, opts) {
    opts = opts || {};
    var allowed = opts.allowed || ['jpg', 'jpeg', 'png', 'pdf', 'ai', 'psd'];
    var limit = opts.max || MAX;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (allowed.indexOf(ext) === -1) throw new Error(file.name + ': allowed types are ' + allowed.filter(function (e) { return e !== 'jpeg'; }).map(function (e) { return e.toUpperCase(); }).join(', ') + '.');
    if (!file.size) throw new Error(file.name + ' is empty.');
    if (file.size > limit) throw new Error(file.name + ' is larger than ' + Math.round(limit / 1048576) + ' MB.');
    var b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    var sig = hex(b, 4);
    var mime = null;
    if (sig === '89504e47') mime = 'image/png';
    else if (sig.slice(0, 6) === 'ffd8ff') mime = 'image/jpeg';
    else if (ascii(b, 0, 5) === '%PDF-') mime = 'application/pdf';
    else if (ascii(b, 0, 4) === '%!PS') mime = 'application/postscript';
    else if (ascii(b, 0, 4) === '8BPS') mime = 'image/vnd.adobe.photoshop';
    else if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') mime = 'image/webp';
    var expected = EXT[ext];
    var ok = expected === 'ai' ? (mime === 'application/pdf' || mime === 'application/postscript') : mime === expected;
    if (!ok) throw new Error(file.name + ' does not look like a valid ' + ext.toUpperCase() + ' file.');
    return { mime: mime, ext: ext };
  }

  function safeName(name) {
    var base = name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
    var ext = (name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    var rand = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).slice(0, 8);
    return rand + '-' + base + (ext ? '.' + ext : '');
  }

  async function uploadRfq(file) {
    var u = window.SB.user();
    if (!u) throw new Error('Please sign in to upload files.');
    var info = await inspect(file);
    var path = 'rfq/' + u.id + '/' + safeName(file.name);
    await window.SB.upload('apparel-files', path, file, info.mime);
    return { path: path, filename: file.name.slice(0, 200), mime: info.mime, size: file.size };
  }
  async function uploadDoc(entity, id, file) {
    var info = await inspect(file, { allowed: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'ai', 'psd'] });
    var path = 'docs/' + entity + '/' + id + '/' + safeName(file.name);
    await window.SB.upload('apparel-files', path, file, info.mime);
    return { path: path, filename: file.name.slice(0, 200), mime: info.mime, size: file.size };
  }
  async function uploadMedia(folder, file) {
    var info = await inspect(file, { allowed: ['jpg', 'jpeg', 'png', 'webp'], max: MEDIA_MAX });
    var path = folder + '/' + safeName(file.name);
    await window.SB.upload('apparel-media', path, file, info.mime);
    return path;
  }
  /** Downloads a private file and opens it (images/PDF) or saves it. */
  async function open(path, filename) {
    var blob = await window.SB.download('apparel-files', path);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || path.split('/').pop();
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }
  function mediaUrl(path) { return /^https?:/.test(path) ? path : window.SB.publicUrl('apparel-media', path); }
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  window.SAFiles = { inspect: inspect, uploadRfq: uploadRfq, uploadDoc: uploadDoc, uploadMedia: uploadMedia, open: open, mediaUrl: mediaUrl, size: size };
})();
