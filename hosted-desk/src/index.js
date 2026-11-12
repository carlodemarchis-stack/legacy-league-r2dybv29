// The editorial desk, hosted. A Claude chat reaches it over the web (MCP, streamable HTTP) and works on the
// stories in the content store, the R2 bucket bound as CONTENT. No file on anyone's computer is involved.
//
// In the bucket:
//   desk/stories.json            every story, drafts included: the desk's own records (the source of truth)
//   desk/config.json             {"now": "<the demo's current time>"}
//   stories/index.json           what the site lists: the published stories, without article text
//   stories/<id>.<hash>.json     one article text each
//   site/…                       profiles and wording (read here only to resolve city and player names)
//   photos/…                     pictures (a new story is given one from photos/course/)
//
// The address carries a secret (the DESK_KEY secret of this Worker): /<key>/mcp. Anything else is refused.

import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const KINDS = { video: "l", gallery: "m", article: "m", quote: "m", result: "r" };
const TOPICS = ["league", "city", "mission"];
const SIZES = ["s", "m", "l", "xl", "p", "r"];
const SITE_ROOT = "https://legacy-league-7awe9upn.legacy-league-demo.workers.dev";
const SITE = SITE_ROOT + "/#3";
const RECORDS = "desk/stories.json";

const sha1 = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");
/* The name a story has in its address: its English headline in plain lower-case words. It is set once and kept,
   so a link that has been shared keeps working when the headline is edited. */
const slugify = (title) => {
  const words = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’‘]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-");
  let out = "";
  for (const w of words) { if ((out + "-" + w).length > 64 && out) break; out = out ? out + "-" + w : w; }
  return out || "story";
};
function nameStories(stories) {
  const taken = new Set(stories.map((s) => s.slug).filter(Boolean));
  for (const s of stories) {
    if (s.slug) continue;
    let slug = slugify(s.title || s.id), n = 1;
    while (taken.has(slug)) slug = `${slugify(s.title || s.id)}-${++n}`;
    s.slug = slug; taken.add(slug);
  }
}
const paras = (text) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const nowIso = () => new Date().toISOString().slice(0, 19);
const isLive = (s) => (s.status || "published") === "published";
const fail = (message) => { throw new Error(message); };

/* ------------------------------------------------------------------ the store */

async function readJson(env, key) {
  const obj = await env.CONTENT.get(key);
  return obj ? { data: await obj.json(), etag: obj.etag } : { data: null, etag: null };
}

/* Read every record, change them, write them back. If someone else wrote in between, start again
   from what they wrote, so two editors never silently overwrite each other. */
async function change(env, fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, etag } = await readJson(env, RECORDS);
    const stories = data || [];
    const out = await fn(stories);
    nameStories(stories);                                     // a story without a name for its address gets one here
    const saved = await env.CONTENT.put(RECORDS, JSON.stringify(stories), {
      httpMetadata: { contentType: "application/json" },
      onlyIf: etag ? { etagMatches: etag } : undefined,
    });
    if (saved) return { out, stories };
  }
  fail("The stories were being changed by someone else at the same moment. Try again.");
}

/* What the site reads: the published stories, newest first, article texts in files of their own. */
async function publishIndex(env, stories) {
  const now = nowIso().slice(0, 16);
  const live = stories.filter((s) => isLive(s) || (s.status === "scheduled" && (s.scheduled_at || "9999") <= now));
  live.sort((a, b) => (a.id < b.id ? -1 : 1));
  live.sort((a, b) => {
    const ka = [a.at || "", a.created_at || ""], kb = [b.at || "", b.created_at || ""];
    return ka[0] !== kb[0] ? (ka[0] < kb[0] ? 1 : -1) : ka[1] !== kb[1] ? (ka[1] < kb[1] ? 1 : -1) : 0;
  });
  const tiles = await Promise.all(live.map(async (full) => {            // all at once: one slow file does not hold up the rest
    const s = { cities: [], players: [], photos: [], ...full };
    const body = {};
    if (s.body) { body.body = s.body; delete s.body; }
    if (Object.keys(body).length) {
      const raw = JSON.stringify(body);
      const key = `stories/${s.id}.${(await sha1(raw)).slice(0, 8)}.json`;
      if (!(await env.CONTENT.head(key))) await env.CONTENT.put(key, raw, { httpMetadata: { contentType: "application/json" } });
      s.body_ref = "content/" + key;
    }
    return s;
  }));
  const rev = (await sha1(JSON.stringify(tiles))).slice(0, 12);
  await env.CONTENT.put("stories/index.json", JSON.stringify({ rev, stories: tiles }), { httpMetadata: { contentType: "application/json" } });
  return { published: tiles.length, rev };
}

/* Cities and players, to turn the names an editor uses into the ids the site uses. */
async function reference(env) {
  const ix = (await readJson(env, "site/index.json")).data || fail("The store has no profiles yet (site/index.json).");
  const site = (await readJson(env, `site/site.${ix.rev}.json`)).data.site;
  const city = Object.fromEntries(site.cities.map((c) => [c.id, c]));
  const player = Object.fromEntries(site.players.map((p) => [p.id, p]));
  const cityId = (x) => {
    x = x.trim().toLowerCase();
    const c = site.cities.find((c) => [c.id, c.short.toLowerCase(), c.name.toLowerCase()].includes(x));
    return c ? c.id : fail(`Unknown city '${x}'. Cities: ` + site.cities.map((c) => `${c.name} (${c.id})`).join(", "));
  };
  const playerId = (x) => {
    x = x.trim().toLowerCase();
    if (player[x]) return x;
    let hits = site.players.filter((p) => p.name.toLowerCase() === x);
    if (!hits.length) hits = site.players.filter((p) => p.name.toLowerCase().includes(x));
    if (hits.length === 1) return hits[0].id;
    if (!hits.length) fail(`No player matches '${x}'.`);
    fail(`'${x}' is ambiguous: ` + hits.slice(0, 6).map((p) => `${p.name} (${p.id}, ${city[p.city].short})`).join(", "));
  };
  return { city, player, cityId, playerId };
}

async function pickPhoto(env, seed) {
  const pool = (await env.CONTENT.list({ prefix: "photos/course/" })).objects.map((o) => o.key).sort();
  if (!pool.length) return null;
  const n = parseInt((await sha1(seed)).slice(0, 8), 16) % pool.length;
  return "content/" + pool[n];
}

const find = (stories, id) => stories.find((s) => s.id === id) || fail(`No story '${id}'. Use list_stories.`);
const summary = (s) => {
  const keep = ["id", "status", "kind", "topic", "at", "author", "title", "dek", "cities", "players", "size", "photo", "dur", "count", "scheduled_at"];
  const out = { status: "published" };
  for (const k of keep) if (s[k] != null && s[k] !== "" && !(Array.isArray(s[k]) && !s[k].length)) out[k] = s[k];
  if (s.slug && isLive(s)) out.url = `${SITE_ROOT}/stories/${s.slug}`;   // the story's own public address
  return out;
};
const reply = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 1) }] });
const tool = (fn) => async (args) => {
  try { return reply(await fn(args)); } catch (e) { return { isError: true, content: [{ type: "text", text: String(e.message || e) }] }; }
};

/* ------------------------------------------------------------------ the tools */

function createServer(env, door) {
  const server = new McpServer({ name: "legacy-desk", version: "1.0.0" }, {
    instructions:
      "Editorial desk for Legacy League Golf, working on the site's content store. Draft first, publish second. " +
      "Publishing is public at once: the site and the app show the story on their next load. So ask the editor " +
      "before publish_story, and before changing, unpublishing or deleting a story that is already published. " +
      "Every published story has its own public address (url in its summary): give it to the editor after publishing. " +
      "Read a story with get_story before changing it. The site and the apps are in English only.",
  });

  server.registerTool("list_stories", {
    description: "Stories, newest first. status: draft | scheduled | published | all.",
    inputSchema: z.object({ status: z.string().default("all"), limit: z.number().int().default(30) }),
  }, tool(async ({ status, limit }) => {
    const stories = (await readJson(env, RECORDS)).data || [];
    return stories.filter((s) => status === "all" || (s.status || "published") === status)
      .sort((a, b) => ((a.at || "") < (b.at || "") ? 1 : -1)).slice(0, limit).map(summary);
  }));

  server.registerTool("get_story", {
    description: "One story in full: every field, the article text, and its photo (with photo_credit when the editor gave one).",
    inputSchema: z.object({ id: z.string() }),
  }, tool(async ({ id }) => find((await readJson(env, RECORDS)).data || [], id)));

  server.registerTool("draft_story", {
    description:
      "Create a DRAFT story. body = the article text, paragraphs separated by blank lines (2–4 short paragraphs; the " +
      "collage shows title + dek, the reader shows the body). kind: video | gallery | article | quote. Cities and " +
      "players may be names or ids. video needs dur (\"2:14\"); gallery needs count. Without photo_url a golf photo " +
      "from the library is picked. at = ISO time in the demo's event timeline (default: the demo's current time, " +
      "shows as \"just now\"). A draft is not public until publish_story.",
    inputSchema: z.object({
      kind: z.string(), title: z.string(), dek: z.string(),
      cities: z.array(z.string()).optional(), players: z.array(z.string()).optional(),
      topic: z.string().default("league"), author: z.string().optional(), dur: z.string().optional(),
      count: z.number().int().optional(), photo_url: z.string().optional(), size: z.string().optional(),
      at: z.string().optional(), body: z.string().optional(),
    }),
  }, tool(async (a) => {
    const kind = a.kind.trim().toLowerCase();
    if (!KINDS[kind] || kind === "result") fail("kind must be video, gallery, article or quote");
    if (!TOPICS.includes(a.topic)) fail(`topic must be one of ${TOPICS.join(", ")}`);
    if (a.size && !SIZES.includes(a.size)) fail(`size must be one of ${SIZES.join(", ")}`);
    if (kind === "video" && !a.dur) fail("a video needs dur, e.g. '2:14'");
    if (kind === "gallery" && !a.count) fail("a gallery needs count");
    const ref = await reference(env);
    const cids = (a.cities || []).map(ref.cityId), pids = (a.players || []).map(ref.playerId);
    for (const pid of pids) if (!cids.includes(ref.player[pid].city)) cids.push(ref.player[pid].city);
    const now = ((await readJson(env, "desk/config.json")).data || {}).now || nowIso().slice(0, 16);
    const { out } = await change(env, async (stories) => {
      const n = Math.max(0, ...stories.filter((s) => /^d\d+$/.test(s.id)).map((s) => parseInt(s.id.slice(1), 10))) + 1;
      const id = "d" + String(n).padStart(3, "0");
      const story = {
        id, status: "draft", kind, topic: a.topic, at: a.at || now,
        author: a.author || (cids.length === 1 ? `${ref.city[cids[0]].name} desk` : a.topic === "mission" ? "Legacy League · Mission" : "Legacy League"),
        title: a.title.trim(), dek: a.dek.trim(), cities: cids, players: pids, likes: 0, comments: 0,
        size: a.size || KINDS[kind], photo: a.photo_url || (await pickPhoto(env, id + a.title)),
        created_by: "desk", created_at: nowIso(),
      };
      if (a.body) story.body = paras(a.body);
      if (a.dur) story.dur = a.dur;
      if (a.count) story.count = a.count;
      if (kind === "gallery") story.photos = [story.photo, await pickPhoto(env, id + "b"), await pickPhoto(env, id + "c")];
      stories.push(story);
      return story;
    });
    return { ok: true, story: summary(out), next: "Show the editor the draft. publish_story(id) makes it public." };
  }));

  server.registerTool("update_story", {
    description:
      "Change fields of a story (draft or published). body replaces the article text (paragraphs separated by blank " +
      "lines). A change to a published story is public at once.",
    inputSchema: z.object({
      id: z.string(), title: z.string().optional(), dek: z.string().optional(),
      cities: z.array(z.string()).optional(), players: z.array(z.string()).optional(), size: z.string().optional(),
      photo_url: z.string().optional(), author: z.string().optional(), at: z.string().optional(), body: z.string().optional(),
    }),
  }, tool(async (a) => {
    if (a.size && !SIZES.includes(a.size)) fail(`size must be one of ${SIZES.join(", ")}`);
    const ref = a.cities || a.players ? await reference(env) : null;
    const { out, stories } = await change(env, async (list) => {
      const s = find(list, a.id);
      if (a.title) s.title = a.title.trim();
      if (a.dek) s.dek = a.dek.trim();
      if (a.cities) s.cities = a.cities.map(ref.cityId);
      if (a.players) s.players = a.players.map(ref.playerId);
      if (a.size) s.size = a.size;
      if (a.photo_url) s.photo = a.photo_url;
      if (a.author) s.author = a.author;
      if (a.at) s.at = a.at;
      if (a.body) s.body = paras(a.body);
      s.updated_by = "desk"; s.updated_at = nowIso();
      return s;
    });
    const res = { ok: true, story: summary(out) };
    if (isLive(out)) res.site = { ...(await publishIndex(env, stories)), live: SITE };
    return res;
  }));

  server.registerTool("publish_story", {
    description:
      "Publish a draft, or schedule it (schedule_at = ISO time). Publishing is PUBLIC at once: the site and the app " +
      "show the story on their next load. Ask the editor first. A scheduled story goes out with the first publish " +
      "after its time has come.",
    inputSchema: z.object({ id: z.string(), schedule_at: z.string().optional() }),
  }, tool(async ({ id, schedule_at }) => {
    const { out, stories } = await change(env, async (list) => {
      const s = find(list, id);
      s.status = schedule_at ? "scheduled" : "published";
      if (schedule_at) s.scheduled_at = schedule_at; else delete s.scheduled_at;
      s.published_by = "desk"; s.published_at = nowIso();
      return s;
    });
    const res = { ok: true, story: summary(out) };
    if (isLive(out)) res.site = { ...(await publishIndex(env, stories)), live: SITE };
    else res.next = "Scheduled. It goes out with the first publish after its time has come.";
    return res;
  }));

  server.registerTool("photo_upload_link", {
    description:
      "The editor's own photo for a story. A picture pasted into the chat cannot reach the desk, so this returns a " +
      "private web page for that story: give the editor the link, they open it, choose the photo and press Upload. " +
      "The desk then stores the photo and sets it as the story's picture (public at once if the story is published). " +
      "Afterwards read the story again with get_story to confirm the new photo. The link is for editors only.",
    inputSchema: z.object({ id: z.string() }),
  }, tool(async ({ id }) => {
    const s = find((await readJson(env, RECORDS)).data || [], id);
    return { ok: true, link: `${door}/photo/${s.id}`, story: s.title,
             next: "Give the editor this link. When they say the photo is uploaded, call get_story to confirm it." };
  }));

  server.registerTool("unpublish_story", {
    description: "Take a story back to draft. If it was published it leaves the public site at once.",
    inputSchema: z.object({ id: z.string() }),
  }, tool(async ({ id }) => {
    let wasLive = false;
    const { out, stories } = await change(env, async (list) => { const s = find(list, id); wasLive = isLive(s); s.status = "draft"; return s; });
    const res = { ok: true, story: summary(out) };
    if (wasLive) res.site = { ...(await publishIndex(env, stories)), live: SITE };
    return res;
  }));

  server.registerTool("delete_story", {
    description: "Delete a story permanently, both languages. If it was published it leaves the public site at once.",
    inputSchema: z.object({ id: z.string() }),
  }, tool(async ({ id }) => {
    let wasLive = false;
    const { stories } = await change(env, async (list) => { const s = find(list, id); wasLive = isLive(s); list.splice(list.indexOf(s), 1); });
    const res = { ok: true, deleted: id };
    if (wasLive) res.site = { ...(await publishIndex(env, stories)), live: SITE };
    return res;
  }));

  return server;
}

/* ------------------------------------------------------------------ the door */

/* ------------------------------------------------------------------ photos */

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO = 8 * 1024 * 1024;

/* The page an editor opens to give a story its photo. The browser shrinks the picture to web size before
   sending it, so nothing on the server has to process images. */
function photoPage(story) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Photo for ${esc(story.id)}</title>
<style>
body{margin:0;font:16px/1.5 -apple-system,system-ui,sans-serif;background:#0b0f11;color:#e9eef0;display:grid;place-items:start center;padding:28px 18px}
main{width:100%;max-width:520px}h1{font-size:20px;margin:0 0 4px}p{color:#9aa7ab;margin:0 0 18px}
label{display:block;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#9aa7ab;margin:16px 0 6px}
input[type=text],input[type=file]{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #2a3438;background:#12181b;color:inherit;font:inherit}
button{margin-top:20px;width:100%;padding:14px;border-radius:999px;border:0;background:#d9ad4e;color:#1a1206;font:inherit;font-weight:700;cursor:pointer}
button:disabled{opacity:.5;cursor:default}img{display:block;width:100%;border-radius:12px;margin-top:14px;border:1px solid #2a3438}
#msg{margin-top:16px;padding:12px 14px;border-radius:10px;display:none}#msg.ok{display:block;background:#12301f;color:#9be0b6}#msg.bad{display:block;background:#3a1715;color:#ffc9c5}
</style></head><body><main>
<h1>Photo for this story</h1><p><b style="color:#e9eef0">${esc(story.title)}</b><br>${esc(story.id)} · ${esc(story.status || "published")}</p>
<label for="f">Choose the photo</label><input id="f" type="file" accept="image/*">
<label for="c">Photo credit (who took it)</label><input id="c" type="text" placeholder="Optional" maxlength="120">
<img id="pv" alt="" hidden>
<button id="go" disabled>Upload</button><div id="msg" role="status"></div>
</main><script>
const f = document.getElementById("f"), go = document.getElementById("go"), msg = document.getElementById("msg"), pv = document.getElementById("pv");
let blob = null;
const say = (kind, text) => { msg.className = kind; msg.textContent = text; };
f.onchange = async () => {
  blob = null; go.disabled = true; pv.hidden = true; msg.className = "";
  const file = f.files[0]; if (!file) return;
  try {                                                   // shrink to at most 1600 px on the long side, as a JPEG
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.82));
  } catch (e) {                                           // a format this browser cannot open: send it as it is, if the desk takes it
    if (${JSON.stringify(Object.keys(PHOTO_TYPES))}.includes(file.type) && file.size <= ${MAX_PHOTO}) blob = file;
  }
  if (!blob) return say("bad", "This browser cannot read that picture. Save it as a JPEG and try again.");
  pv.src = URL.createObjectURL(blob); pv.hidden = false; go.disabled = false;
};
go.onclick = async () => {
  go.disabled = true; say("ok", "Uploading…");
  try {
    const r = await fetch(location.pathname, { method: "POST", headers: { "content-type": blob.type, "x-photo-credit": encodeURIComponent(document.getElementById("c").value.trim()) }, body: blob });
    const out = await r.json();
    if (!r.ok) throw new Error(out.error || "The upload failed.");
    say("ok", out.public ? "Done. The photo is on the story, and the story is public, so it shows on the site now. You can close this page." : "Done. The photo is on the draft. You can close this page and tell Claude it is uploaded.");
  } catch (e) { say("bad", e.message); go.disabled = false; }
};
</script></body></html>`;
}

async function photoRoute(request, env, id) {
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const stories = (await readJson(env, RECORDS)).data || [];
  const story = /^[a-z]\d+$/.test(id) ? stories.find((s) => s.id === id) : null;
  if (!story) return new Response("No such story.", { status: 404 });
  if (request.method === "GET")
    return new Response(photoPage(story), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const ext = PHOTO_TYPES[(request.headers.get("content-type") || "").split(";")[0].trim()];
  if (!ext) return json({ error: "The photo must be a JPEG, PNG or WebP." }, 415);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO) return json({ error: "The photo is empty or larger than 8 MB." }, 413);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-1", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
  const key = `photos/stories/${id}-${hash}.${ext}`;         // a new name per photo, so no browser shows a stale one
  await env.CONTENT.put(key, bytes, { httpMetadata: { contentType: request.headers.get("content-type").split(";")[0].trim() } });
  let credit = "";
  try { credit = decodeURIComponent(request.headers.get("x-photo-credit") || "").slice(0, 120).trim(); } catch (e) {}
  const { out, stories: all } = await change(env, async (list) => {
    const s = find(list, id);
    s.photo = "content/" + key;
    if (credit) s.photo_credit = credit; else delete s.photo_credit;
    s.updated_by = "desk"; s.updated_at = nowIso();
    return s;
  });
  if (isLive(out)) await publishIndex(env, all);
  return json({ ok: true, photo: out.photo, public: isLive(out), kb: Math.round(bytes.byteLength / 1024) });
}

/* Claude's connector screen signs in before it connects, and stops if the server has no sign-in service.
   This is the smallest one that satisfies it: it registers any client and hands out a token without asking
   anything. It protects nothing and is not meant to: the lock on this desk is the secret in the address,
   checked below on every request. Real editor sign-in replaces this (step 5). */
function signIn(request, url) {
  const origin = url.origin, path = url.pathname;
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: {
    "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" } });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" } });
  if (path.startsWith("/.well-known/oauth-protected-resource"))
    return json({ resource: origin + path.slice("/.well-known/oauth-protected-resource".length), authorization_servers: [origin], bearer_methods_supported: ["header"] });
  if (path.startsWith("/.well-known/oauth-authorization-server") || path.startsWith("/.well-known/openid-configuration"))
    return json({ issuer: origin, authorization_endpoint: origin + "/authorize", token_endpoint: origin + "/token", registration_endpoint: origin + "/register",
      response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"] });
  if (path === "/register" && request.method === "POST")
    return request.json().catch(() => ({})).then((b) => json({ ...b, client_id: crypto.randomUUID(), client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }, 201));
  if (path === "/authorize") {
    let back;
    try { back = new URL(url.searchParams.get("redirect_uri")); } catch (e) { return new Response("Bad redirect_uri", { status: 400 }); }
    // only back to Claude, or to a program on the user's own computer: this must not become a way to bounce people elsewhere
    const ok = (back.protocol === "https:" && /(^|\.)(claude\.ai|claude\.com|anthropic\.com)$/.test(back.hostname)) ||
               (back.protocol === "http:" && ["localhost", "127.0.0.1"].includes(back.hostname));
    if (!ok) return new Response("This redirect address is not allowed.", { status: 400 });
    back.searchParams.set("code", crypto.randomUUID());
    if (url.searchParams.get("state")) back.searchParams.set("state", url.searchParams.get("state"));
    return Response.redirect(back.toString(), 302);
  }
  if (path === "/token" && request.method === "POST")
    return json({ access_token: crypto.randomUUID(), token_type: "Bearer", expires_in: 31536000, refresh_token: crypto.randomUUID() });
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handshake = signIn(request, url);
    if (handshake) return handshake;
    const [, key, rest] = url.pathname.match(/^\/([^/]+)(\/mcp.*|\/photo\/[^/]+)$/) || [];
    if (!env.DESK_KEY || !key || key.length !== env.DESK_KEY.length || !rest) return new Response("Not found", { status: 404 });
    let diff = 0;                                              // compare the whole key every time, whatever was sent
    for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ env.DESK_KEY.charCodeAt(i);
    if (diff) return new Response("Not found", { status: 404 });
    if (rest.startsWith("/photo/")) return photoRoute(request, env, rest.slice("/photo/".length));
    const door = `${url.origin}/${key}`;
    url.pathname = rest;
    return createMcpHandler(() => createServer(env, door))(new Request(url, request), env, ctx);
  },
};
