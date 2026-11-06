import data from '../data/site.json';

export const nodes = data.nodes;
export const stats = data.stats;
export const byId = new Map(nodes.map(n => [n.id, n]));
export const get = id => byId.get(id);
export const world = byId.get('ai');
export const fields = world.children.map(get);
export const topics = nodes.filter(n => n.kind === 'topic');
export const areas = nodes.filter(n => n.kind === 'area');

export const levelLabel = n => ['Overview', 'Field', 'Area', 'Topic', 'Subtopic'][n.level] ?? 'Subtopic';

export const STATUS = {
  foundational: { label: 'Foundational', note: 'Core knowledge that later topics rely on.' },
  dominant: { label: 'Standard practice', note: 'The current standard in practice.' },
  active: { label: 'Active research', note: 'Still changing; details may date quickly.' },
  classic: { label: 'Historical, still taught', note: 'No longer state of the art, but still taught and useful.' },
  superseded: { label: 'Superseded', note: 'Replaced by better methods; kept for context.' },
  milestone: { label: 'Historical event', note: 'A dated event in the history of the field.' },
  debate: { label: 'Open question', note: 'Debated; there is no agreed answer.' },
  border: { label: 'Neighbouring field', note: 'A related discipline, covered only to the depth AI uses it.' },
};
export const DIFFICULTY = { beg: 'Introductory', int: 'Intermediate', adv: 'Advanced' };

export const fieldOf = n => (n.field ? get(n.field) : null);
export const trail = n => n.crumbs.slice(1).map(c => get(c).name).join(' › ');

// Most-required topics: a neutral, data-derived list of common starting points.
export const mostRequired = (k = 12) => topics
  .filter(n => n.requiredFor.length)
  .sort((a, b) => b.requiredFor.length - a.requiredFor.length || a.name.localeCompare(b.name))
  .slice(0, k);

export const papers = (() => {
  const seen = new Map();
  for (const n of nodes) {
    if (!n.paper) continue;
    const key = n.paper.title.toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...n.paper, topics: [] });
    seen.get(key).topics.push(n.id);
  }
  return [...seen.values()].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
})();

export const scholarLink = p => `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${p.title}" ${p.authors.split(',')[0]}`)}`;
