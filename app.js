"use strict";
/* P3 Podcast: F1 predictions for Fayez and Leona, 2026 Mexico City GP to Abu Dhabi GP.
   Data lives in Firestore under games/<game code>/picks and games/<game code>/results.
   The game code only comes from the private link (the part after #). It is never stored in this repo. */

/* ---------- season data (keep lights-out times and the driver list in sync with the Firestore rules) ---------- */
const SEASON_ROUNDS = 23;
const TEAMS = {
  MCL: { n: "McLaren", c: "#ff8000" }, MER: { n: "Mercedes", c: "#27f4d2" }, RBR: { n: "Red Bull", c: "#3671c6" },
  FER: { n: "Ferrari", c: "#e8002d" }, WIL: { n: "Williams", c: "#64c4ff" }, RB: { n: "Racing Bulls", c: "#6692ff" },
  AMR: { n: "Aston Martin", c: "#229971" }, HAA: { n: "Haas", c: "#b6babd" }, ALP: { n: "Alpine", c: "#ff87bc" },
  AUD: { n: "Audi", c: "#c4122f" }, CAD: { n: "Cadillac", c: "#d9d9d9" }
};
const DRIVERS = [
  ["NOR", "Lando Norris", "MCL"], ["PIA", "Oscar Piastri", "MCL"],
  ["RUS", "George Russell", "MER"], ["ANT", "Kimi Antonelli", "MER"],
  ["VER", "Max Verstappen", "RBR"], ["HAD", "Isack Hadjar", "RBR"],
  ["LEC", "Charles Leclerc", "FER"], ["HAM", "Lewis Hamilton", "FER"],
  ["ALB", "Alex Albon", "WIL"], ["SAI", "Carlos Sainz", "WIL"],
  ["LAW", "Liam Lawson", "RB"], ["LIN", "Arvid Lindblad", "RB"],
  ["ALO", "Fernando Alonso", "AMR"], ["STR", "Lance Stroll", "AMR"],
  ["OCO", "Esteban Ocon", "HAA"], ["BEA", "Oliver Bearman", "HAA"], ["HIR", "Ryo Hirakawa", "HAA"],
  ["GAS", "Pierre Gasly", "ALP"], ["COL", "Franco Colapinto", "ALP"],
  ["HUL", "Nico Hülkenberg", "AUD"], ["BOR", "Gabriel Bortoleto", "AUD"],
  ["BOT", "Valtteri Bottas", "CAD"], ["PER", "Sergio Pérez", "CAD"]
].map(([code, name, team]) => ({ code, name, team }));
const DMAP = Object.fromEntries(DRIVERS.map(d => [d.code, d]));
const RACES = [
  { id: "mexico-2026", name: "Mexico City", short: "Mexico", round: 19, flag: "mx",
    circuit: "Autódromo Hermanos Rodríguez", place: "Mexico City, Mexico", city: "Mexico City",
    day: "Sun 1 Nov", local: "14:00", laps: 71, length: "4.304 km", distance: "305.4 km", start: "2026-11-01T20:00:00Z" },
  { id: "brazil-2026", name: "São Paulo", short: "Brazil", round: 20, flag: "br",
    circuit: "Autódromo José Carlos Pace (Interlagos)", place: "São Paulo, Brazil", city: "São Paulo",
    day: "Sun 8 Nov", local: "14:00", laps: 71, length: "4.309 km", distance: "305.9 km", start: "2026-11-08T17:00:00Z" },
  { id: "vegas-2026", name: "Las Vegas", short: "Las Vegas", round: 21, flag: "us",
    circuit: "Las Vegas Strip Circuit", place: "Las Vegas, United States", city: "Las Vegas",
    day: "Sat 21 Nov", local: "20:00", laps: 50, length: "6.201 km", distance: "310.0 km", start: "2026-11-22T04:00:00Z" },
  { id: "qatar-2026", name: "Qatar", short: "Qatar", round: 22, flag: "qa",
    circuit: "Lusail International Circuit", place: "Lusail, Qatar", city: "Lusail",
    day: "Sun 29 Nov", local: "19:00", laps: 57, length: "5.419 km", distance: "308.6 km", start: "2026-11-29T16:00:00Z" },
  { id: "abudhabi-2026", name: "Abu Dhabi", short: "Abu Dhabi", round: 23, flag: "ae",
    circuit: "Yas Marina Circuit", place: "Abu Dhabi, United Arab Emirates", city: "Abu Dhabi",
    day: "Sun 6 Dec", local: "17:00", laps: 58, length: "5.281 km", distance: "306.3 km", start: "2026-12-06T13:00:00Z" }
];
const PLAYERS = ["fayez", "leona"], PNAME = { fayez: "Fayez", leona: "Leona" };
const OTHER = { fayez: "leona", leona: "fayez" };
const PTS = { exact: 5, inTop5: 2, pole: 4, firstOut: 4, fastest: 3, dotd: 3, sc: 3, surprise: 3, flop: 3, crazy: 6 };
const SC_OPTS = ["0", "1", "2", "3+"];
const EXTRAS = [["pole", "Pole position"], ["firstOut", "First retirement"], ["fastest", "Fastest lap"], ["dotd", "Driver of the Day"]];
const TEXTS = [["surprise", "Good surprise"], ["flop", "Big flop"], ["crazy", "Crazy prediction"]];
const TEXT_MAX = 80, NOTE_MAX = 600;
const TOTAL_SLOTS = 5 + EXTRAS.length + 1 + TEXTS.length;

/* ---------- flags (simple national flags, 2:1) ---------- */
const flagSvg = inner => `<svg class="flag" viewBox="0 0 24 12" aria-hidden="true" focusable="false">${inner}</svg>`;
const US_STRIPES = Array.from({ length: 7 }, (_, i) => `<rect y="${(i * 24 / 13).toFixed(3)}" width="24" height="${(12 / 13).toFixed(3)}" fill="#b22234"/>`).join("");
const US_STARS = Array.from({ length: 20 }, (_, i) => `<circle cx="${(1 + (i % 5) * 1.9 + (Math.floor(i / 5) % 2) * 0.95).toFixed(2)}" cy="${(0.85 + Math.floor(i / 5) * 1.55).toFixed(2)}" r=".3" fill="#fff"/>`).join("");
const QA_POINTS = (() => { let p = "0,0 6.2,0"; for (let i = 0; i < 9; i++) p += ` 8.2,${((i + 0.5) * 12 / 9).toFixed(3)} 6.2,${((i + 1) * 12 / 9).toFixed(3)}`; return p + " 0,12"; })();
const FLAGS = {
  mx: flagSvg(`<rect width="8" height="12" fill="#006847"/><rect x="8" width="8" height="12" fill="#fff"/><rect x="16" width="8" height="12" fill="#ce1126"/><circle cx="12" cy="6" r="1.9" fill="#8c5a2b"/><circle cx="12" cy="6.3" r="1" fill="#4e7a2a"/>`),
  br: flagSvg(`<rect width="24" height="12" fill="#009c3b"/><polygon points="2,6 12,1.1 22,6 12,10.9" fill="#ffdf00"/><circle cx="12" cy="6" r="3.1" fill="#002776"/><path d="M9.1 5.3 Q12 4.4 14.95 6.4" stroke="#fff" stroke-width=".55" fill="none"/>`),
  us: flagSvg(`<rect width="24" height="12" fill="#fff"/>${US_STRIPES}<rect width="9.6" height="6.46" fill="#3c3b6e"/>${US_STARS}`),
  qa: flagSvg(`<rect width="24" height="12" fill="#8a1538"/><polygon points="${QA_POINTS}" fill="#fff"/>`),
  ae: flagSvg(`<rect width="24" height="4" fill="#00843d"/><rect y="4" width="24" height="4" fill="#fff"/><rect y="8" width="24" height="4" fill="#000"/><rect width="6" height="12" fill="#ef3340"/>`)
};

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const raceById = id => RACES.find(r => r.id === id);
const startMs = id => Date.parse(raceById(id).start);
const started = r => Date.now() >= startMs(r);
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }

/* ---------- private game code ---------- */
const CODE_RE = /^[A-Za-z0-9_-]{16,64}$/;
function readGameCode() {
  let fromHash = "";
  try { fromHash = decodeURIComponent((location.hash || "").slice(1)).trim(); } catch (e) { fromHash = ""; }
  if (CODE_RE.test(fromHash)) { store("p3-game", fromHash); return fromHash; }
  const saved = load("p3-game");
  return saved && CODE_RE.test(saved) ? saved : null;
}
window.addEventListener("hashchange", () => location.reload());

/* ---------- clean everything that comes from the database ---------- */
const CODES = new Set(DRIVERS.map(d => d.code));
const RACE_IDS = new Set(RACES.map(r => r.id));
const drv = (x, allowNone) => (typeof x === "string" && (CODES.has(x) || (allowNone && x === "NONE"))) ? x : "";
const txt = x => (typeof x === "string" ? x.slice(0, TEXT_MAX) : "");
const num = x => (typeof x === "number" && isFinite(x) ? x : 0);
function top5Of(t) {
  const arr = Array.isArray(t) ? t : [], seen = new Set();
  return [0, 1, 2, 3, 4].map(i => { const d = drv(arr[i]); if (!d || seen.has(d)) return ""; seen.add(d); return d; });
}
function cleanPick(race, player, raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    player, race, top5: top5Of(d.top5),
    pole: drv(d.pole), firstOut: drv(d.firstOut, true), fastest: drv(d.fastest), dotd: drv(d.dotd),
    sc: SC_OPTS.includes(d.sc) ? d.sc : "",
    surprise: txt(d.surprise), flop: txt(d.flop), crazy: txt(d.crazy),
    locked: d.locked === true, updatedAt: num(d.updatedAt)
  };
}
function cleanCard(c) {
  const o = {};
  if (c && typeof c === "object") for (const [f] of TEXTS) if (c[f] === true || c[f] === false) o[f] = c[f];
  return o;
}
function cleanRes(race, raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const j = d.judge && typeof d.judge === "object" ? d.judge : {};
  return {
    race, top5: top5Of(d.top5),
    pole: drv(d.pole), firstOut: drv(d.firstOut, true), fastest: drv(d.fastest), dotd: drv(d.dotd),
    sc: SC_OPTS.includes(d.sc) ? d.sc : "",
    judge: { fayez: cleanCard(j.fayez), leona: cleanCard(j.leona) },
    final: d.final === true,
    note: typeof d.note === "string" ? d.note.slice(0, NOTE_MAX) : "",
    updatedBy: PLAYERS.includes(d.updatedBy) ? d.updatedBy : "fayez",
    updatedAt: num(d.updatedAt)
  };
}

/* ---------- state ---------- */
let db = null, gameCode = null, picksCol = null, resultsCol = null;
let conn = "connecting";            // nocode | nofirebase | connecting | live | offline | error
const cacheFlags = { picks: null, results: null };   // null until the first snapshot arrives
let lockArmed = false, lockTimer = null, startedFlag = null;
let who = PLAYERS.includes(load("p3-who")) ? load("p3-who") : null;
let raceId = null, userPickedRace = false, raceSettled = false;
const state = { picks: {}, results: {} };  // cleaned server data
const drafts = {}, dirty = new Set(), saving = {}, again = {}, timers = {};
let noticeText = "", noticeErr = false;

const pickKey = (r, p) => r + "_" + p;
const blankPick = (r, p) => cleanPick(r, p, {});
const blankRes = r => cleanRes(r, {});
function getPick(r, p) { const k = pickKey(r, p); return drafts[k] || state.picks[k] || blankPick(r, p); }
function getRes(r) { const k = "res_" + r; return drafts[k] || state.results[r] || blankRes(r); }

/* The race the board opens on: the first one that isn't scored yet and isn't more than two days past.
   Before results have loaded, assume the next race to start. */
function currentRaceId() {
  const now = Date.now(), loaded = cacheFlags.results !== null;
  const r = RACES.find(x => {
    const st = Date.parse(x.start);
    return loaded ? (!getRes(x.id).final && st + 2 * 864e5 > now) : st > now;
  });
  return (r || RACES[RACES.length - 1]).id;
}

/* ---------- scoring ---------- */
function score(pick, res) {
  const out = { top5: [], total: 0 };
  res.top5.forEach((_, i) => {
    const d = pick.top5[i]; let v = 0, k = "";
    if (d && res.top5[i] === d) { v = PTS.exact; k = "hit"; }
    else if (d && res.top5.includes(d)) { v = PTS.inTop5; k = "half"; }
    out.top5.push({ v, k }); out.total += v;
  });
  for (const [f] of EXTRAS) { const v = pick[f] && pick[f] === res[f] ? PTS[f] : 0; out[f] = { v, k: v ? "hit" : "" }; out.total += v; }
  { const v = pick.sc && pick.sc === res.sc ? PTS.sc : 0; out.sc = { v, k: v ? "hit" : "" }; out.total += v; }
  for (const [f] of TEXTS) { const v = pick[f] && res.judge[pick.player][f] === true ? PTS[f] : 0; out[f] = { v, k: v ? "hit" : "" }; out.total += v; }
  return out;
}
const raceScore = id => { const res = getRes(id); return res.final ? { f: score(getPick(id, "fayez"), res).total, l: score(getPick(id, "leona"), res).total } : null; };
const pickCount = p => p.top5.filter(Boolean).length + [...EXTRAS.map(e => e[0]), "sc", ...TEXTS.map(t => t[0])].filter(f => String(p[f] || "").trim()).length;
function revealed(r) { return (getPick(r, "fayez").locked && getPick(r, "leona").locked) || started(r) || getRes(r).final; }
function canWrite() { return !!db && !!who && conn !== "error"; }
function editable(p, r) { const k = getPick(r, p); return p === who && canWrite() && !k.locked && !started(r) && !getRes(r).final; }

/* ---------- saving ---------- */
function setPath(o, path, val) {
  const ps = path.split("."); let t = o;
  for (let i = 0; i < ps.length - 1; i++) { const k = ps[i]; t[k] = Array.isArray(t[k]) ? [...t[k]] : { ...(t[k] || {}) }; t = t[k]; }
  t[ps[ps.length - 1]] = val;
}
function editPick(path, val) {
  const r = raceId, k = pickKey(r, who), o = structuredClone(getPick(r, who));
  setPath(o, path, val); o.updatedAt = Date.now();
  queue(k, picksCol.doc(k), o, "pick", r);
}
function editRes(path, val) {
  const r = raceId, k = "res_" + r, o = structuredClone(getRes(r));
  setPath(o, path, val);
  for (const p of PLAYERS) for (const [f] of TEXTS) if (o.judge[p][f] === null) delete o.judge[p][f];
  o.updatedBy = who; o.updatedAt = Date.now();
  queue(k, resultsCol.doc(r), o, "res", r);
}
function queue(k, ref, o, kind, r) {
  drafts[k] = o; dirty.add(k);
  clearTimeout(timers[k]);
  timers[k] = setTimeout(() => flush(k, ref, kind, r), 450);
}
async function flush(k, ref, kind, r) {
  if (saving[k]) { again[k] = [ref, kind, r]; return; }
  if (!drafts[k]) return;
  saving[k] = true;
  const body = JSON.stringify(drafts[k]);
  let failed = false;
  try { await ref.set(JSON.parse(body)); }
  catch (e) { failed = true; saveFailed(e, k, kind, r); }
  saving[k] = false;
  if (!failed && again[k]) { const a = again[k]; again[k] = null; flush(k, ...a); return; }
  again[k] = null;
  if (!failed && drafts[k] && JSON.stringify(drafts[k]) === body) { dirty.delete(k); delete drafts[k]; }
}
function saveFailed(e, k, kind, r) {
  delete drafts[k]; dirty.delete(k);   // fall back to what the server has
  const code = e && e.code, name = raceById(r).name;
  if (code === "permission-denied") {
    if (kind === "pick" && started(r)) showNotice(`Lights out has passed in ${name}, so those picks are locked.`, true);
    else if (kind === "res" && !started(r)) showNotice(`${name} results open at lights out.`, true);
    else showNotice("The save was refused. Check that the Firestore rules from SETUP-PRIVATE.txt are published, then reload.", true);
  } else if (code === "resource-exhausted") {
    showNotice("The free daily limit was hit. Saving will work again tomorrow.", true);
  } else {
    showNotice("Couldn't save just now. Check your connection and try again.", true);
  }
  render();
}
function showNotice(t, isErr) { noticeText = t || ""; noticeErr = !!isErr; paintNotice(); }
function paintNotice() {
  const n = $("notice");
  let t = noticeText, err = noticeErr;
  if (!t && db && !who) t = "Pick who's on this device (top right) to start predicting.";
  n.textContent = t; n.hidden = !t; n.classList.toggle("err", !!err && !!t);
}

/* ---------- driver cards ---------- */
function driverOpts(val, used, allowNone) {
  let h = `<option value="">Pick a driver</option>`;
  if (allowNone) h += `<option value="NONE"${val === "NONE" ? " selected" : ""}>No retirements</option>`;
  for (const t of Object.keys(TEAMS)) {
    h += `<optgroup label="${esc(TEAMS[t].n)}">`;
    for (const d of DRIVERS.filter(x => x.team === t)) {
      const dis = used && used.has(d.code) && d.code !== val;
      h += `<option value="${d.code}"${d.code === val ? " selected" : ""}${dis ? " disabled" : ""}>${esc(d.name)}</option>`;
    }
    h += `</optgroup>`;
  }
  return h;
}
/* Driver photos live in drivers/<code>.webp (e.g. drivers/ver.webp). A missing photo is skipped quietly,
   so adding one later (say drivers/lin.webp) needs no code change. */
const NO_PHOTO = new Set();
document.addEventListener("error", e => {
  const img = e.target;
  if (!img || img.tagName !== "IMG" || !img.classList.contains("face")) return;
  NO_PHOTO.add(img.dataset.code);
  const c = img.closest(".drv");
  if (c) c.classList.add("noface");
  img.remove();
}, true);
function card(code, editing) {
  const hide = editing ? ' aria-hidden="true"' : "";
  if (code === "NONE") return `<div class="drv none"${hide}><span class="ident"><span class="nm">No retirements</span><span class="tm">Everyone finishes</span></span></div>`;
  const d = DMAP[code];
  if (!d) return `<div class="drv blank"${hide}><span class="ident"><span class="nm">${editing ? "Pick a driver" : "No pick"}</span></span></div>`;
  const t = TEAMS[d.team], c = d.code.toLowerCase();
  const face = NO_PHOTO.has(c) ? "" : `<img class="face" src="drivers/${c}.webp" data-code="${c}" alt="" loading="lazy" decoding="async">`;
  return `<div class="drv${face ? "" : " noface"}" style="--team:${t.c}"${hide}><b>${d.code}</b><span class="ident"><span class="nm">${esc(d.name)}</span><span class="tm">${esc(t.n)}</span></span>${face}</div>`;
}
/* Editable: the card is what you see; the native dropdown sits invisibly on top of it. */
function driverField(id, dataAttr, value, used, allowNone, label, editing) {
  if (!editing) return card(value, false);
  return `<div class="pick">${card(value, true)}<select id="${id}" ${dataAttr} aria-label="${esc(label)}">${driverOpts(value, used, allowNone)}</select></div>`;
}
const ptCell = s => s ? `<span class="pt ${s.k}">${s.v ? "+" + s.v : "0"}</span>` : `<span></span>`;
const PLACEHOLDER = { surprise: "Who over-delivers?", flop: "Who disappoints?", crazy: "Both Ferraris DNF…" };

/* ---------- rendering ---------- */
function tower(p) {
  const r = raceById(raceId), pick = getPick(raceId, p), res = getRes(raceId), mine = p === who, show = mine || revealed(raceId), ed = editable(p, raceId);
  const sc = res.final ? score(pick, res) : null;
  let status = sc ? `${sc.total} pts` : pick.locked ? "Locked in" : pickCount(pick) ? "Picking" : "No picks yet";
  if (mine && !sc) status += " · you";
  let body;
  if (!show) {
    body = `<div class="sealed"><b>Sealed</b><p>${pickCount(pick)} of ${TOTAL_SLOTS} picks made${pick.locked ? ", locked in" : ""}. Revealed when you both lock in, or at lights out.</p></div>`;
  } else {
    const used = new Set(pick.top5.filter(Boolean));
    const rows = pick.top5.map((d, i) => `<div class="row"><div class="pos">P${i + 1}</div>${driverField(`pk-${p}-t${i}`, `data-f="top5.${i}"`, d, used, false, `Your P${i + 1}`, ed)}${ptCell(sc && sc.top5[i])}</div>`).join("");
    const ex = EXTRAS.map(([f, l]) => `<div class="row x"><span class="xl">${l}</span>${driverField(`pk-${p}-${f}`, `data-f="${f}"`, pick[f], null, f === "firstOut", l, ed)}${ptCell(sc && sc[f])}</div>`).join("");
    const scRow = `<div class="row x"><span class="xl">Safety cars</span><div class="scseg" role="group" aria-label="Safety cars">${SC_OPTS.map(o => `<button type="button" data-sc="${o}" aria-pressed="${pick.sc === o}"${ed ? "" : " disabled"}>${o}</button>`).join("")}</div>${ptCell(sc && sc.sc)}</div>`;
    const tx = TEXTS.map(([f, l]) => `<div class="row x"><span class="xl">${l}</span>${ed ? `<input type="text" id="pk-${p}-${f}" data-f="${f}" maxlength="${TEXT_MAX}" autocomplete="off" placeholder="${PLACEHOLDER[f]}" value="${esc(pick[f])}">` : pick[f] ? `<div class="txt">${esc(pick[f])}</div>` : `<div class="empty">No pick</div>`}${ptCell(sc && sc[f])}</div>`).join("");
    let act = "";
    if (mine && !res.final && !started(raceId) && canWrite()) {
      const other = getPick(raceId, OTHER[p]);
      if (!pick.locked) {
        const full = pick.top5.every(Boolean);
        act = `<div class="actions"><button type="button" class="btn${lockArmed ? " warn" : ""}" data-act="lock"${full ? "" : " disabled"}>${lockArmed ? "Tap again to lock" : "Lock in picks"}</button>${full ? `<p class="hint">You can unlock until ${PNAME[OTHER[p]]} locks in too.</p>` : `<p class="hint">Fill your top 5 to lock in.</p>`}</div>`;
      } else if (!other.locked) {
        act = `<div class="actions"><button type="button" class="btn ghost" data-act="unlock">Unlock to change</button><p class="hint">Waiting for ${PNAME[OTHER[p]]} to lock in.</p></div>`;
      }
    }
    const tot = sc ? `<div class="total"><span class="label">Race total</span><b>${sc.total}</b></div>` : "";
    body = `<div class="tbody"><p class="label">${esc(r.name)} top 5</p><div class="grid5">${rows}</div><p class="label">The rest of the P3 game</p><div class="grid5">${ex}${scRow}${tx}</div>${act}${tot}</div>`;
  }
  return `<article class="tower ${p}"><div class="thead"><h3>${PNAME[p]}</h3><span class="chip">${esc(status)}</span></div>${body}</article>`;
}

function resultsPanel() {
  const r = raceById(raceId), res = getRes(raceId), isOpen = started(raceId), ed = canWrite() && !res.final && isOpen;
  const used = new Set(res.top5.filter(Boolean));
  const head = res.final ? finalBanner(res)
    : `<h3>${esc(r.name)} results</h3><p class="hint">${isOpen ? "Enter what actually happened, judge each other's wildcards, then finalize to score the race." : "Opens at lights out. Either of you can fill it in after the chequered flag."}</p>`;
  const note = res.note ? `<p class="note">${esc(res.note)}</p>` : "";
  const sel = (id, f, v, label, allowNone) => driverField(id, `data-r="${f}"`, v, f.startsWith("top5") ? used : null, allowNone, `Actual ${label}`, ed);
  const top = res.top5.map((d, i) => `<div class="row"><div class="pos">P${i + 1}</div>${sel("rs-t" + i, "top5." + i, d, "P" + (i + 1))}<span></span></div>`).join("");
  const ex = EXTRAS.map(([f, l]) => `<div class="row x"><span class="xl">${l}</span>${sel("rs-" + f, f, res[f], l, f === "firstOut")}<span></span></div>`).join("")
    + `<div class="row x"><span class="xl">Safety cars</span><div class="scseg" role="group" aria-label="Actual safety cars">${SC_OPTS.map(o => `<button type="button" data-rsc="${o}" aria-pressed="${res.sc === o}"${ed ? "" : " disabled"}>${o}</button>`).join("")}</div><span></span></div>`;
  /* Wildcard judging only appears once the race has started. */
  const judge = !(isOpen || res.final) ? "" : PLAYERS.map(p => {
    const pk = getPick(raceId, p);
    return `<div class="jcard ${p}"><p class="label">${PNAME[p]}'s wildcards</p>${TEXTS.map(([f, l]) => {
      const v = res.judge[p][f];
      const shown = pk[f] ? (revealed(raceId) ? esc(pk[f]) : "Sealed") : "No pick";
      const btns = pk[f] && revealed(raceId) ? `<div class="yn"><button type="button" class="y" data-j="${p}.${f}" data-v="1" aria-pressed="${v === true}"${ed ? "" : " disabled"}>Happened</button><button type="button" class="no" data-j="${p}.${f}" data-v="0" aria-pressed="${v === false}"${ed ? "" : " disabled"}>Didn't</button></div>` : "";
      return `<div class="jrow"><p><small>${l}</small>${shown}</p>${btns}</div>`;
    }).join("")}</div>`;
  }).join("");
  const ready = res.top5.every(Boolean);
  let act = "";
  if (canWrite() && isOpen) {
    act = res.final
      ? `<div class="actions"><button type="button" class="btn ghost" data-act="reopen">Reopen results</button><p class="hint">Reopen to fix a mistake or change a wildcard call. Scores update when you finalize again.</p></div>`
      : `<div class="actions"><button type="button" class="btn" data-act="finalize"${ready ? "" : " disabled"}>Finalize &amp; score</button><p class="hint">${ready ? "Locks the results and adds this race to the season." : "Enter the real top 5 first."}</p></div>`;
  }
  return `${head}${note}<div class="rgrid"><div><p class="label">Actual top 5</p>${top}</div><div><p class="label">Everything else</p>${ex}</div></div>${judge ? `<div class="judge">${judge}</div>` : ""}${act}`;
}
function finalBanner(res) {
  const s = raceScore(raceId), r = esc(raceById(raceId).name);
  const line = s.f === s.l ? `Dead heat in ${r}, ${s.f}–${s.l}`
    : s.f > s.l ? `<span class="f">Fayez</span> takes ${r}, ${s.f}–${s.l}` : `<span class="l">Leona</span> takes ${r}, ${s.l}–${s.f}`;
  return `<p class="banner">${line}</p>`;
}
function seasonData() { return RACES.map(r => ({ r, s: raceScore(r.id) })); }
function statusLine() {
  const map = {
    connecting: ["", "Connecting…"],
    live: ["live", "Live board, synced between your devices"],
    offline: ["warn", "Offline. Changes will sync when you're back online."],
    error: ["err", "Can't open this game. Use the full private link and check that the Firestore rules are published."],
    nofirebase: ["err", "Firebase isn't set up. Check firebase-config.js."]
  };
  const [cls, label] = map[conn] || map.connecting;
  return `<span class="dot ${cls}"></span>${label}`;
}
function clockParts() {
  const s = raceScore(raceId);
  if (s) return [s.f === s.l ? "Final · dead heat" : `Final · ${s.f > s.l ? "Fayez" : "Leona"} wins`, `${s.f}–${s.l}`];
  const ms = startMs(raceId) - Date.now();
  if (ms <= 0) return Date.now() - startMs(raceId) < 2.5 * 3600e3 ? ["Picks locked", "Race underway"] : ["Chequered flag", "Enter results"];
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return ["Lights out in", `${d ? d + "d " : ""}${h}h ${String(m).padStart(2, "0")}m`];
}
function paintClock() {
  const [label, value] = clockParts();
  const l = $("clockLabel"), c = $("clock");
  if (l) l.textContent = label;
  if (c) c.textContent = value;
}
function renderTabs() {
  const next = RACES.find(r => !started(r.id));
  $("tabs").innerHTML = RACES.map(r => {
    const s = raceScore(r.id);
    const date = new Date(r.start).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    let tag = "", cls = "";
    if (s) { tag = s.f === s.l ? `Tie ${s.f}–${s.l}` : `${s.f > s.l ? "Fayez" : "Leona"} ${Math.max(s.f, s.l)}–${Math.min(s.f, s.l)}`; cls = s.f === s.l ? "" : (s.f > s.l ? "f" : "l"); }
    else if (started(r.id)) { tag = "Results needed"; cls = "due"; }
    else if (next && r.id === next.id) { tag = "Next race"; cls = "next"; }
    return `<button type="button" class="tab" data-race="${r.id}" aria-current="${r.id === raceId}">${FLAGS[r.flag]}<span class="tl"><b>${esc(r.short)}</b><i>R${r.round} · ${esc(date)}</i>${tag ? `<em class="${cls}">${esc(tag)}</em>` : ""}</span></button>`;
  }).join("");
}
function renderHero() {
  const r = raceById(raceId);
  $("hero").dataset.theme = r.flag;
  $("heroKicker").innerHTML = `${FLAGS[r.flag]}<span>Round ${r.round} of ${SEASON_ROUNDS}${r.round === SEASON_ROUNDS ? " · Season finale" : ""}</span>`;
  $("gpTitle").innerHTML = `<span>${esc(r.name)}</span> <span>Grand Prix</span>`;
  $("venue").textContent = `${r.circuit} · ${r.place}`;
  $("facts").innerHTML = [["Race day", r.day], [`Lights out, ${r.city}`, r.local], ["Laps", String(r.laps)], ["Lap length", r.length], ["Distance", r.distance]]
    .map(([k, v]) => `<li><small>${esc(k)}</small><b>${esc(v)}</b></li>`).join("");
  const when = new Date(r.start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  $("heroWhen").textContent = `${when} your time`;
  paintClock();
  $("status").innerHTML = statusLine();
  document.title = `P3 Podcast · ${r.name} GP`;
}
function renderSeason() {
  const sd = seasonData(), done = sd.filter(x => x.s);
  const tf = done.reduce((a, x) => a + x.s.f, 0), tl = done.reduce((a, x) => a + x.s.l, 0);
  const wf = done.filter(x => x.s.f > x.s.l).length, wl = done.filter(x => x.s.l > x.s.f).length;
  $("standings").innerHTML = `<div class="sbar f"><span class="nm">Fayez</span><span class="pts">${tf}<small>pts · ${wf} W</small></span></div><div class="vs">VS<small>${done.length} of ${RACES.length} scored</small></div><div class="sbar l"><span class="nm">Leona</span><span class="pts">${tl}<small>pts · ${wl} W</small></span></div>`;
  const rows = sd.map(({ r, s }) => {
    const label = `<td>${FLAGS[r.flag]}${esc(r.short)}</td>`;
    if (s) return `<tr>${label}<td class="n">${s.f}</td><td class="n">${s.l}</td>${s.f === s.l ? `<td>Tie</td>` : s.f > s.l ? `<td class="w-f">Fayez</td>` : `<td class="w-l">Leona</td>`}</tr>`;
    return `<tr>${label}<td class="n">–</td><td class="n">–</td><td>${started(r.id) ? "Awaiting results" : "Upcoming"}</td></tr>`;
  }).join("");
  const lead = done.length ? (tf === tl ? "Level" : tf > tl ? "Fayez leads" : "Leona leads") : "";
  $("season").innerHTML = `<h3>Season</h3><div class="tablewrap"><table><thead><tr><th>Race</th><th class="n">Fayez</th><th class="n">Leona</th><th>Winner</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>Total</th><th class="n">${tf}</th><th class="n">${tl}</th><th>${lead}</th></tr></tfoot></table></div>`;
}
function render() {
  if (conn === "nocode") return;
  /* Open on the current race once results have loaded, then stay on whatever race is showing. */
  if (!raceId || (!userPickedRace && !raceSettled)) {
    raceId = currentRaceId();
    if (cacheFlags.results !== null) raceSettled = true;
  }
  const a = document.activeElement, aid = a && a.id;
  let s0 = null, s1 = null;
  try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) { /* not a text field */ }
  startedFlag = started(raceId);
  document.querySelectorAll("#whoSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.who === who)));
  renderTabs();
  renderHero();
  renderSeason();
  $("towers").innerHTML = PLAYERS.map(tower).join("");
  $("results").innerHTML = resultsPanel();
  paintNotice();
  if (aid) {
    const el = $(aid);
    if (el) { el.focus(); try { if (el.setSelectionRange && s0 != null) el.setSelectionRange(s0, s1); } catch (e) { /* ignore */ } }
  }
}
function updateConn() {
  if (conn === "error") return;
  if (cacheFlags.picks === null || cacheFlags.results === null) conn = "connecting";
  else conn = cacheFlags.picks || cacheFlags.results ? "offline" : "live";
}
function setConn(c) { if (conn !== c) { conn = c; const s = $("status"); if (s) s.innerHTML = statusLine(); } }

/* ---------- events ---------- */
document.addEventListener("change", e => {
  const t = e.target;
  if (!canWrite()) return;
  if (t.dataset.f && t.tagName === "SELECT") { disarm(); editPick(t.dataset.f, t.value); render(); }
  else if (t.dataset.r && t.tagName === "SELECT") { editRes(t.dataset.r, t.value); render(); }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.f && t.tagName === "INPUT" && canWrite()) editPick(t.dataset.f, t.value.slice(0, TEXT_MAX));
});
function disarm() { lockArmed = false; clearTimeout(lockTimer); }
document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.who) { who = b.dataset.who; store("p3-who", who); disarm(); noticeText = ""; render(); return; }
  if (b.dataset.race) { raceId = b.dataset.race; userPickedRace = true; disarm(); noticeText = ""; render(); return; }
  if (!canWrite()) return;
  if (b.dataset.sc) { editPick("sc", getPick(raceId, who).sc === b.dataset.sc ? "" : b.dataset.sc); render(); return; }
  if (b.dataset.rsc) { editRes("sc", getRes(raceId).sc === b.dataset.rsc ? "" : b.dataset.rsc); render(); return; }
  if (b.dataset.j) {
    const [p, f] = b.dataset.j.split("."), v = b.dataset.v === "1";
    editRes("judge." + p + "." + f, getRes(raceId).judge[p][f] === v ? null : v); render(); return;
  }
  const act = b.dataset.act;
  if (act === "lock") {
    if (!lockArmed) { lockArmed = true; clearTimeout(lockTimer); lockTimer = setTimeout(() => { lockArmed = false; render(); }, 4000); render(); return; }
    disarm(); editPick("locked", true); render();
  } else if (act === "unlock") { editPick("locked", false); render(); }
  else if (act === "finalize") { editRes("final", true); render(); }
  else if (act === "reopen") { editRes("final", false); render(); }
});
setInterval(() => {
  if (conn === "nocode" || !raceId) return;
  if (started(raceId) !== startedFlag) { render(); return; }
  paintClock();
}, 30000);

/* ---------- start ---------- */
function startGame() {
  gameCode = readGameCode();
  if (!gameCode) {
    conn = "nocode";
    $("gate").hidden = false; $("game").hidden = true; $("whoBox").hidden = true; $("tabs").hidden = true;
    return;
  }
  const cfg = window.FIREBASE_CONFIG;
  const configured = window.firebase && cfg && typeof cfg.projectId === "string" && !/PASTE/.test(cfg.projectId);
  if (!configured) { conn = "nofirebase"; render(); return; }
  try {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    db = app.firestore();
  } catch (e) { db = null; conn = "nofirebase"; render(); return; }
  picksCol = db.collection("games").doc(gameCode).collection("picks");
  resultsCol = db.collection("games").doc(gameCode).collection("results");
  render();
  const onErr = () => { setConn("error"); render(); };
  const opts = { includeMetadataChanges: true };
  picksCol.onSnapshot(opts, snap => {
    const next = {};
    snap.docs.forEach(d => {
      const i = d.id.lastIndexOf("_"), race = d.id.slice(0, i), player = d.id.slice(i + 1);
      if (RACE_IDS.has(race) && PLAYERS.includes(player)) next[d.id] = cleanPick(race, player, d.data());
    });
    state.picks = next;
    for (const k of Object.keys(drafts)) if (!k.startsWith("res_") && !dirty.has(k)) delete drafts[k];
    cacheFlags.picks = snap.metadata.fromCache;
    updateConn();
    render();
  }, onErr);
  resultsCol.onSnapshot(opts, snap => {
    const next = {};
    snap.docs.forEach(d => { if (RACE_IDS.has(d.id)) next[d.id] = cleanRes(d.id, d.data()); });
    state.results = next;
    for (const k of Object.keys(drafts)) if (k.startsWith("res_") && !dirty.has(k)) delete drafts[k];
    cacheFlags.results = snap.metadata.fromCache;
    updateConn();
    render();
  }, onErr);
}
startGame();
