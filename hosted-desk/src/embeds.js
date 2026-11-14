/* Embeds: a paragraph of an article that is only a link to one of these places becomes its player on the site and in
   the app (a YouTube video, a post on X…). The Content Studio shows it as a card; Claude writes it as a bare link on
   its own line. The site carries a copy of this list in template.html (search "EMBEDS"): keep the two in step.

   shape tells the site how much room the player needs: wide 16:9, tall 9:16, post (a social post), audio, audiolist.
   cookieFree: the player sets no tracking cookies until it plays (YouTube's privacy mode), so it loads at once;
   the others load once the fan has said yes. */
const enc = encodeURIComponent;
export const EMBEDS = [
  { id: "youtube", name: "YouTube", cookieFree: true,
    re: /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/,
    player: (m) => `https://www.youtube-nocookie.com/embed/${m[1]}`, shape: (m, u) => (/\/shorts\//.test(u) ? "tall" : "wide"),
    oembed: (u) => `https://www.youtube.com/oembed?format=json&url=${enc(u)}` },
  { id: "vimeo", name: "Vimeo",
    re: /^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/,
    player: (m) => `https://player.vimeo.com/video/${m[1]}?dnt=1`, shape: () => "wide",
    oembed: (u) => `https://vimeo.com/api/oembed.json?url=${enc(u)}` },
  { id: "x", name: "X",
    re: /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/\w+\/status\/(\d+)/,
    player: (m) => `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&dnt=true&theme=dark`, shape: () => "post",
    oembed: (u) => `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${enc(u)}` },
  { id: "tiktok", name: "TikTok",
    re: /^https:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    player: (m) => `https://www.tiktok.com/embed/v2/${m[1]}`, shape: () => "tall",
    oembed: (u) => `https://www.tiktok.com/oembed?url=${enc(u)}` },
  { id: "instagram", name: "Instagram",
    re: /^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([\w-]+)/,
    player: (m) => `https://www.instagram.com/p/${m[1]}/embed`, shape: () => "post",
    oembed: null },                                          // Instagram's needs a Meta app token: the card shows the link only
  { id: "spotify", name: "Spotify",
    re: /^https:\/\/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|episode|show|playlist|album)\/(\w+)/,
    player: (m) => `https://open.spotify.com/embed/${m[1]}/${m[2]}`, shape: (m) => (["track", "episode"].includes(m[1]) ? "audio" : "audiolist"),
    oembed: (u) => `https://open.spotify.com/oembed?url=${enc(u)}` },
];
export const EMBED_NAMES = EMBEDS.map((p) => p.name).join(", ");

/* what a link is, if it is one we embed: { provider, name, url, player, shape, cookieFree } or null */
export function embedOf(url) {
  url = String(url || "").trim();
  if (!url || /\s/.test(url)) return null;
  for (const p of EMBEDS) {
    const m = url.match(p.re);
    if (m) return { provider: p.id, name: p.name, url, player: p.player(m, url), shape: p.shape(m, url), cookieFree: !!p.cookieFree };
  }
  return null;
}
export const oembedUrl = (url) => { const e = embedOf(url); const p = e && EMBEDS.find((x) => x.id === e.provider); return p && p.oembed ? p.oembed(url) : null; };
