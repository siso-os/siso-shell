// v2 look: every v1 example re-renders under v2 with no data change, v1 stays pinnable, and the page is self-contained.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { compose, facesWanted, lookOf, readJSON, ROOT, sectionsOf } from '../bin/lib/compose.mjs';
import { makeEngine } from '../bin/lib/engine.mjs';
import { projectHue, tone, faceStatus } from './v2.mjs';

const V2 = readdirSync(join(ROOT, 'templates')).filter((id) => existsSync(join(ROOT, 'templates', id, 'v2.html')));
const nav = readJSON(join(ROOT, 'site', 'nav.json'));
const clean = (html) => html.replace(/<code>[^<]*<\/code>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');

test('the six v2 families exist', () => { assert.deepEqual(V2.sort(), ['U10', 'U16', 'U2', 'U24', 'U4', 'U7']); });

test('look precedence: opts > meta.look > SISO_SHELL_LOOK > default v2; variants and v1-only families stay v1; U24 is v2-only', () => {
  assert.equal(lookOf('U7', {}), 'v2');
  assert.equal(lookOf('U7', {}, { look: 'v1' }), 'v1');
  assert.equal(lookOf('U7', { meta: { look: 'v1' } }), 'v1');
  assert.equal(lookOf('U7', { meta: { look: 'v1' } }, { look: 'v2' }), 'v2');
  process.env.SISO_SHELL_LOOK = 'v1'; assert.equal(lookOf('U4', {}), 'v1'); delete process.env.SISO_SHELL_LOOK;
  assert.equal(lookOf('U23/detail', {}), 'v1');
  assert.equal(lookOf('U8', {}), 'v1');
  assert.equal(lookOf('U24', {}, { look: 'v1' }), 'v2');
});

for (const id of V2) {
  test(`${id}: example renders in v2, self-contained, no unrendered tags or leaked values`, () => {
    const data = readJSON(join(ROOT, 'templates', id, 'example.json'));
    const html = compose(id, data, { nav: false });
    assert.match(html, /data-look="v2"/);
    assert.match(html, /<style>[\s\S]*--crm-color-text[\s\S]*Depth comes from light|<style>[\s\S]*depth from light/i, 'tokens + look inline');
    assert.doesNotMatch(html, /<link rel="stylesheet"/, 'no external CSS without a rail');
    assert.doesNotMatch(html, /<nav class="siso-sidebar/, 'no rail unless asked');
    const c = clean(html);
    assert.doesNotMatch(c, /\{\{[#>/a-z@.]/, 'no unrendered tags');
    assert.doesNotMatch(c, /\[object Object\]|>undefined<|="undefined"|NaN/, 'no leaked values');
    assert.ok(sectionsOf(html).length >= 3, 'sections for On this page');
    assert.doesNotMatch(c, /<dl class="kv"/, 'rule 7: no key: value grids');
  });
  if (id !== 'U24') test(`${id}: same data still renders v1 (pinned), unchanged contract`, () => {
    const html = compose(id, readJSON(join(ROOT, 'templates', id, 'example.json')), { nav, look: 'v1' });
    assert.match(html, /data-family="/); assert.doesNotMatch(html, /data-look="v2"/);
  });
}

test('with a nav, v2 shows the CRM rail collapsed and links its CSS by base (or inlines it)', () => {
  const data = readJSON(join(ROOT, 'templates', 'U4', 'example.json'));
  const linked = compose('U4', data, { nav, base: '.', current: '/t/U4/' });
  assert.match(linked, /<nav class="siso-sidebar is-collapsed"/); assert.match(linked, /href="\.\/shell\/rail\.css"/);
  const inl = compose('U4', data, { nav, inline: true });
  assert.doesNotMatch(inl, /<link rel="stylesheet"/);
});

test('U24 entity: owner capsule, stat bar, typed cards, not-recorded line', () => {
  const html = compose('U24', readJSON(join(ROOT, 'templates', 'U24', 'example.json')), { nav: false, faces: false });
  for (const re of [/class="cap2/, /class="stats/, /class="bento/, /class="notrec"/, /data-face="/]) assert.match(html, re);
});

test('Halo faces are OFF by default (public repo; the engine is HALO\'s code): only faces:true or SISO_HALO_FACE turns them on', () => {
  const data = readJSON(join(ROOT, 'templates', 'U24', 'example.json'));
  const env = process.env.SISO_HALO_FACE; delete process.env.SISO_HALO_FACE;
  try {
    assert.doesNotMatch(compose('U24', data, { nav: false }), /HaloFace\s*=|window\.HaloFace\s*=/, 'no engine by default');
    process.env.SISO_HALO_FACE = 'off';
    assert.doesNotMatch(compose('U24', data, { nav: false, faces: true }) + compose('U24', data, { nav: false }), /HaloFace\s*=/, 'off wins over env');
  } finally { if (env === undefined) delete process.env.SISO_HALO_FACE; else process.env.SISO_HALO_FACE = env; }
  assert.equal(facesWanted({}), !!env && env !== 'off');
  assert.equal(facesWanted({ faces: true }), env !== 'off');
  assert.equal(facesWanted({ faces: false }), false);
});

test('strict engine: an item without a key never borrows its page\'s', () => {
  const e = makeEngine({ partsDir: ROOT, strict: true });
  assert.equal(e.render('{{#each xs}}[{{href}}]{{/each}}', { href: '/page', xs: [{}, { href: '/x' }] }), '[][/x]');
  const loose = makeEngine({ partsDir: ROOT });
  assert.equal(loose.render('{{#each xs}}[{{href}}]{{/each}}', { href: '/page', xs: [{}] }), '[/page]');
});

test('hue and tones: red/orange/amber are never a project hue; v1 tones map to the semantic palette', () => {
  for (const s of ['HALO', 'Agent Base', 'OFM', 'x', 'restaurants', 'siso-shell']) { const h = projectHue(s); assert.ok(h >= 55 && h < 340, `${s} ${h}`); }
  assert.equal(tone('now'), 'g'); assert.equal(tone('warn'), 'a'); assert.equal(tone('blocked'), 'r'); assert.equal(tone('research'), 'v'); assert.equal(tone('whatever'), 'n');
  assert.equal(faceStatus('working'), 'working'); assert.equal(faceStatus('idle · closed by D-20'), 'waiting'); assert.equal(faceStatus('closed'), 'done');
});
