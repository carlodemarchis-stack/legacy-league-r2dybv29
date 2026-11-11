// The editorial desk, hosted. A Claude chat reaches it over the web (MCP, streamable HTTP) and works on the
// stories in the content store, the R2 bucket bound as CONTENT. No file on anyone's computer is involved.
//
// In the bucket:
//   desk/stories.json            every story, drafts included: the desk's own records (the source of truth)
//   desk/config.json             {"now": "<the demo's current time>"}
//   stories/index.json           what the site lists: the published stories, without article text
//   stories/<id>.<hash>.json     one article text each, English and Spanish
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
const SITE = "https://legacy-league-7awe9upn.legacy-league-demo.workers.dev/#3";
const RECORDS = "desk/stories.json";

const sha1 = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");
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
    for (const k of ["body", "body_es"]) if (s[k]) { body[k] = s[k]; delete s[k]; }
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
  out.spanish = Boolean(s.title_es || s.dek_es || s.body_es);
  return out;
};
const reply = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 1) }] });
const tool = (fn) => async (args) => {
  try { return reply(await fn(args)); } catch (e) { return { isError: true, content: [{ type: "text", text: String(e.message || e) }] }; }
};

/* ------------------------------------------------------------------ the tools */

function createServer(env) {
  const server = new McpServer({ name: "legacy-desk", version: "1.0.0" }, {
    instructions:
      "Editorial desk for Legacy League Golf, working on the site's content store. Draft first, publish second. " +
      "Publishing is public at once: the site and the app show the story on their next load. So ask the editor " +
      "before publish_story, and before changing, unpublishing or deleting a story that is already published. " +
      "Read a story with get_story before changing it. The site is bilingual: give the Spanish version " +
      "(Mexican Spanish) with every story, and change both languages together.",
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
    description: "One story in full: every field, the article text, and the Spanish version if there is one.",
    inputSchema: z.object({ id: z.string() }),
  }, tool(async ({ id }) => find((await readJson(env, RECORDS)).data || [], id)));

  server.registerTool("draft_story", {
    description:
      "Create a DRAFT story. body = the article text, paragraphs separated by blank lines (2–4 short paragraphs; the " +
      "collage shows title + dek, the reader shows the body). kind: video | gallery | article | quote. Cities and " +
      "players may be names or ids. video needs dur (\"2:14\"); gallery needs count. Without photo_url a golf photo " +
      "from the library is picked. at = ISO time in the demo's event timeline (default: the demo's current time, " +
      "shows as \"just now\"). title_es, dek_es, body_es = the Spanish version (Mexican Spanish); without them " +
      "Spanish readers see the English text. A draft is not public until publish_story.",
    inputSchema: z.object({
      kind: z.string(), title: z.string(), dek: z.string(),
      cities: z.array(z.string()).optional(), players: z.array(z.string()).optional(),
      topic: z.string().default("league"), author: z.string().optional(), dur: z.string().optional(),
      count: z.number().int().optional(), photo_url: z.string().optional(), size: z.string().optional(),
      at: z.string().optional(), body: z.string().optional(),
      title_es: z.string().optional(), dek_es: z.string().optional(), body_es: z.string().optional(),
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
      if (a.title_es) story.title_es = a.title_es.trim();
      if (a.dek_es) story.dek_es = a.dek_es.trim();
      if (a.body_es) story.body_es = paras(a.body_es);
      stories.push(story);
      return story;
    });
    return { ok: true, story: summary(out), next: "Show the editor the draft. publish_story(id) makes it public." };
  }));

  server.registerTool("update_story", {
    description:
      "Change fields of a story (draft or published). body replaces the article text (paragraphs separated by blank " +
      "lines). title_es, dek_es, body_es change the Spanish version. English and Spanish are separate texts: when you " +
      "change one, pass the matching change for the other. A change to a published story is public at once.",
    inputSchema: z.object({
      id: z.string(), title: z.string().optional(), dek: z.string().optional(),
      cities: z.array(z.string()).optional(), players: z.array(z.string()).optional(), size: z.string().optional(),
      photo_url: z.string().optional(), author: z.string().optional(), at: z.string().optional(), body: z.string().optional(),
      title_es: z.string().optional(), dek_es: z.string().optional(), body_es: z.string().optional(),
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
      if (a.title_es) s.title_es = a.title_es.trim();
      if (a.dek_es) s.dek_es = a.dek_es.trim();
      if (a.body_es) s.body_es = paras(a.body_es);
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
    const [, key, rest] = url.pathname.match(/^\/([^/]+)(\/mcp.*)$/) || [];
    if (!env.DESK_KEY || !key || key.length !== env.DESK_KEY.length || !rest) return new Response("Not found", { status: 404 });
    let diff = 0;                                              // compare the whole key every time, whatever was sent
    for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ env.DESK_KEY.charCodeAt(i);
    if (diff) return new Response("Not found", { status: 404 });
    url.pathname = rest;
    return createMcpHandler(() => createServer(env))(new Request(url, request), env, ctx);
  },
};
