// Custom design studio: garment mockups with per-placement artwork,
// drag / resize inside the print area, live colour and fabric preview.
import { garmentSVG, TEMPLATES, CM_PER_UNIT } from './mockup.mjs';
import { fabricSVG } from './art.mjs';

const root = document.querySelector('[data-studio]');
if (root) {
  const SA = window.SA;
  const S = window.SAStore;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const form = $('[data-studio-form]');
  const stage = $('[data-stage]');
  const canvas = $('[data-canvas]');
  const panel = $('[data-art-panel]');
  const catSel = form.querySelector('[name="Category"]');
  const fabSel = form.querySelector('[name="Fabric"]');
  const gsmSel = form.querySelector('[name="GSM"]');
  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_FILES = 6;
  const VIEWS = { front: 'Front', back: 'Back', left: 'Left sleeve', right: 'Right sleeve' };
  const DEFAULTS = { front: { size: 70, px: 50, py: 12 }, back: { size: 80, px: 50, py: 10 }, left: { size: 80, px: 50, py: 50 }, right: { size: 80, px: 50, py: 50 } };
  const escText = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    view: 'front',
    color: 'white',
    files: [], // { id, name, size, kind, url, w, h }
    place: { front: null, back: null, left: null, right: null }, // { fileId, size, px, py }
  };
  let seq = 0;

  /* ---------- helpers ---------- */
  const template = () => TEMPLATES[(SA.categories.find((c) => c.name === catSel.value) || { shape: 'crew' }).shape] || TEMPLATES.crew;
  const shapeKey = () => (SA.categories.find((c) => c.name === catSel.value) || { shape: 'crew' }).shape;
  const area = (view = state.view) => template().areas[view];
  const fabric = () => SA.fabrics.find((f) => f.name === fabSel.value);
  const fileById = (id) => state.files.find((f) => f.id === id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function geom(pl, file, a) {
    const r = file.h / file.w;
    const maxW = Math.min(a.w, a.h / r);
    const w = (maxW * pl.size) / 100;
    const h = w * r;
    return { w, h, x: ((a.w - w) * pl.px) / 100, y: ((a.h - h) * pl.py) / 100 };
  }

  /* ---------- garment ---------- */
  function renderGarment() {
    const f = fabric();
    canvas.innerHTML = garmentSVG({ shape: shapeKey(), view: state.view, color: SA.colors[state.color].hex, texture: f ? f.texture : 'jersey', uid: 'sd' });
    bindDrag();
    renderArt();
  }

  function renderArt() {
    const slot = $('[data-art]', canvas);
    if (!slot) return;
    const pl = state.place[state.view];
    const file = pl && fileById(pl.fileId);
    const a = area();
    stage.classList.toggle('has-art', !!file);
    if (!file) {
      slot.innerHTML = '';
    } else {
      const g = geom(pl, file, a);
      if (file.kind === 'pdf') {
        slot.innerHTML = `<g><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="#faf9f6" fill-opacity=".9" stroke="#111" stroke-opacity=".4" stroke-width=".6" stroke-dasharray="2 2"/><text x="${g.x + g.w / 2}" y="${g.y + g.h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Manrope, sans-serif" font-weight="700" font-size="${Math.max(3, g.w / 7)}" fill="#111">PDF</text></g>`;
      } else {
        slot.innerHTML = `<image href="${file.url}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    }
    syncPanel();
  }

  function moveArt() {
    // Fast path while dragging: update the existing element only.
    const pl = state.place[state.view];
    const file = pl && fileById(pl.fileId);
    const el = $('[data-art] > *', canvas);
    if (!file || !el) return renderArt();
    const g = geom(pl, file, area());
    if (el.tagName.toLowerCase() === 'image') {
      el.setAttribute('x', g.x); el.setAttribute('y', g.y); el.setAttribute('width', g.w); el.setAttribute('height', g.h);
    } else {
      renderArt();
      return;
    }
    syncPanel();
  }

  /* ---------- panel ---------- */
  function syncPanel() {
    const pl = state.place[state.view];
    const file = pl && fileById(pl.fileId);
    const a = area();
    const label = state.view === 'front' && a.label === 'Left chest' ? 'Left chest' : VIEWS[state.view];
    $('[data-stage-empty-text]').textContent = state.files.length ? `Add artwork to the ${label.toLowerCase()}` : `Upload artwork for the ${label.toLowerCase()}`;
    $('[data-stage-upload]').hidden = !!file;
    panel.hidden = !state.files.length;
    $('[data-art-title]').textContent = `${label} artwork`;
    const sel = $('[data-art-select]');
    sel.innerHTML = `<option value="">None</option>` + state.files.map((f) => `<option value="${f.id}"${file && f.id === file.id ? ' selected' : ''}>${escText(f.name)}</option>`).join('');
    const ctl = ['[data-art-size]', '[data-art-x]', '[data-art-y]', '[data-art-center]', '[data-art-fit]', '[data-art-reset]', '[data-art-remove]'];
    ctl.forEach((s) => { $(s).disabled = !file; });
    if (file) {
      const g = geom(pl, file, a);
      $('[data-art-size]').value = pl.size; $('[data-out-size]').textContent = `${Math.round(pl.size)}%`;
      $('[data-art-x]').value = pl.px; $('[data-out-x]').textContent = `${Math.round(pl.px)}%`;
      $('[data-art-y]').value = pl.py; $('[data-out-y]').textContent = `${Math.round(pl.py)}%`;
      $('[data-art-dims]').textContent = `≈ ${(g.w * CM_PER_UNIT).toFixed(1)} × ${(g.h * CM_PER_UNIT).toFixed(1)} cm`;
    } else {
      $('[data-art-dims]').textContent = 'No artwork on this placement';
    }
    Object.keys(VIEWS).forEach((v) => {
      const has = !!(state.place[v] && fileById(state.place[v].fileId));
      $(`[data-tab-dot="${v}"]`).hidden = !has;
      const cb = $(`[data-placement="${v}"]`);
      if (has) cb.checked = true;
    });
    listFiles();
  }

  function assign(view, fileId) {
    if (!fileId) { state.place[view] = null; return; }
    const prev = state.place[view];
    state.place[view] = { fileId, ...(prev ? { size: prev.size, px: prev.px, py: prev.py } : DEFAULTS[view]) };
  }

  /* ---------- drag ---------- */
  let drag = null;
  function localPoint(e, hit) {
    const m = hit.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return pt;
  }
  function bindDrag() {
    const hit = $('[data-hit]', canvas);
    if (!hit) return;
    hit.addEventListener('pointerdown', (e) => {
      const pl = state.place[state.view];
      const file = pl && fileById(pl.fileId);
      if (!file) {
        if (state.files.length) {
          const first = state.files.find((f) => f.kind !== 'pdf') || state.files[0];
          assign(state.view, first.id); renderArt();
        } else {
          $('[data-file]').click();
        }
        return;
      }
      e.preventDefault();
      const p = localPoint(e, hit);
      if (!p) return;
      const g = geom(pl, file, area());
      drag = { id: e.pointerId, dx: p.x - g.x, dy: p.y - g.y, hit };
      hit.setPointerCapture(e.pointerId);
      stage.classList.add('dragging');
    });
    hit.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const pl = state.place[state.view];
      const file = fileById(pl.fileId);
      const a = area();
      const p = localPoint(e, hit);
      if (!p) return;
      const g = geom(pl, file, a);
      const nx = p.x - drag.dx;
      const ny = p.y - drag.dy;
      pl.px = a.w - g.w > 0.01 ? clamp((nx / (a.w - g.w)) * 100, 0, 100) : 50;
      pl.py = a.h - g.h > 0.01 ? clamp((ny / (a.h - g.h)) * 100, 0, 100) : 50;
      moveArt();
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      stage.classList.remove('dragging');
    };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
  }

  stage.addEventListener('keydown', (e) => {
    const pl = state.place[state.view];
    if (!pl) return;
    const step = e.shiftKey ? 10 : 2;
    const k = e.key;
    if (k === 'ArrowLeft') pl.px = clamp(pl.px - step, 0, 100);
    else if (k === 'ArrowRight') pl.px = clamp(pl.px + step, 0, 100);
    else if (k === 'ArrowUp') pl.py = clamp(pl.py - step, 0, 100);
    else if (k === 'ArrowDown') pl.py = clamp(pl.py + step, 0, 100);
    else if (k === '+' || k === '=') pl.size = clamp(pl.size + step, 10, 100);
    else if (k === '-' || k === '_') pl.size = clamp(pl.size - step, 10, 100);
    else return;
    e.preventDefault();
    moveArt();
  });

  /* ---------- controls ---------- */
  const onRange = (sel, key) => $(sel).addEventListener('input', (e) => {
    const pl = state.place[state.view];
    if (!pl) return;
    pl[key] = +e.target.value;
    moveArt();
  });
  onRange('[data-art-size]', 'size');
  onRange('[data-art-x]', 'px');
  onRange('[data-art-y]', 'py');
  $('[data-art-center]').addEventListener('click', () => { const pl = state.place[state.view]; if (pl) { pl.px = 50; pl.py = 50; renderArt(); } });
  $('[data-art-fit]').addEventListener('click', () => { const pl = state.place[state.view]; if (pl) { pl.size = 100; pl.px = 50; pl.py = 0; renderArt(); } });
  $('[data-art-reset]').addEventListener('click', () => { const pl = state.place[state.view]; if (pl) { Object.assign(pl, DEFAULTS[state.view]); renderArt(); } });
  $('[data-art-remove]').addEventListener('click', () => { assign(state.view, null); renderArt(); });
  $('[data-art-select]').addEventListener('change', (e) => { assign(state.view, e.target.value ? +e.target.value : null); renderArt(); });
  $('[data-show-area]').addEventListener('change', (e) => { stage.dataset.area = e.target.checked ? 'on' : 'off'; });
  $('[data-stage-upload]').addEventListener('click', () => {
    if (state.files.length) {
      const first = state.files.find((f) => f.kind !== 'pdf') || state.files[0];
      assign(state.view, first.id); renderArt();
    } else {
      $('[data-file]').click();
    }
  });

  function setView(v) {
    state.view = v;
    $$('[data-stage-view]').forEach((b) => { const on = b.dataset.stageView === v; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
    renderGarment();
  }
  $$('[data-stage-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.stageView)));

  /* ---------- colour & fabric ---------- */
  function setColor(k, { fromList = false } = {}) {
    state.color = k;
    $$('[data-preview-color]').forEach((b) => b.setAttribute('aria-checked', b.dataset.previewColor === k));
    $('[data-preview-color-name]').textContent = SA.colors[k].name;
    if (!fromList) { const cb = $(`[data-studio-colors] input[value="${k}"]`); if (cb) cb.checked = true; }
    renderGarment();
    renderFabric();
  }
  $$('[data-preview-color]').forEach((b) => b.addEventListener('click', () => setColor(b.dataset.previewColor)));
  $('[data-studio-colors]').addEventListener('change', (e) => {
    const k = e.target.value;
    if (e.target.checked) setColor(k, { fromList: true });
    else if (k === state.color) {
      const next = $$('[data-studio-colors] input:checked')[0];
      if (next) setColor(next.value, { fromList: true });
    }
  });

  function renderFabric() {
    const f = fabric();
    const hex = SA.colors[state.color].hex;
    const svg = fabricSVG({ texture: f ? f.texture : 'jersey', color: hex, uid: 'fs' });
    $('[data-fabric-swatch]').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    $('[data-fabric-name]').textContent = f ? f.name : 'Select a fabric';
    $('[data-fabric-meta]').textContent = f ? `${f.composition}${gsmSel.value ? ` · ${gsmSel.value} GSM` : ''} · ${SA.colors[state.color].name}` : 'Texture preview updates with your fabric and colour.';
  }

  function syncGsm() {
    const f = fabric();
    const keep = gsmSel.value;
    [...gsmSel.options].forEach((o) => { if (o.value) { o.hidden = !!f && !f.gsm.includes(+o.value); o.disabled = o.hidden; } });
    if (f && keep && !f.gsm.includes(+keep)) gsmSel.value = '';
    if (f && !gsmSel.value) gsmSel.value = String(f.gsm[Math.min(1, f.gsm.length - 1)]);
  }
  catSel.addEventListener('change', renderGarment);
  fabSel.addEventListener('change', () => { syncGsm(); renderGarment(); renderFabric(); });
  gsmSel.addEventListener('change', renderFabric);

  /* ---------- files ---------- */
  async function sniff(file) {
    const buf = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (String.fromCharCode(...buf.slice(0, 5)) === '%PDF-') return 'pdf';
    const text = new TextDecoder().decode(buf).toLowerCase();
    if (text.includes('<svg')) return 'svg';
    return null;
  }
  async function svgSafe(file) {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
    // Remove active content; artwork is only ever drawn as an image, never inline.
    doc.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); }));
    let w = parseFloat(svg.getAttribute('width'));
    let h = parseFloat(svg.getAttribute('height'));
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if ((!w || !h) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) { w = vb[2]; h = vb[3]; }
    if (!w || !h) { w = 1000; h = 1000; }
    if (!svg.getAttribute('width')) svg.setAttribute('width', w);
    if (!svg.getAttribute('height')) svg.setAttribute('height', h);
    const blob = new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
    return { url: URL.createObjectURL(blob), w, h };
  }
  function rasterSize(url) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im.naturalWidth && im.naturalHeight ? { w: im.naturalWidth, h: im.naturalHeight } : null);
      im.onerror = () => res(null);
      im.src = url;
    });
  }

  async function addFiles(list) {
    let added = 0;
    for (const file of list) {
      if (state.files.length >= MAX_FILES) { S.toast(`Up to ${MAX_FILES} files per request.`); break; }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'svg', 'pdf'].includes(ext)) { S.toast(`${file.name}: only PNG, JPG, SVG or PDF files are accepted.`); continue; }
      if (file.size > MAX_BYTES) { S.toast(`${file.name} is larger than 20 MB.`); continue; }
      if (!file.size) { S.toast(`${file.name} is empty.`); continue; }
      const kind = await sniff(file);
      if (kind !== (ext === 'jpeg' ? 'jpg' : ext)) { S.toast(`${file.name} does not look like a valid ${ext.toUpperCase()} file.`); continue; }
      let rec;
      if (kind === 'pdf') rec = { url: '', w: 210, h: 297 };
      else if (kind === 'svg') rec = await svgSafe(file);
      else {
        const url = URL.createObjectURL(file);
        const size = await rasterSize(url);
        rec = size ? { url, ...size } : null;
        if (!rec) URL.revokeObjectURL(url);
      }
      if (!rec) { S.toast(`${file.name} could not be read.`); continue; }
      state.files.push({ id: ++seq, name: file.name, size: file.size, kind, ...rec });
      added++;
    }
    if (added) {
      const cur = state.place[state.view];
      if (!cur || !fileById(cur.fileId)) {
        const pick = state.files.slice(-added).find((f) => f.kind !== 'pdf') || state.files[state.files.length - added];
        assign(state.view, pick.id);
      }
      renderArt();
      S.toast(`Artwork placed on the ${VIEWS[state.view].toLowerCase()} — drag to position it.`);
      if (window.matchMedia('(max-width: 960px)').matches) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function usedOn(id) {
    return Object.keys(VIEWS).filter((v) => state.place[v] && state.place[v].fileId === id).map((v) => VIEWS[v]);
  }
  function listFiles() {
    $('[data-file-list]').innerHTML = state.files.map((f) => {
      const used = usedOn(f.id);
      const thumb = f.kind === 'pdf' ? 'PDF' : `<img src="${f.url}" alt="">`;
      return `<div><span class="thumb">${thumb}</span><span class="meta"><span>${escText(f.name)}</span><span>${f.kind.toUpperCase()} · ${(f.size / 1024 / 1024).toFixed(2)} MB${used.length ? ` · on ${used.join(', ')}` : ' · not placed'}</span></span><button class="use" type="button" data-use="${f.id}">Place on ${VIEWS[state.view].toLowerCase()}</button><button class="q-remove" type="button" data-rm="${f.id}">Remove</button></div>`;
    }).join('');
  }
  $('[data-file-list]').addEventListener('click', (e) => {
    const use = e.target.getAttribute('data-use');
    const rm = e.target.getAttribute('data-rm');
    if (use) { assign(state.view, +use); renderArt(); stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    if (rm) {
      const f = fileById(+rm);
      state.files = state.files.filter((x) => x.id !== +rm);
      Object.keys(VIEWS).forEach((v) => { if (state.place[v] && state.place[v].fileId === +rm) state.place[v] = null; });
      if (f && f.url) URL.revokeObjectURL(f.url);
      renderArt();
    }
  });

  const drop = $('[data-drop]');
  const input = $('[data-file]');
  input.addEventListener('change', () => { const l = [...input.files]; input.value = ''; addFiles(l); });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  ['dragover', 'drop'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop') addFiles([...e.dataTransfer.files]); }));

  /* ---------- quantities & submit ---------- */
  function total() {
    const t = $$('[data-size]').reduce((n, i) => n + (/^\d+$/.test(i.value) ? +i.value : 0), 0);
    $('[data-total]').textContent = t.toLocaleString();
    return t;
  }
  form.addEventListener('input', (e) => { if (e.target.matches('[data-size]')) total(); });

  function placementLines() {
    return Object.keys(VIEWS).map((v) => {
      const pl = state.place[v];
      const file = pl && fileById(pl.fileId);
      const checked = $(`[data-placement="${v}"]`).checked;
      const a = TEMPLATES[shapeKey()].areas[v];
      const name = v === 'front' && a.label === 'Left chest' ? 'Front (left chest)' : VIEWS[v];
      if (!file) return checked ? `${name}: artwork to follow` : '';
      const g = geom(pl, file, a);
      let pos = '';
      if (v === 'front' || v === 'back') {
        const T = TEMPLATES[shapeKey()];
        const top = (a.y + g.y - T.collarY[v]) * CM_PER_UNIT;
        const off = (a.x + g.x + g.w / 2 - 200) * CM_PER_UNIT;
        pos = `, top edge ≈ ${Math.max(0, top).toFixed(1)} cm below collar, ${Math.abs(off) < 0.5 ? 'centred' : `${Math.abs(off).toFixed(1)} cm ${off > 0 ? 'right' : 'left'} of centre (as viewed)`}`;
      }
      return `${name}: ${file.name} — approx. ${(g.w * CM_PER_UNIT).toFixed(1)} × ${(g.h * CM_PER_UNIT).toFixed(1)} cm${pos}`;
    }).filter(Boolean);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!S.validate(form)) return;
    const keys = $$('[data-studio-colors] input:checked').map((i) => i.value);
    if (!keys.length) { S.toast('Choose at least one colour.'); return; }
    const t = total();
    if (!t) { S.toast('Enter quantities for at least one size.'); $('[data-size]').focus(); return; }
    const sizes = $$('[data-size]').filter((i) => +i.value > 0).map((i) => `${i.dataset.size} ${i.value}`).join(', ');
    const method = (form.querySelector('input[name="method"]:checked') || {}).value || '';
    const pls = placementLines();
    const lines = [
      '*Custom design quotation request* — via app.hsdmj.com', '',
      `Category: ${catSel.value}`, `Fabric: ${fabSel.value}`, `Weight: ${gsmSel.value} GSM`,
      `Colours: ${keys.map((k) => SA.colors[k].name).join(', ')}`,
      `Sizes: ${sizes} (total ${t} pcs)`, `Method: ${method}`, '',
      '*Placements* (sizes approximate, based on size M)',
      ...(pls.length ? pls : ['No placement selected yet']),
      state.files.length ? `Artwork files (attaching in this chat): ${state.files.map((f) => f.name).join(', ')}` : 'Artwork: none uploaded yet', '',
      ...S.collect(form).filter((l) => !/^(T-shirt category|Fabric|Weight \(GSM\)):/.test(l)),
    ];
    const waText = lines.join('\n');
    const old = form.querySelector('.form-error');
    if (old) old.remove();
    const payload = S.inquiryPayload(form, 'studio', {
      Category: catSel.value, Fabric: fabSel.value, Weight: `${gsmSel.value} GSM`,
      Colours: keys.map((k) => SA.colors[k].name).join(', '), Sizes: `${sizes} (total ${t} pcs)`, Method: method,
      Placements: pls.join('\n') || 'No placement selected yet',
      'Artwork files': state.files.length ? `${state.files.map((f) => f.name).join(', ')} — to be sent on WhatsApp` : 'None uploaded yet',
    });
    payload.subject = `Custom design — ${catSel.value}, ${t} pcs`;
    S.busy(form, true);
    try {
      const r = await window.SB.rpc('apparel_submit_inquiry', { p: payload });
      S.showDone(form, { code: r.code, tracked: false }, waText);
      if (state.files.length) S.toast('Request saved. Send your artwork files on WhatsApp using the button below.');
    } catch (err) {
      S.showError(form, err, waText);
    } finally { S.busy(form, false); }
  });

  /* ---------- init ---------- */
  const qs = new URLSearchParams(location.search);
  const c0 = SA.categories.find((c) => c.slug === qs.get('category'));
  if (c0) catSel.value = c0.name;
  const f0 = SA.fabrics.find((f) => f.slug === qs.get('fabric'));
  if (f0) fabSel.value = f0.name;
  stage.dataset.area = 'on';
  syncGsm();
  total();
  const firstChecked = $$('[data-studio-colors] input:checked')[0];
  setColor(firstChecked ? firstChecked.value : 'white', { fromList: true });
}
