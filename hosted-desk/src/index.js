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
import { editorPage } from "./editor.js";
import TIPTAP from "./tiptap.bundle.txt";
import { scoring } from "./scores.js";
import { draftWithAI, aiError } from "./ai.js";                   // the article field (Tiptap), see editor-src/

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
async function nameStories(env, stories) {
  const unnamed = stories.filter((s) => !s.slug);
  if (!unnamed.length) return;
  // a headline can stand for names ({p0} = the first tagged player, {c0} = the first city), as the site shows it
  const ref = unnamed.some((s) => /\{(p0|c0|author)\}/.test(s.title || "")) ? await reference(env) : null;
  const shown = (s) => (s.title || s.id)
    .replace(/\{p0\}/g, ref && (s.players || [])[0] && ref.player[s.players[0]] ? ref.player[s.players[0]].name : "")
    .replace(/\{c0\}/g, ref && (s.cities || [])[0] && ref.city[s.cities[0]] ? ref.city[s.cities[0]].name : "the league")
    .replace(/\{author\}/g, "Legacy League Golf");
  const taken = new Set(stories.map((s) => s.slug).filter(Boolean));
  for (const s of unnamed) {
    const base = slugify(shown(s));
    let slug = base, n = 1;
    while (taken.has(slug)) slug = `${base}-${++n}`;
    s.slug = slug; taken.add(slug);
  }
}
/* An article is plain text with a little Markdown: "## " subheadings, "- " and "1. " lists, **bold**, *italic*,
   [words](https://…). This takes it back to the words alone. */
const plain = (t) => String(t).replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, "").replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1").replace(/\*+/g, "").replace(/^(##\s+|[-*]\s+|\d+[.)]\s+)/gm, "");
/* A photo in the article is a block of its own: ![alt text](content/photos/…#1280x853 "Caption · Photo: credit").
   Only the league's own photos; the #WxH is the photo's size, so the reader can make room before it loads. */
const IMG = /^!\[([^\]]*)\]\((content\/photos\/[^\s)#]+)(?:#(\d+)x(\d+))?(?:\s+"([^"]*)")?\)$/;
const bodyPhotos = (body) => (body || []).map((b) => b.trim().match(IMG)).filter(Boolean).map((m) => ({ src: m[2], w: +m[3] || 0, h: +m[4] || 0, alt: m[1], caption: m[5] || "" }));
/* A story whose main photo was only picked from the library takes the first photo of its article instead. */
function adoptFirstPhoto(s) {
  const first = bodyPhotos(s.body)[0];
  if (s.photo_auto && first) {
    s.photo = first.src; delete s.photo_auto; delete s.photo_credit;
    if (first.w && first.h) { s.photo_w = first.w; s.photo_h = first.h; } else { delete s.photo_w; delete s.photo_h; }
  }
  // photos uploaded for the article and now placed in it leave the waiting list
  if (s.photo_inbox) { const used = new Set(bodyPhotos(s.body).map((p) => p.src)); s.photo_inbox = s.photo_inbox.filter((p) => !used.has(p.src)); if (!s.photo_inbox.length) delete s.photo_inbox; }
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
   from what they wrote, so two editors never silently overwrite each other. by = who is making the change. */
async function change(env, fn, by = "Claude") {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, etag } = await readJson(env, RECORDS);
    const stories = data || [];
    const before = new Map(stories.map((s) => [s.id, JSON.stringify(s)]));
    const out = await fn(stories);
    await nameStories(env, stories);                          // a story without a name for its address gets one here
    const saved = await env.CONTENT.put(RECORDS, JSON.stringify(stories), {
      httpMetadata: { contentType: "application/json" },
      onlyIf: etag ? { etagMatches: etag } : undefined,
    });
    if (saved) { await keepHistory(env, stories, before, by); return { out, stories }; }
  }
  fail("The stories were being changed by someone else at the same moment. Try again.");
}

/* ------------------------------------------------------------------ history */

/* Every version a change replaces is kept, one file each: desk/history/<story id>/<time>.json, with who made it,
   who replaced it and how (changed or deleted) in the file's metadata, so a list needs no file to be read.
   Nothing is ever removed from here: a deleted story can be brought back from its last version. */
const HISTORY = "desk/history/";
const whoName = (by) => (by === "desk" ? "Claude" : by || "");
async function keepHistory(env, stories, before, by) {
  const after = new Map(stories.map((s) => [s.id, JSON.stringify(s)]));
  const at = new Date().toISOString();
  await Promise.all([...before].filter(([id, raw]) => after.get(id) !== raw).map(([id, raw]) => {
    const v = JSON.parse(raw);
    return env.CONTENT.put(`${HISTORY}${id}/${at.replace(/[:.]/g, "-")}.json`, raw, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: {
        saved_at: v.updated_at || v.published_at || v.created_at || "", saved_by: whoName(v.updated_by || v.published_by || v.created_by),
        replaced_at: at.slice(0, 19), replaced_by: whoName(by), change: after.has(id) ? "changed" : "deleted",
        status: v.status || "published", title: String(v.title || "").slice(0, 180),
      },
    });
  }));
}
/* The earlier versions of one story, newest first. */
async function versions(env, id) {
  const out = [];
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix: `${HISTORY}${id}/`, include: ["customMetadata"], cursor });
    for (const o of page.objects) out.push({ version: o.key.slice(HISTORY.length + id.length + 1, -5), ...(o.customMetadata || {}) });
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);
  return out.sort((a, b) => (a.version < b.version ? 1 : -1));
}
/* Stories that were deleted, with the version they had when they went. */
async function deletedStories(env) {
  const live = new Set(((await readJson(env, RECORDS)).data || []).map((s) => s.id));
  const ids = [];
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix: HISTORY, delimiter: "/", cursor });
    ids.push(...page.delimitedPrefixes.map((p) => p.slice(HISTORY.length, -1)));
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);
  const gone = [];
  for (const id of ids.filter((x) => !live.has(x))) {
    const last = (await versions(env, id))[0];
    if (last) gone.push({ id, ...last });
  }
  return gone.sort((a, b) => (a.replaced_at < b.replaced_at ? 1 : -1));
}
/* Make an earlier version the story again. The story keeps its status, address, counts and publishing record;
   everything it says and shows comes back. A deleted story comes back as a draft. */
const KEEP_ON_RESTORE = ["id", "status", "slug", "likes", "comments", "created_at", "created_by", "published_at", "published_by", "scheduled_at", "ai_chats"];
async function restoreVersion(env, id, version, by, check) {
  if (!/^[\w-]+$/.test(version)) fail("No such version.");
  const old = (await readJson(env, `${HISTORY}${id}/${version}.json`)).data || fail(`No version '${version}' of story '${id}'. Use story_history.`);
  const { out, stories } = await change(env, async (list) => {
    let s = list.find((x) => x.id === id);
    if (!s) { s = { ...old, status: "draft" }; list.push(s); }
    else {
      if (check) await check(s);
      const keep = Object.fromEntries(KEEP_ON_RESTORE.filter((k) => k in s).map((k) => [k, s[k]]));
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, old);
      for (const k of KEEP_ON_RESTORE) { if (k in keep) s[k] = keep[k]; else delete s[k]; }
    }
    s.updated_by = by; s.updated_at = nowIso(); s.restored_from = version;
    return s;
  }, by);
  if (isLive(out)) await publishIndex(env, stories);
  return out;
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
  // the shape of every library picture, so the story reader can lay a story out before its picture loads
  const sizes = (await readJson(env, "photos/sizes.json")).data || {};
  const tiles = await Promise.all(live.map(async (full) => {            // all at once: one slow file does not hold up the rest
    const s = { cities: [], players: [], photos: [], ...full };
    const lead = s.photo || s.photos[0];
    if (!(s.photo_w && s.photo_h) && sizes[lead]) [s.photo_w, s.photo_h] = sizes[lead];
    s.body_photos = bodyPhotos(s.body).length;              // the reader keeps a story with photos in its text to one column
    delete s.photo_auto; delete s.photo_inbox; delete s.ai_chats;       // desk bookkeeping, not for the site
    s.words = plain([s.dek || "", ...(s.body || [])].join(" ")).split(/\s+/).filter(Boolean).length;
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
  const events = site.schedule || [];
  const event = Object.fromEntries(events.map((e) => [e.id, e]));
  const eventId = (x) => {
    x = x.trim().toLowerCase();
    const e = events.find((e) => e.id === x || e.name.toLowerCase() === x) || events.filter((e) => e.name.toLowerCase().includes(x)).find((e, i, all) => all.length === 1);
    return e ? e.id : fail(`Unknown event '${x}'. Events: ` + events.map((e) => `${e.name} (${e.id})`).join(", "));
  };
  return { site, city, player, cityId, playerId, event, eventId };
}

async function pickPhoto(env, seed) {
  const pool = (await env.CONTENT.list({ prefix: "photos/course/" })).objects.map((o) => o.key).sort();
  if (!pool.length) return null;
  const n = parseInt((await sha1(seed)).slice(0, 8), 16) % pool.length;
  return "content/" + pool[n];
}

/* A new draft, the same whether Claude (draft_story) or an editor (the editor page) makes it.
   cids and pids are already ids; by says who made it. */
async function makeDraft(env, stories, a, cids, pids, ref, now, by) {
  const n = Math.max(0, ...stories.filter((s) => /^d\d+$/.test(s.id)).map((s) => parseInt(s.id.slice(1), 10))) + 1;
  const id = "d" + String(n).padStart(3, "0");
  const kind = a.kind;
  const story = {
    id, status: "draft", kind, topic: a.topic, at: a.at || now,
    author: a.author || (cids.length === 1 ? `${ref.city[cids[0]].name} desk` : a.topic === "mission" ? "Legacy League · Mission" : "Legacy League"),
    title: a.title.trim(), dek: (a.dek || "").trim(), cities: cids, players: pids, events: a.eventIds || [], likes: 0, comments: 0,
    size: a.size || KINDS[kind], photo: a.photo_url || (await pickPhoto(env, id + a.title)),
    created_by: by, created_at: nowIso(),
  };
  if (!a.photo_url) story.photo_auto = true;                 // a library photo, until the article gives one
  if (a.body) story.body = paras(a.body);
  adoptFirstPhoto(story);
  if (a.dur) story.dur = a.dur;
  if (a.count) story.count = a.count;
  if (kind === "gallery") story.photos = [story.photo, await pickPhoto(env, id + "b"), await pickPhoto(env, id + "c")];
  stories.push(story);
  return story;
}

const find = (stories, id) => stories.find((s) => s.id === id) || fail(`No story '${id}'. Use list_stories.`);
const summary = (s) => {
  const keep = ["id", "status", "kind", "topic", "at", "author", "title", "dek", "cities", "players", "events", "size", "photo", "dur", "count", "scheduled_at"];
  const out = { status: "published" };
  for (const k of keep) if (s[k] != null && s[k] !== "" && !(Array.isArray(s[k]) && !s[k].length)) out[k] = s[k];
  if (s.slug && isLive(s)) out.url = `${SITE_ROOT}/stories/${s.slug}`;   // the story's own public address
  return out;
};
const reply = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 1) }] });
const tool = (fn) => async (args) => {
  try { return reply(await fn(args)); } catch (e) { return { isError: true, content: [{ type: "text", text: String(e.message || e) }] }; }
};

/* The scores: the board and one city's round, from the feed in the store. The course time defaults to the demo's
   current time (desk/config.json), where the site opens. */
async function scores(env) {
  const feed = (await readJson(env, "scores/feed.json")).data || fail("The store has no scoring feed yet (scores/feed.json).");
  const ref = await reference(env);
  const now = ((await readJson(env, "desk/config.json")).data || {}).now || feed.generated_at || "";
  return { ...scoring(feed, ref.site), ref, feed, clock: now.slice(11, 16) || "14:20" };
}

/* What the desk can look up, as plain functions: Claude's connector and the editor's AI drafting use the same ones. */
const LIVE_BOARD_DOC = "The team leaderboard as fans see it at a course time (HH:MM on day 2; leave it out for now). Positions, " +
  "today, thru, total, league points and each city's best individual rounds today. final_at is when the last group " +
  "finishes: ask for that time or later for the final board. Every score is strokes relative to par: negative is under par.";
const CITY_ROUND_DOC = "Who is doing what for one city: each player's holes and score, how many of the team's counted scores " +
  "each supplied, the team's score hole by hole, and notable holes (eagles, holes in one). Use it to name players " +
  "in a story. clock = course time HH:MM on day 2 (leave out for now; round 1 is complete). A hole is firm once every " +
  "player on the team has finished it; only firm holes are on the board. Scores are relative to par.";
const lookups = (env) => ({
  async leagueReference() {
    const { ref, feed, clock } = await scores(env);
    const site = ref.site;
    return {
      cities: site.cities.map((c) => ({ id: c.id, name: c.name, short: c.short, teams: c.teams,
        captain: ref.player[c.captain] ? ref.player[c.captain].name : null, charity: c.charity })),
      events: (site.schedule || []).map((e) => ({ id: e.id, name: e.name, venue: e.venue, start: e.start, end: e.end, status: e.status })),
      rules: site.rules, scores_at: { event: feed.event.name, course_time: clock },
    };
  },
  async findPlayers(query, city) {
    const ref = await reference(env);
    const cid = city ? ref.cityId(city) : null, q = String(query || "").trim().toLowerCase();
    return ref.site.players.filter((p) => (!cid || p.city === cid) &&
      [p.name, p.team, p.role, p.sport, ref.city[p.city] && ref.city[p.city].name].join(" ").toLowerCase().includes(q))
      .slice(0, 25).map((p) => ({ id: p.id, name: p.name, city: ref.city[p.city].name, sport: p.sport, team: p.team, role: p.role, captain: p.captain }));
  },
  async liveBoard(clock) { const sc = await scores(env); return sc.board(clock || sc.clock); },
  async cityRound(city, clock, round = 2) {
    const sc = await scores(env), cid = sc.ref.cityId(city);
    return { city: sc.ref.city[cid].name, ...sc.cityRound(cid, clock || sc.clock, round) };
  },
  async listStories(status = "all", limit = 30) {
    const stories = (await readJson(env, RECORDS)).data || [];
    return stories.filter((s) => status === "all" || (s.status || "published") === status)
      .sort((a, b) => ((a.at || "") < (b.at || "") ? 1 : -1)).slice(0, limit).map(summary);
  },
  async getStory(id) { return find((await readJson(env, RECORDS)).data || [], id); },
});

/* ------------------------------------------------------------------ the tools */

function createServer(env, door) {
  const server = new McpServer({ name: "legacy-desk", version: "1.0.0" }, {
    instructions:
      "Editorial desk for Legacy League Golf, working on the site's content store. Draft first, publish second. " +
      "Publishing is public at once: the site and the app show the story on their next load. So ask the editor " +
      "before publish_story, and before changing, unpublishing or deleting a story that is already published. " +
      "Every published story has its own public address (url in its summary): give it to the editor after publishing. " +
      "Use league_reference and find_players for names, live_board when a story quotes scores and city_round to " +
      "name the players behind them; never state a score from memory. " +
      "Read a story with get_story before changing it. The site and the apps are in English only.",
  });

  const look = lookups(env);
  server.registerTool("league_reference", {
    description: "The league at a glance: cities (id, name, code, heritage teams, captain, charity), the events of the " +
      "season (id, name, dates, status), the scoring rules, and the course time the scores are at now. Call this first.",
    inputSchema: z.object({}),
  }, tool(() => look.leagueReference()));

  server.registerTool("find_players", {
    description: "Find players by name, former team, role or sport, optionally within one city (name, code or id).",
    inputSchema: z.object({ query: z.string(), city: z.string().optional() }),
  }, tool(({ query, city }) => look.findPlayers(query, city)));

  server.registerTool("live_board", {
    description: LIVE_BOARD_DOC,
    inputSchema: z.object({ clock: z.string().optional() }),
  }, tool(({ clock }) => look.liveBoard(clock)));

  server.registerTool("city_round", {
    description: CITY_ROUND_DOC,
    inputSchema: z.object({ city: z.string(), clock: z.string().optional(), round: z.number().int().default(2) }),
  }, tool(({ city, clock, round }) => look.cityRound(city, clock, round)));

  server.registerTool("list_stories", {
    description: "Stories, newest first. status: draft | scheduled | published | all.",
    inputSchema: z.object({ status: z.string().default("all"), limit: z.number().int().default(30) }),
  }, tool(({ status, limit }) => look.listStories(status, limit)));

  server.registerTool("get_story", {
    description: "One story in full: every field, the article text, and its photo (with photo_credit when the editor gave one).",
    inputSchema: z.object({ id: z.string() }),
  }, tool(({ id }) => look.getStory(id)));

  server.registerTool("draft_story", {
    description:
      "Create a DRAFT story. body = the article text, paragraphs separated by blank lines (2–4 short paragraphs; the " +
      "body may use only: '## ' subheadings, **bold**, *italic*, [words](https://…) links, '- ' or '1. ' lists, and " +
      "photos as their own paragraph in the form photo_inbox gives (photo_upload_link with place=article); the " +
      "collage shows title + dek, the reader shows the body). kind: video | gallery | article | quote. Cities and " +
      "players may be names or ids. events = the league events the story is about, names or ids (e.g. Mayakoba); " +
      "leave out for a story not about an event. video needs dur (\"2:14\"); gallery needs count. Without photo_url a golf photo " +
      "from the library is picked. at = ISO time in the demo's event timeline (default: the demo's current time, " +
      "shows as \"just now\"). A draft is not public until publish_story.",
    inputSchema: z.object({
      kind: z.string(), title: z.string(), dek: z.string(),
      cities: z.array(z.string()).optional(), players: z.array(z.string()).optional(),
      topic: z.string().default("league"), author: z.string().optional(), dur: z.string().optional(),
      count: z.number().int().optional(), photo_url: z.string().optional(), size: z.string().optional(),
      at: z.string().optional(), body: z.string().optional(), events: z.array(z.string()).optional(),
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
    const eventIds = (a.events || []).map(ref.eventId);
    const { out } = await change(env, (stories) => makeDraft(env, stories, { ...a, kind, eventIds }, cids, pids, ref, now, "desk"));
    return { ok: true, story: summary(out), next: "Show the editor the draft. publish_story(id) makes it public." };
  }));

  server.registerTool("update_story", {
    description:
      "Change fields of a story (draft or published). body replaces the article text (paragraphs separated by blank " +
      "lines; the same small Markdown as draft_story). A change to a published story is public at once.",
    inputSchema: z.object({
      id: z.string(), title: z.string().optional(), dek: z.string().optional(),
      cities: z.array(z.string()).optional(), players: z.array(z.string()).optional(), size: z.string().optional(),
      photo_url: z.string().optional(), author: z.string().optional(), at: z.string().optional(), body: z.string().optional(),
      events: z.array(z.string()).optional(),
    }),
  }, tool(async (a) => {
    if (a.size && !SIZES.includes(a.size)) fail(`size must be one of ${SIZES.join(", ")}`);
    const ref = a.cities || a.players || a.events ? await reference(env) : null;
    const { out, stories } = await change(env, async (list) => {
      const s = find(list, a.id);
      if (a.title) s.title = a.title.trim();
      if (a.dek) s.dek = a.dek.trim();
      if (a.cities) s.cities = a.cities.map(ref.cityId);
      if (a.players) s.players = a.players.map(ref.playerId);
      if (a.events) s.events = a.events.map(ref.eventId);
      if (a.size) s.size = a.size;
      if (a.photo_url) { s.photo = a.photo_url; delete s.photo_w; delete s.photo_h; delete s.photo_auto; }   // the new picture's shape is looked up on publish
      if (a.author) s.author = a.author;
      if (a.at) s.at = a.at;
      if (a.body) s.body = paras(a.body);
      adoptFirstPhoto(s);
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
      "place = main (default): the photo becomes the story's main picture, on the tile and at the top of the reader " +
      "(public at once if the story is published). place = article: a photo to go inside the article text; the page " +
      "also asks for its alt text and caption, and the photo waits in the story's photo_inbox (see get_story) until you " +
      "put it in the body with update_story, as its own paragraph exactly as photo_inbox gives it (the markdown field). " +
      "The link is for editors only.",
    inputSchema: z.object({ id: z.string(), place: z.enum(["main", "article"]).default("main") }),
  }, tool(async ({ id, place }) => {
    const s = find((await readJson(env, RECORDS)).data || [], id);
    return { ok: true, link: `${door}/photo/${s.id}${place === "article" ? "?to=article" : ""}`, story: s.title,
             next: place === "article"
               ? "Give the editor this link. When they say it is uploaded, call get_story: the photo is in photo_inbox with its markdown; ask where it goes and put it in the body with update_story."
               : "Give the editor this link. When they say the photo is uploaded, call get_story to confirm it." };
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
    description: "Delete a story. If it was published it leaves the public site at once. Its last version is kept, so " +
      "deleted_stories and restore_story_version can bring it back as a draft. Ask the editor first.",
    inputSchema: z.object({ id: z.string() }),
  }, tool(async ({ id }) => {
    let wasLive = false;
    const { stories } = await change(env, async (list) => { const s = find(list, id); wasLive = isLive(s); list.splice(list.indexOf(s), 1); });
    const res = { ok: true, deleted: id };
    if (wasLive) res.site = { ...(await publishIndex(env, stories)), live: SITE };
    return res;
  }));

  server.registerTool("story_history", {
    description: "The earlier versions of a story, newest first: when each was saved and by whom, who replaced it and " +
      "how, its status and headline. Every change by Claude, the editors' page or the photo page keeps the version it replaced.",
    inputSchema: z.object({ id: z.string() }),
  }, tool(async ({ id }) => ({ id, versions: await versions(env, id),
    next: "To see one in full, get_story_version(id, version). To go back to one, restore_story_version." })));

  server.registerTool("get_story_version", {
    description: "One earlier version of a story in full, as it was saved.",
    inputSchema: z.object({ id: z.string(), version: z.string() }),
  }, tool(async ({ id, version }) => {
    if (!/^[\w-]+$/.test(version)) fail("No such version.");
    return (await readJson(env, `${HISTORY}${id}/${version}.json`)).data || fail(`No version '${version}' of story '${id}'.`);
  }));

  server.registerTool("restore_story_version", {
    description: "Make an earlier version (from story_history) the story again: its text, tags, photo and kind come back; " +
      "its status and address stay. If the story is published the site changes at once, so ask the editor first. " +
      "A deleted story comes back as a draft. The version being replaced is kept too, so a restore can itself be undone.",
    inputSchema: z.object({ id: z.string(), version: z.string() }),
  }, tool(async ({ id, version }) => {
    const out = await restoreVersion(env, id, version, "Claude");
    const res = { ok: true, story: summary(out) };
    if (isLive(out)) res.site = { live: SITE };
    return res;
  }));

  server.registerTool("deleted_stories", {
    description: "Stories that were deleted, newest first, with the version each had when it went. restore_story_version brings one back as a draft.",
    inputSchema: z.object({}),
  }, tool(async () => deletedStories(env)));

  return server;
}

/* ------------------------------------------------------------------ the door */

/* ------------------------------------------------------------------ photos */

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO = 8 * 1024 * 1024;

/* The page an editor opens to give a story its photo. The browser shrinks the picture to web size before
   sending it, so nothing on the server has to process images. */
function photoPage(story, article) {
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
<h1>${article ? "Photo for the article" : "Photo for this story"}</h1><p><b style="color:#e9eef0">${esc(story.title)}</b><br>${esc(story.id)} · ${esc(story.status || "published")}</p>
<label for="f">Choose the photo</label><input id="f" type="file" accept="image/*">
${article ? `<label for="a">Describe the photo (for people who cannot see it)</label><input id="a" type="text" placeholder="Required, e.g. Omar Quintero hits a 5-wood on the 13th" maxlength="200">
<label for="cap">Caption</label><input id="cap" type="text" placeholder="Optional" maxlength="200">` : ""}
<label for="c">Photo credit (who took it)</label><input id="c" type="text" placeholder="Optional" maxlength="120">
<img id="pv" alt="" hidden>
<button id="go" disabled>Upload</button><div id="msg" role="status"></div>
</main><script>
const f = document.getElementById("f"), go = document.getElementById("go"), msg = document.getElementById("msg"), pv = document.getElementById("pv");
let blob = null, size = "";
const say = (kind, text) => { msg.className = kind; msg.textContent = text; };
f.onchange = async () => {
  blob = null; size = ""; go.disabled = true; pv.hidden = true; msg.className = "";
  const file = f.files[0]; if (!file) return;
  try {                                                   // shrink to at most 1600 px on the long side, as a JPEG
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.82));
    size = cv.width + "x" + cv.height;
  } catch (e) {                                           // a format this browser cannot open: send it as it is, if the desk takes it
    if (${JSON.stringify(Object.keys(PHOTO_TYPES))}.includes(file.type) && file.size <= ${MAX_PHOTO}) blob = file;
  }
  if (!blob) return say("bad", "This browser cannot read that picture. Save it as a JPEG and try again.");
  pv.src = URL.createObjectURL(blob); pv.hidden = false; go.disabled = false;
};
const ART = ${article ? "true" : "false"};
go.onclick = async () => {
  if (ART && !document.getElementById("a").value.trim()) return say("bad", "Describe the photo first: it is read aloud to people who cannot see it.");
  go.disabled = true; say("ok", "Uploading…");
  try {
    const r = await fetch(location.pathname, { method: "POST", headers: { "content-type": blob.type, "x-photo-credit": encodeURIComponent(document.getElementById("c").value.trim()), "x-photo-size": size,
      ...(ART ? { "x-to": "article", "x-photo-alt": encodeURIComponent(document.getElementById("a").value.trim()), "x-photo-caption": encodeURIComponent(document.getElementById("cap").value.trim()) } : {}) }, body: blob });
    const out = await r.json();
    if (!r.ok) throw new Error(out.error || "The upload failed.");
    if (ART) return say("ok", "Done. Tell Claude the photo is uploaded and where it goes in the article. You can close this page.");
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
    return new Response(photoPage(story, new URL(request.url).searchParams.get("to") === "article"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const up = await storePhoto(env, request, id);
  if (up.error) return json({ error: up.error }, up.status);
  const credit = header(request, "x-photo-credit", 120);
  if (request.headers.get("x-to") === "article") {          // a photo for the article: it waits until Claude places it
    const alt = header(request, "x-photo-alt", 200), caption = [header(request, "x-photo-caption", 200), credit ? `Photo: ${credit}` : ""].filter(Boolean).join(" · ");
    if (!alt) return json({ error: "Describe the photo first." }, 400);
    await change(env, async (list) => {
      const s = find(list, id);
      (s.photo_inbox = s.photo_inbox || []).push({ src: up.src, w: up.w, h: up.h, alt, caption, markdown: photoMd(up, alt, caption), at: nowIso() });
      return s;
    }, "photo page");
    return json({ ok: true, photo: up.src, inbox: true, kb: up.kb });
  }
  const { out, stories: all } = await change(env, async (list) => {
    const s = find(list, id);
    s.photo = up.src; delete s.photo_auto;
    if (up.w) { s.photo_w = up.w; s.photo_h = up.h; } else { delete s.photo_w; delete s.photo_h; }
    if (credit) s.photo_credit = credit; else delete s.photo_credit;
    s.updated_by = "photo page"; s.updated_at = nowIso();
    return s;
  }, "photo page");
  if (isLive(out)) await publishIndex(env, all);
  return json({ ok: true, photo: out.photo, public: isLive(out), kb: up.kb });
}
const header = (request, name, max) => { try { return decodeURIComponent(request.headers.get(name) || "").slice(0, max).trim(); } catch (e) { return ""; } };
const photoMd = (p, alt, caption) => `![${String(alt).replace(/[\[\]]/g, "")}](${p.src}${p.w ? `#${p.w}x${p.h}` : ""}${caption ? ` "${String(caption).replace(/"/g, "”")}"` : ""})`;
/* Keep an uploaded photo in the store. The browser has already made it web-sized (and says its size). */
async function storePhoto(env, request, prefix) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  const ext = PHOTO_TYPES[type];
  if (!ext) return { error: "The photo must be a JPEG, PNG or WebP.", status: 415 };
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO) return { error: "The photo is empty or larger than 8 MB.", status: 413 };
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-1", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
  const key = `photos/stories/${prefix}-${hash}.${ext}`;    // a new name per photo, so no browser shows a stale one
  await env.CONTENT.put(key, bytes, { httpMetadata: { contentType: type } });
  const wh = (request.headers.get("x-photo-size") || "").match(/^(\d{1,5})x(\d{1,5})$/);
  return { src: "content/" + key, w: wh ? +wh[1] : 0, h: wh ? +wh[2] : 0, kb: Math.round(bytes.byteLength / 1024) };
}

/* ------------------------------------------------------------------ the Content Studio (the stories editor) */

/* A plain editing page for people, next to Claude. It changes the same records through the same steps
   (change, makeDraft, publishIndex), so a story edited here and one edited through Claude behave alike.
   Every save carries the stamp of the version the editor started from: if Claude or another editor changed
   the story in between, the save is refused and the editor reloads, so nobody's work is silently lost. */
const stampOf = async (s) => (await sha1(JSON.stringify(s))).slice(0, 12);
class Conflict extends Error {}
async function editorApi(request, env, path) {
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  // who is working: the sign-in email once the Studio is behind Cloudflare Access, until then the name the editor gave
  const who = (request.headers.get("cf-access-authenticated-user-email") || header(request, "x-editor", 60) || "editor").trim();
  const withStamp = async (s) => ({ ...s, stamp: await stampOf(s), url: s.slug && isLive(s) ? `${SITE_ROOT}/stories/${s.slug}` : null });
  try {
    if (request.method === "GET" && path === "stories") {
      const stories = (await readJson(env, RECORDS)).data || [];
      stories.sort((a, b) => ((a.at || "") < (b.at || "") ? 1 : -1));
      return json({ site: SITE_ROOT, stories: await Promise.all(stories.map(withStamp)) });
    }
    if (request.method === "GET" && path === "history") {
      const id = new URL(request.url).searchParams.get("id") || "";
      if (!/^[a-z]\d+$/.test(id)) fail("No such story.");
      return json({ versions: await versions(env, id) });
    }
    if (request.method === "GET" && path === "version") {
      const q = new URL(request.url).searchParams, id = q.get("id") || "", v = q.get("v") || "";
      if (!/^[a-z]\d+$/.test(id) || !/^[\w-]+$/.test(v)) fail("No such version.");
      return json({ story: (await readJson(env, `${HISTORY}${id}/${v}.json`)).data || fail("No such version.") });
    }
    if (request.method === "GET" && path === "usage") return json(await aiUsage(env));
    if (request.method === "GET" && path === "deleted") return json({ deleted: await deletedStories(env) });
    if (request.method === "GET" && path === "ref") {
      const ref = await reference(env);
      return json({
        cities: Object.values(ref.city).map((c) => ({ id: c.id, name: c.name, short: c.short, color: c.color })),
        players: Object.values(ref.player).map((p) => ({ id: p.id, name: p.name, city: p.city })),
        events: Object.values(ref.event).map((e) => ({ id: e.id, name: e.name, start: e.start, end: e.end, status: e.status })),
      });
    }
    if (request.method !== "POST") return json({ error: "Not found." }, 404);
    if (path === "ai") {                                      // Draft with AI: a proposal for the form, nothing is saved
      try {
        const body = await request.json();
        const out = await draftWithAI(env, lookups(env), body);
        if (out.proposal) {                                     // tags may come back as names: the form needs ids
          const ref = await reference(env);
          const ids = (list, fn) => [...new Set((list || []).map((x) => { try { return fn(String(x)); } catch (e) { return null; } }).filter(Boolean))];
          out.proposal.cities = ids(out.proposal.cities, ref.cityId);
          out.proposal.players = ids(out.proposal.players, ref.playerId);
          out.proposal.events = ids(out.proposal.events, ref.eventId);
        }
        await logAI(env, { user: who, story: /^[a-z]\d+$/.test(body.story_id || "") ? body.story_id : null, chat: String(body.chat || "").slice(0, 40),
          model: out.model, usage: out.usage, cost: out.cost, asked: String((body.messages || []).slice(-1)[0]?.content || "").slice(0, 200),
          proposed: out.proposal ? out.proposal.title : null });
        return json(out);
      }
      catch (e) { const [status, error] = aiError(e); return json({ error }, status); }
    }
    if (path === "upload") {                                  // a photo for the article, placed by the editor page itself
      const up = await storePhoto(env, request, "article");
      return up.error ? json({ error: up.error }, up.status) : json({ ok: true, ...up });
    }
    const b = await request.json();
    const check = async (s) => { if (b.stamp !== await stampOf(s)) throw new Conflict("This story was changed by someone else (Claude or another editor) since you opened it. Reload it to see their version."); };
    let wasLive = false;
    if (path === "save") {
      const f = b.fields || {};
      const ref = await reference(env);
      const kind = String(f.kind || "").trim();
      if (!f.title || !f.title.trim()) fail("A story needs a headline.");
      if (!b.id && (!KINDS[kind] || kind === "result")) fail("Kind must be article, video, gallery or quote.");
      if (f.topic && !TOPICS.includes(f.topic)) fail(`Topic must be one of ${TOPICS.join(", ")}.`);
      if (kind === "video" && !f.dur) fail("A video needs its length, e.g. 2:14.");
      if (kind === "gallery" && !f.count) fail("A gallery needs its number of pictures.");
      const cids = (f.cities || []).filter((id) => ref.city[id]), pids = (f.players || []).filter((id) => ref.player[id]);
      const eventIds = (f.events || []).filter((id) => ref.event[id]);
      const now = ((await readJson(env, "desk/config.json")).data || {}).now || nowIso().slice(0, 16);
      const { out, stories } = await change(env, async (list) => {
        const main = f.photo && /^content\/photos\//.test(f.photo) ? f.photo : undefined;
        if (!b.id) {
          const st = await makeDraft(env, list, { ...f, kind, topic: f.topic || "league", eventIds, photo_url: main }, cids, pids, ref, now, who);
          if (main && f.photo_w && f.photo_h) { st.photo_w = +f.photo_w; st.photo_h = +f.photo_h; }
          linkChat(st, b.ai_chat);
          return st;
        }
        const s = find(list, b.id);
        await check(s);
        if (KINDS[kind] && kind !== "result" && s.kind !== "result") s.kind = kind;
        if (f.topic) s.topic = f.topic;
        s.title = f.title.trim();
        s.dek = (f.dek || "").trim();
        s.cities = cids; s.players = pids; s.events = eventIds;
        if (f.author && f.author.trim()) s.author = f.author.trim();
        if (f.at) s.at = f.at;
        const body = paras(f.body || "");
        if (body.length) s.body = body; else delete s.body;
        if (s.kind === "video") s.dur = f.dur; else delete s.dur;
        if (s.kind === "gallery") s.count = +f.count; else delete s.count;
        if (f.photo && /^content\/photos\//.test(f.photo) && f.photo !== s.photo) {     // "Use as main photo"
          s.photo = f.photo; delete s.photo_auto; delete s.photo_credit;
          if (f.photo_w && f.photo_h) { s.photo_w = +f.photo_w; s.photo_h = +f.photo_h; } else { delete s.photo_w; delete s.photo_h; }
        }
        adoptFirstPhoto(s);
        s.updated_by = who; s.updated_at = nowIso();
        linkChat(s, b.ai_chat);
        return s;
      }, who);
      if (isLive(out)) await publishIndex(env, stories);
      return json({ ok: true, story: await withStamp(out) });
    }
    if (path === "publish" || path === "unpublish") {
      const { out, stories } = await change(env, async (list) => {
        const s = find(list, b.id);
        await check(s);
        wasLive = isLive(s);
        if (path === "publish") { s.status = "published"; delete s.scheduled_at; s.published_by = who; s.published_at = nowIso(); }
        else s.status = "draft";
        return s;
      }, who);
      if (isLive(out) || wasLive) await publishIndex(env, stories);
      return json({ ok: true, story: await withStamp(out) });
    }
    if (path === "restore") {
      const out = await restoreVersion(env, b.id, String(b.version || ""), who, b.deleted ? null : check);
      return json({ ok: true, story: await withStamp(out) });
    }
    if (path === "delete") {
      const { stories } = await change(env, async (list) => {
        const s = find(list, b.id);
        await check(s);
        wasLive = isLive(s);
        list.splice(list.indexOf(s), 1);
      }, who);
      if (wasLive) await publishIndex(env, stories);
      return json({ ok: true, deleted: b.id });
    }
    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json({ error: String(e.message || e) }, e instanceof Conflict ? 409 : 400);
  }
}

/* ------------------------------------------------------------------ AI usage log */

/* Every Draft-with-AI request is one file: ai/log/<YYYY-MM>/<time>.json, who asked, for which story, tokens and cost
   in its metadata so the report reads only the listing. A chat started on a story not saved yet is tied to the story
   when it is first saved (the story keeps the ids of its chats in ai_chats). */
const linkChat = (s, chat) => {
  chat = String(chat || "").slice(0, 40);
  if (chat && /^[\w-]+$/.test(chat) && !(s.ai_chats || []).includes(chat)) s.ai_chats = [...(s.ai_chats || []), chat];
};
async function logAI(env, e) {
  const at = new Date().toISOString();
  await env.CONTENT.put(`ai/log/${at.slice(0, 7)}/${at.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 6)}.json`, JSON.stringify({ at, ...e }), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { at: at.slice(0, 19), user: e.user, story: e.story || "", chat: e.chat || "", cost: String(e.cost || 0),
      tokens_in: String((e.usage?.input || 0) + (e.usage?.cache_read || 0) + (e.usage?.cache_write || 0)), tokens_out: String(e.usage?.output || 0),
      asked: (e.asked || "").slice(0, 120) },
  });
}
async function aiUsage(env) {
  const rows = [];
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix: "ai/log/", include: ["customMetadata"], cursor });
    for (const o of page.objects) rows.push(o.customMetadata || {});
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);
  const stories = (await readJson(env, RECORDS)).data || [];
  const byChat = {};
  for (const s of stories) for (const c of s.ai_chats || []) byChat[c] = s.id;
  const title = Object.fromEntries(stories.map((s) => [s.id, s.title]));
  const add = (map, key, r) => { const m = (map[key] = map[key] || { requests: 0, cost: 0 }); m.requests++; m.cost += +r.cost || 0; };
  const users = {}, articles = {}, months = {};
  let total = 0;
  for (const r of rows) {
    r.story = r.story || byChat[r.chat] || "";
    add(users, r.user || "unknown", r); add(articles, r.story || "(never saved)", r); add(months, (r.at || "").slice(0, 7), r);
    total += +r.cost || 0;
  }
  const round = (m) => Object.entries(m).map(([k, v]) => ({ key: k, requests: v.requests, cost: Math.round(v.cost * 1000) / 1000 })).sort((a, b) => b.cost - a.cost);
  return {
    total: { requests: rows.length, cost: Math.round(total * 1000) / 1000 },
    by_user: round(users), by_month: round(months).sort((a, b) => (a.key < b.key ? 1 : -1)),
    by_article: round(articles).map((a) => ({ ...a, title: title[a.key] || null })),
    recent: rows.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 40).map((r) => ({ ...r, title: title[r.story] || null, cost: +r.cost })),
  };
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
    const [, key, rest] = url.pathname.match(/^\/([^/]+)(\/mcp.*|\/photo\/[^/]+|\/editor(?:\/api\/[a-z]+|\/app\.js)?)$/) || [];
    if (!env.DESK_KEY || !key || key.length !== env.DESK_KEY.length || !rest) return new Response("Not found", { status: 404 });
    let diff = 0;                                              // compare the whole key every time, whatever was sent
    for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ env.DESK_KEY.charCodeAt(i);
    if (diff) return new Response("Not found", { status: 404 });
    if (rest.startsWith("/photo/")) return photoRoute(request, env, rest.slice("/photo/".length));
    if (rest.startsWith("/editor/api/")) return editorApi(request, env, rest.slice("/editor/api/".length));
    if (rest === "/editor/app.js") return new Response(TIPTAP, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" } });
    if (rest === "/editor") return new Response(editorPage(SITE_ROOT), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
    const door = `${url.origin}/${key}`;
    url.pathname = rest;
    return createMcpHandler(() => createServer(env, door))(new Request(url, request), env, ctx);
  },
};
