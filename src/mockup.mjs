// Studio mockup templates: flat-lay garments with defined print areas.
// Artwork is placed inside a print-area group, below the garment's shading and
// knit-texture layers, so prints pick up the folds and fabric of the shirt.
import { luminance, shade } from './art.mjs';

const CREW = 'M158 52 C170 82 230 82 242 52 L300 70 Q318 76 330 92 L372 168 Q376 176 368 180 L326 200 Q318 204 314 196 L286 150 L288 404 Q288 412 280 412 L120 412 Q112 412 112 404 L114 150 L86 196 Q82 204 74 200 L32 180 Q24 176 28 168 L70 92 Q82 76 100 70 Z';
const OVER = 'M164 54 C176 80 224 80 236 54 L316 80 Q332 86 340 100 L384 196 Q388 206 378 210 L332 226 Q322 230 318 220 L298 174 L300 412 Q300 420 292 420 L108 420 Q100 420 100 412 L102 174 L82 220 Q78 230 68 226 L22 210 Q12 206 16 196 L60 100 Q68 86 84 80 Z';
const DROP = OVER.replace('L300 412 Q300 420 292 420 L108 420 Q100 420 100 412', 'L298 396 Q298 404 290 404 L110 404 Q102 404 102 396');

/** Real-world scale: 1 unit ≈ 0.3 cm on a size M body (52 cm half chest). */
export const CM_PER_UNIT = 0.3;

const regular = {
  body: CREW,
  neck: { front: 'M158 52 C170 82 230 82 242 52', back: 'M158 52 C176 62 224 62 242 52' },
  rib: { front: 'M158 52 C170 84 230 84 242 52 C228 72 172 72 158 52 Z', back: 'M158 52 C176 64 224 64 242 52 C226 54 174 54 158 52 Z' },
  inside: { front: 'M158 52 C172 72 228 72 242 52 C226 44 174 44 158 52 Z', back: 'M158 52 C174 54 226 54 242 52 C226 45 174 45 158 52 Z' },
  ribMid: { front: 'M159 53 C171 79 229 79 241 53', back: 'M159 53 C176 59 224 59 241 53' },
  armholes: ['M100 71 Q109 110 114 150', 'M300 71 Q291 110 286 150'],
  hems: ['M35 172 L77 192', 'M37 168 L79 188', 'M365 172 L323 192', 'M363 168 L321 188', 'M113 400 L287 400', 'M113 396 L287 396'],
  folds: { dark: ['M118 160 Q138 176 148 212', 'M282 160 Q262 178 252 214', 'M150 300 Q200 312 252 298'], light: ['M126 158 Q146 172 156 206', 'M274 158 Q254 174 244 208'] },
  areas: {
    front: { x: 148, y: 100, w: 104, h: 150, label: 'Front print area' },
    back: { x: 148, y: 84, w: 104, h: 160, label: 'Back print area' },
    left: { cx: 76, cy: 140, w: 34, h: 28, rot: 24, label: 'Left sleeve' },
    right: { cx: 324, cy: 140, w: 34, h: 28, rot: -24, label: 'Right sleeve' },
  },
  collarY: { front: 80, back: 62 },
  crop: { left: '-8 30 252 252', right: '156 30 252 252' },
};
const oversized = {
  body: OVER,
  neck: { front: 'M164 54 C176 80 224 80 236 54', back: 'M164 54 C180 66 220 66 236 54' },
  rib: { front: 'M164 54 C176 88 224 88 236 54 C226 74 174 74 164 54 Z', back: 'M164 54 C180 68 220 68 236 54 C224 58 176 58 164 54 Z' },
  inside: { front: 'M164 54 C174 74 226 74 236 54 C222 46 178 46 164 54 Z', back: 'M164 54 C176 58 224 58 236 54 C222 47 178 47 164 54 Z' },
  ribMid: { front: 'M165 55 C176 82 224 82 235 55', back: 'M165 55 C180 63 220 63 235 55' },
  armholes: ['M66 104 Q86 140 102 176', 'M334 104 Q314 140 298 176'],
  hems: ['M25 202 L71 218', 'M27 198 L73 214', 'M375 202 L329 218', 'M373 198 L327 214', 'M101 408 L299 408', 'M101 404 L299 404'],
  folds: { dark: ['M106 186 Q130 200 140 236', 'M294 186 Q270 202 260 238', 'M150 316 Q200 330 254 314'], light: ['M114 184 Q138 196 148 230', 'M286 184 Q262 198 252 232'] },
  areas: {
    front: { x: 146, y: 104, w: 108, h: 156, label: 'Front print area' },
    back: { x: 146, y: 88, w: 108, h: 166, label: 'Back print area' },
    left: { cx: 66, cy: 152, w: 36, h: 30, rot: 21, label: 'Left sleeve' },
    right: { cx: 334, cy: 152, w: 36, h: 30, rot: -21, label: 'Right sleeve' },
  },
  collarY: { front: 82, back: 66 },
  crop: { left: '-14 40 256 256', right: '158 40 256 256' },
};
const drop = { ...oversized, body: DROP, hems: [...oversized.hems.slice(0, 4), 'M103 392 L297 392', 'M103 388 L297 388'] };
const polo = {
  ...regular,
  areas: { ...regular.areas, front: { x: 214, y: 114, w: 40, h: 40, label: 'Left chest' } },
};
const raglan = {
  ...regular,
  armholes: ['M160 56 L116 150', 'M240 56 L284 150'],
  raglan: ['M160 56 L116 150 L86 196 Q82 204 74 200 L32 180 Q24 176 28 168 L70 92 Q82 76 100 70 Z', 'M240 56 L284 150 L314 196 Q318 204 326 200 L368 180 Q376 176 372 168 L330 92 Q318 76 300 70 Z'],
};

export const TEMPLATES = { crew: regular, heavy: regular, oversized, drop, polo, raglan };

/** Transform that maps print-area local space (0..w, 0..h) into garment space. */
export function areaTransform(a) {
  return a.rot !== undefined ? `translate(${a.cx} ${a.cy}) rotate(${a.rot}) translate(${-a.w / 2} ${-a.h / 2})` : `translate(${a.x} ${a.y})`;
}

function knitPattern(id, texture, ink) {
  switch (texture) {
    case 'pique':
      return `<pattern id="${id}" width="4" height="3.4" patternUnits="userSpaceOnUse"><path d="M0 1.7 L1 0 H3 L4 1.7 L3 3.4 H1 Z" fill="none" stroke="${ink}" stroke-width=".35"/></pattern>`;
    case 'mesh':
      return `<pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".7" fill="${ink}"/></pattern>`;
    default:
      return `<pattern id="${id}" width="2.2" height="3.2" patternUnits="userSpaceOnUse"><path d="M0 0 L1.1 2 L2.2 0" fill="none" stroke="${ink}" stroke-width=".35"/></pattern>`;
  }
}

/**
 * Full garment SVG for the studio.
 * view: 'front' | 'back' | 'left' | 'right'. Returns markup containing
 * <g data-art> (empty, filled by the editor), a dashed area outline and a hit target.
 */
export function garmentSVG({ shape = 'crew', view = 'front', color = '#e7dfd0', texture = 'jersey', uid = 'm' }) {
  const T = TEMPLATES[shape] || regular;
  const side = view === 'back' ? 'back' : 'front';
  const sleeve = view === 'left' || view === 'right';
  const light = luminance(color) > 0.35;
  const seam = light ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.16)';
  const stitch = light ? 'rgba(0,0,0,.26)' : 'rgba(255,255,255,.2)';
  const ribFill = shade(color, light ? -0.07 : 0.06);
  const insideFill = shade(color, light ? -0.24 : -0.38);
  const area = T.areas[view];
  const vb = sleeve ? T.crop[view] : '0 0 400 440';
  const knitInk = light ? '#000' : '#fff';

  let details = '';
  if (T.raglan) details += T.raglan.map((d) => `<path d="${d}" fill="${shade(color, light ? -0.08 : 0.1)}"/>`).join('');

  let collar = `<path d="${T.inside[side]}" fill="${insideFill}"/><path d="${T.rib[side]}" fill="${ribFill}"/><path d="${T.ribMid[side]}" fill="none" stroke="${seam}" stroke-width="5" stroke-dasharray=".7 1.9" opacity=".55"/><path d="${T.rib[side]}" fill="none" stroke="${seam}" stroke-width=".8"/>`;
  if (side === 'front') collar += `<rect x="193" y="${shape === 'oversized' || shape === 'drop' ? 57 : 54}" width="14" height="7" rx="1" fill="${light ? '#2a2a2a' : '#ece4d6'}" opacity=".85"/>`;
  if (shape === 'polo') {
    const flap = shade(color, light ? -0.04 : 0.06);
    const btn = shade(color, light ? -0.32 : 0.32);
    collar = side === 'back'
      ? `<path d="M156 50 C176 40 224 40 244 50 L246 62 C224 54 176 54 154 62 Z" fill="${flap}" stroke="${seam}" stroke-width=".8"/>`
      : `<path d="M160 54 L200 98 L240 54 C222 64 178 64 160 54 Z" fill="${insideFill}"/><path d="M156 48 C176 38 224 38 244 48 L240 56 C222 48 178 48 160 56 Z" fill="${shade(color, light ? -0.12 : 0.1)}"/><path d="M160 54 L198 98 L176 108 L146 66 Q148 56 160 54 Z" fill="${flap}" stroke="${seam}" stroke-width=".8"/><path d="M240 54 L202 98 L224 108 L254 66 Q252 56 240 54 Z" fill="${flap}" stroke="${seam}" stroke-width=".8"/><rect x="191" y="96" width="18" height="60" rx="2" fill="${ribFill}" stroke="${seam}" stroke-width=".8"/><circle cx="200" cy="114" r="3.2" fill="${btn}"/><circle cx="200" cy="138" r="3.2" fill="${btn}"/>`;
  }

  const t = areaTransform(area);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="mockup-svg" role="img" aria-label="${side === 'back' ? 'Back' : sleeve ? area.label : 'Front'} of garment">
<defs>
<clipPath id="${uid}b"><path d="${T.body}"/></clipPath>
<clipPath id="${uid}a"><rect width="${area.w}" height="${area.h}"/></clipPath>
<linearGradient id="${uid}l" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset=".2" stop-color="#000" stop-opacity=".03"/><stop offset=".48" stop-color="#fff" stop-opacity=".07"/><stop offset=".8" stop-color="#000" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<linearGradient id="${uid}v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>
<radialGradient id="${uid}r" cx=".36" cy=".22" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
${knitPattern(uid + 'k', texture, knitInk)}
<filter id="${uid}f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="${uid}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="11" flood-color="#2a2014" flood-opacity=".24"/></filter>
</defs>
<g filter="url(#${uid}s)"><path d="${T.body}" fill="${color}"/></g>
<g clip-path="url(#${uid}b)">
${details}
<g transform="${t}"><g clip-path="url(#${uid}a)"><g data-art opacity=".96"></g></g></g>
<g pointer-events="none">
<rect x="-50" y="-50" width="500" height="540" fill="url(#${uid}l)"/>
<rect x="-50" y="-50" width="500" height="540" fill="url(#${uid}v)"/>
<rect x="-50" y="-50" width="500" height="540" fill="url(#${uid}r)"/>
<g filter="url(#${uid}f)" fill="none" stroke-linecap="round">${T.folds.dark.map((d) => `<path d="${d}" stroke="#000" stroke-opacity="${light ? 0.09 : 0.2}" stroke-width="9"/>`).join('')}${T.folds.light.map((d) => `<path d="${d}" stroke="#fff" stroke-opacity="${light ? 0.22 : 0.06}" stroke-width="6"/>`).join('')}</g>
<rect x="-50" y="-50" width="500" height="540" fill="url(#${uid}k)" opacity="${light ? 0.05 : 0.06}"/>
<g fill="none" stroke="${seam}" stroke-width=".9">${T.armholes.map((d) => `<path d="${d}"/>`).join('')}</g>
<g fill="none" stroke="${stitch}" stroke-width=".7" stroke-dasharray="2.2 1.6">${T.hems.map((d) => `<path d="${d}"/>`).join('')}</g>
</g></g>
<g pointer-events="none">${collar}</g>
<g transform="${t}" data-outline pointer-events="none"><rect width="${area.w}" height="${area.h}" fill="none" stroke="${light ? '#111' : '#faf9f6'}" stroke-opacity=".55" stroke-width="${sleeve ? 0.5 : 0.8}" stroke-dasharray="${sleeve ? '1.5 1.5' : '3 2.5'}" vector-effect="non-scaling-stroke"/></g>
<g transform="${t}"><rect data-hit width="${area.w}" height="${area.h}" fill="transparent"/></g>
</svg>`;
}
