"use strict";
/* P3 Podcast: F1 predictions for Fayez and Leona, 2026 Abu Dhabi Grand Prix.
   Data lives in Firestore under games/<game code>/picks and games/<game code>/results.
   The game code only comes from the private link (the part after #). It is never stored in this repo. */

/* ---------- race data (keep the lights-out time and driver list in sync with the Firestore rules) ---------- */
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
  ["OCO", "Esteban Ocon", "HAA"], ["BEA", "Oliver Bearman", "HAA"],
  ["GAS", "Pierre Gasly", "ALP"], ["COL", "Franco Colapinto", "ALP"],
  ["HUL", "Nico Hülkenberg", "AUD"], ["BOR", "Gabriel Bortoleto", "AUD"],
  ["BOT", "Valtteri Bottas", "CAD"], ["PER", "Sergio Pérez", "CAD"]
].map(([code, name, team]) => ({ code, name, team }));
const DMAP = Object.fromEntries(DRIVERS.map(d => [d.code, d]));
const RACES = [
  // Round 22 of 22. Lights out 17:00 in Abu Dhabi = 13:00 UTC.
  { id: "abudhabi-2026", name: "Abu Dhabi GP", short: "Abu Dhabi", round: 22, circuit: "Yas Marina Circuit", start: "2026-12-06T13:00:00Z" }
];
const PLAYERS = ["fayez", "leona"], PNAME = { fayez: "Fayez", leona: "Leona" };
const OTHER = { fayez: "leona", leona: "fayez" };
const PTS = { exact: 5, inTop5: 2, pole: 4, firstOut: 4, fastest: 3, dotd: 3, sc: 3, surprise: 3, flop: 3, crazy: 6 };
const SC_OPTS = ["0", "1", "2", "3+"];
const EXTRAS = [["pole", "Pole position"], ["firstOut", "First retirement"], ["fastest", "Fastest lap"], ["dotd", "Driver of the Day"]];
const TEXTS = [["surprise", "Good surprise"], ["flop", "Big flop"], ["crazy", "Crazy prediction"]];
const TEXT_MAX = 80;
const TOTAL_SLOTS = 5 + EXTRAS.length + 1 + TEXTS.length;

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
const raceId = RACES[0].id;               // this game is one race only
const state = { picks: {}, results: {} };  // cleaned server data
const drafts = {}, dirty = new Set(), saving = {}, again = {}, timers = {};
let noticeText = "", noticeErr = false;

const pickKey = (r, p) => r + "_" + p;
const blankPick = (r, p) => cleanPick(r, p, {});
const blankRes = r => cleanRes(r, {});
function getPick(r, p) { const k = pickKey(r, p); return drafts[k] || state.picks[k] || blankPick(r, p); }
function getRes(r) { const k = "res_" + r; return drafts[k] || state.results[r] || blankRes(r); }

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
  const k = pickKey(raceId, who), o = structuredClone(getPick(raceId, who));
  setPath(o, path, val); o.updatedAt = Date.now();
  queue(k, picksCol.doc(k), o, "pick", raceId);
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
  const code = e && e.code;
  if (code === "permission-denied") {
    if (kind === "pick" && started(r)) showNotice("Lights out has passed, so picks for this race are locked.", true);
    else if (kind === "res" && !started(r)) showNotice("Results open at lights out.", true);
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

/* ---------- rendering ---------- */
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
function chip(code) {
  if (!code) return `<div class="empty">No pick</div>`;
  if (code === "NONE") return `<div class="txt">No retirements</div>`;
  const d = DMAP[code];
  if (!d) return `<div class="empty">No pick</div>`;
  return `<div class="drv" style="--team:${TEAMS[d.team].c}"><b>${d.code}</b><span>${esc(d.name)}</span></div>`;
}
const ptCell = s => s ? `<span class="pt ${s.k}">${s.v ? "+" + s.v : "0"}</span>` : `<span></span>`;
const PLACEHOLDER = { surprise: "Who over-delivers?", flop: "Who disappoints?", crazy: "Both Ferraris DNF…" };

function tower(p) {
  const pick = getPick(raceId, p), res = getRes(raceId), mine = p === who, show = mine || revealed(raceId), ed = editable(p, raceId);
  const sc = res.final ? score(pick, res) : null;
  let status = sc ? `${sc.total} pts` : pick.locked ? "Locked in" : pickCount(pick) ? "Picking" : "No picks yet";
  if (mine && !sc) status += " · you";
  let body;
  if (!show) {
    body = `<div class="sealed"><b>Sealed</b><p>${pickCount(pick)} of ${TOTAL_SLOTS} picks made${pick.locked ? ", locked in" : ""}. Revealed when you both lock in, or at lights out.</p></div>`;
  } else {
    const used = new Set(pick.top5.filter(Boolean));
    const rows = pick.top5.map((d, i) => `<div class="row"><div class="pos">P${i + 1}</div>${ed ? `<select id="pk-${p}-t${i}" data-f="top5.${i}" aria-label="Your P${i + 1}">${driverOpts(d, used)}</select>` : chip(d)}${ptCell(sc && sc.top5[i])}</div>`).join("");
    const ex = EXTRAS.map(([f, l]) => `<div class="row x"><span class="xl">${l}</span>${ed ? `<select id="pk-${p}-${f}" data-f="${f}" aria-label="${l}">${driverOpts(pick[f], null, f === "firstOut")}</select>` : chip(pick[f])}${ptCell(sc && sc[f])}</div>`).join("");
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
    body = `<div class="tbody"><p class="label">Top 5 finish</p><div class="grid5">${rows}</div><p class="label">The rest of the P3 game</p><div class="grid5">${ex}${scRow}${tx}</div>${act}${tot}</div>`;
  }
  return `<article class="tower ${p}"><div class="thead"><h3>${PNAME[p]}</h3><span class="chip">${esc(status)}</span></div>${body}</article>`;
}

function resultsPanel() {
  const res = getRes(raceId), isOpen = started(raceId), ed = canWrite() && !res.final && isOpen;
  const used = new Set(res.top5.filter(Boolean));
  const head = res.final ? finalBanner(res)
    : `<h3>Race results</h3><p class="hint">${isOpen ? "Enter what actually happened, judge each other's wildcards, then finalize to score the race." : "Opens at lights out. Either of you can fill it in after the chequered flag."}</p>`;
  const sel = (id, f, v, label, allowNone) => ed ? `<select id="${id}" data-r="${f}" aria-label="Actual ${label}">${driverOpts(v, f.startsWith("top5") ? used : null, allowNone)}</select>` : chip(v);
  const top = res.top5.map((d, i) => `<div class="row"><div class="pos">P${i + 1}</div>${sel("rs-t" + i, "top5." + i, d, "P" + (i + 1))}<span></span></div>`).join("");
  const ex = EXTRAS.map(([f, l]) => `<div class="row x"><span class="xl">${l}</span>${sel("rs-" + f, f, res[f], l, f === "firstOut")}<span></span></div>`).join("")
    + `<div class="row x"><span class="xl">Safety cars</span><div class="scseg" role="group" aria-label="Actual safety cars">${SC_OPTS.map(o => `<button type="button" data-rsc="${o}" aria-pressed="${res.sc === o}"${ed ? "" : " disabled"}>${o}</button>`).join("")}</div><span></span></div>`;
  const judge = PLAYERS.map(p => {
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
      ? `<div class="actions"><button type="button" class="btn ghost" data-act="reopen">Reopen results</button><p class="hint">Reopen to fix a mistake. Scores update when you finalize again.</p></div>`
      : `<div class="actions"><button type="button" class="btn" data-act="finalize"${ready ? "" : " disabled"}>Finalize &amp; score</button><p class="hint">${ready ? "Locks the results and scores the race." : "Enter the real top 5 first."}</p></div>`;
  }
  return `${head}<div class="rgrid"><div><p class="label">Actual top 5</p>${top}</div><div><p class="label">Everything else</p>${ex}</div></div><div class="judge">${judge}</div>${act}`;
}
function finalBanner(res) {
  const f = score(getPick(raceId, "fayez"), res).total, l = score(getPick(raceId, "leona"), res).total, r = esc(raceById(raceId).short);
  const line = f === l ? `Dead heat in ${r}, ${f}–${l}`
    : f > l ? `<span class="f">Fayez</span> takes ${r}, ${f}–${l}` : `<span class="l">Leona</span> takes ${r}, ${l}–${f}`;
  return `<p class="banner">${line}</p>`;
}
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
function clockText() {
  const ms = startMs(raceId) - Date.now();
  if (getRes(raceId).final) return "Race scored";
  if (ms <= 0) return Date.now() - startMs(raceId) < 2.5 * 3600e3 ? "Race underway · picks locked" : "Chequered flag · enter results";
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return `Lights out in ${d ? d + "d " : ""}${h}h ${String(m).padStart(2, "0")}m`;
}
function render() {
  if (conn === "nocode") return;
  const a = document.activeElement, aid = a && a.id;
  let s0 = null, s1 = null;
  try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) { /* not a text field */ }
  startedFlag = started(raceId);
  document.querySelectorAll("#whoSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.who === who)));
  const r = raceById(raceId);
  const when = new Date(r.start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  $("raceStrip").innerHTML = `<div><h2>${esc(r.name)}<em>R${r.round}</em></h2><div class="meta">${esc(r.circuit)} · lights out ${esc(when)}</div></div><div><div class="clock" id="clock">${clockText()}</div><div class="status" id="status">${statusLine()}</div></div>`;
  const res = getRes(raceId);
  const tf = res.final ? score(getPick(raceId, "fayez"), res).total : 0;
  const tl = res.final ? score(getPick(raceId, "leona"), res).total : 0;
  $("standings").innerHTML = `<div class="sbar f"><span class="nm">Fayez</span><span class="pts">${tf}<small>pts</small></span></div><div class="vs">VS<small>${res.final ? "Final" : "Not scored yet"}</small></div><div class="sbar l"><span class="nm">Leona</span><span class="pts">${tl}<small>pts</small></span></div>`;
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
  if (conn === "nocode") return;
  if (started(raceId) !== startedFlag) { render(); return; }
  const c = $("clock"); if (c) c.textContent = clockText();
}, 30000);

/* ---------- start ---------- */
function startGame() {
  gameCode = readGameCode();
  if (!gameCode) {
    conn = "nocode";
    $("gate").hidden = false; $("game").hidden = true; $("whoBox").hidden = true;
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
