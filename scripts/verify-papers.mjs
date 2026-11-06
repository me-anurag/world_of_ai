// Checks every key paper against Crossref and arXiv, and writes build/paper-report.csv.
// Run on your own machine (needs internet): node scripts/verify-papers.mjs
// Each paper gets: match (title and year agree), year-differs, title-differs, or not-found.
// Review every row that is not "match" by hand before marking papers verified.
import fs from 'node:fs';
const { nodes } = JSON.parse(fs.readFileSync('src/data/site.json', 'utf8'));
const seen = new Map();
for (const n of nodes) if (n.paper) { const k = n.paper.title.toLowerCase(); if (!seen.has(k)) seen.set(k, { ...n.paper, topics: [] }); seen.get(k).topics.push(n.id); }
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const sim = (a, b) => { const A = new Set(norm(a).split(' ')), B = new Set(norm(b).split(' ')); let i = 0; for (const w of A) if (B.has(w)) i++; return i / Math.max(A.size, B.size, 1); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function crossref(p) {
  const u = `https://api.crossref.org/works?rows=3&query.bibliographic=${encodeURIComponent(p.title + ' ' + p.authors)}`;
  const r = await fetch(u, { headers: { 'User-Agent': 'world-of-ai-verifier/1.0' } }); if (!r.ok) return [];
  const j = await r.json();
  return j.message.items.map(it => ({ title: (it.title || [''])[0], year: (it.issued?.['date-parts']?.[0]?.[0]) || null, id: it.DOI ? 'doi:' + it.DOI : '' }));
}
async function arxiv(p) {
  const u = `https://export.arxiv.org/api/query?max_results=3&search_query=ti:${encodeURIComponent('"' + p.title + '"')}`;
  const r = await fetch(u); if (!r.ok) return [];
  const x = await r.text();
  return [...x.matchAll(/<entry>[\s\S]*?<id>([^<]+)<\/id>[\s\S]*?<published>(\d{4})[\s\S]*?<title>([\s\S]*?)<\/title>/g)].map(m => ({ id: m[1], year: +m[2], title: m[3].replace(/\s+/g, ' ') }));
}
const rows = [['status', 'year', 'title', 'authors', 'found_title', 'found_year', 'found_id', 'topics']];
let i = 0;
for (const p of seen.values()) {
  i++;
  let cands = [];
  try { cands = [...await arxiv(p), ...await crossref(p)]; } catch (e) { /* network error: leave not-found */ }
  const best = cands.map(c => ({ ...c, s: sim(p.title, c.title) })).sort((a, b) => b.s - a.s)[0];
  let status = 'not-found';
  if (best && best.s >= 0.8) status = Math.abs((best.year || 0) - p.year) <= 1 ? 'match' : 'year-differs';
  else if (best && best.s >= 0.5) status = 'title-differs';
  rows.push([status, p.year, p.title, p.authors, best?.title || '', best?.year || '', best?.id || '', p.topics.join(' ')]);
  process.stdout.write(`\r${i}/${seen.size}`);
  await sleep(1100);
}
fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/paper-report.csv', rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n');
const tally = rows.slice(1).reduce((t, r) => (t[r[0]] = (t[r[0]] || 0) + 1, t), {});
console.log('\n', tally, '\nWrote build/paper-report.csv');
