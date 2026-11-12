// The site on Cloudflare: the built page and its files are served as they are (ASSETS);
// anything under /content/ comes from the content store, the R2 bucket bound as CONTENT.
// The bucket itself stays private: this is the only way in, and it only reads.
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* /stories/<name>: a story's own address. The answer is the page itself, told to open that story, and carrying
   the story's headline, summary and picture in its head, so a link pasted into a message or a post shows
   the story's own card. An address no story has goes to the Stories section. */
async function storyPage(request, env, url, name) {
  const ix = await env.CONTENT.get("stories/index.json");
  const stories = ix ? (await ix.json()).stories : [];
  const s = stories.find((x) => x.slug === name || x.id === name);
  if (!s) return Response.redirect(url.origin + "/#3", 302);
  const page = await env.ASSETS.fetch(new Request(url.origin + "/", request));
  const title = s.title, dek = s.dek || "";
  const abs = (p) => (/^https?:/.test(p || "") ? p : url.origin + "/" + (p || "img/og.jpg"));
  const head = `<base href="/">
<title>${esc(title)} · Legacy League Golf</title>
<meta property="og:type" content="article">
<meta property="og:site_name" content="Legacy League Golf">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(dek)}">
<meta property="og:url" content="${url.origin}/stories/${esc(s.slug || s.id)}">
<meta property="og:image" content="${esc(abs(s.photo))}">
<meta name="description" content="${esc(dek)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(dek)}">
<meta name="twitter:image" content="${esc(abs(s.photo))}">`;
  const html = (await page.text())
    .replace(/<title>[^<]*<\/title>\s*/, "")
    .replace(/<meta (property="og:|name="twitter:)[^>]*>\s*/g, "")
    .replace("<head>", "<head>\n" + head);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "x-robots-tag": "noindex" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const story = url.pathname.match(/^\/stories\/([^/]+)\/?$/);
    if (story) return storyPage(request, env, url, decodeURIComponent(story[1]));
    if (!url.pathname.startsWith("/content/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const key = decodeURIComponent(url.pathname.slice("/content/".length));
    const obj = await env.CONTENT.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set("ETag", obj.httpEtag);
    h.set("X-Robots-Tag", "noindex");
    h.set("Access-Control-Allow-Origin", "*");   // the app's page lives at its own address and reads the store from there
    // the index is checked on every visit; an article text never changes under its name; photos keep for a day
    h.set("Cache-Control", key.endsWith("index.json") ? "no-cache"
      : /\.[0-9a-f]{8}\.json$/.test(key) ? "public, max-age=31536000, immutable" : "public, max-age=86400");
    return new Response(request.method === "HEAD" ? null : obj.body, { headers: h });
  },
};
