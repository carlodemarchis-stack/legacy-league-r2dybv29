// The article field of the stories editor: Tiptap with only what a story may hold.
// Build: npm run build:editor  →  src/tiptap.bundle.txt (served by the Desk as /<key>/editor/app.js)
//
// A story's article is kept as plain text, one block per paragraph, blocks separated by a blank line:
//   ## A subheading          a block starting with "## "
//   - one / - two            a bulleted list, one item per line
//   1. one / 2. two          a numbered list, one item per line
//   **bold**  *italic*  [words](https://…)
//   ![alt text](content/photos/…#1280x853 "Caption")   a photo from the league's store, a block of its own
// Nothing else exists: whatever else is pasted in is reduced to these.

import { Editor } from "@tiptap/core";
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
    return ({ node }) => {
      const fig = document.createElement("figure"), img = document.createElement("img"), cap = document.createElement("figcaption");
      fig.className = "ph"; fig.append(img, cap);
      const paint = (n) => { img.src = n.attrs.src; img.alt = n.attrs.alt || ""; cap.textContent = n.attrs.title || ""; cap.hidden = !n.attrs.title; };
      paint(node);
      return { dom: fig, update: (n) => { if (n.type !== node.type) return false; paint(n); return true; } };
    };
  },
}).configure({ inline: false, allowBase64: false });

export const okUrl = (u) => /^(https:\/\/|mailto:|\/stories\/)/.test(u || "");
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
    if (b.type === "image") { const path = toPath(b.attrs.src); return path ? photoMd(path, b.attrs.alt, b.attrs.title) : null; }
    if (b.type === "bulletList") return items(b).map((t) => "- " + t).join("\n") || null;
    if (b.type === "orderedList") return items(b).map((t, i) => `${i + 1}. ${t}`).join("\n") || null;
    const t = inlineMd(b.content || []).trim();
    if (!t) return null;
    return b.type === "heading" ? "## " + t : t;
  }).filter(Boolean).join("\n\n");
}

export function makeEditor(element, blocks, onChange, site) {
  SITE = site || SITE;
  return new Editor({
    element,
    extensions: [
      Document, Text, Paragraph, Heading.configure({ levels: [2] }), Bold, Italic, UndoRedo,
      BulletList, OrderedList, ListItem, ListKeymap, Photo,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https",
        protocols: ["mailto"], isAllowedUri: (url) => okUrl(url), HTMLAttributes: { rel: "noopener", target: null } }),
      Placeholder.configure({ placeholder: "Write the article. Subheadings, bold, italic, links, lists and photos are all it can hold." }),
    ],
    content: fromMd(blocks),
    onUpdate: onChange,
  });
}
