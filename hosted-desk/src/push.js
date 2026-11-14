/* Push alerts: the app's devices, the alerts the Content Studio sends, and the ones the scoring feed sends by itself.

   No fan accounts. A device is a random id the app makes once, its Firebase Cloud Messaging token, what it follows
   (city and player ids, as stored on the phone) and which kinds of alert it wants. Nothing else: no name, no email,
   no location. They live in Cloudflare D1 (binding PUSH), one row per device.

   Delivery is Firebase Cloud Messaging HTTP v1 (it reaches iPhones through Apple's APNs and Android phones directly),
   signed in with the Firebase service account in the Worker secret FCM_SERVICE_ACCOUNT (its JSON, never in the repo).

   Duplicate prevention: every alert has a key (the story it links to, or the alert itself, or the scoring moment);
   a device gets each key at most once (deliveries, primary key device + key). A device gets at most DAILY_CAP alerts
   a day (UTC), whatever sends them.

   Scale note: the demo sends one request per device inside the request or the 5-minute timer. For 50k installs the
   same loop runs in a Cloudflare Queue consumer, a few thousand devices per message; the tables stay as they are. */

export const ALERT_TYPES = { results: "Results", leaders: "Round leaders", news: "News", mission: "Mission" };
export const AUTO_RULES = {
  lead: "A followed city takes the lead",
  city_final: "A followed city finishes its round",
  round_final: "The round is final (each city's finish)",
  big_shot: "Eagle, albatross or hole in one by a followed player",
};
const DAILY_CAP = 15;
const MAX_FOLLOWS = 80;

const nowIso = () => new Date().toISOString().slice(0, 19);
const fail = (m) => { throw new Error(m); };
const sgn = (n) => (n > 0 ? "+" + n : n === 0 ? "E" : String(n));
const addMin = (hhmm, m) => { const [h, mm] = hhmm.split(":").map(Number), t = h * 60 + mm + m; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

/* ------------------------------------------------------------------ the tables (made on first use) */
let READY = null;
async function db(env) {
  if (!env.PUSH) fail("The device list is not set up (D1 binding PUSH).");
  if (!READY) READY = env.PUSH.batch([
    env.PUSH.prepare(`CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, token TEXT NOT NULL, platform TEXT, follows TEXT NOT NULL DEFAULT '[]',
      types TEXT NOT NULL DEFAULT '[]', enabled INTEGER NOT NULL DEFAULT 1, app TEXT, created_at TEXT, updated_at TEXT, dead INTEGER NOT NULL DEFAULT 0)`),
    env.PUSH.prepare(`CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, source TEXT, type TEXT, title TEXT, body TEXT, link TEXT, target TEXT,
      dedupe TEXT, status TEXT, send_at TEXT, created_by TEXT, created_at TEXT, sent_at TEXT,
      targeted INTEGER DEFAULT 0, sent INTEGER DEFAULT 0, dup INTEGER DEFAULT 0, capped INTEGER DEFAULT 0, failed INTEGER DEFAULT 0, note TEXT)`),
    env.PUSH.prepare(`CREATE TABLE IF NOT EXISTS deliveries (device_id TEXT NOT NULL, dedupe TEXT NOT NULL, alert_id TEXT, day TEXT, at TEXT, PRIMARY KEY (device_id, dedupe))`),
    env.PUSH.prepare(`CREATE INDEX IF NOT EXISTS deliveries_day ON deliveries (day, device_id)`),
    env.PUSH.prepare(`CREATE INDEX IF NOT EXISTS alerts_status ON alerts (status, send_at)`),
    env.PUSH.prepare(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`),
  ]).catch((e) => { READY = null; throw e; });
  await READY;
  return env.PUSH;
}
async function getKv(d, k, dflt) { const r = await d.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first(); return r ? JSON.parse(r.v) : dflt; }
const setKv = (d, k, v) => d.prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(k, JSON.stringify(v)).run();
async function rules(d) { return { ...Object.fromEntries(Object.keys(AUTO_RULES).map((k) => [k, true])), ...(await getKv(d, "rules", {})) }; }

/* ------------------------------------------------------------------ the app's side: register, update, unregister */
const APP_ORIGINS = /^(capacitor|ionic):\/\/localhost$|^https?:\/\/localhost(:\d+)?$/;
export async function pushRoute(request, env, path, siteRoot) {
  const origin = request.headers.get("origin") || "";
  const cors = { "access-control-allow-origin": APP_ORIGINS.test(origin) || origin === siteRoot ? origin : siteRoot,
    "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "vary": "origin" };
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Not found." }, 404);
  try {
    const text = await request.text();
    if (text.length > 20000) fail("Too long.");
    const b = JSON.parse(text || "{}");
    const id = String(b.id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) fail("A device id is a UUID.");
    const d = await db(env);
    if (path === "unregister") { await d.prepare("DELETE FROM devices WHERE id = ?").bind(id).run(); return json({ ok: true }); }
    if (path !== "register") return json({ error: "Not found." }, 404);
    const token = String(b.token || "");
    if (!/^[\w:.-]{20,4096}$/.test(token)) fail("That is not a messaging token.");
    const follows = [...new Set((Array.isArray(b.follows) ? b.follows : []).map(String).filter((x) => /^[a-z0-9_-]{1,40}$/.test(x)))].slice(0, MAX_FOLLOWS);
    const types = (Array.isArray(b.types) ? b.types : Object.keys(ALERT_TYPES)).filter((t) => ALERT_TYPES[t]);
    const platform = ["ios", "android", "web"].includes(b.platform) ? b.platform : "ios";
    const now = nowIso();
    await d.prepare(`INSERT INTO devices (id, token, platform, follows, types, enabled, app, created_at, updated_at, dead) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT (id) DO UPDATE SET token = excluded.token, platform = excluded.platform, follows = excluded.follows, types = excluded.types,
      enabled = excluded.enabled, app = excluded.app, updated_at = excluded.updated_at, dead = 0`)
      .bind(id, token, platform, JSON.stringify(follows), JSON.stringify(types), b.enabled === false ? 0 : 1, String(b.app || "").slice(0, 20), now, now).run();
    return json({ ok: true });
  } catch (e) { return json({ error: String(e.message || e) }, 400); }
}

/* ------------------------------------------------------------------ Firebase Cloud Messaging */
let FCM = null;
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = (s) => b64url(new TextEncoder().encode(s));
export async function fcmAuth(env) {
  if (FCM && FCM.exp > Date.now() + 120e3) return FCM;
  if (!env.FCM_SERVICE_ACCOUNT) fail("Firebase is not connected yet (Worker secret FCM_SERVICE_ACCOUNT).");
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT), now = Math.floor(Date.now() / 1000);
  const unsigned = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64urlText(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const jwt = unsigned + "." + b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) fail("Firebase refused the sign-in: " + (j.error_description || j.error || r.status));
  FCM = { token: j.access_token, project: sa.project_id, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return FCM;
}
/* one device; dead = the token no longer exists (app removed, or a new token since) */
export async function fcmSend(auth, token, a) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.project}/messages:send`, {
    method: "POST", headers: { authorization: "Bearer " + auth.token, "content-type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title: a.title, body: a.body },
      data: { alert: a.id, link: a.link || "", type: a.type },
      apns: { payload: { aps: { sound: "default", "thread-id": a.type } } },
      android: { priority: "high", notification: { channel_id: "alerts", sound: "default" } } } }),
  });
  if (r.ok) return { ok: true };
  const j = await r.json().catch(() => ({})), err = j.error || {};
  const code = ((err.details || []).find((x) => x.errorCode) || {}).errorCode || err.status || "";
  return { ok: false, dead: r.status === 404 || code === "UNREGISTERED" || (code === "INVALID_ARGUMENT" && /registration token/i.test(err.message || "")), error: `${r.status} ${code} ${err.message || ""}`.trim() };
}

/* ------------------------------------------------------------------ sending one alert to everyone it is for */
async function deliver(env, d, a) {
  const auth = await fcmAuth(env);
  const target = JSON.parse(a.target || '{"all":true}'), want = new Set(target.follows || []);
  const devices = (await d.prepare("SELECT id, token, follows, types FROM devices WHERE dead = 0 AND enabled = 1").all()).results
    .filter((v) => JSON.parse(v.types).includes(a.type) && (target.all || JSON.parse(v.follows).some((f) => want.has(f))));
  const day = nowIso().slice(0, 10);
  const used = Object.fromEntries((await d.prepare("SELECT device_id, COUNT(*) AS n FROM deliveries WHERE day = ? GROUP BY device_id").bind(day).all()).results.map((r) => [r.device_id, r.n]));
  const c = { targeted: devices.length, sent: 0, dup: 0, capped: 0, failed: 0 };
  let lastError = "";
  for (let i = 0; i < devices.length; i += 20) {
    await Promise.all(devices.slice(i, i + 20).map(async (v) => {
      if ((used[v.id] || 0) >= DAILY_CAP) { c.capped++; return; }
      const claim = await d.prepare("INSERT OR IGNORE INTO deliveries (device_id, dedupe, alert_id, day, at) VALUES (?, ?, ?, ?, ?)").bind(v.id, a.dedupe, a.id, day, nowIso()).run();
      if (!claim.meta.changes) { c.dup++; return; }
      const r = await fcmSend(auth, v.token, a);
      if (r.ok) { c.sent++; used[v.id] = (used[v.id] || 0) + 1; return; }
      c.failed++; lastError = r.error;
      await d.prepare("DELETE FROM deliveries WHERE device_id = ? AND dedupe = ?").bind(v.id, a.dedupe).run();   // not delivered: may go again
      if (r.dead) await d.prepare("UPDATE devices SET dead = 1 WHERE id = ?").bind(v.id).run();
    }));
  }
  await d.prepare("UPDATE alerts SET status = 'sent', sent_at = ?, targeted = ?, sent = ?, dup = ?, capped = ?, failed = ?, note = ? WHERE id = ?")
    .bind(nowIso(), c.targeted, c.sent, c.dup, c.capped, c.failed, lastError ? lastError.slice(0, 300) : null, a.id).run();
  return c;
}
async function createAlert(d, a) {
  const row = { id: a.id || "a" + Date.now().toString(36) + crypto.randomUUID().slice(0, 4), source: a.source || "studio", type: a.type, title: a.title, body: a.body,
    link: a.link || "", target: JSON.stringify(a.target), dedupe: a.dedupe, status: a.status, send_at: a.send_at || null, created_by: a.created_by || "", created_at: nowIso() };
  if (!row.dedupe) row.dedupe = "alert:" + row.id;
  await d.prepare(`INSERT INTO alerts (id, source, type, title, body, link, target, dedupe, status, send_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.source, row.type, row.title, row.body, row.link, row.target, row.dedupe, row.status, row.send_at, row.created_by, row.created_at).run();
  return row;
}

/* ------------------------------------------------------------------ the Content Studio's Alerts page */
/* deps: { stories(): the desk's story records, scores(): the scoring of the event in play, mayRules: the role may switch automatic alerts } */
export async function alertsApi(request, env, path, who, deps) {
  const d = await db(env);
  if (request.method === "GET") {
    const alerts = (await d.prepare("SELECT * FROM alerts ORDER BY COALESCE(sent_at, send_at, created_at) DESC LIMIT 60").all()).results;
    const dv = (await d.prepare("SELECT platform, follows, types FROM devices WHERE dead = 0 AND enabled = 1").all()).results;
    const follows = {};
    for (const v of dv) for (const f of JSON.parse(v.follows)) follows[f] = (follows[f] || 0) + 1;
    const total = (await d.prepare("SELECT COUNT(*) AS n FROM devices").first()).n;
    return { alerts, types: ALERT_TYPES, auto_rules: AUTO_RULES, rules: await rules(d), replay: await replayState(d, deps), may_rules: deps.mayRules, daily_cap: DAILY_CAP,
      devices: { total, active: dv.length, ios: dv.filter((v) => v.platform === "ios").length, android: dv.filter((v) => v.platform === "android").length, follows },
      firebase: !!env.FCM_SERVICE_ACCOUNT };
  }
  const b = await request.json();
  if (path === "alertrules" || path === "replay") {
    if (!deps.mayRules) fail("Your role does not allow switching automatic alerts.");
    if (path === "alertrules") { const r = await rules(d); for (const k of Object.keys(AUTO_RULES)) if (typeof b[k] === "boolean") r[k] = b[k]; await setKv(d, "rules", r); return { ok: true, rules: r }; }
    const sc = await deps.scores(), rp = await replayState(d, deps, sc);
    if (b.action === "reset") { await d.prepare("DELETE FROM deliveries WHERE dedupe LIKE 'auto:%'").run(); Object.assign(rp, { clock: rp.start, running: false }); }
    else if (b.action === "run") rp.running = true;
    else if (b.action === "pause") rp.running = false;
    else if (b.action === "speed") rp.step = Math.max(2, Math.min(60, +b.step || 20));
    else if (b.action === "step") { const out = await autoStep(env, d, sc, rp, Math.max(1, Math.min(120, +b.minutes || 10)), who); return { ok: true, replay: out.replay, fired: out.fired }; }
    await setKv(d, "replay", rp);
    return { ok: true, replay: rp };
  }
  if (path !== "alerts") fail("Not found.");
  if (b.action === "cancel") {
    const r = await d.prepare("UPDATE alerts SET status = 'cancelled', note = ? WHERE id = ? AND status = 'scheduled'").bind("Cancelled by " + who, String(b.id || "")).run();
    if (!r.meta.changes) fail("That alert is not waiting to go out.");
    return { ok: true };
  }
  // send or schedule
  const title = String(b.title || "").trim(), body = String(b.body || "").trim();
  if (!title) fail("An alert needs a title.");
  if (title.length > 65) fail("Keep the title to 65 characters: phones cut it there.");
  if (body.length > 178) fail("Keep the text to 178 characters: phones cut it there.");
  if (!ALERT_TYPES[b.type]) fail("Pick what kind of alert it is.");
  const target = b.target && Array.isArray(b.target.follows) && b.target.follows.length ? { follows: b.target.follows.map(String).slice(0, 40) } : { all: true };
  let link = "", dedupe = "";
  if (b.link && b.link.kind === "story") {
    const s = (await deps.stories()).find((x) => x.id === b.link.id) || fail("No such story.");
    if ((s.status || "published") !== "published" && !(s.status === "scheduled" && b.at && s.scheduled_at <= b.at)) fail("That story is not published yet, so the alert would open nothing. Publish it first (or schedule the alert after it).");
    link = "story:" + (s.slug || s.id); dedupe = "story:" + s.id;
  } else if (b.link && ["city", "player"].includes(b.link.kind) && /^[a-z0-9_-]{1,40}$/.test(b.link.id || "")) link = b.link.kind + ":" + b.link.id;
  else if (b.link && b.link.kind === "live") link = "live";
  if (dedupe && !b.again) {
    const had = await d.prepare("SELECT COUNT(*) AS n FROM deliveries WHERE dedupe = ?").bind(dedupe).first();
    const queued = await d.prepare("SELECT id FROM alerts WHERE dedupe = ? AND status = 'scheduled'").bind(dedupe).first();
    if (queued) fail("An alert for this story is already scheduled. Cancel that one first.");
    if (had.n) return { duplicate: had.n };                        // the Studio asks; sending anyway skips those devices
  }
  if (b.at) {
    const at = String(b.at).slice(0, 16);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(at) || at <= nowIso().slice(0, 16)) fail("Pick a time in the future.");
    const a = await createAlert(d, { type: b.type, title, body, link, target, dedupe, status: "scheduled", send_at: at, created_by: who });
    return { ok: true, alert: a };
  }
  const a = await createAlert(d, { type: b.type, title, body, link, target, dedupe, status: "sending", created_by: who });
  const counts = await deliver(env, d, a);
  return { ok: true, alert: { ...a, status: "sent", ...counts } };
}

/* ------------------------------------------------------------------ automatic alerts from the scoring feed */
/* In the demo the round is replayed on the Desk: a course clock (kv "replay") that moves on when the Studio steps it,
   or by itself on every 5-minute timer while it runs. Each move compares the board before and after and sends what
   happened in between. In production the clock is the feed's own: every feed update is one step. */
async function replayState(d, deps, sc) {
  const rp = await getKv(d, "replay", null);
  if (rp) return rp;
  sc = sc || await deps.scores();
  const start = sc.feed.tee_sheet.filter((g) => g.round_id === "r2").map((g) => g.tee_time.slice(11, 16)).sort()[0];
  return { start, clock: start, end: sc.board(start).final_at, running: false, step: 20 };
}
const shortEvent = (sc) => (sc.feed.event.name.split(/\s+[—–-]\s+/).pop() || sc.feed.event.name);
export function moments(sc, from, to) {
  const ev = sc.feed.event.id, where = shortEvent(sc), out = [];
  const b0 = sc.board(from), b1 = sc.board(to);
  const team = (cid) => [cid, ...sc.ref.site.players.filter((p) => p.city === cid).map((p) => p.id)];
  const pos = (r) => r.pos.startsWith("T") ? "tied " + r.pos.slice(1) + ordinal(r.pos.slice(1)) : r.pos + ordinal(r.pos);
  const lead0 = b0.board[0].pos === "1" ? b0.board[0].id : null, l = b1.board[0];
  if (l.pos === "1" && l.id !== lead0 && l.thru !== 0)
    out.push({ rule: "lead", type: "leaders", target: { follows: team(l.id) }, dedupe: `auto:${ev}:lead:${l.id}:${to}`, link: "live",
      title: `${l.city} takes the lead at ${where}`, body: `${sgn(l.total)} overall, ${sgn(l.today)} today${l.thru === "F" ? ", round finished" : " thru " + l.thru}. Round 2 is live.` });
  for (const r of b1.board) {
    const was = b0.board.find((x) => x.id === r.id);
    if (r.thru === "F" && was.thru !== "F" && !b1.final)
      out.push({ rule: "city_final", type: "results", target: { follows: team(r.id) }, dedupe: `auto:${ev}:done:${r.id}`, link: "city:" + r.id,
        title: `${r.city} finishes Round 2 at ${sgn(r.today)}`, body: `${sgn(r.total)} overall, ${pos(r)} on the board while the others finish.` });
  }
  if (b1.final && !b0.final) {
    const win = b1.board[0];
    for (const r of b1.board)            // one key for all: a fan who follows two cities gets one final, not two
      out.push({ rule: "round_final", type: "results", target: { follows: team(r.id) }, dedupe: `auto:${ev}:final`, link: "live",
        title: r.id === win.id ? `${r.city} wins at ${where}!` : `Final at ${where}: ${r.city} ${pos(r)}`,
        body: `${sgn(r.total)} overall · ${r.points} league points.${r.id === win.id ? "" : ` ${win.city} wins at ${sgn(win.total)}.`} Season standings updated.` });
  }
  for (const c of sc.ref.site.cities) for (const n of sc.cityRound(c.id, to, 2).notable)
    if (n.posted > from && n.posted <= to)
      out.push({ rule: "big_shot", type: "leaders", target: { follows: [n.id] }, dedupe: `auto:${ev}:shot:${n.id}:${n.hole}`, link: "player:" + n.id,
        title: `${n.what === "hole in one" ? "Hole in one" : n.what[0].toUpperCase() + n.what.slice(1)}! ${n.player} on the ${n.hole}${ordinal(n.hole)}`,
        body: `${n.score} on the par-${n.par}, ${n.yardage} yards, for ${c.name} at ${where}.` });
  return out;
}
const ordinal = (n) => { n = +n; return [11, 12, 13].includes(n % 100) ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"; };
async function autoStep(env, d, sc, rp, minutes, who) {
  if (rp.clock >= rp.end) { rp.running = false; await setKv(d, "replay", rp); return { replay: rp, fired: [] }; }
  const to = addMin(rp.clock, minutes) > rp.end ? rp.end : addMin(rp.clock, minutes);
  const on = await rules(d), fired = [];
  for (const m of moments(sc, rp.clock, to)) {
    if (!on[m.rule]) continue;
    const a = await createAlert(d, { ...m, source: "auto", status: "sending", created_by: "scoring feed · " + AUTO_RULES[m.rule] });
    let counts;
    try { counts = await deliver(env, d, a); } catch (e) { await d.prepare("UPDATE alerts SET status = 'failed', note = ? WHERE id = ?").bind(String(e.message).slice(0, 300), a.id).run(); counts = { error: e.message }; }
    fired.push({ title: m.title, rule: m.rule, ...counts });
  }
  rp.clock = to; if (to >= rp.end) rp.running = false;
  await setKv(d, "replay", rp);
  return { replay: rp, fired };
}

/* ------------------------------------------------------------------ the 5-minute timer */
export async function alertsDue(env, deps) {
  if (!env.PUSH) return;
  const d = await db(env), now = nowIso().slice(0, 16);
  const due = (await d.prepare("SELECT * FROM alerts WHERE status = 'scheduled' AND send_at <= ?").bind(now).all()).results;
  for (const a of due) {
    const r = await d.prepare("UPDATE alerts SET status = 'sending' WHERE id = ? AND status = 'scheduled'").bind(a.id).run();
    if (!r.meta.changes) continue;                                // another timer took it
    try { await deliver(env, d, a); } catch (e) { await d.prepare("UPDATE alerts SET status = 'failed', note = ? WHERE id = ?").bind(String(e.message).slice(0, 300), a.id).run(); }
  }
  const rp = await getKv(d, "replay", null);
  if (rp && rp.running) await autoStep(env, d, await deps.scores(), rp, rp.step || 20, "timer");
}
