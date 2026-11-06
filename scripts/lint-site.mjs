// Site lint: scans the built HTML for banned phrasing and broken internal links.
import fs from 'node:fs';
import path from 'node:path';
import { BANNED } from './lint-content.mjs';
import { site } from '../src/site.config.mjs';
const dist = 'dist';
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'pagefind') walk(p); } else if (p.endsWith('.html')) files.push(p); } })(dist);
const exists = (href) => {
  const clean = decodeURIComponent(href.split('#')[0].split('?')[0]);
  if (!clean) return true;
  const p = path.join(dist, clean);
  return fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, 'index.html')));
};
const problems = [];
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  // The site's own name ("World of AI") matches a banned filler phrase; drop exact-case uses of it before checking.
  const text = html.replace(/<i>[\s\S]*?<\/i>/g, ' ').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').split(site.name).join(' ');
  for (const re of BANNED) if (re.test(text)) problems.push(`${f}: banned phrase ${re}`);
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    if (m[1].startsWith('//')) continue;
    if (!exists(m[1])) problems.push(`${f}: broken link ${m[1]}`);
  }
}
if (problems.length) {
  console.error([...new Set(problems)].slice(0, 200).join('\n'));
  console.error(`\nlint-site: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`lint-site: ${files.length} pages clean`);
