// Content lint: rejects phrasing that reads as filler or machine-written,
// and definitions that are hard to read. Runs on the built data before the site build.
import fs from 'node:fs';
const { nodes } = JSON.parse(fs.readFileSync('src/data/site.json', 'utf8'));

export const BANNED = [
  /\bdelve/i, /\btapestry\b/i, /\bgame[- ]chang/i, /\brevolutioni[sz]/i, /\bunlock(s|ing)? the\b/i,
  /\bin today's\b/i, /\bfast-paced\b/i, /\bever-evolving\b/i, /\bseamless(ly)?\b/i, /\bcutting-edge\b/i,
  /\bleverag(e|es|ing) the power\b/i, /\bplays? a (crucial|pivotal|vital) role\b/i, /\bpivotal\b/i,
  /\bit is (important|worth) (to note|noting)\b/i, /\bin the realm of\b/i, /\bembark/i, /\bunleash/i,
  /\bholistic\b/i, /\brobust and scalable\b/i, /\bsynerg/i, /\bnavigat(e|ing) the (complex|landscape)/i,
  /\blandscape of\b/i, /\btestament to\b/i, /\bharness(es|ing)? the\b/i, /\bempower/i,
  /\bat its core\b/i, /\bworld of ai\b/i, /\bnot just .{1,40}, but\b/i, /✨|🚀|🧠|💡/u,
];
const problems = [];
const sentences = s => s.split(/(?<=[.!?])\s+(?=[A-Z(])/);
for (const n of nodes) {
  const texts = [['def', n.def || '']];
  for (const [k, t] of texts) {
    for (const re of BANNED) if (re.test(t)) problems.push(`${n.id}: banned phrase ${re} in ${k}`);
    const dashes = (t.match(/—/g) || []).length;
    if (dashes > 1) problems.push(`${n.id}: ${dashes} em dashes in ${k}`);
    for (const s of sentences(t)) {
      const w = s.split(/\s+/).filter(Boolean).length;
      if (w > 40) problems.push(`${n.id}: sentence of ${w} words in ${k}`);
    }
  }
  if (!n.def || n.def.length < 30) problems.push(`${n.id}: definition missing or too short`);
}
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain && problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nlint-content: ${problems.length} problem(s)`);
  process.exit(1);
}
if (isMain) console.log(`lint-content: ${nodes.length} entries clean`);
