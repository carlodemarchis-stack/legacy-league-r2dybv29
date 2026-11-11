// The site on Cloudflare: the built page and its files are served as they are (ASSETS);
// anything under /content/ comes from the content store, the R2 bucket bound as CONTENT.
// The bucket itself stays private: this is the only way in, and it only reads.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/content/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const key = decodeURIComponent(url.pathname.slice("/content/".length));
    const obj = await env.CONTENT.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set("ETag", obj.httpEtag);
    h.set("X-Robots-Tag", "noindex");
    // the index is checked on every visit; an article text never changes under its name; photos keep for a day
    h.set("Cache-Control", key.endsWith("index.json") ? "no-cache"
      : /\.[0-9a-f]{8}\.json$/.test(key) ? "public, max-age=31536000, immutable" : "public, max-age=86400");
    return new Response(request.method === "HEAD" ? null : obj.body, { headers: h });
  },
};
