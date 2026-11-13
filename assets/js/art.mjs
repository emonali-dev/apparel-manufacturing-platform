// Generated from src/art.mjs — do not edit.
// Garment and fabric illustrations, rendered as standalone SVG.
// Used until real product photography is supplied through the CMS.

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const shade = (hex, amt) => {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
};

const SHAPES = {
  crew: {
    body: 'M158 52 C170 82 230 82 242 52 L300 70 Q318 76 330 92 L372 168 Q376 176 368 180 L326 200 Q318 204 314 196 L286 150 L288 404 Q288 412 280 412 L120 412 Q112 412 112 404 L114 150 L86 196 Q82 204 74 200 L32 180 Q24 176 28 168 L70 92 Q82 76 100 70 Z',
    rib: 'M158 52 C170 84 230 84 242 52 C228 72 172 72 158 52 Z',
    inside: 'M158 52 C172 72 228 72 242 52 C226 44 174 44 158 52 Z',
    backRib: 'M158 52 C176 64 224 64 242 52 C226 54 174 54 158 52 Z',
    backInside: 'M158 52 C174 54 226 54 242 52 C226 45 174 45 158 52 Z',
    hems: ['M38 166 L80 188', 'M362 166 L320 188', 'M114 398 L286 398'],
    folds: ['M160 250 Q176 320 158 392', 'M244 270 Q232 330 248 396'],
    chest: [200, 170],
    shoulders: [],
  },
  oversized: {
    body: 'M164 54 C176 80 224 80 236 54 L316 80 Q332 86 340 100 L384 196 Q388 206 378 210 L332 226 Q322 230 318 220 L298 174 L300 412 Q300 420 292 420 L108 420 Q100 420 100 412 L102 174 L82 220 Q78 230 68 226 L22 210 Q12 206 16 196 L60 100 Q68 86 84 80 Z',
    rib: 'M164 54 C176 88 224 88 236 54 C226 74 174 74 164 54 Z',
    inside: 'M164 54 C174 74 226 74 236 54 C222 46 178 46 164 54 Z',
    backRib: 'M164 54 C180 68 220 68 236 54 C224 58 176 58 164 54 Z',
    backInside: 'M164 54 C176 58 224 58 236 54 C222 47 178 47 164 54 Z',
    hems: ['M26 194 L76 214', 'M374 194 L324 214', 'M102 404 L298 404'],
    folds: ['M156 260 Q172 330 152 404', 'M250 270 Q236 340 256 406'],
    chest: [200, 176],
    shoulders: ['M66 104 Q86 140 102 176', 'M334 104 Q314 140 298 176'],
  },
};
SHAPES.drop = {
  ...SHAPES.oversized,
  body: SHAPES.oversized.body.replace('L300 412 Q300 420 292 420 L108 420 Q100 420 100 412', 'L298 396 Q298 404 290 404 L110 404 Q102 404 102 396'),
  hems: ['M26 194 L76 214', 'M374 194 L324 214', 'M104 390 L296 390'],
};
SHAPES.heavy = {
  ...SHAPES.crew,
  rib: 'M156 52 C168 90 232 90 244 52 C230 72 170 72 156 52 Z',
  inside: 'M156 52 C170 72 230 72 244 52 C228 43 172 43 156 52 Z',
};
SHAPES.polo = { ...SHAPES.crew };
SHAPES.raglan = { ...SHAPES.crew };

function printArt(kind, ink, view, cx, cy) {
  const f = `font-family="Manrope, Helvetica, Arial, sans-serif"`;
  if (view === 'back') {
    if (kind === 'back-type') return `<g fill="${ink}"><text x="${cx}" y="${cy + 10}" text-anchor="middle" ${f} font-weight="800" font-size="25" letter-spacing="1.5">SIDDIQIYA</text><text x="${cx}" y="${cy + 36}" text-anchor="middle" ${f} font-weight="600" font-size="8.5" letter-spacing="4">VOL. 01</text><rect x="${cx - 70}" y="${cy + 50}" width="140" height="2"/></g>`;
    if (kind === 'merch') return `<g fill="${ink}"><text x="${cx}" y="${cy + 6}" text-anchor="middle" ${f} font-weight="700" font-size="12" letter-spacing="8">SEASON PROGRAMME</text><text x="${cx}" y="${cy + 40}" text-anchor="middle" ${f} font-weight="800" font-size="40">2026</text></g>`;
    return '';
  }
  switch (kind) {
    case 'horizon':
      return `<g><circle cx="${cx}" cy="${cy + 6}" r="30" fill="${ink}" opacity=".9"/><g stroke="${ink}" stroke-width="3"><path d="M${cx - 54} ${cy + 26}h108"/><path d="M${cx - 42} ${cy + 36}h84"/><path d="M${cx - 28} ${cy + 46}h56"/></g><text x="${cx}" y="${cy + 72}" text-anchor="middle" ${f} font-weight="700" font-size="10" letter-spacing="7" fill="${ink}">HORIZON</text></g>`;
    case 'arc':
      return `<g fill="none" stroke="${ink}" stroke-width="3"><path d="M${cx - 60} ${cy + 50}a60 60 0 0 1 120 0"/><path d="M${cx - 44} ${cy + 50}a44 44 0 0 1 88 0"/><path d="M${cx - 28} ${cy + 50}a28 28 0 0 1 56 0"/></g><text x="${cx}" y="${cy + 72}" text-anchor="middle" ${f} font-weight="700" font-size="10" letter-spacing="6" fill="${ink}">FORM / STUDY</text>`;
    case 'block':
      return `<g><rect x="${cx - 46}" y="${cy - 8}" width="92" height="56" fill="${ink}"/><text x="${cx}" y="${cy + 30}" text-anchor="middle" ${f} font-weight="800" font-size="24" fill="currentColor">NO.26</text></g>`;
    case 'back-type':
      return `<text x="${cx + 34}" y="${cy - 8}" text-anchor="middle" ${f} font-weight="800" font-size="10" letter-spacing="2" fill="${ink}">SIDDIQIYA</text>`;
    case 'logo':
      return `<g><circle cx="${cx + 40}" cy="${cy - 10}" r="13" fill="none" stroke="${ink}" stroke-width="2.4"/><text x="${cx + 40}" y="${cy - 5}" text-anchor="middle" font-family="Playfair Display, Georgia, serif" font-weight="700" font-size="15" fill="${ink}">S</text></g>`;
    case 'merch':
      return `<text x="${cx}" y="${cy + 10}" text-anchor="middle" ${f} font-weight="800" font-size="26" letter-spacing="3" fill="${ink}">STUDIO</text>`;
    default:
      return '';
  }
}

/** Standalone garment SVG. opts: shape, color(hex), view, print, finish, crop */
export function teeSVG({ shape = 'crew', color = '#e7dfd0', view = 'front', print = '', finish = '', crop = false, uid = 'g' } = {}) {
  const S = SHAPES[shape] || SHAPES.crew;
  const light = luminance(color) > 0.35;
  const seam = light ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.14)';
  const ink = light ? '#1a1a1a' : '#efe9de';
  const ribFill = shade(color, light ? -0.06 : 0.05);
  const insideFill = shade(color, light ? -0.22 : -0.35);
  const [cx, cy] = S.chest;
  const back = view === 'back';
  const vb = crop ? (shape === 'oversized' || shape === 'drop' ? '120 20 160 150' : '116 18 168 150') : '0 0 400 440';
  let details = '';
  if (shape === 'raglan') {
    const tint = shade(color, light ? -0.1 : 0.12);
    details += `<path d="M160 56 L116 150 L86 196 Q82 204 74 200 L32 180 Q24 176 28 168 L70 92 Q82 76 100 70 Z" fill="${tint}"/><path d="M240 56 L284 150 L314 196 Q318 204 326 200 L368 180 Q376 176 372 168 L330 92 Q318 76 300 70 Z" fill="${tint}"/><g stroke="${seam}" stroke-width="1.4" fill="none"><path d="M160 56 L116 150"/><path d="M240 56 L284 150"/></g>`;
  }
  // Garment-wash fade: soft, irregular light patches drawn with gradients (no noise filters).
  const vintage = finish === 'vintage'
    ? `<radialGradient id="${uid}w"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    : '';
  const fades = finish === 'vintage'
    ? [[150, 140, 90, 60], [250, 230, 110, 70], [170, 330, 100, 50], [60, 150, 40, 30], [340, 150, 40, 30], [230, 110, 50, 30]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${uid}w)"/>`).join('') + `<rect width="400" height="440" fill="#fff" opacity=".05"/>`
    : '';
  const isOver = shape === 'oversized' || shape === 'drop';
  const armholes = shape === 'raglan' ? [] : isOver ? [] : ['M100 71 Q109 110 114 150', 'M300 71 Q291 110 286 150'];
  const folds = isOver
    ? ['M106 186 Q130 200 140 236', 'M294 186 Q270 202 260 238']
    : ['M118 160 Q138 176 148 212', 'M282 160 Q262 178 252 214'];
  const ribMid = back
    ? (isOver ? 'M165 55 C180 63 220 63 235 55' : 'M159 53 C176 59 224 59 241 53')
    : (isOver ? 'M165 55 C176 82 224 82 235 55' : 'M159 53 C171 79 229 79 241 53');
  const rib = back ? S.backRib : S.rib;
  const inside = back ? S.backInside : S.inside;
  let collar = `<path d="${inside}" fill="${insideFill}"/><path d="${rib}" fill="${ribFill}"/><path d="${ribMid}" fill="none" stroke="${seam}" stroke-width="5" stroke-dasharray=".7 1.9" opacity=".5"/><path d="${rib}" fill="none" stroke="${seam}" stroke-width=".9"/>`;
  if (shape === 'polo') {
    const flap = shade(color, light ? -0.04 : 0.06);
    collar = back
      ? `<path d="M156 50 C176 40 224 40 244 50 L246 62 C224 54 176 54 154 62 Z" fill="${flap}" stroke="${seam}"/>`
      : `<path d="M160 54 L200 98 L240 54 C222 64 178 64 160 54 Z" fill="${insideFill}"/><path d="M156 48 C176 38 224 38 244 48 L240 56 C222 48 178 48 160 56 Z" fill="${shade(color, light ? -0.12 : 0.1)}"/><path d="M160 54 L198 98 L176 108 L146 66 Q148 56 160 54 Z" fill="${flap}" stroke="${seam}"/><path d="M240 54 L202 98 L224 108 L254 66 Q252 56 240 54 Z" fill="${flap}" stroke="${seam}"/><rect x="191" y="96" width="18" height="60" rx="2" fill="${ribFill}" stroke="${seam}"/><circle cx="200" cy="114" r="3.4" fill="${shade(color, light ? -0.3 : 0.3)}"/><circle cx="200" cy="138" r="3.4" fill="${shade(color, light ? -0.3 : 0.3)}"/>`;
  }
  const label = back ? '' : `<rect x="192" y="${shape === 'oversized' || shape === 'drop' ? 58 : 55}" width="16" height="8" rx="1" fill="${light ? '#2a2a2a' : '#e9e1d2'}" opacity=".85"/>`;
  const art = printArt(print, ink, view, cx, back ? cy + 20 : cy).replace('fill="currentColor"', `fill="${color}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><defs>
<linearGradient id="${uid}l" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".22" stop-color="#000" stop-opacity=".02"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset=".78" stop-color="#000" stop-opacity=".03"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
<linearGradient id="${uid}v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient>
<pattern id="${uid}k" width="2.4" height="3.4" patternUnits="userSpaceOnUse"><path d="M0 0 L1.2 2.1 L2.4 0" fill="none" stroke="${light ? '#000' : '#fff'}" stroke-width=".4"/></pattern>
<filter id="${uid}f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="${uid}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#2a2014" flood-opacity=".22"/></filter>
<clipPath id="${uid}c"><path d="${S.body}"/></clipPath>${vintage}</defs>
<g filter="url(#${uid}s)"><path d="${S.body}" fill="${color}"/></g>
<g clip-path="url(#${uid}c)">${details}
<rect width="400" height="440" fill="url(#${uid}l)"/><rect width="400" height="440" fill="url(#${uid}v)"/>
${fades}
<g filter="url(#${uid}f)" fill="none" stroke-linecap="round">${folds.map((d) => `<path d="${d}" stroke="#000" stroke-opacity="${light ? 0.08 : 0.18}" stroke-width="9"/>`).join('')}</g>
<rect width="400" height="440" fill="url(#${uid}k)" opacity="${light ? 0.045 : 0.05}"/>
<g fill="none" stroke="${seam}" stroke-width=".9">${armholes.map((d) => `<path d="${d}"/>`).join('')}</g>
<g fill="none" stroke="${seam}" stroke-width="1" stroke-dasharray="2.6 2">${S.hems.map((d) => `<path d="${d}"/>`).join('')}</g>
<g fill="none" stroke="${seam}" stroke-width="1.2">${S.shoulders.map((d) => `<path d="${d}"/>`).join('')}</g>
<g style="mix-blend-mode:multiply" opacity=".92">${art}</g>
</g>${collar}${label}</svg>`;
}

/** Side profile of the garment (sleeve towards the viewer). */
export function teeSideSVG({ shape = 'crew', color = '#e7dfd0', finish = '', uid = 's' } = {}) {
  const big = shape === 'oversized' || shape === 'drop' || shape === 'heavy';
  const light = luminance(color) > 0.35;
  const seam = light ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.15)';
  const w = big ? 176 : 156;
  const x0 = 200 - w / 2, x1 = 200 + w / 2;
  const hem = big ? 412 : 404;
  const top = big ? 66 : 60;
  // Body seen from the side: rounded shoulder, gentle chest curve, straight side seam to the hem.
  const body = `M${x0 + 34} ${top} Q200 ${top - 14} ${x1 - 30} ${top + 2} Q${x1 + 2} ${top + 10} ${x1 + 4} ${top + 70} L${x1 + 6} ${hem - 8} Q${x1 + 6} ${hem} ${x1 - 2} ${hem} L${x0 + 2} ${hem} Q${x0 - 6} ${hem} ${x0 - 6} ${hem - 8} L${x0 - 4} ${top + 70} Q${x0 - 2} ${top + 8} ${x0 + 34} ${top} Z`;
  // Sleeve hanging from the shoulder, angled slightly forward.
  const sl = big
    ? `M${x0 + 26} ${top + 6} Q200 ${top - 12} ${x1 - 22} ${top + 8} L${x1 + 2} ${top + 150} Q200 ${top + 168} ${x0 + 14} ${top + 146} Z`
    : `M${x0 + 30} ${top + 4} Q200 ${top - 10} ${x1 - 26} ${top + 6} L${x1 - 6} ${top + 122} Q200 ${top + 138} ${x0 + 20} ${top + 118} Z`;
  const cuff = big ? `M${x0 + 16} ${top + 136} Q200 ${top + 156} ${x1} ${top + 140}` : `M${x0 + 22} ${top + 108} Q200 ${top + 126} ${x1 - 8} ${top + 112}`;
  const sleeveFill = shade(color, light ? -0.04 : 0.06);
  const collarFill = shade(color, light ? -0.1 : 0.08);
  const fades = finish === 'vintage' ? `<ellipse cx="200" cy="300" rx="70" ry="80" fill="#fff" opacity=".07"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440" role="img"><defs>
<linearGradient id="${uid}l" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset=".4" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
<linearGradient id="${uid}v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
<linearGradient id="${uid}sl" x1="0" x2="1" y1="0" y2=".3"><stop offset="0" stop-color="#000" stop-opacity=".14"/><stop offset=".45" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<pattern id="${uid}k" width="2.4" height="3.4" patternUnits="userSpaceOnUse"><path d="M0 0 L1.2 2.1 L2.4 0" fill="none" stroke="${light ? '#000' : '#fff'}" stroke-width=".4"/></pattern>
<filter id="${uid}s" x="-30%" y="-20%" width="160%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#2a2014" flood-opacity=".22"/></filter>
<filter id="${uid}d" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".18"/></filter>
<clipPath id="${uid}c"><path d="${body}"/></clipPath></defs>
<g filter="url(#${uid}s)"><path d="${body}" fill="${color}"/></g>
<g clip-path="url(#${uid}c)"><rect width="400" height="440" fill="url(#${uid}l)"/><rect width="400" height="440" fill="url(#${uid}v)"/>${fades}<rect width="400" height="440" fill="url(#${uid}k)" opacity=".045"/>
<path d="M${x0 + 4} ${hem - 12} L${x1} ${hem - 12}" stroke="${seam}" stroke-dasharray="2.6 2" fill="none"/><path d="M${x0 - 6} ${hem - 9} L${x1 + 6} ${hem - 9}" stroke="${seam}" stroke-dasharray="2.6 2" fill="none"/><path d="M201 ${top + 150} L203 ${hem}" stroke="${seam}" stroke-width=".9" fill="none"/></g>
<path d="M${x0 + 40} ${top - 1} Q200 ${top - 16} ${x1 - 34} ${top + 1} Q200 ${top - 6} ${x0 + 40} ${top - 1} Z" fill="${collarFill}" stroke="${seam}" stroke-width=".8"/>
<g filter="url(#${uid}d)"><path d="${sl}" fill="${sleeveFill}"/></g><path d="${sl}" fill="url(#${uid}sl)"/><path d="${sl}" fill="url(#${uid}k)" opacity=".045"/>
<path d="${cuff}" fill="none" stroke="${seam}" stroke-dasharray="2.6 2"/><path d="${sl}" fill="none" stroke="${seam}" stroke-width=".8"/></svg>`;
}

/** Close-up fabric swatch. */
export function fabricSVG({ texture = 'jersey', color = '#e7dfd0', uid = 'f' } = {}) {
  const light = luminance(color) > 0.35;
  const hi = shade(color, light ? 0.35 : 0.18);
  const lo = shade(color, light ? -0.18 : -0.35);
  let pat = '';
  const P = (w, h, body) => `<pattern id="${uid}p" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`;
  switch (texture) {
    case 'pique':
      pat = P(28, 24, `<rect width="28" height="24" fill="${color}"/><g transform="scale(2)"><path d="M0 6 L3.5 0 H10.5 L14 6 L10.5 12 H3.5 Z" fill="${lo}" opacity=".55"/><path d="M2 6 L4.6 1.6 H9.4 L12 6 L9.4 10.4 H4.6 Z" fill="${color}"/><circle cx="7" cy="6" r="1.4" fill="${lo}" opacity=".7"/></g>`);
      break;
    case 'terry':
      pat = P(18, 18, `<rect width="18" height="18" fill="${lo}"/><circle cx="9" cy="9" r="6.4" fill="none" stroke="${color}" stroke-width="3.4"/><circle cx="7.6" cy="7.4" r="1.8" fill="${hi}" opacity=".6"/>`);
      break;
    case 'mesh':
      pat = P(16, 16, `<rect width="16" height="16" fill="${color}"/><circle cx="8" cy="8" r="4" fill="${lo}"/><circle cx="7.2" cy="7.2" r="1.5" fill="${shade(lo, -0.3)}"/>`);
      break;
    default: {
      const w = texture === 'jersey-heavy' ? 20 : texture === 'jersey-fine' ? 11 : 15;
      const h = w * 1.5;
      pat = P(w, h, `<rect width="${w}" height="${h}" fill="${color}"/><path d="M0 0 L${w / 2} ${h * 0.6} L${w} 0" fill="none" stroke="${lo}" stroke-width="${w / 6}" opacity=".55"/><path d="M${w * 0.15} ${h * 0.05} L${w / 2} ${h * 0.45}" stroke="${hi}" stroke-width="${w / 10}" opacity=".5"/>`);
    }
  }
  const slub = texture === 'jersey-slub' || texture === 'jersey-heather';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img"><defs>${pat}
<radialGradient id="${uid}r" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>
<linearGradient id="${uid}f" x1="0" y1="0" x2="1" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity=".18"/><stop offset=".62" stop-color="#fff" stop-opacity=".1"/><stop offset=".75" stop-color="#000" stop-opacity="0"/></linearGradient>
<pattern id="${uid}s" width="37" height="29" patternUnits="userSpaceOnUse">${slub ? `<g fill="${light ? '#000' : '#fff'}" opacity=".16"><rect x="3" y="4" width="9" height="1.6" rx=".8"/><rect x="21" y="13" width="12" height="1.6" rx=".8"/><rect x="8" y="22" width="7" height="1.6" rx=".8"/><circle cx="30" cy="4" r=".9"/><circle cx="16" cy="9" r=".8"/><circle cx="5" cy="15" r=".7"/></g>` : `<g fill="${light ? '#000' : '#fff'}" opacity=".08"><circle cx="5" cy="6" r=".8"/><circle cx="23" cy="3" r=".7"/><circle cx="14" cy="17" r=".8"/><circle cx="31" cy="21" r=".7"/><circle cx="7" cy="25" r=".6"/></g>`}</pattern></defs>
<rect width="400" height="400" fill="url(#${uid}p)"/><rect width="400" height="400" fill="url(#${uid}s)"/><rect width="400" height="400" fill="url(#${uid}f)"/><rect width="400" height="400" fill="url(#${uid}r)"/></svg>`;
}
