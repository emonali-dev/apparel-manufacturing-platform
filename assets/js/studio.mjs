// Custom design studio: live garment mockup with client-side artwork preview.
import { teeSVG } from './art.mjs';

const root = document.querySelector('[data-studio]');
if (root) {
  const SA = window.SA;
  const S = window.SAStore;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const form = $('[data-studio-form]');
  const canvas = $('[data-canvas]');
  const catSel = form.querySelector('[name="Category"]');
  const fabSel = form.querySelector('[name="Fabric"]');
  const gsmSel = form.querySelector('[name="GSM"]');
  const MAX = 20 * 1024 * 1024;
  let view = 'front';
  let files = []; // {name, size, kind, url}

  // Prefill from query string
  const qs = new URLSearchParams(location.search);
  const c0 = SA.categories.find((c) => c.slug === qs.get('category'));
  if (c0) catSel.value = c0.name;
  const f0 = SA.fabrics.find((f) => f.slug === qs.get('fabric'));
  if (f0) fabSel.value = f0.name;

  const shape = () => (SA.categories.find((c) => c.name === catSel.value) || { shape: 'crew' }).shape;
  const colorKeys = () => $$('[data-studio-colors] input:checked').map((i) => i.value);
  const placements = () => $$('input[name="placement"]:checked').map((i) => i.value);

  function syncGsm() {
    const f = SA.fabrics.find((x) => x.name === fabSel.value);
    const keep = gsmSel.value;
    [...gsmSel.options].forEach((o) => { if (o.value) o.hidden = !!f && !f.gsm.includes(+o.value); });
    if (f && keep && !f.gsm.includes(+keep)) gsmSel.value = '';
    if (f && !gsmSel.value) gsmSel.value = String(f.gsm[Math.min(1, f.gsm.length - 1)]);
  }

  function render() {
    const keys = colorKeys();
    const color = SA.colors[keys[0] || 'bone'].hex;
    const showArt = placements().includes(view === 'front' ? 'Front' : 'Back');
    const art = files.find((f) => f.kind !== 'pdf') || files[0];
    const scale = +$('[data-art-scale]').value;
    const y = +$('[data-art-y]').value;
    let overlay = '';
    if (art && showArt) {
      overlay = art.kind === 'pdf'
        ? `<div class="artwork pdf" style="width:${scale}%;top:${y}%">PDF artwork<br>${art.name.replace(/[<>&"]/g, '')}<br><span style="font-weight:400;letter-spacing:0">Preview not available — sent as file</span></div>`
        : `<div class="artwork" style="width:${scale}%;top:${y}%"><img src="${art.url}" alt="Your artwork"></div>`;
    }
    canvas.innerHTML = teeSVG({ shape: shape(), color, view, uid: 'st' }) + overlay;
    $$('[data-stage-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.stageView === view));
  }

  function total() {
    const t = $$('[data-size]').reduce((n, i) => n + (/^\d+$/.test(i.value) ? +i.value : 0), 0);
    $('[data-total]').textContent = t.toLocaleString();
    return t;
  }

  async function sniff(file) {
    const buf = new Uint8Array(await file.slice(0, 512).arrayBuffer());
    const head = String.fromCharCode(...buf.slice(0, 5));
    if (buf[0] === 0x89 && head.slice(1, 4) === 'PNG') return 'png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (head === '%PDF-') return 'pdf';
    const text = new TextDecoder().decode(buf).toLowerCase();
    if (text.includes('<svg')) return 'svg';
    return null;
  }

  async function addFiles(list) {
    for (const file of list) {
      if (files.length >= 6) { S.toast('Up to 6 files per request.'); break; }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'svg', 'pdf'].includes(ext)) { S.toast(`${file.name}: only PNG, JPG, SVG or PDF files are accepted.`); continue; }
      if (file.size > MAX) { S.toast(`${file.name} is larger than 20 MB.`); continue; }
      const kind = await sniff(file);
      const expected = ext === 'jpeg' ? 'jpg' : ext;
      if (kind !== expected) { S.toast(`${file.name} does not look like a valid ${ext.toUpperCase()} file.`); continue; }
      files.push({ name: file.name, size: file.size, kind, url: kind === 'pdf' ? '' : URL.createObjectURL(file) });
    }
    listFiles(); render();
  }
  function listFiles() {
    $('[data-file-list]').innerHTML = files.map((f, i) => `<div><span>${f.name.replace(/[<>&"]/g, '')} · ${(f.size / 1024 / 1024).toFixed(2)} MB</span><button class="q-remove" type="button" data-rm="${i}">Remove</button></div>`).join('');
  }

  const drop = $('[data-drop]');
  const input = $('[data-file]');
  input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  $('[data-file-list]').addEventListener('click', (e) => {
    const i = e.target.getAttribute('data-rm');
    if (i === null) return;
    const [f] = files.splice(+i, 1);
    if (f.url) URL.revokeObjectURL(f.url);
    listFiles(); render();
  });

  $$('[data-stage-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.stageView; render(); }));
  fabSel.addEventListener('change', () => { syncGsm(); render(); });
  form.addEventListener('change', render);
  form.addEventListener('input', (e) => { if (e.target.matches('[data-size]')) total(); if (e.target.matches('[type=range]')) render(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!S.validate(form)) return;
    const keys = colorKeys();
    if (!keys.length) { S.toast('Choose at least one colour.'); return; }
    const t = total();
    if (!t) { S.toast('Enter quantities for at least one size.'); $('[data-size]').focus(); return; }
    const sizes = $$('[data-size]').filter((i) => +i.value > 0).map((i) => `${i.dataset.size} ${i.value}`).join(', ');
    const method = (form.querySelector('input[name="method"]:checked') || {}).value || '';
    const lines = [
      '*Custom design quotation request* — via app.hsdmj.com', '',
      `Category: ${catSel.value}`, `Fabric: ${fabSel.value}`, `Weight: ${gsmSel.value} GSM`,
      `Colours: ${keys.map((k) => SA.colors[k].name).join(', ')}`,
      `Sizes: ${sizes} (total ${t} pcs)`,
      `Placement: ${placements().join(', ') || 'Not specified'}`, `Method: ${method}`,
      files.length ? `Artwork files (attaching in this chat): ${files.map((f) => f.name).join(', ')}` : 'Artwork: none uploaded yet', '',
      ...S.collect(form).filter((l) => !/^(T-shirt category|Fabric|Weight \(GSM\)):/.test(l)),
    ];
    S.openWhatsApp(lines.join('\n'));
    S.toast(files.length ? 'WhatsApp opened — attach your artwork files, then press send.' : 'WhatsApp opened — press send to deliver your request.');
  });

  syncGsm();
  total();
  render();
}
