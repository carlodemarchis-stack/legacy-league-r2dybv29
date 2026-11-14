/* The structure of the content: which kinds of story and which topics exist. It is data, kept in the store at
   site/structure.json, read by the Desk, the Content Studio and the site, and changed by producers.

   The line between producers and coders:
   - A FORMAT is code. It decides which fields a story has in the Studio and how the site draws it: a gallery has
     its row of photos, a video its length, a result its scores. Only coders add formats (here and in the Studio
     and the site).
   - A KIND is data. It is a format with a name: "News" is the text format, "Gallery" the gallery format. Producers
     add, rename and remove kinds, set their tile size and whether fans get a filter for them.
   - A TOPIC is data: what a story is about (the league, a city, the mission). Producers manage the list. */

export const FORMATS = {
  text: { name: "Text", about: "Headline, summary and article, with photos in the article." },
  gallery: { name: "Gallery", about: "A row of photos in order; the first is the cover." },
  video: { name: "Video", about: "A video with its length (e.g. 2:14)." },
  quote: { name: "Quote", about: "A quote over a photo: the headline is the words, the byline the speaker." },
  result: { name: "Live result", about: "Made by the Desk from the scores. Not for editors.", system: true },
};
export const SIZES = ["s", "m", "l", "xl", "p", "r"];
export const TOPIC_STYLES = ["", "mission"];                   // a style the site knows how to draw

/* what the league had before the structure became data: the same kinds, labels, sizes and filters */
export const DEFAULT_STRUCTURE = {
  kinds: [
    { id: "video", format: "video", label: "Video", filter_label: "Video", size: "l", filter: true },
    { id: "gallery", format: "gallery", label: "Gallery", filter_label: "Galleries", size: "m", filter: true },
    { id: "article", format: "text", label: "News", filter_label: "News", size: "m", filter: true },
    { id: "quote", format: "quote", label: "Mission", size: "m", filter: false },
    { id: "result", format: "result", label: "Live result", size: "r", filter: false },
  ],
  topics: [
    { id: "league", label: "League" },
    { id: "city", label: "City" },
    { id: "mission", label: "Mission", filter: true, badge: true, style: "mission", author: "Legacy League · Mission" },
  ],
};

const ID = /^[a-z][a-z0-9-]{1,29}$/;
const text = (x, max) => String(x == null ? "" : x).trim().slice(0, max);

/* a structure as it should be stored: known fields only, trimmed */
export function clean(raw) {
  const s = raw && Array.isArray(raw.kinds) && Array.isArray(raw.topics) ? raw : DEFAULT_STRUCTURE;
  return {
    kinds: s.kinds.map((k) => ({
      id: text(k.id, 30).toLowerCase(), format: text(k.format, 20), label: text(k.label, 40),
      ...(text(k.filter_label, 40) ? { filter_label: text(k.filter_label, 40) } : {}),
      size: SIZES.includes(k.size) ? k.size : "m", filter: !!k.filter,
    })),
    topics: s.topics.map((t) => ({
      id: text(t.id, 30).toLowerCase(), label: text(t.label, 40),
      ...(t.filter ? { filter: true } : {}), ...(t.badge ? { badge: true } : {}),
      ...(TOPIC_STYLES.includes(t.style) && t.style ? { style: t.style } : {}),
      ...(text(t.author, 60) ? { author: text(t.author, 60) } : {}),
    })),
    ...(raw && raw.updated_at ? { updated_at: raw.updated_at, updated_by: raw.updated_by } : {}),
  };
}

/* What is wrong with a proposed structure, given the stories that exist. [] when it can be saved. */
export function problems(next, stories) {
  const out = [];
  const seen = (list, what) => {
    const ids = new Set();
    for (const x of list) {
      if (!ID.test(x.id)) out.push(`${what} "${x.id}": the id must be 2 to 30 lower-case letters, digits or dashes, starting with a letter.`);
      if (ids.has(x.id)) out.push(`${what} "${x.id}" appears twice.`);
      ids.add(x.id);
      if (!x.label) out.push(`${what} "${x.id}" needs a name.`);
    }
    return ids;
  };
  const kinds = seen(next.kinds, "Kind"), topics = seen(next.topics, "Topic");
  for (const k of next.kinds) if (!FORMATS[k.format]) out.push(`Kind "${k.id}": format must be one of ${Object.keys(FORMATS).join(", ")}.`);
  if (!next.kinds.some((k) => k.format === "text")) out.push("Keep at least one kind with the text format.");
  if (!next.kinds.some((k) => k.format === "result")) out.push(`Keep the "result" kind: the Desk makes live results with it.`);
  if (!next.topics.length) out.push("Keep at least one topic.");
  // a kind or topic still used by a story cannot go (change those stories first)
  const used = (field, ids, what) => {
    const counts = {};
    for (const s of stories) if (s[field] && !ids.has(s[field])) counts[s[field]] = (counts[s[field]] || 0) + 1;
    for (const [id, n] of Object.entries(counts)) out.push(`${what} "${id}" is used by ${n} stor${n === 1 ? "y" : "ies"}: change ${n === 1 ? "it" : "them"} first.`);
  };
  used("kind", kinds, "Kind"); used("topic", topics, "Topic");
  // a kind used by stories keeps its format: their fields depend on it
  return out;
}
export function formatChanges(prev, next, stories) {
  const out = [];
  for (const k of next.kinds) {
    const was = prev.kinds.find((x) => x.id === k.id);
    if (was && was.format !== k.format && stories.some((s) => s.kind === k.id))
      out.push(`Kind "${k.id}" is used by stories, so its format stays ${was.format}. Make a new kind instead.`);
  }
  return out;
}

export const kindOf = (st, id) => st.kinds.find((k) => k.id === id) || null;
export const formatOf = (st, id) => (kindOf(st, id) || {}).format || null;
export const topicOf = (st, id) => st.topics.find((t) => t.id === id) || null;
/* kinds an editor can choose (not the system ones) */
export const editorKinds = (st) => st.kinds.filter((k) => !(FORMATS[k.format] || {}).system);
