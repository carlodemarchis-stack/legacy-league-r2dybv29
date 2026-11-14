// The site on Cloudflare: the built page and its files are served as they are (ASSETS);
// the public part of the content store (site/, stories/, photos/ in the R2 bucket bound as CONTENT) is under /content/.
// The bucket itself stays private: this is the only way in, it only reads, and never the desk's own files.
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* The name a city or a player has in an address: plain lower-case words, the same rule as the page's. */
const slug = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’‘]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* Every card of the film has an address of its own on this site:
     /live  /stories  /season  /league  /sign-up
     /cities/<city>  /players/<player>  /events/<event>  /stories/<story>
   The answer is always the page itself, told it may use such addresses (the ll-paths mark), with the card's own
   title, summary and picture in its head, so a link pasted into a message or a post shows that card. */
const SECTIONS = {
  live: ["Live", "Live scoring from the current event: team best ball, hole by hole."],
  stories: ["Stories", "News, video and photos from the league, its cities and its players."],
  season: ["Season", "Six events, league points and the road to the Team Championship."],
  league: ["The league", "Eleven cities, legends of their teams, one cause each."],
  "sign-up": ["Sign up", "Follow your city and its players: news, alerts and invitations."],
};

async function sitePackage(env) {
  const ix = await env.CONTENT.get("site/index.json");
  if (!ix) return null;
  const { rev } = await ix.json();
  const pack = await env.CONTENT.get(`site/site.${rev}.json`);
  return pack ? (await pack.json()).site : null;
}

async function page(request, env, url, meta) {
  const res = await env.ASSETS.fetch(new Request(url.origin + "/", request));
  const abs = (p) => (/^https?:/.test(p || "") ? p : url.origin + "/" + (p || "img/og.jpg"));
  const head = `<base href="/">
<meta name="ll-paths" content="1">
${meta ? `<title>${esc(meta.title)} · Legacy League Golf</title>
<meta property="og:type" content="${meta.type || "website"}">
<meta property="og:site_name" content="Legacy League Golf">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.text)}">
<meta property="og:url" content="${url.origin}${esc(url.pathname)}">
<meta property="og:image" content="${esc(abs(meta.image))}">
<meta name="description" content="${esc(meta.text)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.text)}">
<meta name="twitter:image" content="${esc(abs(meta.image))}">` : ""}`;
  let html = await res.text();
  if (meta) html = html.replace(/<title>[^<]*<\/title>\s*/, "").replace(/<meta (property="og:|name="twitter:|name="description")[^>]*>\s*/g, "");
  html = html.replace("<head>", "<head>\n" + head);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "x-robots-tag": "noindex" } });
}

/* the card an address names, as the head's title, summary and picture; null when nothing has that name */
async function cardMeta(env, url, parts) {
  const [kind, name] = parts;
  if (!name) return SECTIONS[kind] ? { title: SECTIONS[kind][0], text: SECTIONS[kind][1] } : null;
  if (kind === "stories") {
    const ix = await env.CONTENT.get("stories/index.json");
    const s = (ix ? (await ix.json()).stories : []).find((x) => x.slug === name || x.id === name);
    if (!s) return null;
    // a headline can stand for names ({p0} the first tagged player, {c0} the first city), as the page shows it
    const site = /\{(p0|c0)\}/.test(s.title + s.dek) ? await sitePackage(env) : null;
    const fill = (t) => String(t || "").replace(/\{p0\}/g, () => { const p = site && site.players.find((x) => x.id === (s.players || [])[0]); return p ? p.name : "the captain"; })
      .replace(/\{c0\}/g, () => { const c = site && site.cities.find((x) => x.id === (s.cities || [])[0]); return c ? c.name : "the league"; });
    return { type: "article", title: fill(s.title), text: fill(s.dek), image: s.photo };
  }
  const site = await sitePackage(env);
  if (!site) return null;
  if (kind === "cities") {
    const c = site.cities.find((x) => slug(x.name) === name || x.id === name);
    return c ? { title: c.name, text: `${(c.teams || []).join(" · ")}. ${c.story || ""}`.trim(), image: (c.photos || [])[0] } : null;
  }
  if (kind === "players") {
    const p = site.players.find((x) => slug(x.name) === name || x.id === name);
    const c = p && site.cities.find((x) => x.id === p.city);
    return p ? { type: "profile", title: `${p.name} · ${c ? c.name : ""}`, text: p.bio || "", image: p.full || p.face } : null;
  }
  if (kind === "events") {
    const e = (site.schedule || []).find((x) => x.id === name || slug(x.name) === name);
    return e ? { title: e.name, text: [e.venue, e.city, e.start && e.end ? `${e.start} to ${e.end}` : ""].filter(Boolean).join(" · ") } : null;
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").map(decodeURIComponent);
    // the page's own addresses
    if (url.pathname === "/" || url.pathname === "/index.html") return page(request, env, url, null);
    if ((parts.length === 1 && SECTIONS[parts[0]]) || (parts.length === 2 && ["stories", "cities", "players", "events"].includes(parts[0]))) {
      const meta = await cardMeta(env, url, parts);
      // a name nothing has: back to its section (a story to Stories, an event to Season, a city or player home)
      if (!meta) return Response.redirect(url.origin + "/" + ({ stories: "stories", events: "season" }[parts[0]] || ""), 302);
      return page(request, env, url, meta);
    }
    if (!url.pathname.startsWith("/content/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const key = decodeURIComponent(url.pathname.slice("/content/".length));
    // only what the page and the app read is public; the desk's own files (desk/, ai/, scores/) never leave the bucket
    if (!/^(site|stories|photos)\/[^]+$/.test(key) || key.split("/").includes("..")) return new Response("Not found", { status: 404 });
    const obj = await env.CONTENT.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set("ETag", obj.httpEtag);
    h.set("X-Robots-Tag", "noindex");
    h.set("Access-Control-Allow-Origin", "*");   // the app's page lives at its own address and reads the store from there
    // the index is checked on every visit; an article text never changes under its name; photos keep for a day
    h.set("Cache-Control", key.endsWith("index.json") || key === "site/structure.json" ? "no-cache"
      : /\.[0-9a-f]{8}\.json$/.test(key) ? "public, max-age=31536000, immutable" : "public, max-age=86400");
    return new Response(request.method === "HEAD" ? null : obj.body, { headers: h });
  },
};
