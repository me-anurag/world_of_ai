// Renders scripts/og-card.html to public/og.png (1200x630) with headless Chrome.
// Run after changing the card or the headline numbers: node scripts/make-og-image.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = candidates.find(p => fs.existsSync(p));
if (!chrome) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(1); }

const out = path.join(root, 'public/og.png');
const r = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1200,630', '--virtual-time-budget=3000', '--allow-file-access-from-files',
  `--screenshot=${out}`, pathToFileURL(path.join(root, 'scripts/og-card.html')).href,
], { stdio: 'inherit' });
if (r.status !== 0 || !fs.existsSync(out)) process.exit(1);
console.log(`wrote ${path.relative(root, out)} (${fs.statSync(out).size} bytes)`);
