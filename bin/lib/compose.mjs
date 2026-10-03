/* bin/lib/compose.mjs — compose(family, data, opts) → page HTML.
 * A family is templates/<id>/template.html (the body, composed from parts/). The page frame is templates/_layout.html:
 * shell rail (from opts.nav or data.nav), topbar breadcrumb, the body, and "On this page" built from the body's
 * <section class="siso-section" id="…"><…><h2>Title</h2>. No framework, no build step beyond node. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEngine, esc } from './engine.mjs';
import { helpers } from './helpers.mjs';
import { rail, head as shellHead } from '../../shell.mjs';
import { prepare, v2helpers } from '../../v2/v2.mjs';
import { homedir } from 'node:os';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const engine = makeEngine({ partsDir: join(ROOT, 'parts'), helpers });

export function readJSON(p) { return JSON.parse(readFileSync(p, 'utf8')); }

/** 'U4' → templates/U4/template.html · 'U23/detail' → templates/U23/detail.html */
export function templateFile(family) {
  const [id, variant = 'template'] = family.split('/');
  let f = join(ROOT, 'templates', id, `${variant}.html`);
  if (!existsSync(f) && variant === 'template' && existsSync(join(ROOT, 'templates', `${id}.html`))) f = join(ROOT, 'templates', `${id}.html`); // page-level: templates/how.html, templates/404.html
  if (!existsSync(f)) throw new Error(`No template for family ${family} (${f})`);
  return { id, variant, file: f, dir: join(ROOT, 'templates', id) };
}
export function familyDir(id) { return templateFile(id).dir; }

/** Find sections in rendered body HTML → [{label, href}] for the rail's "On this page" group. */
export function sectionsOf(html) {
  const out = [];
  const re = /<section[^>]*class="[^"]*\bsiso-section\b[^"]*"[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = re.exec(html))) out.push({ label: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), href: `#${m[1]}` });
  return out;
}

export function renderPart(name, data) { return engine.render(engine.partial(name), data); }

/* ---------- look v2 (templates-v2, 3 Oct 2026) ----------
 * A family that has templates/<id>/v2.html renders in the v2 look unless the caller pins v1. Which look:
 *   opts.look ('v1'|'v2')  >  data.meta.look  >  env SISO_SHELL_LOOK  >  DEFAULT_LOOK.
 * A family with only v2.html (U24) is always v2; a variant ('U23/detail') and a family without v2.html are always v1.
 * v2 pages carry their CSS inline (tokens + v2/look.css), so they render the same in the console, a book build or offline,
 * and changing v2 later never restyles a page already rendered; v1 pages and parts/parts.css are untouched. */
export const DEFAULT_LOOK = 'v2';
const engine2 = makeEngine({ partsDir: [join(ROOT, 'v2', 'parts'), join(ROOT, 'parts')], helpers: { ...helpers, ...v2helpers }, strict: true });
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');
const SECTION_ICON = { what: 'quote', map: 'map', repos: 'git-branch', live: 'globe', seats: 'users', landed: 'check-circle', left: 'list-todo', research: 'flask-conical', docs: 'file-text', timeline: 'clock', links: 'link', agent: 'terminal', evidence: 'shield-check', related: 'compass', scope: 'target', counts: 'bar-chart-3', list: 'layout-grid', observations: 'activity', stale: 'moon', coverage: 'shield-check', message: 'message-square', words: 'quote', effects: 'route', reversal: 'history', decision: 'gavel', abstract: 'align-left' };
const strip = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export function lookOf(family, data = {}, opts = {}) {
  const [id, variant] = family.split('/');
  if (variant) return 'v1';
  const hasV2 = existsSync(join(ROOT, 'templates', id, 'v2.html'));
  const hasV1 = existsSync(join(ROOT, 'templates', id, 'template.html')) || existsSync(join(ROOT, 'templates', `${id}.html`));
  if (!hasV2) return 'v1';
  if (!hasV1) return 'v2';
  const want = opts.look ?? (data.meta && data.meta.look) ?? process.env.SISO_SHELL_LOOK ?? DEFAULT_LOOK;
  return want === 'v1' ? 'v1' : 'v2';
}

/** The Halo Face engine to inline when a page shows faces. OFF by default: the engine is HALO's code (@halo/ui) and this
 *  repo is public, so a page gets it only when asked (opts.faces === true, or SISO_HALO_FACE=on|<engine dir>), i.e. private
 *  console/app pages. The engine comes from SISO_HALO_FACE when it is a dir, else Agent Base's vendored copy if on disk. */
export function facesWanted(opts = {}) {
  const env = process.env.SISO_HALO_FACE;
  if (opts.faces === false || env === 'off') return false;
  return opts.faces === true || (!!env && env !== 'off');
}
function faceEngine() {
  const env = process.env.SISO_HALO_FACE;
  const dirs = [env && env !== 'on' && env !== 'off' ? env : null, join(homedir(), 'SISO_Workspace/_data/worktrees/siso-internal-labs-agent-base/release-1/packages/halo-face')].filter(Boolean);
  const dir = dirs.find((d) => existsSync(join(d, 'halo-face.js')) && existsSync(join(d, 'agent-face.js')));
  if (!dir) return null;
  const r = (f) => readFileSync(join(dir, f), 'utf8');
  return { css: r('halo-face.css') + (existsSync(join(dir, 'agent-face.css')) ? r('agent-face.css') : ''), js: r('halo-face.js') + '\n' + r('agent-face.js') };
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
/** Inline relative <img src> (resolved against opts.assetDir) as data URIs, so a page is one file. */
function inlineImages(html, dir) {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (m, a, src, b) => {
    if (/^(data:|https?:|\/\/)/.test(src)) return m;
    const f = resolve(dir, src.replace(/&amp;/g, '&'));
    const ext = (f.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    if (!existsSync(f) || !MIME[ext]) return m;
    return a + `data:${MIME[ext]};base64,` + readFileSync(f).toString('base64') + b;
  });
}

export function composeV2(family, data, opts = {}) {
  const id = family.split('/')[0];
  const d = prepare(id, data);
  if (d.sections) d.sections = Object.fromEntries(Object.entries(d.sections).map(([k, s]) => [k, { ...s, icon: (s && s.icon) || SECTION_ICON[k] || 'circle-dot', subText: strip(s && s.sub) }]));
  if (d._v2 && d._v2.tl && d._v2.tl.bars && !d._v2.chart) d._v2.chart = { label: 'Activity', period: `${d._v2.tl.total} dated events, by day`, ...d._v2.tl.bars };
  let body = engine2.render(read('templates', id, 'v2.html'), d);
  const nav = opts.nav === false ? null : (opts.nav || data.nav || null);
  const base = (opts.base ?? '').replace(/\/$/, '');
  const railHtml = nav ? rail({ ...nav, collapsed: true, current: opts.current ?? data.current ?? '', page: sectionsOf(body) }) : '';
  const meta = data.meta || {};
  let head = '';
  if (nav) head += opts.inline ? `<style>${read('shell', 'rail.css')}</style><script>${read('shell', 'rail.js')}</script>` : `<link rel="stylesheet" href="${esc(base)}/shell/rail.css"><script src="${esc(base)}/shell/rail.js" defer></script>`;
  let js = read('v2', 'page.js');
  if (body.includes('data-catalogue=')) js = read('parts', 'catalogue.js') + '\n' + js;
  let css = read('shell', 'tokens.css') + '\n' + read('v2', 'look.css');
  if (body.includes('data-face=') && facesWanted(opts)) { const f = faceEngine(); if (f) { css += '\n' + f.css; js = f.js + '\n' + js; } }
  const crumb = (meta.crumb && meta.crumb.length ? meta.crumb : (data.heading && data.heading.breadcrumb) || (data.entity && data.entity.crumb) || []);
  const ctx = {
    title: meta.title || (data.heading && data.heading.title) || (data.entity && data.entity.name) || family,
    description: meta.description || '', stream: opts.stream || meta.stream || data.stream || 'projects', family: id,
    head, css, js, rail: railHtml, hue: d._v2 ? d._v2.hue : 200, crumb, actions: meta.actions || [], body,
    generated: opts.generated || new Date().toISOString(), source: meta.source || '',
  };
  let html = engine2.render(read('v2', 'layout.html'), ctx);
  if (opts.inline && opts.assetDir) html = inlineImages(html, opts.assetDir);
  return html;
}

/**
 * @param {string} family  e.g. 'U4'
 * @param {object} data    the family's JSON (schema.json describes it)
 * @param {object} opts    { nav: {title, home, mark, groups, utilities, operator}, current, base: URL prefix for shell/ and parts/, stream }
 */
export function compose(family, data, opts = {}) {
  if (lookOf(family, data, opts) === 'v2') return composeV2(family, data, opts);
  const { id, file } = templateFile(family);
  const template = readFileSync(file, 'utf8');
  const body = engine.render(template, data);
  const nav = opts.nav || data.nav;
  if (!nav) throw new Error('compose needs opts.nav (rail groups)');
  const base = (opts.base ?? '').replace(/\/$/, '');
  const page = sectionsOf(body);
  const railHtml = rail({ ...nav, current: opts.current ?? data.current ?? '', page });
  const layout = readFileSync(join(ROOT, 'templates', '_layout.html'), 'utf8');
  const meta = data.meta || {};
  const ctx = {
    title: meta.title || data.title || family,
    description: meta.description || '',
    stream: opts.stream || meta.stream || data.stream || 'projects',
    family: id,
    base,
    head: shellHead(`${base}/shell`) + `<link rel="stylesheet" href="${esc(base)}/parts/parts.css"><script src="${esc(base)}/parts/catalogue.js" defer></script>`,
    rail: railHtml,
    crumb: meta.crumb || [],
    actions: meta.actions || [],
    body,
    generated: opts.generated || new Date().toISOString(),
    source: meta.source || '',
  };
  return engine.render(layout, ctx);
}

export { engine, esc };
