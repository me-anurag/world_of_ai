// Turns build/atlas.json (from check_and_build_data.py) into src/data/site.json for the site.
// Assigns stable, readable URL slugs (locked in content/slugs.json so published URLs never change),
// computes learning paths, and adds the derived fields pages need.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'build/atlas.json'), 'utf8'));
const lockPath = path.join(root, 'content/slugs.json');
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : {};

const N = new Map(atlas.nodes.map(n => [n.id, n]));
const kids = new Map(atlas.nodes.map(n => [n.id, []]));
for (const n of atlas.nodes) if (n.parent) kids.get(n.parent).push(n.id);

const slugify = s => s
  .replace(/\s*\([^)]*\)/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[⊃]/g, ' ').replace(/[‐-―]/g, '-')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 70).replace(/-+$/, '');

const kindOf = n => n.level === 0 ? 'world' : n.level === 1 ? 'field' : n.level === 2 ? 'area' : 'topic';
const fieldOf = id => id.split('.')[0];

// --- slugs: fields and areas are unique within their parent; topics are unique site-wide
const used = new Set();
const slug = {};
for (const n of atlas.nodes) {
  if (lock[n.id]) { slug[n.id] = lock[n.id]; used.add(kindOf(n) + ':' + lock[n.id]); }
}
for (const n of atlas.nodes) {
  if (slug[n.id] || n.level === 0) continue;
  const k = kindOf(n);
  let base = slugify(n.name) || slugify(n.id);
  let s = base;
  const scope = k === 'topic' ? 'topic:' : k + ':' + (n.parent || '') + ':';
  if (k !== 'topic') { s = base; }
  let key = (k === 'topic' ? 'topic:' : k + ':') + s;
  if (used.has(key)) { s = `${base}-${slugify(N.get(fieldOf(n.id)).name).split('-')[0]}`; key = (k === 'topic' ? 'topic:' : k + ':') + s; }
  let i = 2;
  while (used.has(key)) { s = `${base}-${i++}`; key = (k === 'topic' ? 'topic:' : k + ':') + s; }
  used.add(key); slug[n.id] = s;
}
const newLock = {};
for (const n of atlas.nodes) if (n.level > 0) newLock[n.id] = slug[n.id];
fs.writeFileSync(lockPath, JSON.stringify(newLock, null, 1) + '\n');

const url = id => {
  const n = N.get(id);
  if (n.level === 0) return '/';
  if (n.level === 1) return `/fields/${slug[id]}/`;
  if (n.level === 2) return `/fields/${slug[n.parent]}/${slug[id]}/`;
  return `/topics/${slug[id]}/`;
};

// --- inherited prerequisites and learning paths (same rule as the published map)
const inherited = id => {
  const out = []; const own = new Set(N.get(id).pre);
  let p = N.get(id).parent;
  while (p && p !== 'ai') {
    for (const q of N.get(p).pre) if (!own.has(q) && !out.includes(q) && !q.startsWith(id + '.')) out.push(q);
    p = N.get(p).parent;
  }
  return out;
};
const effPre = id => [...N.get(id).pre, ...inherited(id)];
const pathTo = goal => {
  const seen = new Set(), order = [];
  (function visit(id) {
    if (seen.has(id)) return; seen.add(id);
    for (const p of effPre(id)) if (N.has(p)) visit(p);
    order.push(id);
  })(goal);
  // Depth = longest prerequisite chain below a step. A topic never comes after its own
  // subtopics: when both are on the path, the subtopic is placed no earlier than its parent.
  const inPath = new Set(order), depth = {};
  for (const id of order) depth[id] = 0;
  for (let changed = true, guard = 0; changed && guard < 200; guard++) {
    changed = false;
    for (const id of order) {
      const parent = N.get(id).parent;
      const d = Math.max(0, ...effPre(id).filter(p => inPath.has(p)).map(p => depth[p] + 1),
        inPath.has(parent) ? depth[parent] : 0);
      if (d !== depth[id]) { depth[id] = d; changed = true; }
    }
  }
  const lvl = id => N.get(id).level;
  return order.slice().sort((a, b) => depth[a] - depth[b] || lvl(a) - lvl(b) || order.indexOf(a) - order.indexOf(b));
};

const desc = {};
const count = id => (desc[id] = kids.get(id).reduce((s, k) => s + 1 + count(k), 0));
count('ai');

const rev = atlas.reverse;
const nodes = atlas.nodes.map(n => {
  const r = rev[n.id] || { neededBy: [], from: [], xBack: [] };
  const crumbs = []; let p = n.parent; while (p) { crumbs.unshift(p); p = N.get(p).parent; }
  const ip = n.level >= 2 ? inherited(n.id) : [];
  const steps = n.level >= 2 && effPre(n.id).length ? pathTo(n.id) : [];
  return {
    id: n.id, name: n.name, slug: slug[n.id] || '', url: url(n.id), kind: kindOf(n), level: n.level,
    field: n.level >= 1 ? fieldOf(n.id) : null, parent: n.parent, crumbs,
    def: n.def, formula: n.formula || null, aka: n.aka, status: n.status, difficulty: n.difficulty,
    year: n.year, paper: n.paper || null, review: n.review || null,
    pre: n.pre, inheritedPre: ip, to: n.to,
    related: [...new Set([...n.x, ...r.xBack])],
    requiredFor: r.neededBy, developedFrom: r.from.filter(x => !n.pre.includes(x)),
    children: kids.get(n.id), descendants: desc[n.id],
    path: steps,
  };
});

fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/site.json'), JSON.stringify({ stats: atlas.stats, nodes }));

// downloadable dataset (JSON + CSV) in public/data
fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
const pub = nodes.map(({ path: _p, descendants: _d, crumbs: _c, ...rest }) => rest);
fs.writeFileSync(path.join(root, 'public/data/atlas-of-ai.json'), JSON.stringify({ version: new Date().toISOString().slice(0, 10), license: 'CC BY 4.0', topics: pub }, null, 1));
const csvCell = v => { const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const cols = ['id', 'name', 'kind', 'parent', 'status', 'difficulty', 'year', 'def', 'formula', 'aka', 'pre', 'to', 'related', 'paper_authors', 'paper_title', 'paper_year', 'url'];
const rows = [cols.join(',')].concat(nodes.map(n => cols.map(c => csvCell(
  c === 'paper_authors' ? n.paper?.authors : c === 'paper_title' ? n.paper?.title : c === 'paper_year' ? n.paper?.year : n[c])).join(',')));
fs.writeFileSync(path.join(root, 'public/data/atlas-of-ai.csv'), rows.join('\n') + '\n');

const withPath = nodes.filter(n => n.path.length).length;
console.log(`site data: ${nodes.length} nodes, ${withPath} learning paths, slugs locked in content/slugs.json`);
