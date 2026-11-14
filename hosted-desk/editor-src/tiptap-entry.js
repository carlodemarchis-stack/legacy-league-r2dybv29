// The article field of the stories editor: Tiptap with only what a story may hold.
// Build: npm run build:editor  →  src/tiptap.bundle.txt (served by the Desk as /<key>/editor/app.js)
//
// A story's article is kept as plain text, one block per paragraph, blocks separated by a blank line:
//   ## A subheading          a block starting with "## "
//   - one / - two            a bulleted list, one item per line
//   1. one / 2. two          a numbered list, one item per line
//   **bold**  *italic*  [words](https://…)
//   ![alt text](content/photos/…#1280x853 "Caption")   a photo from the league's store, a block of its own
//   https://www.youtube.com/watch?v=…                   an embed: a block that is only a link to YouTube, X… (embeds.js)
//   leaderboard: board=event top=5 at=r1                 a leaderboard (boards.js)
// Nothing else exists: whatever else is pasted in is reduced to these.

import { Editor, Node } from "@tiptap/core";
import { embedOf } from "../src/embeds.js";
import { parseBoard, boardLine } from "../src/boards.js";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import { BulletList, OrderedList, ListItem, ListKeymap } from "@tiptap/extension-list";
import { UndoRedo, Placeholder } from "@tiptap/extensions";
import Image from "@tiptap/extension-image";

/* Photos live in the league's store; the page shows them from the site's address. */
let SITE = "";
const IMG = /^!\[([^\]]*)\]\((content\/photos\/[^\s)#]+)(#\d+x\d+)?(?:\s+"([^"]*)")?\)$/;
const toPath = (src) => { const i = String(src || "").indexOf("/content/photos/"); return i < 0 ? null : src.slice(i + 1); };
export const photoMd = (path, alt, caption) => `![${String(alt || "").replace(/[\[\]]/g, "")}](${path}${caption ? ` "${String(caption).replace(/"/g, "”")}"` : ""})`;
/* A photo in the text: full width, its caption under it. Only photos from the store are taken in, so a picture pasted
   from another site never enters a story. */
const Photo = Image.extend({
  parseHTML() { return [{ tag: "img[src]", getAttrs: (el) => (toPath(el.getAttribute("src")) ? null : false) }]; },
  addNodeView() {
    return ({ node, getPos }) => {
      const fig = document.createElement("figure"), img = document.createElement("img"), cap = document.createElement("figcaption");
      // a ⋯ button on the photo opens the page's photo menu (edit text, use as main photo, remove)
      const more = document.createElement("button");
      more.type = "button"; more.className = "ph-more"; more.textContent = "⋯"; more.contentEditable = "false"; more.title = "Photo options";
      more.addEventListener("mousedown", (e) => e.preventDefault());
      more.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = more.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent("photo-menu", { detail: { pos: getPos(), x: r.right, y: r.bottom } }));
      });
      fig.className = "ph"; fig.append(img, more, cap);
      const paint = (n) => { img.src = n.attrs.src; img.alt = n.attrs.alt || ""; cap.textContent = n.attrs.title || ""; cap.hidden = !n.attrs.title;
        fig.classList.toggle("nodesc", !n.attrs.alt); };
      paint(node);
      return { dom: fig, update: (n) => { if (n.type !== node.type) return false; paint(n); return true; } };
    };
  },
}).configure({ inline: false, allowBase64: false });

/* An embed: a card in the editor (picture, provider, title) standing for the player the site shows.
   Its title and picture come from the Desk: setEmbeds(map) gives those already known for the story,
   setEmbedLookup(fn) how to ask for a new one. ⋯ opens the page's embed menu. */
let EMBED_META = {}, EMBED_LOOKUP = null;
export const setEmbeds = (m) => { EMBED_META = { ...(m || {}) }; };
export const setEmbedLookup = (fn) => { EMBED_LOOKUP = fn; };
export const embedLink = (u) => embedOf(u);
const Embed = Node.create({
  name: "embed", group: "block", atom: true, draggable: true, selectable: true,
  addAttributes() { return { url: { default: null } }; },
  parseHTML() { return [{ tag: "div[data-embed]", getAttrs: (el) => (embedOf(el.getAttribute("data-embed")) ? { url: el.getAttribute("data-embed") } : false) }]; },
  renderHTML({ node }) { return ["div", { "data-embed": node.attrs.url }]; },
  addNodeView() {
    return ({ node, getPos }) => {
      const box = document.createElement("div"); box.className = "emb"; box.contentEditable = "false";
      const pic = document.createElement("div"), txt = document.createElement("div"), more = document.createElement("button");
      pic.className = "emb-pic"; txt.className = "emb-txt";
      more.type = "button"; more.className = "ph-more"; more.textContent = "⋯"; more.title = "Embed options";
      more.addEventListener("mousedown", (e) => e.preventDefault());
      more.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = more.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent("embed-menu", { detail: { pos: getPos(), url: node.attrs.url, x: r.right, y: r.bottom } }));
      });
      box.append(pic, txt, more);
      const paint = (url) => {
        const e = embedOf(url) || { name: "Link" }, m = EMBED_META[url] || {};
        pic.style.backgroundImage = m.thumb ? `url("${m.thumb.replace(/"/g, "%22")}")` : "";
        pic.textContent = m.thumb ? "" : "▶";
        txt.innerHTML = `<small>${esc(e.name)}${m.author ? " · " + esc(m.author) : ""}</small><b>${esc(m.title || url)}</b><span>${esc(url)}</span>`;
      };
      paint(node.attrs.url);
      if (!EMBED_META[node.attrs.url] && EMBED_LOOKUP)
        EMBED_LOOKUP(node.attrs.url).then((m) => { if (m) { EMBED_META[node.attrs.url] = m; paint(node.attrs.url); } }).catch(() => {});
      return { dom: box, update: (n) => { if (n.type !== node.type) return false; node = n; paint(n.attrs.url); return true; } };
    };
  },
});
/* A leaderboard: a card with its title, when it is as of, and its first rows. Rows come from the Desk:
   setBoards(map) for the story's frozen ones, setBoardLookup(fn) to ask for any other. ⋯ opens the page's menu. */
let BOARD_META = {}, BOARD_LOOKUP = null;
export const setBoards = (m) => { BOARD_META = { ...(m || {}) }; };
export const setBoardLookup = (fn) => { BOARD_LOOKUP = fn; };
export { parseBoard, boardLine };
const sgn = (n) => (n == null ? "" : n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const Board = Node.create({
  name: "board", group: "block", atom: true, draggable: true, selectable: true,
  addAttributes() { return { line: { default: null } }; },
  parseHTML() { return [{ tag: "div[data-board]", getAttrs: (el) => (parseBoard(el.getAttribute("data-board")) ? { line: el.getAttribute("data-board") } : false) }]; },
  renderHTML({ node }) { return ["div", { "data-board": node.attrs.line }]; },
  addNodeView() {
    return ({ node, getPos }) => {
      const box = document.createElement("div"); box.className = "brd"; box.contentEditable = "false";
      const more = document.createElement("button");
      more.type = "button"; more.className = "ph-more"; more.textContent = "⋯"; more.title = "Leaderboard options";
      more.addEventListener("mousedown", (e) => e.preventDefault());
      more.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = more.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent("board-menu", { detail: { pos: getPos(), line: node.attrs.line, x: r.right, y: r.bottom } }));
      });
      const inner = document.createElement("div"); box.append(inner, more);
      const paint = (line) => {
        const m = BOARD_META[line], spec = parseBoard(line) || {};
        const rows = m && m.rows ? m.rows.slice(0, 6) : [];
        inner.innerHTML = `<small>Leaderboard · ${esc(spec.at === "live" ? "live, always current" : "frozen")}</small>
          <b>${esc((m && m.title) || "Leaderboard")}</b><span class="as">${esc((m && (m.note || m.as_of)) || "Loading…")}</span>
          <div class="rows">${rows.map((r) => spec.board === "city"
            ? `<div><span></span><span>${esc(r.name)}</span><span>${esc(String(r.thru))}</span><span>${sgn(r.to_par)}</span></div>`
            : `<div><span>${esc(String(r.pos))}</span><span><i style="background:${esc(r.color || "#888")}"></i>${esc(r.city)}</span><span>${spec.board === "season" ? "" : sgn(r.total)}</span><span>${spec.board === "season" ? esc(String(r.points)) + " pts" : ""}</span></div>`).join("")}
            ${m && m.rows && m.rows.length > rows.length ? `<div class="more">+ ${m.rows.length - rows.length} more</div>` : ""}</div>`;
      };
      paint(node.attrs.line);
      if (!BOARD_META[node.attrs.line] && BOARD_LOOKUP)
        BOARD_LOOKUP(node.attrs.line).then((m) => { if (m) { BOARD_META[node.attrs.line] = m; paint(node.attrs.line); } }).catch(() => {});
      return { dom: box, update: (n) => { if (n.type !== node.type) return false; node = n; paint(n.attrs.line); return true; } };
    };
  },
});
export const insertBoard = (editor, line, at) => {
  const node = { type: "board", attrs: { line } };
  return at == null ? editor.chain().focus().insertContent(node).run() : editor.chain().focus().insertContentAt(at, node).run();
};
export const setBoardLine = (editor, pos, line) => editor.chain().setNodeSelection(pos).command(({ tr }) => { tr.setNodeMarkup(pos, undefined, { line }); return true; }).run();

export const insertEmbed = (editor, url, at) => {
  const node = { type: "embed", attrs: { url } };
  return at == null ? editor.chain().focus().insertContent(node).run() : editor.chain().focus().insertContentAt(at, node).run();
};

export const okUrl = (u) => /^(https:\/\/|mailto:|\/(stories|players|cities|events)\/)/.test(u || "");   // league pages open in the site
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Markdown (our small part of it) → HTML, for loading a story into the editor. The site uses the same rules. */
export function inlineHtml(text) {
  const links = [];
  let s = esc(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    if (!okUrl(url)) return m;
    links.push([label, url]);
    return `\u0000${links.length - 1}\u0000`;
  });
  const marks = (t) => t.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = marks(s);
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<a href="${links[i][1]}">${marks(links[i][0])}</a>`);
}
const BULLET = /^[-*]\s+/, NUMBER = /^\d+[.)]\s+/;
export function blockHtml(b) {
  if (embedOf(String(b).trim())) return `<div data-embed="${esc(String(b).trim())}"></div>`;
  if (parseBoard(String(b).trim())) return `<div data-board="${esc(String(b).trim())}"></div>`;
  const im = String(b).trim().match(IMG);
  if (im) return `<img src="${esc(SITE + "/" + im[2] + (im[3] || ""))}" alt="${esc(im[1])}" title="${esc(im[4] || "")}">`;
  const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length && lines.every((l) => BULLET.test(l))) return `<ul>${lines.map((l) => `<li><p>${inlineHtml(l.replace(BULLET, ""))}</p></li>`).join("")}</ul>`;
  if (lines.length && lines.every((l) => NUMBER.test(l))) return `<ol>${lines.map((l) => `<li><p>${inlineHtml(l.replace(NUMBER, ""))}</p></li>`).join("")}</ol>`;
  if (/^##\s+/.test(b)) return `<h2>${inlineHtml(b.replace(/^##\s+/, ""))}</h2>`;
  return `<p>${inlineHtml(lines.join(" "))}</p>`;
}
export function fromMd(blocks) {
  return (blocks || []).map(blockHtml).join("") || "<p></p>";
}

/* The editor's document → our Markdown. */
function fmt(n) {
  if (n.type !== "text") return "";
  const m = (n.marks || []).map((x) => x.type);
  const [, lead, core, trail] = n.text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!core) return n.text;
  let t = core;
  if (m.includes("italic")) t = `*${t}*`;
  if (m.includes("bold")) t = `**${t}**`;
  return lead + t + trail;
}
const hrefOf = (n) => ((n.marks || []).find((m) => m.type === "link") || { attrs: {} }).attrs.href;
function inlineMd(nodes) {
  let out = "", i = 0;
  while (i < nodes.length) {
    const href = hrefOf(nodes[i]);
    if (href && okUrl(href)) {
      let inner = "";
      while (i < nodes.length && hrefOf(nodes[i]) === href) inner += fmt(nodes[i++]);
      out += `[${inner}](${href})`;
    } else out += fmt(nodes[i++]);
  }
  return out;
}
/* the text lines of a list, nested items brought up to the same level so every list looks alike */
function items(list) {
  const out = [];
  for (const li of list.content || []) for (const part of li.content || []) {
    if (part.type === "paragraph" || part.type === "heading") { const t = inlineMd(part.content || []).trim(); if (t) out.push(t); }
    else if (part.type === "bulletList" || part.type === "orderedList") out.push(...items(part));
  }
  return out;
}
export function toMd(doc) {
  return (doc.content || []).map((b) => {
    if (b.type === "embed") return embedOf(b.attrs.url) ? b.attrs.url : null;
    if (b.type === "board") return parseBoard(b.attrs.line) ? b.attrs.line : null;
    if (b.type === "image") { const path = toPath(b.attrs.src); return path ? photoMd(path, b.attrs.alt, b.attrs.title) : null; }
    if (b.type === "bulletList") return items(b).map((t) => "- " + t).join("\n") || null;
    if (b.type === "orderedList") return items(b).map((t, i) => `${i + 1}. ${t}`).join("\n") || null;
    const t = inlineMd(b.content || []).trim();
    if (!t) return null;
    return b.type === "heading" ? "## " + t : t;
  }).filter(Boolean).join("\n\n");
}

/* Pictures pasted or dropped in: picture files go to onFiles (the page uploads them and asks for a description);
   a picture that is only a link to another site is left out, and onNotice says so. */
const imageFiles = (dt) => [...((dt && dt.files) || [])].filter((f) => /^image\//.test(f.type));
const foreignImages = (dt) => /<img[^>]+src=/i.test((dt && dt.getData("text/html")) || "") &&
  ![...((dt.getData("text/html") || "").matchAll(/<img[^>]+src="([^"]+)"/gi))].every((m) => toPath(m[1]));

export function makeEditor(element, blocks, onChange, site, onFiles, onNotice) {
  SITE = site || SITE;
  return new Editor({
    editorProps: {
      handlePaste(view, event) {
        // a link to YouTube, X… pasted on an empty line becomes an embed; anywhere else it stays a link in the text
        const text = ((event.clipboardData && event.clipboardData.getData("text/plain")) || "").trim(), { $from } = view.state.selection;
        if (embedOf(text) && $from.parent.type.name === "paragraph" && !$from.parent.content.size) {
          event.preventDefault();
          view.dispatch(view.state.tr.replaceWith($from.before(), $from.after(), view.state.schema.nodes.embed.create({ url: text })));
          return true;
        }
        const files = imageFiles(event.clipboardData);
        if (files.length && onFiles) { event.preventDefault(); onFiles(files, null); return true; }
        if (foreignImages(event.clipboardData) && onNotice) onNotice("Pictures from other websites are left out. Copy the image itself, or use the Photo button.");
        return false;
      },
      handleDrop(view, event, slice, moved) {
        const files = imageFiles(event.dataTransfer);
        if (moved || !files.length || !onFiles) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        onFiles(files, at ? at.pos : null);
        return true;
      },
    },
    element,
    extensions: [
      Document, Text, Paragraph, Heading.configure({ levels: [2] }), Bold, Italic, UndoRedo,
      BulletList, OrderedList, ListItem, ListKeymap, Photo, Embed, Board,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https",
        protocols: ["mailto"], isAllowedUri: (url) => okUrl(url), HTMLAttributes: { rel: "noopener", target: null } }),
      Placeholder.configure({ placeholder: "Write the article. Subheadings, bold, italic, links, lists and photos are all it can hold." }),
    ],
    content: fromMd(blocks),
    onUpdate: onChange,
  });
}
