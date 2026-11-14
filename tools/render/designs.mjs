// SIDDIQIYA Apparel — original artwork for every product (rendered to PNG by art.mjs).
// Each print: { view, area, kind, svg(ink) } where ink = { main, accent, soft } chosen for the garment colour.
// Areas are defined in tools/render/render.py (natural garment units, ~3 mm each).

const F = {
  sans: "Inter, 'Inter Display', sans-serif",
  black: "'Inter Display', Inter, sans-serif",
  cond: "'TeX Gyre Heros Cn', 'Liberation Sans Narrow', sans-serif",
  serif: "Lora, 'TeX Gyre Pagella', serif",
  didone: "'TeX Gyre Bonum', 'TeX Gyre Pagella', serif",
  script: "'TeX Gyre Chorus', cursive",
  geo: "Poppins, Inter, sans-serif",
};

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 10}" height="${h * 10}">${body}</svg>`;
const t = (x, y, size, fill, txt, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${o.f || F.sans}" font-size="${size}" font-weight="${o.w || 400}" fill="${fill}" text-anchor="${o.a || 'middle'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.st ? ` font-style="${o.st}"` : ''}${o.extra || ''}>${txt}</text>`;

// ---------- reusable marks ----------
const monogram = (ink, size = 30) => svg(size, size, `
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1.2}" fill="none" stroke="${ink.main}" stroke-width="1.1"/>
  ${t(size / 2, size / 2 + size * 0.2, size * 0.58, ink.main, 'S', { f: F.didone, w: 400 })}`);

const crest = (ink) => svg(30, 34, `
  <path d="M15 2 L27 6 L27 17 C27 25 21 30 15 32 C9 30 3 25 3 17 L3 6 Z" fill="none" stroke="${ink.main}" stroke-width="1.4"/>
  <path d="M15 5 L24.5 8.2 L24.5 17 C24.5 23 20 27.4 15 29.2 C10 27.4 5.5 23 5.5 17 L5.5 8.2 Z" fill="${ink.main}" opacity=".12"/>
  ${t(15, 22, 13, ink.main, 'S', { f: F.didone })}
  <path d="M8 26.5 Q15 31 22 26.5" fill="none" stroke="${ink.accent}" stroke-width="1"/>`);

const laurel = (ink) => {
  const leaf = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry="3" transform="rotate(${r} ${x} ${y})" fill="${ink.main}"/>`;
  let l = '';
  for (let i = 0; i < 6; i++) {
    const a = (200 + i * 22) * Math.PI / 180;
    l += leaf(15 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, i * 22 + 110);
    const b = (340 - i * 22) * Math.PI / 180;
    l += leaf(15 + Math.cos(b) * 11, 16 + Math.sin(b) * 11, -i * 22 + 70);
  }
  return svg(30, 30, `${l}${t(15, 20.5, 11, ink.main, 'S', { f: F.didone })}`);
};

// ---------- product artwork ----------
export const DESIGNS = {
  // 1. Luxury minimalist
  'PRD-0001': {
    name: 'Luxury Minimalist', prints: [
      { view: 'front', area: 'chest-left', kind: 'embroidery', tonal: true, svg: (i) => monogram(i, 24) },
      { view: 'back', area: 'back-neck', kind: 'screen', svg: (i) => svg(36, 10, t(18, 7, 4.4, i.main, 'SIDDIQIYA', { ls: 1.6, w: 500 })) },
    ],
  },
  'PRD-0002': {
    name: 'Everyday Wordmark', prints: [
      { view: 'front', area: 'chest-center', kind: 'screen', svg: (i) => svg(44, 14, t(22, 9.5, 5.2, i.main, 'SIDDIQIYA', { ls: 2.2, w: 600 })) },
      { view: 'front', area: 'hem-left', kind: 'label', svg: (i) => svg(18, 10, `<rect x=".5" y=".5" width="17" height="9" rx="1" fill="${i.label}"/>${t(9, 6.6, 3.6, i.labelInk, 'SA', { f: F.didone, ls: 0.6 })}`) },
      { view: 'back', area: 'back-neck', kind: 'screen', svg: (i) => svg(36, 10, t(18, 7, 4, i.main, 'EVERYDAY · 180', { ls: 1.2, w: 500 })) },
    ],
  },
  // 2. Premium oversized streetwear
  'PRD-0003': {
    name: 'Atelier Back Graphic', prints: [
      { view: 'front', area: 'chest-left', kind: 'screen', svg: (i) => svg(30, 14, `${t(15, 6, 4.6, i.main, 'SIDDIQIYA', { w: 800, ls: 0.6 })}${t(15, 11.5, 2.8, i.accent, 'STUDIO — PHNOM PENH', { ls: 0.5 })}`) },
      { view: 'back', area: 'back-full', kind: 'screen', svg: (i) => svg(120, 150, `
        <defs><path id="arc" d="M14 66 A46 46 0 0 1 106 66"/></defs>
        <text font-family="${F.cond}" font-size="17" font-weight="700" fill="${i.main}" letter-spacing="2.4"><textPath href="#arc" startOffset="50%" text-anchor="middle">SIDDIQIYA</textPath></text>
        <circle cx="60" cy="86" r="26" fill="none" stroke="${i.main}" stroke-width="1.6"/>
        <circle cx="60" cy="86" r="21.5" fill="none" stroke="${i.main}" stroke-width=".6"/>
        ${t(60, 96, 30, i.main, 'S', { f: F.didone })}
        ${t(60, 128, 7.6, i.main, 'ATELIER  PHNOM  PENH', { f: F.cond, w: 700, ls: 1.8 })}
        <line x1="22" y1="134" x2="98" y2="134" stroke="${i.accent}" stroke-width=".8"/>
        ${t(60, 143, 4.6, i.accent, 'HEAVY COTTON · CUT &amp; SEWN · EST. 2026', { ls: 0.8, w: 500 })}`) },
    ],
  },
  'PRD-0004': {
    name: 'Studio 01', prints: [
      { view: 'front', area: 'chest-center', kind: 'puff', svg: (i) => svg(44, 14, `${t(22, 10.5, 9, i.main, 'STUDIO 01', { f: F.cond, w: 700, ls: 1 })}`) },
      { view: 'back', area: 'back-full', kind: 'screen', svg: (i) => svg(120, 150, `
        ${['FORM', 'FOLLOWS', 'FABRIC'].map((w, k) => t(6, 40 + k * 30, 33, i.main, w, { f: F.cond, w: 700, a: 'start', ls: -0.5 })).join('')}
        <rect x="6" y="104" width="108" height=".9" fill="${i.main}"/>
        ${t(6, 116, 5.2, i.accent, 'SIDDIQIYA STUDIO — OVERSIZED TERRY', { a: 'start', ls: 0.9, w: 500 })}
        ${t(6, 125, 5.2, i.accent, '280 GSM · GARMENT DYED', { a: 'start', ls: 0.9, w: 500 })}
        ${t(114, 125, 5.2, i.main, '01/26', { a: 'end', w: 700 })}`) },
    ],
  },
  // 4. Signature embroidered
  'PRD-0005': {
    name: 'Signature Script', prints: [
      { view: 'front', area: 'front-wide', kind: 'embroidery', stitch_angle: 20, svg: (i) => svg(120, 60, `${t(60, 38, 30, i.main, 'Siddiqiya', { f: F.script })}<path d="M30 46 Q60 50 92 44" fill="none" stroke="${i.main}" stroke-width="1.3" stroke-linecap="round"/>`) },
    ],
  },
  'PRD-0006': {
    name: 'Lounge Crest', prints: [
      { view: 'front', area: 'chest-left', kind: 'embroidery', tonal: true, svg: (i) => laurel(i) },
      { view: 'back', area: 'back-neck', kind: 'screen', svg: (i) => svg(36, 10, t(18, 7, 4, i.main, 'LOUNGE · MODAL', { ls: 1.4, w: 500 })) },
    ],
  },
  // 5. Premium back graphic
  'PRD-0007': {
    name: 'Heavy Goods Back Graphic', prints: [
      { view: 'front', area: 'chest-left', kind: 'screen', svg: (i) => svg(30, 14, `${t(15, 7.6, 7.2, i.main, 'HG/280', { f: F.cond, w: 700, ls: 0.4 })}${t(15, 12.4, 2.6, i.accent, 'SIDDIQIYA APPAREL', { ls: 0.6 })}`) },
      { view: 'back', area: 'back-full', kind: 'screen', svg: (i) => svg(120, 150, `
        ${t(60, 20, 6, i.accent, 'SIDDIQIYA APPAREL — HEAVYWEIGHT DIVISION', { ls: 0.9, w: 600 })}
        ${t(60, 64, 46, i.main, 'HEAVY', { f: F.cond, w: 700, ls: -1 })}
        ${t(60, 104, 46, i.main, 'GOODS', { f: F.cond, w: 700, ls: -1 })}
        <rect x="6" y="112" width="108" height="22" fill="${i.main}"/>
        ${t(60, 127.6, 12, i.knock, '280 GSM · BOXY · NO.07', { f: F.cond, w: 700, ls: 0.6, extra: ' textLength="96" lengthAdjust="spacingAndGlyphs"' })}
        ${t(60, 145, 5, i.accent, 'BUILT IN CAMBODIA FOR THE WORLD', { ls: 1.2, w: 500 })}`) },
    ],
  },
  // 7. Modern typography
  'PRD-0008': {
    name: 'Built To Last', prints: [
      { view: 'front', area: 'front-center', kind: 'puff', svg: (i) => svg(104, 120, `
        ${t(4, 40, 40, i.main, 'BUILT', { f: F.cond, w: 700, a: 'start', ls: -0.5 })}
        ${t(4, 76, 40, i.main, `<tspan fill="${i.accent}">TO</tspan> LAST`, { f: F.cond, w: 700, a: 'start', ls: -0.5 })}
        <rect x="4" y="86" width="96" height="1.2" fill="${i.main}"/>
        ${t(4, 97, 5.4, i.main, 'SIDDIQIYA — STREET DIVISION', { a: 'start', ls: 1, w: 600 })}`) },
    ],
  },
  'PRD-0009': {
    name: 'Horizon', prints: [
      { view: 'front', area: 'front-center', kind: 'screen', svg: (i) => svg(104, 120, `
        <defs><clipPath id="c"><circle cx="52" cy="52" r="38"/></clipPath></defs>
        <g clip-path="url(#c)">${Array.from({ length: 9 }, (_, k) => `<rect x="0" y="${14 + k * 8.6}" width="104" height="${2 + k * 0.62}" fill="${[i.accent, i.main, i.warm][k % 3]}"/>`).join('')}</g>
        <circle cx="52" cy="52" r="38" fill="none" stroke="${i.main}" stroke-width="1"/>
        ${t(52, 106, 15, i.main, 'HORIZON', { f: F.cond, w: 700, ls: 4 })}
        ${t(52, 116, 4.6, i.accent, 'SIDDIQIYA GRAPHIC SERIES · 09', { ls: 1, w: 500 })}`) },
    ],
  },
  'PRD-0010': {
    name: 'Arc Worldwide', prints: [
      { view: 'front', area: 'front-center', kind: 'screen', svg: (i) => svg(104, 120, `
        <defs><path id="a1" d="M10 70 A42 42 0 0 1 94 70"/></defs>
        <text font-family="${F.black}" font-size="15.5" font-weight="900" fill="${i.main}" letter-spacing="1.2"><textPath href="#a1" startOffset="50%" text-anchor="middle">SIDDIQIYA</textPath></text>
        <path d="M52 50 L55 60 L65 60 L57 66 L60 76 L52 70 L44 76 L47 66 L39 60 L49 60 Z" fill="${i.accent}"/>
        ${t(52, 96, 12, i.main, 'WORLDWIDE', { f: F.cond, w: 700, ls: 3 })}
        ${t(52, 106, 4.6, i.accent, 'APPAREL MANUFACTURING · PHNOM PENH', { ls: 0.9, w: 500 })}`) },
      { view: 'back', area: 'back-neck', kind: 'screen', svg: (i) => svg(36, 10, t(18, 7, 4.2, i.main, '★ WORLDWIDE ★', { ls: 1, w: 600 })) },
    ],
  },
  // 9. Premium polo
  'PRD-0011': { name: 'Classic Crest Polo', prints: [{ view: 'front', area: 'polo-chest', kind: 'embroidery', svg: (i) => crest(i) }] },
  'PRD-0012': {
    name: 'Club Polo', tipping: true, prints: [
      { view: 'front', area: 'polo-chest', kind: 'embroidery', svg: (i) => svg(30, 16, `${t(15, 10, 9, i.main, 'CLUB', { f: F.didone, ls: 1.4 })}<rect x="5" y="12.6" width="20" height=".9" fill="${i.accent}"/>`) },
    ],
  },
  // 10. Performance sportswear
  'PRD-0013': {
    name: 'Pace Performance', prints: [
      { view: 'front', area: 'front-wide', kind: 'reflective', svg: (i) => svg(120, 60, `
        ${[0, 1, 2].map((k) => `<path d="M${30 + k * 9} 14 L${42 + k * 9} 26 L${30 + k * 9} 38" fill="none" stroke="${k === 2 ? i.accent : i.main}" stroke-width="3.4" stroke-linecap="square"/>`).join('')}
        ${t(64, 32, 16, i.main, 'PACE', { f: F.cond, w: 700, a: 'start', ls: 2.5, st: 'italic' })}
        ${t(64, 40, 4.4, i.accent, 'DRY-FIT 140 · SIDDIQIYA', { a: 'start', ls: 0.8, w: 600 })}`) },
      { view: 'back', area: 'back-neck', kind: 'reflective', svg: (i) => svg(36, 10, t(18, 7.2, 5, i.main, 'PACE', { f: F.cond, w: 700, ls: 2, st: 'italic' })) },
    ],
  },
  'PRD-0014': {
    name: 'Team Raglan', contrastSleeves: true, prints: [
      { view: 'front', area: 'chest-left', kind: 'screen', svg: (i) => svg(30, 14, `${t(15, 9, 8.4, i.main, 'SA', { f: F.cond, w: 700, ls: 0.5 })}${t(15, 13, 2.6, i.accent, 'ATHLETICS', { ls: 0.8, w: 600 })}`) },
      { view: 'back', area: 'back-full', kind: 'screen', svg: (i) => svg(120, 150, `
        ${t(60, 30, 10, i.main, 'SIDDIQIYA', { f: F.cond, w: 700, ls: 3 })}
        ${t(60, 112, 86, i.main, '07', { f: F.cond, w: 700, ls: -2, extra: ` stroke="${i.accent}" stroke-width="1.6" paint-order="stroke"` })}
        ${t(60, 130, 5.4, i.accent, 'ATHLETICS DEPARTMENT', { ls: 1.6, w: 600 })}`) },
    ],
  },
  // Premium cotton / organic
  'PRD-0015': { name: 'Supima-Style Mark', prints: [{ view: 'front', area: 'chest-left', kind: 'embroidery', tonal: true, svg: (i) => svg(30, 14, t(15, 10.5, 11, i.main, 'SA', { f: F.didone, ls: 1 })) }] },
  'PRD-0016': {
    name: 'Atelier No. 16', prints: [
      { view: 'front', area: 'chest-center', kind: 'screen', svg: (i) => svg(44, 16, `${t(22, 8.4, 8, i.main, 'Atelier', { f: F.serif, st: 'italic' })}<rect x="14" y="11" width="16" height=".5" fill="${i.main}"/>${t(22, 15, 3, i.accent, 'No. 16', { ls: 1 })}`) },
    ],
  },
  // 8. Luxury organic
  'PRD-0017': {
    name: 'Organic Sprig', prints: [
      { view: 'front', area: 'chest-left', kind: 'embroidery', svg: (i) => svg(30, 30, `
        <path d="M15 28 C15 20 15 12 16 3" fill="none" stroke="${i.main}" stroke-width="1.1" stroke-linecap="round"/>
        ${[[15, 22, -40], [15.2, 17, 40], [15.4, 12, -40], [15.6, 7.5, 40]].map(([x, y, r]) => `<ellipse cx="${x + (r < 0 ? -3.4 : 3.4)}" cy="${y}" rx="3.6" ry="1.6" transform="rotate(${r} ${x + (r < 0 ? -3.4 : 3.4)} ${y})" fill="${i.leaf}"/>`).join('')}`) },
    ],
  },
  'PRD-0018': {
    name: 'Grown Slow', prints: [
      { view: 'front', area: 'chest-left', kind: 'embroidery', svg: (i) => svg(30, 14, t(15, 10, 7.4, i.main, 'Organic', { f: F.serif, st: 'italic' })) },
      { view: 'back', area: 'back-full', kind: 'screen', svg: (i) => svg(120, 150, `
        <defs><path id="o1" d="M20 70 A40 40 0 1 1 100 70 A40 40 0 1 1 20 70"/></defs>
        <circle cx="60" cy="70" r="33" fill="none" stroke="${i.main}" stroke-width=".8"/>
        <text font-family="${F.sans}" font-size="6.4" font-weight="600" fill="${i.main}" letter-spacing="2.2"><textPath href="#o1">GROWN SLOW · MADE TO LAST · ORGANIC COTTON · </textPath></text>
        <path d="M60 96 C60 82 60 66 62 46" fill="none" stroke="${i.leaf}" stroke-width="1.6" stroke-linecap="round"/>
        ${[[60, 86, -38], [60.5, 76, 38], [61, 66, -38], [61.5, 57, 38]].map(([x, y, r]) => `<ellipse cx="${x + (r < 0 ? -7 : 7)}" cy="${y}" rx="7.4" ry="3.1" transform="rotate(${r} ${x + (r < 0 ? -7 : 7)} ${y})" fill="${i.leaf}"/>`).join('')}
        ${t(60, 128, 12, i.main, 'Siddiqiya', { f: F.serif, st: 'italic' })}
        ${t(60, 138, 4.6, i.accent, 'ORGANIC HEAVY TEE · 240 GSM', { ls: 1.2, w: 500 })}`) },
    ],
  },
  // 6. Vintage washed
  'PRD-0019': {
    name: 'Supply Co. Vintage', finish: 'vintage', prints: [
      { view: 'front', area: 'front-center', kind: 'vintage', svg: (i) => svg(104, 120, `
        <rect x="8" y="10" width="88" height="70" rx="3" fill="none" stroke="${i.main}" stroke-width="2"/>
        <path d="M14 70 L34 40 L46 56 L60 30 L90 70 Z" fill="${i.main}"/>
        <circle cx="76" cy="26" r="7" fill="${i.accent}"/>
        ${t(52, 98, 13, i.main, 'SIDDIQIYA', { f: F.cond, w: 700, ls: 2.2 })}
        ${t(52, 110, 7.2, i.main, 'SUPPLY  CO.', { f: F.didone, ls: 3 })}
        ${t(52, 118, 4, i.accent, 'GARMENT WASHED · HEAVY JERSEY', { ls: 1, w: 600 })}`) },
    ],
  },
  'PRD-0020': {
    name: 'Sun Wash', finish: 'vintage', prints: [
      { view: 'front', area: 'front-center', kind: 'vintage', svg: (i) => svg(104, 120, `
        ${Array.from({ length: 18 }, (_, k) => { const a = Math.PI + (k + 0.5) * Math.PI / 18; return `<line x1="${52 + Math.cos(a) * 26}" y1="${66 + Math.sin(a) * 26}" x2="${52 + Math.cos(a) * 44}" y2="${66 + Math.sin(a) * 44}" stroke="${i.main}" stroke-width="2.2"/>`; }).join('')}
        <path d="M30 66 A22 22 0 0 1 74 66 Z" fill="${i.accent}"/>
        <rect x="6" y="66" width="92" height="2" fill="${i.main}"/>
        ${t(52, 88, 16, i.main, 'SUN WASH', { f: F.cond, w: 700, ls: 3 })}
        ${t(52, 98, 4.8, i.main, 'SOFT HAND · FADED BY DESIGN', { ls: 1.2, w: 500 })}`) },
    ],
  },
  // 3. Heavyweight boxy
  'PRD-0021': {
    name: 'Heavyweight 280', prints: [
      { view: 'front', area: 'chest-left', kind: 'puff', svg: (i) => svg(30, 14, t(15, 11.5, 13, i.main, '280', { f: F.cond, w: 700, ls: 0.5 })) },
      { view: 'back', area: 'back-neck', kind: 'screen', svg: (i) => svg(36, 10, t(18, 7, 4.6, i.main, 'HEAVYWEIGHT', { f: F.cond, w: 700, ls: 1.6 })) },
    ],
  },
  'PRD-0022': {
    name: 'Three Twenty', prints: [
      { view: 'front', area: 'chest-left', kind: 'embroidery', svg: (i) => svg(30, 14, t(15, 11, 11, i.main, '320', { f: F.didone, ls: 1 })) },
      { view: 'back', area: 'back-full', kind: 'screen', svg: (i) => svg(120, 150, `
        ${t(60, 46, 40, i.main, 'THREE', { f: F.cond, w: 700, ls: 1 })}
        ${t(60, 84, 40, i.main, 'TWENTY', { f: F.cond, w: 700, ls: 1 })}
        <rect x="14" y="92" width="92" height=".9" fill="${i.accent}"/>
        ${t(60, 103, 5.4, i.accent, 'GRAMS PER SQUARE METRE · BOXY CUT', { ls: 1, w: 600 })}`) },
    ],
  },
  // Custom printed (sample client artwork)
  'PRD-0023': {
    name: 'Private Label Logo', prints: [
      { view: 'front', area: 'front-wide', kind: 'screen', svg: (i) => svg(120, 60, `
        <circle cx="38" cy="30" r="13" fill="none" stroke="${i.main}" stroke-width="2.6"/>
        <path d="M31 30 L36 35 L46 24" fill="none" stroke="${i.accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        ${t(57, 29, 13, i.main, 'NORTHWIND', { f: F.geo, w: 500, a: 'start', ls: 0.5 })}
        ${t(57, 37, 4.2, i.accent, 'YOUR BRAND — SAMPLE ARTWORK', { a: 'start', ls: 1, w: 500 })}`) },
    ],
  },
  'PRD-0024': {
    name: 'Merch Series 01', prints: [
      { view: 'front', area: 'front-center', kind: 'screen', svg: (i) => svg(104, 120, `
        ${t(52, 30, 8, i.accent, 'MERCH SERIES', { f: F.cond, w: 700, ls: 4 })}
        ${t(52, 78, 56, i.main, '01', { f: F.didone })}
        <rect x="26" y="86" width="52" height="1" fill="${i.main}"/>
        ${t(52, 97, 6, i.main, 'SIDDIQIYA APPAREL', { ls: 2, w: 600 })}`) },
      { view: 'back', area: 'back-full', kind: 'screen', svg: (i) => svg(120, 150, `
        ${t(60, 20, 8, i.main, 'WORLD SERIES', { f: F.cond, w: 700, ls: 4 })}
        ${['PHNOM PENH', 'DHAKA', 'DUBAI', 'LONDON', 'BERLIN', 'TORONTO', 'NEW YORK', 'SYDNEY'].map((c, k) => `${t(18, 40 + k * 12, 6.4, i.main, c, { a: 'start', ls: 1.4, w: 600 })}${t(102, 40 + k * 12, 6.4, i.accent, String(k + 1).padStart(2, '0'), { a: 'end', w: 600 })}`).join('')}`) },
    ],
  },
};
