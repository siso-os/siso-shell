/* v2/v2.mjs — the v2 look's view-model and helpers. A family's data contract does not change between v1 and v2: prepare()
 * reads the same JSON (templates/<id>/schema.json) and adds a `_v2` block the v2 templates render, so every existing
 * data file (HALO book, Oracle docs, console reports) re-renders under v2 without edits. */
import { esc } from '../bin/lib/engine.mjs';
import { ICONS } from '../shell/icons.mjs';
import { V2ICONS } from './icons.mjs';

/** lucide glyph: the shell's set plus v2/icons.mjs (no pathLength: v2 does not animate strokes). */
export function icon(name, cls) {
  const body = V2ICONS[name] || ICONS[name] || ICONS['circle-dot'];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + ' data-icon="' + esc(name) + '">' + body + '</svg>';
}

// Agent Base's project hash (packages/halo-face/agent-face.js hueOf/projectHue): red, orange and amber mean "blocked" and
// "needs you", so a project hue landing there is turned to the other side of the wheel.
export const hueOf = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
export const projectHue = (s) => { const h = hueOf(s); return h >= 340 || h < 55 ? (h + 180) % 360 : h; };

// v1 stream/tone names → the v2 semantic palette (rule 8). g ok · b working · a needs/warn · r blocked · v specced/research · h page hue · n neutral
const TONE = { now: 'g', ok: 'g', live: 'g', health: 'g', done: 'g', warn: 'a', partial: 'a', tasks: 'a', blocked: 'r', no: 'r', danger: 'r', research: 'v', focus: 'v', agents: 'v', reflect: 'v', projects: 'h', today: 'h', clients: 'h', muted: 'n' };
export const tone = (t) => (t && 'gbarvhno'.includes(t) && t.length === 1) ? t : (TONE[String(t || '').toLowerCase()] || 'n');

// seat / agent state text → Halo face status (agent-face.js STATUS)
export function faceStatus(s) {
  const t = String(s || '').toLowerCase();
  if (/needs|waiting on (him|shaan)|ask/.test(t)) return 'needs-shaan';
  if (/block|fail|error|stuck/.test(t)) return 'blocked';
  if (/work|live|running|busy|building|active|thinking/.test(t)) return 'working';
  if (/idle|wait|standby|ready|planned/.test(t)) return 'waiting';
  if (/done|closed|retired|finished|landed|merged/.test(t)) return 'done';
  if (/off|dead|stopped|asleep|gone/.test(t)) return 'offline';
  if (/vacant|none|nobody|unowned/.test(t)) return 'vacant';
  return 'waiting';
}

/** A face: the CSS face now, upgraded to the real HaloFace when the engine is inlined (data-face is its mount). */
export function face({ project = '', status = 'waiting', size = 26, name = '', hue } = {}) {
  if (status === 'vacant') return `<span class="hfh seatf" style="width:${size}px;height:${size}px" title="nobody running">${icon('plus')}</span>`;
  const h = hue ?? projectHue(project || name);
  return `<span class="hfh" data-face="${esc(project)}|${esc(status)}|${size}|${esc(name)}" style="width:${size}px;height:${size}px" title="${esc(name)}${name ? ': ' : ''}${esc(String(status).replace('-', ' '))}"><span class="cf ${esc(status)}" style="--fh:${h}"><i></i><i></i></span></span>`;
}

const DAY = 864e5;
const parseAt = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortAt = (s) => { const t = parseAt(s); if (isNaN(t)) return String(s || ''); const d = new Date(t); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };

/** Day bars from dated events (rule 6): the last `n` days up to the newest event; the newest day lit in the hue. */
export function dayBars(events, n = 11) {
  const ts = (events || []).map((e) => parseAt(e.at)).filter((t) => !isNaN(t));
  if (ts.length < 2) return null;
  const last = Math.floor(Math.max(...ts) / DAY), first = Math.max(Math.floor(Math.min(...ts) / DAY), last - n + 1);
  const days = []; for (let d = first; d <= last; d++) days.push({ d, n: 0 });
  for (const t of ts) { const i = Math.floor(t / DAY) - first; if (i >= 0 && i < days.length) days[i].n++; }
  if (days.length < 3) return null; // a chart of one or two days says nothing
  return bars(days.map((x) => x.n), days.map((x, i) => (i % 2 === (days.length - 1) % 2 ? String(new Date(x.d * DAY).getUTCDate()) : '')), days.length - 1);
}
/** values → [{h, hot, v}] for .bars; labels aligned. */
export function bars(values, labels = [], hot = values.length - 1) {
  const m = Math.max(...values, 1);
  return { cells: values.map((v, i) => ({ h: Math.max(4, Math.round((v / m) * 100)), hot: i === hot, v })), labels: values.map((_, i) => labels[i] ?? '') };
}

const cap = (s) => { s = String(s ?? ''); return s ? s[0].toUpperCase() + s.slice(1) : s; };
// `of` is a denominator ("/44", "of 44", "44") or a unit ("GiB", "in Plane"): stats show "/44" or " GiB", trackers "of 44".
const isDen = (s) => /^\s*(\/|of\s+)?\d/i.test(String(s));
const bareOf = (s) => String(s).replace(/^\s*(\/|of\s+)/i, '');
const statOf = (s) => (s == null || s === '' ? '' : isDen(s) ? '/' + bareOf(s) : '\u2009' + s);
const workOf = (s) => (s == null || s === '' ? '' : isDen(s) ? 'of ' + bareOf(s) : String(s));
/** v1 heading → the v2 hero view. */
function hero(h = {}, extra = {}) {
  const tags = (h.badges || []).map((b) => ({ label: b.label, href: b.href, title: b.title, dot: b.dot, tc: tone(b.tone) }));
  const metrics = (h.metrics || []).map((m) => ({ ...m, label: cap(m.label), tc: tone(m.tone) }));
  return { crumb: h.breadcrumb || [], kicker: h.kicker, title: h.title, subtitle: h.subtitle, tags, jump: h.jump || [], status: h.status, metrics, ...extra };
}

/** Recent events, newest first, with lane colour (timeline {lanes, events}). */
function recent(tl = {}, n = 10) {
  const laneTone = Object.fromEntries((tl.lanes || []).map((l) => [l.id, tone(l.tone)]));
  const events = [...(tl.events || [])].sort((a, b) => (parseAt(b.at) || 0) - (parseAt(a.at) || 0));
  return {
    items: events.slice(0, n).map((e, i) => ({ at: shortAt(e.at), text: e.label, href: e.href, sc: SC[laneTone[e.lane] || 'n'], hot: i === 0 })),
    more: Math.max(0, events.length - n), total: events.length,
    lanes: (tl.lanes || []).map((l) => ({ label: l.label, sc: SC[tone(l.tone)] })),
    bars: dayBars(tl.events),
  };
}
const SC = { g: 'var(--green)', b: 'var(--cyan)', a: 'var(--amber)', r: 'var(--red)', v: 'var(--violet)', h: 'hsl(var(--h) 80% 65%)', n: '#5c5c57', o: 'var(--crm-color-brand)' };

function seatsView(seats = [], project = '') {
  return seats.map((s) => { const st = faceStatus(s.state || s.status); return { ...s, st, face: face({ project, status: st, size: 40, name: s.name }) }; });
}

/** The status capsule's state (rule 2: glow only when alive). */
function capState(status, seats) {
  const t = JSON.stringify(status || '') + JSON.stringify((seats || []).map((s) => s.st));
  if (/needs-shaan|needs you|needs shaan/i.test(t)) return 'needs';
  if (/"working"/.test(t)) return 'working';
  return '';
}

export function prepare(family, data) {
  const meta = data.meta || {};
  const h = data.heading || {};
  const key = meta.hue_key || data.entity?.hue_key || data.hue_key || (meta.crumb && meta.crumb[0] && meta.crumb[0].label) || h.title || meta.title || family;
  const hue = meta.hue ?? data.entity?.hue ?? projectHue(key);
  const v = { hue, project: key };
  if (family === 'U24') return { ...data, _v2: { ...v, ...entity(data, key) } };
  v.hero = hero(h);
  if (data.timeline) v.tl = recent(data.timeline);
  if (family === 'U4') {
    v.seats = seatsView(data.seats, key);
    v.cap = capState(h.status, v.seats);
    v.urls = (data.urls || []).map((u) => ({ ...u, dot: u.code >= 200 && u.code < 300 ? 'ok' : u.code === 401 || u.code === 403 ? 'gate' : 'none' }));
    v.left = (data.left?.items || []).map((x) => ({ ...x, sc: 's-' + (x.tone || 'muted'), tc: tone(x.tone) }));
  }
  if (family === 'U10') {
    v.seats = (data.seats || []).map((s) => { const st = faceStatus(s.status); return { ...s, st, face: face({ project: s.node || key, status: st, size: 36, name: s.name }), ftc: tone(s.fresh_tone), ntc: tone(s.node_tone) }; });
    const days = data.activity?.days || [];
    v.act = days.length ? bars(days.map((d) => Math.round((d.w || 0) * 100)), days.map((d) => String(d.title || '').slice(8, 10))) : null;
    v.obs = (data.activity?.items || []).slice(0, 12).map((x, i) => ({ ...x, sc: SC[tone(x.tone)], hot: i === 0 }));
    v.cap = v.seats.some((s) => s.st === 'working') ? 'working' : '';
    v.repo = (data.repo_activity || []).map((r) => ({ ...r, tc: tone(r.tone) }));
    v.stale = (data.stale || []).map((s) => ({ ...s, tc: tone(s.tone) }));
  }
  if (family === 'U2') {
    v.shape = (data.breakdowns || []).map((b) => {
      const segs = (b.chips || []).map((c, k) => { const m = String(c.label).match(/^(.*?)\s*·\s*(\d+)\s*$/); return { label: m ? m[1] : c.label, n: m ? +m[2] : 1, t: 't-' + (c.tone || 'muted'), k }; });
      return { label: b.label, segs, counted: segs.every((s) => s.n) };
    });
  }
  if (family === 'U16') v.state = (data.state || []).map((s) => ({ ...s, tc: tone(s.tone) }));
  if (family === 'U7') v.chapters = (data.chapters || []).map((c, i) => ({ ...c, n: c.n ?? String(i + 1).padStart(2, '0') }));
  return { ...data, _v2: v };
}

/* ---------- U24 entity page ---------- */
const STATE_ORDER = ['building', 'tested', 'allocated', 'specced', 'todo', 'backlog', 'thought', 'built', 'gap', 'done'];
function entity(data, key) {
  const e = data.entity || {};
  const o = e.owner || null;
  const owner = o ? {
    ...o, label: o.label || 'Owner', cls: o.status === 'working' ? 'working' : o.status === 'needs-shaan' ? 'needs' : '',
    face: face({ project: o.project || key, status: o.status || 'waiting', size: 56, name: o.name }),
    crewFaces: (o.crew || []).map((c) => face({ project: c.project || key, status: c.status || 'waiting', size: 26, name: c.name })).join(''),
    oh: projectHue(o.project || key),
  } : null;
  const st = e.stage || {};
  const shots = st.shots || [];
  const stage = {
    front: shots[0], back: shots[1], solo: shots.length === 1 && !st.phone, phone: st.phone, caps: st.caps || [],
    panel: st.panel ? { ...st.panel, lines: (st.panel.lines || []).map((l) => ({ ...l, tc: l.tone ? tone(l.tone) : '' })) } : null,
    icon: st.icon, empty: st.empty, has: !!(shots.length || st.panel || st.icon || st.empty),
  };
  const chart = data.chart && data.chart.values ? { ...data.chart, ...bars(data.chart.values, data.chart.labels || [], data.chart.hot ?? data.chart.values.length - 1) } : null;
  const cards = (data.cards || []).map((c, i) => {
    const out = { ...c, id: c.id || `c${i + 1}-${String(c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, span: c.span === 3 ? 's3' : c.span === 2 ? 's2' : '', icon: c.icon || ICON[c.type] || 'circle-dot', ['is_' + c.type]: true };
    if (c.type === 'work' && c.work) {
      const segs = [...(c.work.segs || [])].filter((s) => s.n > 0).sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state));
      out.work = { ...c.work, of: workOf(c.work.of), segs: segs.map((s) => ({ ...s, sc: 's-' + s.state })), items: (c.work.items || []).map((x) => ({ ...x, sc: 's-' + (x.state || 'backlog') })) };
    }
    if (c.type === 'tiles') out.items = (c.items || []).map((t) => {
      const faces = t.faces || [];
      // no picture: the tile's art is its agent's face, big (rule 3 + rule 4), not an empty hue field
      const bigFace = !t.img && !t.icon && !t.mono && faces.length ? face({ project: faces[0].project || t.name, status: faces[0].status, size: 52, name: faces[0].name }) : '';
      return { ...t, th: t.hue ?? projectHue((faces[0] && faces[0].project) || t.name || ''), bigFace, short: !!bigFace,
        facesHtml: (bigFace ? faces.slice(1) : faces).map((f) => face({ project: f.project || t.name, status: f.status, size: 22, name: f.name })).join('') };
    });
    if (c.type === 'feat') out.items = (c.items || []).map((t) => ({ ...t, fh: t.hue ?? projectHue(t.title || ''), tc: tone(t.tone) }));
    if (c.type === 'timeline') out.items = (c.items || []).map((t) => ({ ...t, sc: t.tone ? SC[tone(t.tone)] : '' }));
    if (c.type === 'people') out.items = (c.items || []).map((p) => ({ ...p, ph: p.hue ?? projectHue(p.name || ''), initial: p.face ? '' : String(p.name || '?').trim()[0], faceHtml: p.face ? face({ project: p.face.project || key, status: p.face.status, size: 40, name: p.name }) : '' }));
    if (c.type === 'deliv') out.items = (c.items || []).map((t) => ({ ...t, tc: tone(t.tone) }));
    if (c.type === 'live') out.items = (c.items || []).map((t) => ({ ...t, dot: t.dot || (t.code >= 200 && t.code < 300 ? 'ok' : t.code === 401 || t.code === 403 ? 'gate' : 'none') }));
    return out;
  });
  return {
    kind: e.kind, owner, stage, chart, cards, nstat: (data.stats || []).length,
    stats: (data.stats || []).map((s) => ({ ...s, of: statOf(s.of), dtc: s.delta ? (s.delta.tone === 'z' ? 'z' : tone(s.delta.tone)) : '' })),
    tags: (e.tags || []).map((t) => ({ ...t, tc: tone(t.tone) })),
    state: e.state === 'working' ? 'working' : e.state === 'needs' ? 'needs' : '',
  };
}
const ICON = { work: 'list-checks', tiles: 'layout-grid', feat: 'layers', timeline: 'clock', people: 'users', quote: 'quote', chips: 'paperclip', deliv: 'package', lines: 'align-left', checks: 'check-circle', live: 'globe' };

export const v2helpers = {
  icon: (v) => icon(String(v)),
  tone: (v) => tone(v),
  short: (v) => esc(shortAt(v)),
};
