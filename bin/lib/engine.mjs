/* bin/lib/engine.mjs — the whole template engine. No framework, no build step beyond node.
 * Syntax (in parts/*.html and templates/<id>/template.html):
 *   {{path}}            escaped value          {{{path}}}          raw HTML
 *   {{#if path}}…{{else}}…{{/if}}              {{#each path}}…{{/each}}  (inside: {{.}} {{@index}} {{@n}} {{@first}} {{@last}}, and parent via {{../x}})
 *   {{> part-name}}     include parts/part-name.html with the current context
 *   {{> part-name path}}                        include with context = path
 *   {{#with path}}…{{/with}}                    narrow context
 * Paths are dot separated; `.` is the context itself; `../` climbs one frame; `@root` is the top data. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function lookup(frames, path, strict = false) {
  if (path === '.' || path === 'this') return frames[frames.length - 1].ctx;
  let depth = frames.length - 1;
  while (path.startsWith('../')) { path = path.slice(3); depth = Math.max(0, depth - 1); }
  if (path.startsWith('@root')) { path = path.slice(5).replace(/^\./, ''); depth = 0; }
  const frame = frames[depth];
  if (path.startsWith('@')) return frame.meta ? frame.meta[path.slice(1)] : undefined;
  let cur = frame.ctx;
  if (path === '') return cur;
  for (const key of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  // Fall back to outer frames when a key is absent in the inner context (Handlebars-style recursive lookup).
  // v2 engines are strict (Handlebars' own default): an absent key is absent, so an item without `href` never borrows its page's.
  if (cur === undefined && depth > 0 && !path.includes('.') && !strict) return lookup(frames.slice(0, depth), path);
  return cur;
}

const truthy = (v) => Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && v !== false && v !== '' && v !== 0);

export function makeEngine({ partsDir, helpers = {}, strict = false }) {
  const look = (frames, path) => lookup(frames, path, strict);
  const cache = new Map();
  const dirs = Array.isArray(partsDir) ? partsDir : [partsDir]; // v2: [v2/parts, parts] — the first dir that has the part wins
  function partial(name) {
    if (!cache.has(name)) {
      const file = dirs.map((d) => join(d, `${name}.html`)).find((f) => existsSync(f)) || join(dirs[0], `${name}.html`);
      if (!existsSync(file)) throw new Error(`Unknown part: ${name} (${file})`);
      cache.set(name, readFileSync(file, 'utf8'));
    }
    return cache.get(name);
  }

  function render(src, frames) {
    let out = '';
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf('{{', i);
      if (open === -1) { out += src.slice(i); break; }
      out += src.slice(i, open);
      if (src.startsWith('{{!--', open)) { const c = src.indexOf('--}}', open); if (c === -1) throw new Error('Unclosed comment'); i = c + 4; continue; }
      const raw = src.startsWith('{{{', open);
      const close = src.indexOf(raw ? '}}}' : '}}', open);
      if (close === -1) throw new Error('Unclosed tag');
      const tag = src.slice(open + (raw ? 3 : 2), close).trim();
      i = close + (raw ? 3 : 2);
      if (raw) { out += String(look(frames, tag) ?? ''); continue; }
      if (tag.startsWith('!')) continue;
      if (tag.startsWith('#')) {
        const [kind, ...rest] = tag.slice(1).split(/\s+/);
        const arg = rest.join(' ');
        const { body, elseBody, end } = block(src, i, kind);
        i = end;
        if (kind === 'if') out += truthy(look(frames, arg)) ? render(body, frames) : render(elseBody, frames);
        else if (kind === 'unless') out += !truthy(look(frames, arg)) ? render(body, frames) : render(elseBody, frames);
        else if (kind === 'each') {
          const list = look(frames, arg);
          const items = Array.isArray(list) ? list : (list && typeof list === 'object' ? Object.entries(list).map(([k, v]) => ({ key: k, value: v })) : []);
          if (!items.length) out += render(elseBody, frames);
          else items.forEach((item, idx) => { out += render(body, [...frames, { ctx: item, meta: { index: idx, n: idx + 1, first: idx === 0, last: idx === items.length - 1 } }]); });
        } else if (kind === 'with') {
          const v = look(frames, arg);
          out += truthy(v) || (v && typeof v === 'object') ? render(body, [...frames, { ctx: v }]) : render(elseBody, frames);
        } else throw new Error(`Unknown block: ${kind}`);
        continue;
      }
      if (tag.startsWith('>')) {
        const [name, ...rest] = tag.slice(1).trim().split(/\s+/);
        const arg = rest.join(' ');
        const ctx = arg ? look(frames, arg) : frames[frames.length - 1].ctx;
        out += render(partial(name), arg ? [...frames, { ctx }] : frames);
        continue;
      }
      const helperMatch = tag.match(/^(\w+)\s+(.+)$/);
      if (helperMatch && helpers[helperMatch[1]]) {
        const arg = helperMatch[2].trim();
        const literal = /^(['"]).*\1$/.test(arg) ? arg.slice(1, -1) : undefined;
        const val = literal !== undefined ? literal : look(frames, arg);
        out += helpers[helperMatch[1]](val === undefined ? arg : val, frames);
        continue;
      }
      out += esc(look(frames, tag));
    }
    return out;
  }

  function block(src, from, kind) {
    let depth = 1, i = from, elseAt = -1;
    while (i < src.length) {
      const open = src.indexOf('{{', i);
      if (open === -1) throw new Error(`Unclosed block: ${kind}`);
      const close = src.indexOf('}}', open);
      const tag = src.slice(open + 2, close).trim();
      if (tag.startsWith('#')) depth++;
      else if (tag.startsWith('/')) { depth--; if (depth === 0) { const body = src.slice(from, elseAt === -1 ? open : elseAt); const elseBody = elseAt === -1 ? '' : src.slice(elseAt, open).replace(/^\{\{\s*else\s*\}\}/, ''); return { body, elseBody, end: close + 2 }; } }
      else if (tag.startsWith('!--')) { const c = src.indexOf('--}}', open); i = c + 4; continue; }
      else if (tag === 'else' && depth === 1) elseAt = open;
      i = close + 2;
    }
    throw new Error(`Unclosed block: ${kind}`);
  }

  return { render: (src, data) => render(src, [{ ctx: data }]), partial };
}
