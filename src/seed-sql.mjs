// Prints SQL that seeds apparel_products / apparel_fabrics / apparel_collections from src/data.mjs.
import { products, fabrics, collections, categories } from './data.mjs';
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`;
const shape = Object.fromEntries(categories.map((c) => [c.slug, c.shape]));
const out = [];
out.push('insert into public.apparel_products (id, slug, name, category, fabric, gsm, fit, colors, sizes, description, moq, lead_time, shape, print, finish, sort) values');
out.push(products.map((p, i) => `(${q(p.id)},${q(p.slug)},${q(p.name)},${q(p.cat)},${q(p.fabric)},${p.gsm},${q(p.fit)},${arr(p.colors)},${arr(p.sizes)},${q(p.desc)},'Confirmed with your quotation','Confirmed with your quotation',${q(shape[p.cat])},${q(p.print || '')},${q(p.finish || '')},${i})`).join(',\n') + '\non conflict (id) do nothing;');
out.push('insert into public.apparel_fabrics (slug, name, composition, gsm, texture, description, applications, care, colors, sort) values');
out.push(fabrics.map((f, i) => `(${q(f.slug)},${q(f.name)},${q(f.composition)},array[${f.gsm.join(',')}]::int[],${q(f.texture)},${q(f.description)},${arr(f.applications)},${arr(f.care)},${arr(f.colors)},${i})`).join(',\n') + '\non conflict (slug) do nothing;');
out.push('insert into public.apparel_collections (slug, name, kicker, lead, categories, sort) values');
out.push(collections.map((c, i) => `(${q(c.slug)},${q(c.name)},${q(c.kicker)},${q(c.lead)},${arr(c.cats)},${i})`).join(',\n') + '\non conflict (slug) do nothing;');
console.log(out.join('\n'));
