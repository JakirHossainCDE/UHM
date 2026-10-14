import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import * as css from 'css-tree';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const { window } = new JSDOM(html, { url: 'https://jakirhossaincde.github.io/UHM/' });
const doc = window.document;
const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
assert.equal(new Set(ids).size, ids.length, 'Every HTML id must be unique');
assert.equal(doc.querySelectorAll('h1').length, 1, 'Use one page heading');
assert.equal(doc.documentElement.lang, 'en');
for (const node of doc.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]')) {
  for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
    for (const id of (node.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) assert(doc.getElementById(id), `Missing accessibility target ${id}`);
  }
}
let localLinks = 0;
for (const node of doc.querySelectorAll('[src], [href]')) {
  const href = node.getAttribute('src') || node.getAttribute('href');
  if (!href || /^(https?:|data:|mailto:|blob:)/.test(href)) continue;
  if (href.startsWith('#')) { assert(doc.getElementById(href.slice(1)), `Missing anchor ${href}`); continue; }
  const filename = decodeURIComponent(href.split(/[?#]/)[0]);
  await stat(path.join(root, filename)); localLinks++;
}
for (const image of doc.querySelectorAll('img')) assert(image.hasAttribute('alt'), 'Images need alt text');
for (const button of doc.querySelectorAll('button')) {
  assert(button.getAttribute('aria-label') || button.textContent.trim() || button.title, `Unnamed button ${button.id}`);
}
for (const input of doc.querySelectorAll('input, select')) {
  assert(input.getAttribute('aria-label') || input.closest('label') || doc.querySelector(`label[for="${input.id}"]`), `Unlabelled input ${input.id}`);
}
for (const link of doc.querySelectorAll('a[target="_blank"]')) assert(link.rel.includes('noopener'), 'External tabs need noopener');
const source = await readFile(path.join(root, 'script.js'), 'utf8');
for (const match of source.matchAll(/\$\('([^']+)'\)/g)) assert(doc.getElementById(match[1]), `Script references missing #${match[1]}`);
assert(!/innerHTML\s*=|insertAdjacentHTML|document\.write/.test(source), 'Untrusted content must be rendered as text, not HTML');
assert(!/MAPBOX_ACCESS_TOKEN|pk\.eyJ|service_role|sb_secret_/.test(source), 'Remove obsolete or privileged tokens');
const style = await readFile(path.join(root, 'style.css'), 'utf8');
const errors = [];
const ast = css.parse(style, { positions: true, onParseError: error => errors.push(error.message) });
assert.deepEqual(errors, [], 'CSS must parse without errors');
const media = [];
css.walk(ast, node => { if (node.type === 'Atrule' && node.name === 'media') media.push(css.generate(node.prelude)); });
assert(media.some(value => value.includes('520px')), 'Provide a mobile layout');
assert(media.some(value => value.includes('prefers-reduced-motion')), 'Respect reduced motion');
assert(style.includes(':root[data-theme="dark"]'), 'Provide dark theme tokens');
assert(html.includes('Amna Azeem') && html.includes('Md Jakir Hossain'), 'Preserve original authorship');
console.log(`Static checks passed: ${ids.length} unique IDs, ${localLinks} local links, valid CSS, labelled controls, responsive and reduced-motion rules.`);
window.close();
