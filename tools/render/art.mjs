// Renders every product artwork to transparent PNG and writes the render manifest.
// Usage: node tools/render/art.mjs   (needs Playwright + Chromium, used only at asset-creation time)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, colors, categories } from '../../src/data.mjs';
import { DESIGNS } from './designs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
const pw = await import(process.env.PLAYWRIGHT || 'playwright').catch(() => import('/opt/npm-tools/node_modules/playwright/index.mjs'));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = hex(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mix = (h, t, k) => '#' + hex(h).map((v, i) => Math.round((v * (1 - k) + hex(t)[i] * k) * 255).toString(16).padStart(2, '0')).join('');

function inks(garment, tonal) {
  const light = lum(garment) > 0.45;
  if (tonal) {
    const m = light ? mix(garment, '#000000', 0.22) : mix(garment, '#ffffff', 0.28);
    return { main: m, accent: m, warm: m, knock: garment, label: m, labelInk: garment, leaf: m };
  }
  return light
    ? { main: '#1b1a18', accent: '#8a6a37', warm: '#b0502b', knock: garment, label: '#1b1a18', labelInk: '#eae3d4', leaf: '#4c6a43' }
    : { main: '#f1ebdf', accent: '#cfae6d', warm: '#dc7444', knock: garment, label: '#f1ebdf', labelInk: '#1b1a18', leaf: '#a8c49a' };
}

const catBy = Object.fromEntries(categories.map((c) => [c.slug, c]));
const browser = await pw.chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const manifest = [];
for (const p of products) {
  const d = DESIGNS[p.id];
  if (!d) throw new Error('No design for ' + p.id);
  const dir = path.join(OUT, 'art', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const c of p.colors) {
    const garment = colors[c].hex;
    const prints = [];
    for (const [k, pr] of d.prints.entries()) {
      const markup = pr.svg(inks(garment, pr.tonal));
      await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        // keep every line of type inside the artwork bounds
        const svgEl = document.querySelector('svg');
        const vb = svgEl.viewBox.baseVal;
        for (const el of svgEl.querySelectorAll('text')) {
          if (el.querySelector('textPath')) continue;
          const b = el.getBBox();
          const x = parseFloat(el.getAttribute('x'));
          const anchor = el.getAttribute('text-anchor');
          const avail = anchor === 'start' ? vb.width - x - 3 : anchor === 'end' ? x - 3 : Math.min(x, vb.width - x) * 2 - 4;
          if (b.width > avail) { el.setAttribute('textLength', avail.toFixed(2)); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
        }
      });
      const file = path.join(dir, `${c}-${k}.png`);
      await page.locator('svg').screenshot({ path: file, omitBackground: true });
      prints.push({ file: path.relative(here, file), view: pr.view, area: pr.area, kind: pr.kind, stitch_angle: pr.stitch_angle || 35 });
    }
    // contrast sleeves / tipping use a second colour from the product palette
    const second = p.colors.find((x) => x !== c) || c;
    manifest.push({
      id: p.id, slug: p.slug, name: p.name, design: d.name, color: c, hex: garment, shape: catBy[p.cat].shape, fabric: p.fabric, gsm: p.gsm,
      finish: d.finish || p.finish || 'plain', heather: c === 'heather',
      sleeve: d.contrastSleeves ? colors[second].hex : null,
      tipping: d.tipping ? (lum(garment) > 0.45 ? '#1f2a3b' : '#efe9dd') : null,
      prints,
    });
  }
  process.stdout.write('.');
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`\n${manifest.length} colourways, ${manifest.reduce((n, m) => n + m.prints.length, 0)} artworks`);
