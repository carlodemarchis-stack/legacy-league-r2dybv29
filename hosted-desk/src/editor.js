// The stories editor: one page, a list of every story on the left and the open story on the right.
// It talks to the Desk's own small API (/<key>/editor/api/…), next to the Claude connector.

export function editorPage(site) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stories editor · Legacy League Golf</title><meta name="robots" content="noindex">
<style>
:root{--bg:#0b0f11;--panel:#141a1d;--line:#26302f;--ink:#e9eeec;--dim:#93a09c;--acc:#d9ad4e;--on-acc:#1a1406;--bad:#e5675a;--ok:#5fbf7a;
  color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
@media (prefers-color-scheme:light){:root{--bg:#eef1ef;--panel:#fff;--line:#d9dfdc;--ink:#14191b;--dim:#5d6965;color-scheme:light}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-size:14px}
button,input,select,textarea{font:inherit;color:inherit}
header{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line)}
header h1{margin:0;font-size:12px;letter-spacing:.2em;text-transform:uppercase}header h1 span{color:var(--dim);font-weight:400}
header a{margin-left:auto;color:var(--dim);font-size:12px}
.wrap{display:grid;grid-template-columns:340px minmax(0,1fr);height:calc(100dvh - 49px)}
aside{border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.tools{display:flex;gap:6px;padding:12px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.tools input{flex:1 1 100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel)}
.seg{display:flex;gap:4px;flex:1}.seg button,.btn{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 11px;cursor:pointer;font-size:12px}
.seg button.on{background:var(--acc);border-color:var(--acc);color:var(--on-acc)}
.btn.pri{background:var(--acc);border-color:var(--acc);color:var(--on-acc);font-weight:600}
.btn.bad{color:var(--bad)}.btn:disabled{opacity:.45;cursor:default}
#list{overflow-y:auto;flex:1}
.row{display:flex;gap:10px;width:100%;padding:10px 12px;border:0;border-bottom:1px solid var(--line);background:none;text-align:left;cursor:pointer}
.row:hover{background:var(--panel)}.row.on{background:var(--panel);box-shadow:inset 3px 0 var(--acc)}
.row img{width:64px;height:40px;object-fit:cover;border-radius:6px;flex:0 0 auto;background:#000}
.row b{display:block;font-size:13px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.row small{display:block;color:var(--dim);font-size:11px;margin-top:3px}
.st{display:inline-block;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:1px 6px;border-radius:4px;margin-right:6px;border:1px solid var(--line)}
.st.published{color:var(--ok);border-color:currentColor}.st.draft{color:var(--dim)}.st.scheduled{color:var(--acc);border-color:currentColor}
main{overflow-y:auto;padding:22px 28px 80px}
.empty{color:var(--dim);padding:60px 0;text-align:center}
.bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px;position:sticky;top:-22px;background:var(--bg);padding:10px 0;z-index:2}
.bar .msg{font-size:12px;color:var(--dim);margin-right:auto}.msg.err{color:var(--bad)}.msg.ok{color:var(--ok)}
.form{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start}
label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:0 0 6px}
.f{margin-bottom:16px}
.f input,.f select,.f textarea{width:100%;padding:9px 11px;border-radius:8px;border:1px solid var(--line);background:var(--panel)}
.f textarea{resize:vertical;line-height:1.5}
/* the article field: Tiptap, with only subheadings, bold, italic, links and lists */
.rte{border:1px solid var(--line);border-radius:8px;background:var(--panel)}
.rte:focus-within{border-color:color-mix(in srgb,var(--acc) 60%,var(--line))}
.tb{display:flex;gap:2px;padding:5px;border-bottom:1px solid var(--line);flex-wrap:wrap;position:sticky;top:30px;background:var(--panel);border-radius:8px 8px 0 0;z-index:1}
.tb button{min-width:32px;height:30px;padding:0 8px;border:0;border-radius:6px;background:none;cursor:pointer;color:var(--dim);font-size:13px}
.tb button:hover{background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink)}
.tb button.on{background:color-mix(in srgb,var(--acc) 22%,transparent);color:var(--ink)}
.tb i.sep{width:1px;margin:5px 4px;background:var(--line)}
.tiptap{min-height:320px;padding:12px 14px;outline:none;line-height:1.6}
.tiptap>*:first-child{margin-top:0}.tiptap p{margin:0 0 .8em}
.tiptap h2{font-size:17px;margin:1.2em 0 .5em}
.tiptap ul,.tiptap ol{margin:0 0 .8em;padding-left:1.4em}.tiptap li p{margin:0 0 .25em}
.tiptap a{color:var(--acc);text-decoration:underline}
.tiptap figure.ph{margin:0 0 1em;cursor:pointer}.tiptap figure.ph img{display:block;width:100%;border-radius:8px}
.tiptap figure.ph figcaption{font-size:12px;color:var(--dim);margin-top:5px}
.tiptap figure.ph.ProseMirror-selectednode img{outline:3px solid var(--acc);outline-offset:2px}
.phbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 9px;border-bottom:1px solid var(--line);font-size:12px;color:var(--dim);background:color-mix(in srgb,var(--acc) 8%,var(--panel))}
.phbar span{flex:1 1 200px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.phbar .btn{padding:4px 10px}
.tiptap p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:var(--dim);float:left;height:0;pointer-events:none}
#title{font-size:20px;font-weight:700}
.hint{font-size:11px;color:var(--dim);margin-top:4px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cities{display:flex;flex-wrap:wrap;gap:5px}
.cities button{border:1px solid color-mix(in srgb,var(--c) 50%,transparent);color:var(--c);background:none;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:700;letter-spacing:.06em;cursor:pointer}
.cities button.on{background:var(--c);color:#fff;border-color:var(--c)}
.events{display:flex;flex-wrap:wrap;gap:5px}
.events button{border:1px solid var(--line);background:none;border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--dim)}
.events button.on{background:var(--acc);border-color:var(--acc);color:var(--on-acc)}
.events button small{opacity:.7;margin-left:5px;font-size:10px}
/* history: a panel over the right of the page, the versions listed, the chosen one shown as it read */
.hist{position:fixed;top:0;right:0;bottom:0;width:min(760px,100vw);background:var(--bg);border-left:1px solid var(--line);z-index:20;
  display:grid;grid-template-columns:260px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);box-shadow:-20px 0 60px rgba(0,0,0,.35)}
.hist>header{grid-column:1/-1}
.hist .vl{overflow-y:auto;border-right:1px solid var(--line)}
.hist .vl button{display:block;width:100%;text-align:left;padding:10px 14px;border:0;border-bottom:1px solid var(--line);background:none;cursor:pointer}
.hist .vl button:hover,.hist .vl button.on{background:var(--panel)}.hist .vl button.on{box-shadow:inset 3px 0 var(--acc)}
.hist .vl b{display:block;font-size:12.5px}.hist .vl small{display:block;color:var(--dim);font-size:11px;margin-top:2px;line-height:1.4}
.hist .vp{overflow-y:auto;padding:18px 22px 60px}
.hist .vp h2{margin:6px 0 8px;font-size:20px}.hist .vp .dek{color:var(--dim);margin:0 0 14px}
.hist .vp .art{border-top:1px solid var(--line);padding-top:12px;line-height:1.6}.hist .vp .art p{margin:0 0 .8em}
.hist .vp .art a{color:var(--acc)}.hist .vp img{width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:12px}
.hist-inline{max-width:640px}.hist-inline h2{font-size:22px}.hist-inline .dek{color:var(--dim)}.hist-inline .art{border-top:1px solid var(--line);padding-top:12px;line-height:1.6}
.hist-inline img{width:100%;max-height:280px;object-fit:cover;border-radius:10px;margin-bottom:12px}.hist-inline .tags{font-size:12px;color:var(--dim)}
.hist .vp .tags{font-size:12px;color:var(--dim);margin:12px 0}
@media(max-width:860px){.hist{grid-template-columns:1fr;grid-template-rows:auto 38dvh minmax(0,1fr)}.hist .vl{border-right:0;border-bottom:1px solid var(--line)}}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:3px 4px 3px 10px;font-size:12px}
.chip i{width:8px;height:8px;border-radius:50%;background:var(--c)}.chip button{border:0;background:none;cursor:pointer;color:var(--dim);font-size:14px;line-height:1}
.photo img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px;display:block;background:#000}
.photo .btn{margin-top:8px}
.meta{font-size:11px;color:var(--dim);line-height:1.7;margin-top:14px}
@media(max-width:860px){.wrap{grid-template-columns:1fr;height:auto}aside{max-height:45dvh;border-right:0;border-bottom:1px solid var(--line)}.form{grid-template-columns:1fr}main{padding:16px}}
</style></head><body>
<header><h1>Legacy League Golf <span>· Stories editor</span></h1><a href="${site}" target="_blank" rel="noopener">Open the site ↗</a></header>
<div class="wrap">
  <aside>
    <div class="tools">
      <input id="q" type="search" placeholder="Find a story" autocomplete="off">
      <div class="seg" id="seg"><button data-s="all" class="on">All</button><button data-s="draft">Drafts</button><button data-s="published">Published</button><button data-s="deleted">Deleted</button></div>
      <button class="btn pri" id="new">+ New</button>
    </div>
    <div id="list"></div>
  </aside>
  <main id="main"><div class="empty">Pick a story on the left, or make a new one.</div></main>
</div>
<script src="editor/app.js"></script>
<script>
const SITE = ${JSON.stringify(site)};
const API = location.pathname.replace(/\\/editor\\/?$/, "") + "/editor/api/";
const DOOR = location.pathname.replace(/\\/editor\\/?$/, "");
let stories = [], ref = { cities: [], players: [] }, CITY = {}, PLAYER = {}, cur = null, filter = "all", dirty = false;
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pic = (p) => !p ? "" : /^https?:/.test(p) ? p : SITE + "/" + p;
const statusOf = (s) => s.status || "published";
// a headline can stand for names, as the site shows it: {p0} the first tagged player, {c0} the first city
const shown = (s, t) => String(t || "").replace(/\{p0\}/g, PLAYER[(s.players || [])[0]] ? PLAYER[s.players[0]].name : "")
  .replace(/\{c0\}/g, CITY[(s.cities || [])[0]] ? CITY[s.cities[0]].name : "the league").replace(/\{author\}/g, "Legacy League Golf");
const when = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
async function call(path, body) {
  const r = await fetch(API + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({ error: "The desk did not answer." }));
  if (!r.ok) { const e = new Error(j.error || "Something went wrong."); e.conflict = r.status === 409; throw e; }
  return j;
}
async function load(keep) {
  const j = await call("stories");
  stories = j.stories;
  renderList();
  if (keep) { const s = stories.find((x) => x.id === keep); if (s) show(s.id, true); }
}
let deleted = [];
function renderList() {
  const q = $("q").value.trim().toLowerCase();
  if (filter === "deleted") {
    const rows = deleted.filter((d) => !q || (d.title || "").toLowerCase().includes(q));
    $("list").innerHTML = rows.map((d) => \`<button class="row \${cur && cur.deletedId === d.id ? "on" : ""}" onclick="showDeleted('\${d.id}')">
      <span><b>\${esc(d.title || d.id)}</b><small><span class="st draft">deleted</span>\${esc(when(d.replaced_at))}\${d.replaced_by ? " by " + esc(d.replaced_by) : ""}</small></span></button>\`).join("") ||
      '<div class="empty">No deleted stories.</div>';
    return;
  }
  const rows = stories.filter((s) => (filter === "all" || statusOf(s) === filter) &&
    (!q || [s.title, s.dek, s.author, ...(s.cities || []).map((c) => CITY[c] && CITY[c].name), ...(s.players || []).map((p) => PLAYER[p] && PLAYER[p].name)].join(" ").toLowerCase().includes(q)));
  $("list").innerHTML = rows.map((s) => \`<button class="row \${cur && cur.id === s.id ? "on" : ""}" onclick="pick('\${s.id}')"><img src="\${esc(pic(s.photo))}" alt="" loading="lazy">
    <span><b>\${esc(shown(s, s.title))}</b><small><span class="st \${statusOf(s)}">\${statusOf(s)}</span>\${esc(s.kind)} · \${esc(when(s.at))}</small></span></button>\`).join("") ||
    '<div class="empty">No story matches.</div>';
}
function pick(id) {
  if (dirty && !confirm("Leave this story without saving your changes?")) return;
  show(id);
}
function show(id, quiet) {
  const found = stories.find((s) => s.id === id);
  cur = found ? structuredClone(found) : null;          // a copy: unsaved edits never touch the list
  dirty = false;
  renderList(); renderForm(); if (!quiet) $("main").scrollTop = 0;
}
function blank() {
  const live = ref.events.find((e) => e.status === "live");          // a new story is about the event on now, until untagged
  return { id: null, status: "draft", kind: "article", topic: "league", title: "", dek: "", body: [], cities: [], players: [], events: live ? [live.id] : [], author: "" };
}
function renderForm(msg) {
  const s = cur; if (!s) { $("main").innerHTML = '<div class="empty">Pick a story on the left, or make a new one.</div>'; return; }
  const st = s.id ? statusOf(s) : "new";
  const kinds = s.kind === "result" ? ["result"] : ["article", "video", "gallery", "quote"];
  $("main").innerHTML = \`
  <div class="bar"><span class="msg" id="msg">\${s.id ? \`<span class="st \${st}">\${st}</span>\` : "New story, not saved yet"}</span>
    \${s.url ? \`<a class="btn" href="\${esc(s.url)}" target="_blank" rel="noopener">View on site ↗</a>\` : ""}
    <button class="btn" id="discard" onclick="discard()" \${s.id ? "hidden" : ""}>\${s.id ? "Discard changes" : "Cancel"}</button>
    \${s.id ? \`<button class="btn" onclick="openHistory()">History</button><button class="btn bad" onclick="del()">Delete</button>\` : ""}
    \${s.id && st === "published" ? \`<button class="btn" onclick="act('unpublish')">Unpublish</button>\` : ""}
    <button class="btn \${st === "published" ? "pri" : ""}" id="save" onclick="save()">\${st === "published" ? "Save and update the site" : "Save draft"}</button>
    \${s.id && st !== "published" ? \`<button class="btn pri" onclick="act('publish')">Publish</button>\` : ""}
  </div>
  <div class="form">
    <div>
      <div class="f"><label for="title">Headline</label><input id="title" value="\${esc(s.title)}">\${/\{(p0|c0|author)\}/.test(s.title) ? \`<div class="hint">Shows on the site as: \${esc(shown(s, s.title))}</div>\` : ""}</div>
      <div class="f"><label for="dek">Summary</label><textarea id="dek" rows="2">\${esc(s.dek)}</textarea><div class="hint">One or two sentences, shown under the headline on the tile and in the reader.</div></div>
      <div class="f"><label>Article</label><div class="rte"><div class="tb" id="tb">
          <button type="button" data-c="h" title="Subheading">H</button><button type="button" data-c="b" title="Bold (⌘B)"><b>B</b></button><button type="button" data-c="i" title="Italic (⌘I)"><i>I</i></button>
          <button type="button" data-c="a" title="Link (⌘K)">Link</button><i class="sep"></i>
          <button type="button" data-c="ul" title="Bulleted list">• List</button><button type="button" data-c="ol" title="Numbered list">1. List</button>
          <i class="sep"></i><button type="button" data-c="img" title="Add a photo where the cursor is">Photo</button><input type="file" id="pfile" accept="image/*" hidden></div>
          <div class="phbar" id="phbar" hidden><span id="phinfo"></span><button type="button" class="btn" onclick="editPhoto()">Edit text</button>
            <button type="button" class="btn" onclick="mainFromPhoto()">Use as main photo</button><button type="button" class="btn bad" onclick="ed.chain().focus().deleteSelection().run()">Remove</button></div>
          <div id="body"></div></div>
        <div class="hint">Subheadings, bold, italic, links, lists and photos. The site and the app set the style.</div></div>
    </div>
    <div>
      <div class="f photo"><label>Main photo</label>\${s.photo ? \`<img id="mainpic" src="\${esc(pic(s.photo))}" alt="">\` : '<div class="hint">A golf photo from the library is given to a new story.</div>'}
        \${s.photo_auto || !s.id ? '<div class="hint">Picked from the library. The first photo you add to the article takes its place.</div>' : ""}
        \${s.id ? \`<a class="btn" href="\${DOOR}/photo/\${s.id}" target="_blank" rel="noopener" onclick="watchPhoto()">Change photo ↗</a>\` : ""}
        \${s.photo_credit ? \`<div class="hint">Photo: \${esc(s.photo_credit)}</div>\` : ""}</div>
      <div class="f two"><div><label for="kind">Kind</label><select id="kind" \${kinds.length === 1 ? "disabled" : ""}>\${kinds.map((k) => \`<option \${k === s.kind ? "selected" : ""}>\${k}</option>\`).join("")}</select></div>
        <div><label for="topic">Topic</label><select id="topic">\${["league", "city", "mission"].map((k) => \`<option \${k === s.topic ? "selected" : ""}>\${k}</option>\`).join("")}</select></div></div>
      <div class="f" id="kindx"></div>
      <div class="f"><label>Cities</label><div class="cities" id="cities">\${ref.cities.map((c) => \`<button type="button" style="--c:\${c.color}" class="\${(s.cities || []).includes(c.id) ? "on" : ""}" data-id="\${c.id}" title="\${esc(c.name)}">\${c.short}</button>\`).join("")}</div></div>
      <div class="f"><label>Events</label><div class="events" id="events">\${ref.events.map((e) => \`<button type="button" class="\${(s.events || []).includes(e.id) ? "on" : ""}" data-id="\${e.id}" title="\${esc(e.start)} – \${esc(e.end)}">\${esc(e.name)}\${e.status === "live" ? "<small>live</small>" : ""}</button>\`).join("")}</div>
        <div class="hint">The events this story is about. None for a story that is not about an event.</div></div>
      <div class="f"><label for="padd">Players</label><input id="padd" list="plist" placeholder="Type a name to add"><datalist id="plist">\${ref.players.map((p) => \`<option value="\${esc(p.name)}">\${CITY[p.city] ? CITY[p.city].short : ""}</option>\`).join("")}</datalist>
        <div class="chips" id="pchips"></div></div>
      <div class="f"><label for="author">Byline</label><input id="author" value="\${esc(s.author)}" placeholder="Set from the city"></div>
      <div class="f"><label for="at">Story time</label><input id="at" type="datetime-local" value="\${esc((s.at || "").slice(0, 16))}"></div>
      \${s.id ? \`<div class="meta">\${s.id}\${s.slug ? " · /stories/" + esc(s.slug) : ""}<br>\${s.created_at ? "Made " + esc(when(s.created_at)) + (s.created_by ? " by " + esc(s.created_by === "desk" ? "Claude" : s.created_by) : "") : ""}
        \${s.updated_at ? "<br>Changed " + esc(when(s.updated_at)) + (s.updated_by ? " by " + esc(s.updated_by === "desk" ? "Claude" : s.updated_by) : "") : ""}</div>\` : ""}
    </div>
  </div>\`;
  paintKind(); paintPlayers();
  $("kind").onchange = () => { paintKind(); touch(); };
  $("events").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; b.classList.toggle("on"); touch(); };
  $("cities").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; b.classList.toggle("on"); touch(); };
  $("padd").onchange = () => {
    const name = $("padd").value.trim().toLowerCase(); const p = ref.players.find((x) => x.name.toLowerCase() === name);
    if (p && !cur.players.includes(p.id)) {
      cur.players = [...cur.players, p.id];
      const cb = document.querySelector(\`#cities [data-id="\${p.city}"]\`); if (cb) cb.classList.add("on");   // a player brings their city
      paintPlayers(); touch();
    }
    $("padd").value = "";
  };
  ["title", "dek", "topic", "author", "at"].forEach((id) => $(id).addEventListener("input", touch));
  mountBody(s.body || []);
  if (msg) say(msg[0], msg[1]);
}
/* the article field */
let ed = null;
function mountBody(blocks) {
  if (ed) ed.destroy();
  ed = TT.makeEditor($("body"), blocks, touch, SITE);
  const paint = () => document.querySelectorAll("#tb button").forEach((b) => b.classList.toggle("on",
    { h: ed.isActive("heading"), b: ed.isActive("bold"), i: ed.isActive("italic"), a: ed.isActive("link"), ul: ed.isActive("bulletList"), ol: ed.isActive("orderedList") }[b.dataset.c] || false));
  const photoBar = () => {
    const on = ed.isActive("image"); $("phbar").hidden = !on;
    if (on) { const a = ed.getAttributes("image"); $("phinfo").textContent = (a.title || "No caption") + " · " + (a.alt ? "described" : "NOT DESCRIBED"); }
  };
  ed.on("transaction", () => { paint(); photoBar(); }); paint();
  $("pfile").onchange = () => { const f = $("pfile").files[0]; $("pfile").value = ""; if (f) addPhoto(f); };
  $("tb").onmousedown = (e) => e.preventDefault();            // keep the text selected while a button is pressed
  $("tb").onclick = (e) => { const b = e.target.closest("button"); if (b) command(b.dataset.c); };
  ed.view.dom.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); command("a"); } });
}
function command(c) {
  const ch = ed.chain().focus();
  if (c === "h") ch.toggleHeading({ level: 2 }).run();
  else if (c === "b") ch.toggleBold().run();
  else if (c === "i") ch.toggleItalic().run();
  else if (c === "ul") ch.toggleBulletList().run();
  else if (c === "ol") ch.toggleOrderedList().run();
  else if (c === "img") $("pfile").click();
  else if (c === "a") {
    const was = ed.getAttributes("link").href || "";
    let url = prompt("Link address (https://…). Leave empty to remove the link.", was);
    if (url === null) return;
    url = url.trim();
    if (!url) { ch.extendMarkRange("link").unsetLink().run(); return; }
    if (/^www\./i.test(url)) url = "https://" + url;
    if (/^[^\s@:\/]+@[^\s@]+\.[^\s@]+$/.test(url)) url = "mailto:" + url;
    if (!TT.okUrl(url)) { alert("Links must start with https:// (or be an email address, or a /stories/ address on this site)."); return; }
    if (ed.state.selection.empty && !was) ch.insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
    else ch.extendMarkRange("link").setLink({ href: url }).run();
  }
}
/* photos in the article: shrunk in the browser, kept in the store, described and captioned, placed at the cursor */
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return { blob: await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.82)), w: cv.width, h: cv.height };
}
function askText(alt, caption) {
  let a = alt || "";
  do { a = prompt("Describe the photo for people who cannot see it (required):", a); if (a === null) return null; a = a.trim(); } while (!a);
  const c = prompt("Caption, with the credit if you have one (optional):", caption || "");
  return { alt: a, caption: (c || "").trim() };
}
async function addPhoto(file) {
  say("", "Uploading the photo…");
  try {
    const { blob, w, h } = await shrink(file);
    const r = await fetch(API + "upload", { method: "POST", headers: { "content-type": "image/jpeg", "x-photo-size": w + "x" + h }, body: blob });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "The upload failed.");
    const t = askText(); if (!t) { say("", "Photo not added."); return; }
    ed.chain().focus().setImage({ src: SITE + "/" + j.src + "#" + w + "x" + h, alt: t.alt, title: t.caption }).run();
    say("", "Photo added. Save to keep it.");
  } catch (e) { say("err", e.message || "That picture could not be read. Save it as a JPEG and try again."); }
}
function editPhoto() {
  const a = ed.getAttributes("image"); const t = askText(a.alt, a.title); if (!t) return;
  ed.chain().focus().updateAttributes("image", { alt: t.alt, title: t.caption }).run();
}
function mainFromPhoto() {
  const src = ed.getAttributes("image").src || ""; const i = src.indexOf("/content/photos/"); if (i < 0) return;
  const [path, size] = src.slice(i + 1).split("#"); const wh = (size || "").split("x");
  cur.photo = path; cur.photo_w = +wh[0] || 0; cur.photo_h = +wh[1] || 0; cur.photo_auto = false; cur.mainChanged = true;
  if ($("mainpic")) $("mainpic").src = pic(path);
  touch(); say("", "Main photo changed. Save to keep it.");
}
function paintKind() {
  const k = $("kind").value, s = cur;
  $("kindx").innerHTML = k === "video" ? \`<label for="dur">Video length</label><input id="dur" value="\${esc(s.dur || "")}" placeholder="2:14">\` :
    k === "gallery" ? \`<label for="count">Number of pictures</label><input id="count" type="number" min="2" value="\${esc(s.count || "")}">\` : "";
  ["dur", "count"].forEach((id) => $(id) && $(id).addEventListener("input", touch));
}
function paintPlayers() {
  $("pchips").innerHTML = (cur.players || []).map((id) => { const p = PLAYER[id] || { name: id }; const c = CITY[p.city];
    return \`<span class="chip" style="--c:\${c ? c.color : "var(--dim)"}"><i></i>\${esc(p.name)}<button type="button" title="Remove" onclick="dropPlayer('\${id}')">×</button></span>\`; }).join("");
}
function dropPlayer(id) { cur.players = cur.players.filter((x) => x !== id); paintPlayers(); touch(); }
/* a new story not saved yet goes away; a story with unsaved changes goes back to how it was saved */
function discard() {
  if (dirty && !confirm(cur.id ? "Throw away your unsaved changes?" : "Throw away this new story?")) return;
  dirty = false;
  if (cur.id) { show(cur.id, true); say("", "Changes thrown away."); }
  else { cur = null; renderList(); renderForm(); }
}
function touch() { dirty = true; if ($("discard")) $("discard").hidden = false; say("", cur.id ? "Unsaved changes" : "New story, not saved yet"); }
function say(kind, text) { const m = $("msg"); if (m) { m.className = "msg " + kind; m.textContent = text; } }
function fields() {
  return { title: $("title").value, dek: $("dek").value, body: ed ? TT.toMd(ed.getJSON()) : "", kind: $("kind").value, topic: $("topic").value,
    author: $("author").value, at: $("at").value, dur: $("dur") ? $("dur").value.trim() : undefined, count: $("count") ? $("count").value : undefined,
    cities: [...document.querySelectorAll("#cities button.on")].map((b) => b.dataset.id), players: cur.players || [],
    events: [...document.querySelectorAll("#events button.on")].map((b) => b.dataset.id),
    ...(cur.mainChanged ? { photo: cur.photo, photo_w: cur.photo_w, photo_h: cur.photo_h } : {}) };
}
async function run(fn, busy) {
  document.querySelectorAll(".bar .btn").forEach((b) => (b.disabled = true)); say("", busy);
  try { await fn(); }
  catch (e) {
    say("err", e.message);
    document.querySelectorAll(".bar .btn").forEach((b) => (b.disabled = false));
    if (e.conflict) { const m = $("msg"); m.innerHTML = esc(e.message) + ' <button class="btn" onclick="dirty=false;load(cur.id)">Reload</button>'; }
  }
}
function save() {
  const live = cur.id && statusOf(cur) === "published";
  run(async () => {
    const j = await call("save", { id: cur.id, stamp: cur.stamp, fields: fields() });
    dirty = false; await load(j.story.id); renderForm(["ok", live ? "Saved. The site shows the change on its next load." : "Draft saved."]);
  }, "Saving…");
}
function act(what) {
  if (dirty) { say("err", "Save your changes first."); return; }
  const q = what === "publish" ? "Publish this story? It is public on the site and in the app at once." : "Take this story off the site? It goes back to drafts.";
  if (!confirm(q)) return;
  run(async () => {
    await call(what, { id: cur.id, stamp: cur.stamp });
    await load(cur.id); renderForm(["ok", what === "publish" ? "Published. It is on the site now." : "Back in drafts, off the site."]);
  }, what === "publish" ? "Publishing…" : "Taking it off the site…");
}
function del() {
  if (!confirm("Delete this story for good?" + (statusOf(cur) === "published" ? " It also leaves the site at once." : "") + " It can be brought back from Deleted.")) return;
  run(async () => { await call("delete", { id: cur.id, stamp: cur.stamp }); cur = null; dirty = false; await load(); renderForm(); }, "Deleting…");
}
/* ------------------------------------------------ history */
function versionHtml(v) {
  const names = (ids, map) => (ids || []).map((x) => map[x] ? map[x].name : x).join(", ");
  const EV = Object.fromEntries(ref.events.map((e) => [e.id, e]));
  return \`\${v.photo ? \`<img src="\${esc(pic(v.photo))}" alt="">\` : ""}<span class="st \${statusOf(v)}">\${statusOf(v)}</span> <small style="color:var(--dim)">\${esc(v.kind || "")} · \${esc(when(v.at))}</small>
    <h2>\${esc(shown(v, v.title))}</h2><p class="dek">\${esc(v.dek || "")}</p>
    <div class="art">\${TT.fromMd(v.body || [])}</div>
    <div class="tags">\${[names(v.events, EV), names(v.cities, CITY), names(v.players, PLAYER)].filter(Boolean).join(" · ") || "No tags"}\${v.author ? " · by " + esc(v.author) : ""}</div>\`;
}
async function openHistory() {
  if (dirty) { say("err", "Save or undo your changes before opening the history."); return; }
  const s = cur;
  const box = document.createElement("div"); box.className = "hist"; box.id = "hist";
  box.innerHTML = \`<header><h1>History <span>· \${esc(shown(s, s.title))}</span></h1><button class="btn" onclick="closeHistory()">Close</button></header>
    <div class="vl" id="vl"><div class="empty">Loading…</div></div><div class="vp" id="vp"></div>\`;
  document.body.appendChild(box);
  const { versions } = await call("history?id=" + encodeURIComponent(s.id));
  const who = (x) => x ? " by " + esc(x) : "";
  $("vl").innerHTML = \`<button class="on" data-v="" onclick="pickVersion('')"><b>Now</b><small>\${esc(when(s.updated_at || s.published_at || s.created_at))}\${who(s.updated_by === "desk" ? "Claude" : s.updated_by)}</small></button>\` +
    (versions.map((v) => \`<button data-v="\${v.version}" onclick="pickVersion('\${v.version}')"><b>\${esc(when(v.saved_at || v.replaced_at))}\${who(v.saved_by)}</b>
      <small>\${esc(v.status)} · replaced \${esc(when(v.replaced_at))}\${who(v.replaced_by)}</small></button>\`).join("") ||
     '<div class="empty" style="padding:30px 14px">No earlier versions yet. From now on every change keeps the version it replaces.</div>');
  pickVersion("");
}
function closeHistory() { const h = $("hist"); if (h) h.remove(); }
async function pickVersion(v) {
  document.querySelectorAll("#vl button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  if (!v) { $("vp").innerHTML = '<p class="hint" style="margin-top:0">The story as it is now.</p>' + versionHtml(cur); return; }
  $("vp").innerHTML = '<div class="empty">Loading…</div>';
  const { story } = await call("version?id=" + encodeURIComponent(cur.id) + "&v=" + encodeURIComponent(v));
  const live = statusOf(cur) === "published";
  $("vp").innerHTML = \`<div class="bar" style="top:-18px"><span class="msg" id="hmsg">\${live ? "Restoring updates the site at once." : "Restoring changes the draft."}</span>
    <button class="btn pri" onclick="restore('\${v}')">Restore this version</button></div>\` + versionHtml(story);
}
async function restore(v) {
  if (!confirm("Make this version the story again?" + (statusOf(cur) === "published" ? " The site shows it at once." : "") + " The current version is kept in the history."))
    return;
  try {
    const j = await call("restore", { id: cur.id, version: v, stamp: cur.stamp });
    closeHistory(); await load(j.story.id); renderForm(["ok", "Restored. The version it replaced is in the history."]);
  } catch (e) { const m = $("hmsg"); if (m) { m.className = "msg err"; m.textContent = e.message; } }
}
async function showDeleted(id) {
  const d = deleted.find((x) => x.id === id); if (!d) return;
  const { story } = await call("version?id=" + encodeURIComponent(id) + "&v=" + encodeURIComponent(d.version));
  cur = { deletedId: id }; dirty = false; renderList();
  $("main").innerHTML = \`<div class="bar"><span class="msg" id="msg">Deleted \${esc(when(d.replaced_at))}\${d.replaced_by ? " by " + esc(d.replaced_by) : ""}. This is how it read.</span>
    <button class="btn pri" onclick="undelete('\${id}','\${d.version}')">Restore as a draft</button></div><div class="hist-inline">\${versionHtml(story)}</div>\`;
}
async function undelete(id, v) {
  try {
    const j = await call("restore", { id, version: v, deleted: true });
    deleted = deleted.filter((x) => x.id !== id);
    filter = "draft"; document.querySelectorAll("#seg button").forEach((x) => x.classList.toggle("on", x.dataset.s === "draft"));
    await load(j.story.id); renderForm(["ok", "Back as a draft."]);
  } catch (e) { say("err", e.message); }
}
function watchPhoto() { addEventListener("focus", () => { if (cur && cur.id && !dirty) load(cur.id); }, { once: true }); }
$("q").oninput = renderList;
$("seg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.s;
  document.querySelectorAll("#seg button").forEach((x) => x.classList.toggle("on", x === b));
  if (filter === "deleted") { $("list").innerHTML = '<div class="empty">Loading…</div>'; call("deleted").then((j) => { deleted = j.deleted; renderList(); }); }
  else renderList(); };
$("new").onclick = () => { if (dirty && !confirm("Leave this story without saving your changes?")) return; cur = blank(); dirty = false; renderList(); renderForm(); $("title").focus(); };
addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
(async () => {
  try {
    ref = await call("ref");
    CITY = Object.fromEntries(ref.cities.map((c) => [c.id, c])); PLAYER = Object.fromEntries(ref.players.map((p) => [p.id, p]));
    await load();
  } catch (e) { $("main").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; }
})();
</script></body></html>`;
}
