import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rail, safeHref } from './shell.mjs';
import { makeEngine } from './bin/lib/engine.mjs';
import { helpers } from './bin/lib/helpers.mjs';
import { compose, sectionsOf, readJSON, ROOT } from './bin/lib/compose.mjs';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const groups = [{ id: 'a', label: 'A', destinations: [{ label: 'X', href: '/x/', icon: 'book-open' }, { label: 'P', href: '/p/', private: true }] }];

test('rail: groups are headings, compact strip mirrors destinations, current + page group render', () => {
  const html = rail({ title: 'T', groups, current: '/x/', page: [{ label: 'Why', href: '#why' }] });
  assert.equal((html.match(/<section class="siso-sidebar__nav-group"/g) || []).length, 1);
  assert.doesNotMatch(html, /<details class="siso-sidebar__nav-group"(?![^>]*page-group)/);
  assert.equal((html.match(/siso-sidebar__compact-link/g) || []).length, 2);
  assert.match(html, /nav-link is-active" href="\/x\/"[^>]*aria-current="page"/);
  assert.match(html, /<details class="siso-sidebar__nav-group siso-sidebar__page-group"[^>]*open>/);
  assert.match(html, /data-icon="lock"/);
  assert.match(html, /siso-sidebar__search-input/);
});
test('rail: escapes content and rejects executable and protocol-relative links', () => {
  assert.match(rail({ title: '<script>', groups: [{ id: 'g', label: 'G', destinations: [{ label: 'A&B', href: '/agents/' }] }] }), /&lt;script&gt;/);
  for (const href of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'https://good.test\n', 'x/y']) assert.throws(() => safeHref(href));
  for (const href of ['/a/', './a.html', '../a/', '#x', 'https://a.b/c']) assert.doesNotThrow(() => safeHref(href));
});
test('engine: if/else, each with meta, partials with context, raw, helpers, comments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'parts-'));
  writeFileSync(join(dir, 'x.html'), '{{!-- c {a:{b}} --}}<b>{{name}}</b>{{#each items}}<i>{{@n}}:{{.}}{{#if @last}}!{{/if}}</i>{{else}}none{{/each}}{{#if missing}}bad{{else}}ok{{/if}}{{> y sub}}{{{raw}}}{{icon lock}}');
  writeFileSync(join(dir, 'y.html'), '[{{k}}/{{../name}}/{{@root.name}}]');
  const e = makeEngine({ partsDir: dir, helpers });
  const out = e.render(e.partial('x'), { name: '<n>', items: ['a', 'b'], sub: { k: 'K' }, raw: '<u>r</u>' });
  assert.equal(out.replace(/<svg[\s\S]*<\/svg>/, '[svg]'), '<b>&lt;n&gt;</b><i>1:a</i><i>2:b!</i>ok[K/&lt;n&gt;/&lt;n&gt;]<u>r</u>[svg]');
  assert.equal(e.render(e.partial('x'), { name: 'n', items: [], sub: { k: 'K' }, raw: '' }).replace(/<svg[\s\S]*<\/svg>/, ''), '<b>n</b>noneok[K/n/n]');
});
test('compose v1 (pinned): every built family renders its example inside the shell with an On-this-page group', () => {
  const nav = readJSON(join(ROOT, 'site', 'nav.json'));
  const plan = readJSON(join(ROOT, 'site', 'templates.json'));
  for (const id of plan.order) {
    let data; try { data = readJSON(join(ROOT, 'templates', id, 'example.json')); } catch { continue; }
    const current = id === 'U23' ? '/' : `/t/${id}/`;
    if (!existsSync(join(ROOT, 'templates', id, 'template.html')) && !existsSync(join(ROOT, 'templates', `${id}.html`))) continue; // v2-only family (U24)
    const html = compose(id, data, { nav, current, base: '', look: 'v1' });
    assert.match(html, /<nav class="siso-sidebar is-expanded"/, id);
    assert.ok(sectionsOf(html).length >= 2, `${id} has sections`);
    assert.match(html, /siso-sidebar__page-group/, `${id} page group`);
    assert.match(html, new RegExp(`href="${current}"[^>]*aria-current="page"`), `${id} current marked`);
    assert.doesNotMatch(html.replace(/<code>[^<]*<\/code>/g, ''), /\{\{[#>/a-z@.]/, `${id} no unrendered tags`);
  }
});
