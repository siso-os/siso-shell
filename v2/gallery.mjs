/* v2/gallery.mjs — the v2 family gallery (site/v2/index.html): each family as a live, scaled preview of its rendered
 * example, with what it is for and how to compose it. Self-contained (tokens + look inline). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esc } from '../bin/lib/engine.mjs';
import { icon } from './v2.mjs';

export const FAMILIES = [
  { id: 'U7', name: 'Report / doc reader', use: 'Any agent report or long document: abstract on a lit slab, calm prose, contents that follow you, receipts and limits.', uses: 'most used: 784 pages on disk, 249 console cards' },
  { id: 'U4', name: 'Project one-pager', use: 'A project at a glance: his words, live URLs with glowing dots, seats as faces, repos, map, what landed and what is left.', uses: '37 pages (Oracle overview, the hub pages)' },
  { id: 'U2', name: 'Catalogue / list', use: 'A list of records: the counts as shape bars, glass search, capsule filters, lit cards.', uses: '48 pages, 3 console cards' },
  { id: 'U10', name: 'Now / activity', use: 'Who is doing what right now: live seats as faces, fresh writebacks glow, newest first.', uses: '3 pages' },
  { id: 'U16', name: 'Decision', use: 'One call in one lit sentence, his words that caused it, what it changed and what reverses it.', uses: '3 console cards' },
  { id: 'U24', name: 'Entity page (new)', use: 'One page for any client, agency, industry, project, task, agent, machine or release, in the same shape as Agent Base project pages v2.', uses: 'new: replaces U8, U12, U14, U15, U17, U22 as they are touched' },
];

export function galleryHtml({ root, items = FAMILIES, hrefOf = (f) => `/t/${f.id}/v2/`, thumbOf = null, title = 'siso-shell · templates v2', lede = '' }) {
  const css = readFileSync(join(root, 'shell', 'tokens.css'), 'utf8') + readFileSync(join(root, 'v2', 'look.css'), 'utf8');
  const card = (f) => `<a class="card gcard" href="${esc(hrefOf(f))}">
  <div class="gprev">${thumbOf ? `<img src="${thumbOf(f)}" alt="${esc(f.name)}" loading="lazy">` : `<iframe src="${esc(hrefOf(f))}" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>`}</div>
  <div class="ch" style="margin:12px 0 4px"><span class="ic">${icon('layout-template')}</span><h2>${esc(f.id)} · ${esc(f.name)}</h2><span class="pill h" style="margin-left:auto">${esc(f.uses.split(':')[0])}</span></div>
  <p class="prose" style="font-size:13px">${esc(f.use)}</p>
  <p class="more">${esc(f.uses)} · <code>bin/compose ${esc(f.id)} data.json</code></p></a>`;
  return `<!doctype html><html lang="en" data-look="v2"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>${css}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:16px;padding:18px 32px 40px}
.gcard{display:flex;flex-direction:column;color:inherit;transition:transform .2s var(--ease)} .gcard:hover{text-decoration:none;transform:translateY(-2px)}
.gprev{position:relative;height:250px;border-radius:12px;overflow:hidden;background:#0d0d0c;box-shadow:0 0 0 1px rgb(255 255 255/.08)}
.gprev iframe{position:absolute;top:0;left:0;width:1440px;height:1000px;border:0;transform:scale(.29);transform-origin:0 0;pointer-events:none}
.gprev img{width:100%;height:100%;object-fit:cover;object-position:top}</style></head>
<body class="v2-nonav" style="--h:200"><main class="v2-page">
<header class="hero solo"><div><div class="kick"><span>siso-shell</span><i></i><span>templates v2</span><i></i><span>${items.length} families</span></div>
<h1 class="h1">Every page, one look</h1><p class="lede">${lede || 'The page families agents compose most, rebuilt under the eight visual rules of Agent Base’s project pages v2, plus one entity page for clients, agencies, industries, tasks, agents, machines and releases. Same data as v1; v1 stays one flag away.'}</p></div></header>
<div class="gal">${items.map(card).join('')}</div></main></body></html>`;
}
