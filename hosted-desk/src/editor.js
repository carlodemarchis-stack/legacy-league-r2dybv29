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
.tiptap p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:var(--dim);float:left;height:0;pointer-events:none}
#title{font-size:20px;font-weight:700}
.hint{font-size:11px;color:var(--dim);margin-top:4px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cities{display:flex;flex-wrap:wrap;gap:5px}
.cities button{border:1px solid color-mix(in srgb,var(--c) 50%,transparent);color:var(--c);background:none;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:700;letter-spacing:.06em;cursor:pointer}
.cities button.on{background:var(--c);color:#fff;border-color:var(--c)}
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
      <div class="seg" id="seg"><button data-s="all" class="on">All</button><button data-s="draft">Drafts</button><button data-s="published">Published</button></div>
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
function renderList() {
  const q = $("q").value.trim().toLowerCase();
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
  cur = stories.find((s) => s.id === id) || null;
  dirty = false;
  renderList(); renderForm(); if (!quiet) $("main").scrollTop = 0;
}
function blank() {
  return { id: null, status: "draft", kind: "article", topic: "league", title: "", dek: "", body: [], cities: [], players: [], author: "" };
}
function renderForm(msg) {
  const s = cur; if (!s) { $("main").innerHTML = '<div class="empty">Pick a story on the left, or make a new one.</div>'; return; }
  const st = s.id ? statusOf(s) : "new";
  const kinds = s.kind === "result" ? ["result"] : ["article", "video", "gallery", "quote"];
  $("main").innerHTML = \`
  <div class="bar"><span class="msg" id="msg">\${s.id ? \`<span class="st \${st}">\${st}</span>\` : "New story, not saved yet"}</span>
    \${s.url ? \`<a class="btn" href="\${esc(s.url)}" target="_blank" rel="noopener">View on site ↗</a>\` : ""}
    \${s.id ? \`<button class="btn bad" onclick="del()">Delete</button>\` : ""}
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
          <button type="button" data-c="ul" title="Bulleted list">• List</button><button type="button" data-c="ol" title="Numbered list">1. List</button></div>
          <div id="body"></div></div>
        <div class="hint">Subheadings, bold, italic, links and lists. The site and the app set the style.</div></div>
    </div>
    <div>
      <div class="f photo"><label>Photo</label>\${s.photo ? \`<img src="\${esc(pic(s.photo))}" alt="">\` : '<div class="hint">A golf photo from the library is given to a new story.</div>'}
        \${s.id ? \`<a class="btn" href="\${DOOR}/photo/\${s.id}" target="_blank" rel="noopener" onclick="watchPhoto()">Change photo ↗</a>\` : ""}
        \${s.photo_credit ? \`<div class="hint">Photo: \${esc(s.photo_credit)}</div>\` : ""}</div>
      <div class="f two"><div><label for="kind">Kind</label><select id="kind" \${kinds.length === 1 ? "disabled" : ""}>\${kinds.map((k) => \`<option \${k === s.kind ? "selected" : ""}>\${k}</option>\`).join("")}</select></div>
        <div><label for="topic">Topic</label><select id="topic">\${["league", "city", "mission"].map((k) => \`<option \${k === s.topic ? "selected" : ""}>\${k}</option>\`).join("")}</select></div></div>
      <div class="f" id="kindx"></div>
      <div class="f"><label>Cities</label><div class="cities" id="cities">\${ref.cities.map((c) => \`<button type="button" style="--c:\${c.color}" class="\${(s.cities || []).includes(c.id) ? "on" : ""}" data-id="\${c.id}" title="\${esc(c.name)}">\${c.short}</button>\`).join("")}</div></div>
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
  ed = TT.makeEditor($("body"), blocks, touch);
  const paint = () => document.querySelectorAll("#tb button").forEach((b) => b.classList.toggle("on",
    { h: ed.isActive("heading"), b: ed.isActive("bold"), i: ed.isActive("italic"), a: ed.isActive("link"), ul: ed.isActive("bulletList"), ol: ed.isActive("orderedList") }[b.dataset.c] || false));
  ed.on("transaction", paint); paint();
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
function touch() { dirty = true; say("", cur.id ? "Unsaved changes" : "New story, not saved yet"); }
function say(kind, text) { const m = $("msg"); if (m) { m.className = "msg " + kind; m.textContent = text; } }
function fields() {
  return { title: $("title").value, dek: $("dek").value, body: ed ? TT.toMd(ed.getJSON()) : "", kind: $("kind").value, topic: $("topic").value,
    author: $("author").value, at: $("at").value, dur: $("dur") ? $("dur").value.trim() : undefined, count: $("count") ? $("count").value : undefined,
    cities: [...document.querySelectorAll("#cities button.on")].map((b) => b.dataset.id), players: cur.players || [] };
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
  if (!confirm("Delete this story for good?" + (statusOf(cur) === "published" ? " It also leaves the site at once." : "") + " This cannot be undone.")) return;
  run(async () => { await call("delete", { id: cur.id, stamp: cur.stamp }); cur = null; dirty = false; await load(); renderForm(); }, "Deleting…");
}
function watchPhoto() { addEventListener("focus", () => { if (cur && cur.id && !dirty) load(cur.id); }, { once: true }); }
$("q").oninput = renderList;
$("seg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.s;
  document.querySelectorAll("#seg button").forEach((x) => x.classList.toggle("on", x === b)); renderList(); };
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
