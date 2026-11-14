// The Content Studio: one page, a list of every story on the left and the open story on the right.
// It talks to the Desk's own small API (/<key>/editor/api/…), next to the Claude connector.

/* The Content Studio's version, shown in its top bar. Raise it with every change editors can see:
   0.1 stories editor · 0.2 formatting · 0.3 events, history, cancel · 0.4 photos in the article · 0.5 Draft with AI ·
   0.6 photo menu on the photo, the name Content Studio and this number · 0.7 your name on changes, AI usage log ·
   0.8 paste or drop photos into the article · 0.9 the Studio's own dialogs instead of the browser's ·
   0.10 the main photo changed in place, with its credit · 0.10.1 its own icon in the browser tab ·
   0.11 the photo library: every photo, searchable, uploaded on its own, chosen wherever a photo goes ·
   0.12 AI-suggested photo descriptions, accepted or edited by the editor ·
   0.13 top menu (Stories, Photos, Videos, Shorts), photos picked in a dialog ·
   0.14 a photo's own data (XMP, EXIF) fills its description, caption, credit and date · 0.14.1 descriptions on Haiku */
export const STUDIO_VERSION = "0.29.1";                       // 0.14.2: a licence in a photo's data is not taken for its credit · 0.15: all of a photo's data kept and shown · 0.15.1: photo dialogs side by side on a wide screen · 0.16: photos tagged with events, cities and players · 0.16.1: the file's own description proposed for description and caption, Windows author as credit · 0.16.2: a reload stays where you were · 0.17: unsaved work kept in the browser and offered back after a reload · 0.18: a weekly AI allowance per editor · 0.18.1: and one for the whole league · 0.19: sign-in with Cloudflare Access (your email instead of a typed name) · 0.20: gallery photos chosen and ordered here, a new story's time is now, Desk times in your time zone · 0.20.1: a new story starts at the league's time (the demo clock while there is one) · 0.20.2: the list puts the stories last worked on first · 0.21: a gallery's photos across the top of the story, the cover on the right · 0.22: roles (super admin, coder, producer, editor), People and Structure pages, kinds and topics from the structure, EXIF/XMP/GPS tags on library photos · 0.23: People under an Admin menu; the structure is changed in Claude Code only · 0.23.1: ★ makes a gallery photo the cover · 0.24: the cover is any gallery photo, the order stays · 0.25: embeds (YouTube, Vimeo, X, TikTok, Instagram, Spotify) in the article · 0.25.1: Save only once something has changed · 0.26: photos in the size they are shown at (the site makes them) · 0.27: Preview (desktop, tablet, phone; story or feed) and scheduled publishing · 0.28: leaderboards in the article (frozen or live) · 0.28.1: links to a player, city or event page from the Link dialog · 0.29: Alerts: push alerts to the app (compose, target followers, send or schedule, no duplicates, daily cap, history) and automatic alerts from the scoring feed · 0.29.1: quotes in the article (“ Quote), shown by the site as pull quotes

/* The Studio's tab icon: the site's ring and green dot, inverted onto gold, so the two tabs are told apart at a glance. */
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#d9ad4e"/>' +
  '<circle cx="16" cy="16" r="9" fill="none" stroke="#080c0e" stroke-width="2.8"/><circle cx="16" cy="16" r="3.2" fill="#1f7a4c"/></svg>';
export const STUDIO_ICON = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(ICON_SVG)}">`;

export function editorPage(site) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Content Studio · Legacy League Golf</title>${STUDIO_ICON}<meta name="robots" content="noindex">
<style>
:root{--bg:#0b0f11;--panel:#141a1d;--line:#26302f;--ink:#e9eeec;--dim:#93a09c;--acc:#d9ad4e;--on-acc:#1a1406;--bad:#e5675a;--ok:#5fbf7a;
  color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
@media (prefers-color-scheme:light){:root{--bg:#eef1ef;--panel:#fff;--line:#d9dfdc;--ink:#14191b;--dim:#5d6965;color-scheme:light}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-size:14px}
button,input,select,textarea{font:inherit;color:inherit}
header{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line)}
header h1{margin:0;font-size:12px;letter-spacing:.2em;text-transform:uppercase}header h1 span{color:var(--dim);font-weight:400}
header a{color:var(--dim);font-size:12px}
header .snav{display:flex;gap:2px;margin-left:18px;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px}
header .snav button{border:0;background:none;border-radius:999px;padding:5px 14px;font-size:12px;letter-spacing:.04em;cursor:pointer;color:var(--dim)}
header .snav button:hover{color:var(--ink)}header .snav button.on{background:var(--acc);color:var(--on-acc);font-weight:600}
header .hright{margin-left:auto;display:flex;align-items:center;gap:8px}
.usage table{width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0 18px}
.usage th,.usage td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}.usage th{color:var(--dim);font-weight:500;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.usage td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.usage h3{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:14px 0 4px}
.usage .big{font-size:26px;font-weight:700}
header .ver{font-size:10.5px;letter-spacing:.06em;color:var(--dim);border:1px solid var(--line);border-radius:999px;padding:2px 8px;font-variant-numeric:tabular-nums}
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
.tiptap figure.ph{margin:0 0 1em;cursor:pointer;position:relative}
.tiptap blockquote{margin:16px 0;padding:6px 0 6px 18px;border-left:3px solid var(--acc);font-size:1.12em;font-style:italic}
.tiptap blockquote p{margin:4px 0}
.tiptap .brd{position:relative;margin:14px 0;padding:12px 14px;border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:12px;background:var(--panel);cursor:default}
.tiptap .brd.ProseMirror-selectednode{outline:2px solid var(--acc)}
.tiptap .brd small{display:block;color:var(--dim);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.tiptap .brd b{display:block;font-size:14.5px;margin-top:2px}.tiptap .brd .as{display:block;color:var(--dim);font-size:12px;margin-bottom:6px}
.tiptap .brd .rows div{display:grid;grid-template-columns:30px minmax(0,1fr) 50px 64px;gap:6px;font-size:13px;padding:3px 0;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
.tiptap .brd .rows div span:nth-child(n+3){text-align:right}.tiptap .brd .rows i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:7px}
.tiptap .brd .rows .more{display:block;color:var(--dim);font-size:12px;border-top:1px solid var(--line);padding-top:5px}
.tiptap .brd .ph-more{top:10px}
.tiptap .emb{position:relative;display:flex;gap:12px;align-items:center;margin:14px 0;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--panel);cursor:default}
.tiptap .emb.ProseMirror-selectednode{outline:2px solid var(--acc)}
.tiptap .emb-pic{flex:none;width:120px;aspect-ratio:16/9;border-radius:8px;background:#000 center/cover no-repeat;display:grid;place-items:center;color:#fff;font-size:20px}
.tiptap .emb-txt{min-width:0;display:flex;flex-direction:column;gap:2px;padding-right:40px}
.tiptap .emb-txt small{color:var(--dim);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.tiptap .emb-txt b{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tiptap .emb-txt span{color:var(--dim);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tiptap .emb .ph-more{top:50%;transform:translateY(-50%)}
.ph-more{position:absolute;top:8px;right:8px;width:34px;height:28px;border-radius:8px;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:18px;line-height:1;cursor:pointer;backdrop-filter:blur(6px)}
.ph-more:hover{background:rgba(0,0,0,.8)}
.tiptap figure.ph.nodesc .ph-more{box-shadow:0 0 0 2px var(--bad)}
.pmenu{position:fixed;z-index:30;min-width:200px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:5px;box-shadow:0 12px 40px rgba(0,0,0,.4)}
.pmenu button{display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-radius:6px;background:none;cursor:pointer;font-size:13px}
.pmenu button:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}.pmenu button.bad{color:var(--bad)}
.pmenu .note{font-size:11px;color:var(--bad);padding:4px 10px 6px}.tiptap figure.ph img{display:block;width:100%;border-radius:8px}
.tiptap figure.ph figcaption{font-size:12px;color:var(--dim);margin-top:5px}
.tiptap figure.ph.ProseMirror-selectednode img{outline:3px solid var(--acc);outline-offset:2px}
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
/* Draft with AI: a chat panel over the right of the page */
.ai{position:fixed;top:0;right:0;bottom:0;width:min(520px,100vw);background:var(--bg);border-left:1px solid var(--line);z-index:20;
  display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(0,0,0,.35)}
.ai>header .model{font-size:11px;color:var(--dim);letter-spacing:.04em;text-transform:none}
#aimsgs{flex:1;overflow-y:auto;padding:16px}
.am{margin:0 0 14px;line-height:1.5;font-size:13.5px;white-space:pre-wrap}
.am.u{background:var(--panel);border:1px solid var(--line);border-radius:12px 12px 4px 12px;padding:9px 12px;margin-left:40px}
.am.a{padding:2px 2px}.am small{display:block;color:var(--dim);font-size:11px;margin-top:6px}
.am.wait{color:var(--dim)}.am.err{color:var(--bad)}
.prop{white-space:normal;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-top:10px;background:var(--panel)}
.prop h3{margin:0 0 6px;font-size:16px}.prop .dek{color:var(--dim);margin:0 0 8px}
.prop .art{font-size:13px;line-height:1.55;max-height:260px;overflow-y:auto;border-top:1px solid var(--line);padding-top:8px}.prop .art p{margin:0 0 .6em}
.prop .tags{font-size:11.5px;color:var(--dim);margin:8px 0}.prop .warn{font-size:12px;color:var(--acc);margin:6px 0}
.aiform{border-top:1px solid var(--line);padding:12px;display:flex;flex-direction:column;gap:8px}
.aiform textarea{width:100%;min-height:76px;padding:9px 11px;border-radius:8px;border:1px solid var(--line);background:var(--panel);resize:vertical;line-height:1.45}
.aiform .row2{display:flex;align-items:center;gap:8px}.aiform .row2 .hint{flex:1;margin:0}
.hist-inline{max-width:640px}.hist-inline h2{font-size:22px}.hist-inline .dek{color:var(--dim)}.hist-inline .art{border-top:1px solid var(--line);padding-top:12px;line-height:1.6}
.hist-inline img{width:100%;max-height:280px;object-fit:cover;border-radius:10px;margin-bottom:12px}.hist-inline .tags{font-size:12px;color:var(--dim)}
.hist .vp .tags{font-size:12px;color:var(--dim);margin:12px 0}
@media(max-width:860px){.hist{grid-template-columns:1fr;grid-template-rows:auto 38dvh minmax(0,1fr)}.hist .vl{border-right:0;border-bottom:1px solid var(--line)}}
/* the Studio's own dialog: one design for questions, confirmations and the photo's description */
.mback{position:fixed;inset:0;z-index:50;background:rgba(5,8,10,.55);backdrop-filter:blur(4px);display:grid;place-items:center;padding:16px;animation:mfade .12s ease-out}
@keyframes mfade{from{opacity:0}to{opacity:1}}
.mbox{width:min(520px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;background:var(--panel);border:1px solid var(--line);border-radius:16px;
  box-shadow:0 30px 80px rgba(0,0,0,.45);padding:22px 22px 18px;animation:mrise .16s ease-out}
@keyframes mrise{from{transform:translateY(8px);opacity:.6}to{transform:none;opacity:1}}
.mbox h2{margin:0 0 6px;font-size:17px;letter-spacing:-.01em}
.mbox .mtext{margin:0 0 14px;color:var(--dim);line-height:1.5;font-size:13.5px}
.mbox .mimg{display:block;width:100%;max-height:260px;object-fit:contain;background:#000;border-radius:10px;margin:4px 0 16px}
.mbox .mf{margin-bottom:14px}.mbox .mf label{display:flex;justify-content:space-between;align-items:baseline}
.mbox .mf label em{font-style:normal;text-transform:none;letter-spacing:0;font-size:11px;color:var(--dim)}
.mbox .mf input,.mbox .mf textarea{width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--line);background:var(--bg);line-height:1.45}
.mbox .mf input:focus,.mbox .mf textarea:focus{outline:none;border-color:color-mix(in srgb,var(--acc) 70%,var(--line))}
.mbox .mf.bad input,.mbox .mf.bad textarea{border-color:var(--bad)}
.mbox .mf .hint{margin-top:5px}.mbox .mf .merr{font-size:12px;color:var(--bad);margin-top:5px}
.mbox .mbtns{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:8px}
.mbox .mbtns .btn{padding:8px 16px;font-size:13px}.mbox .mbtns .left{margin-right:auto}
/* on a wide, landscape screen a dialog with a photo sits side by side: the photo and its data on the left,
   what is edited on the right, each scrolling on its own, so the whole dialog fits the screen */
@media (min-width:900px) and (orientation:landscape){
  .mbox.split{width:min(1120px,100%);height:min(calc(100dvh - 32px),780px);display:flex;flex-direction:column;overflow:hidden}
  .mbox.split .msplit{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,1fr);gap:26px}
  .mbox.split .mleft,.mbox.split .mright{min-height:0;overflow-y:auto;padding-right:4px}
  .mbox.split .mright{display:flex;flex-direction:column}
  .mbox.split .mright .mbtns{margin-top:auto;padding-top:12px;position:sticky;bottom:0;background:var(--panel)}
  .mbox.split .mimg{max-height:min(52dvh,460px);margin-top:0}
}
.btn.danger{background:var(--bad);border-color:var(--bad);color:#fff;font-weight:600}
/* the photo library: a page of its own over the Studio, also used to choose a photo */
.lib{position:fixed;left:0;right:0;bottom:0;top:49px;z-index:25;background:var(--bg);display:flex;flex-direction:column}
.libpick .mbox.libmodal{width:min(1040px,100%);height:min(86dvh,820px);max-height:none;padding:0;display:flex;flex-direction:column;overflow:hidden}
.libpick .libbar{padding:14px 18px}.libpick .grid{padding:14px 18px 24px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.soon{flex:1;display:grid;place-items:center;text-align:center;color:var(--dim);padding:40px}
.pcard{position:relative}
.pcard .mtags{position:absolute;top:8px;left:8px;display:flex;gap:4px;pointer-events:none;z-index:1}
.pcard .mtags i{font-style:normal;font-weight:700;font-size:9.5px;line-height:1;letter-spacing:.07em;padding:4px 6px;border-radius:5px;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35)}
.mtags .exif{background:#b8741a}.mtags .xmp{background:#2f68c8}.mtags .gps{background:#2b8f55}
.pv{position:fixed;inset:0;z-index:60;background:#05080a;display:flex;flex-direction:column}
.pv header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--bg)}
.pv header h1{margin:0 8px 0 0;font-size:12px;letter-spacing:.2em;text-transform:uppercase}
.pv .seg2{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px;gap:2px}
.pv .seg2 button{border:0;background:none;color:var(--dim);font:inherit;font-size:12.5px;padding:6px 12px;border-radius:999px;cursor:pointer}
.pv .seg2 button.on{background:var(--acc);color:var(--on-acc);font-weight:600}
.pv .note{color:var(--dim);font-size:12px;margin-left:auto}
.pv .stage{flex:1;display:grid;place-items:center;overflow:hidden;padding:18px}
.pv .dev{position:relative;background:#000;border-radius:14px;box-shadow:0 0 0 1px #2a3438,0 30px 80px rgba(0,0,0,.6);overflow:hidden}
.pv .dev.phone{border-radius:44px;box-shadow:0 0 0 10px #1b2124,0 0 0 11px #333,0 30px 80px rgba(0,0,0,.6)}
.pv .dev.tablet{border-radius:28px;box-shadow:0 0 0 12px #1b2124,0 0 0 13px #333,0 30px 80px rgba(0,0,0,.6)}
.pv .dev iframe{border:0;display:block;transform-origin:0 0;background:#0b0f11}
.sched{font-size:12.5px;color:var(--acc);align-self:center}
.adm{flex:1;overflow-y:auto;padding:18px 20px 60px}.adm h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:22px 0 6px}
.adm p.hint{max-width:860px}.adm table{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0 10px}
.adm th{text-align:left;font-weight:500;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);padding:6px;border-bottom:1px solid var(--line)}
.adm td{padding:5px 6px;border-bottom:1px solid var(--line);vertical-align:middle}
.adm input[type=text],.adm input[type=email],.adm select{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px}
.adm input[readonly]{opacity:.65}.adm td.n{text-align:right;white-space:nowrap;color:var(--dim)}.adm td.act{white-space:nowrap;text-align:right}
.adm td.act button{background:none;border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:4px 8px;cursor:pointer;font:inherit;font-size:12px;margin-left:3px}
.adm td.act button:disabled{opacity:.3;cursor:default}.adm .roles label{display:inline-flex;gap:4px;align-items:center;margin-right:10px;white-space:nowrap;font-size:12px}
.adm .msg{margin-left:6px}
.alform{display:grid;grid-template-columns:1fr 1fr;gap:26px;max-width:1080px}.alcol{display:flex;flex-direction:column;gap:6px}
.alcol>label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin-top:8px;display:flex;justify-content:space-between}.alcol>label em{font-style:normal;text-transform:none;letter-spacing:0}
.alform textarea,.alform input[type=datetime-local]{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px;resize:vertical}
.alrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px}.alrow select{flex:1;min-width:180px}.alseg{align-self:flex-start;flex:none}
.alform .events{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.alform .events small{opacity:.7;margin-left:3px}
.alphone{margin-top:12px;padding:14px;border-radius:14px;background:linear-gradient(135deg,#2a3a44,#141a1d)}
.alnote{display:flex;gap:10px;align-items:flex-start;background:rgba(240,240,240,.88);color:#111;border-radius:13px;padding:10px 12px;font-size:13px;line-height:1.3}
.alnote i{flex:none;width:30px;height:30px;border-radius:7px;background:#0b0f14;color:#d9ad4e;display:grid;place-items:center;font:700 11px/1 -apple-system,sans-serif;font-style:normal}
.alnote div{flex:1;min-width:0}.alnote b{display:block}.alnote span{display:block;overflow-wrap:anywhere}.alnote small{color:#666;font-size:11px}
.alauto{display:flex;flex-direction:column;gap:6px;font-size:13px}.alreplay{margin:10px 0 4px}.alreplay small{color:var(--dim);margin-right:8px}
@media(max-width:860px){.alform{grid-template-columns:1fr}}
.soon h2{color:var(--ink);font-size:20px;margin:0 0 8px}.soon p{max-width:520px;line-height:1.55;margin:0 auto}
:is(.lib,.libmodal) .libbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--line)}
:is(.lib,.libmodal) .libbar h1{margin:0 8px 0 0;font-size:12px;letter-spacing:.2em;text-transform:uppercase}
:is(.lib,.libmodal) .libbar input[type=search]{flex:1 1 240px;max-width:420px;padding:8px 11px;border-radius:8px;border:1px solid var(--line);background:var(--panel)}
:is(.lib,.libmodal) .libbar .count{color:var(--dim);font-size:12px;margin-left:auto}
:is(.lib,.libmodal) .grid{flex:1;min-height:0;grid-auto-rows:max-content;overflow-y:auto;padding:18px 20px 60px;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;align-content:start}
.lib.drop .grid{outline:3px dashed var(--acc);outline-offset:-10px}
.pcard{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel);cursor:pointer;text-align:left;padding:0;display:flex;flex-direction:column}
.pcard:hover{border-color:color-mix(in srgb,var(--acc) 60%,var(--line))}
.pcard img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#000;flex:none}
.pcard span{padding:8px 10px 10px;display:block}.pcard b{display:block;font-size:12.5px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pcard b.none{color:var(--bad);font-weight:500}.pcard small{display:block;color:var(--dim);font-size:11px;margin-top:4px}
.pcard i.sug{display:block;font-style:normal;font-size:12px;line-height:1.35;color:var(--ink);opacity:.85}
.pcard i.sug::before{content:"✦ ";color:var(--acc)}
.pcard .pact{display:flex;gap:6px;margin-top:7px}.pcard .pact .btn{padding:3px 9px;font-size:11px}
.mmeta{margin:-4px 0 16px;font-size:12px}
.mmeta table{width:100%;border-collapse:collapse}.mmeta td{padding:4px 0;border-bottom:1px solid var(--line);vertical-align:top}
.mmeta td:first-child{color:var(--dim);width:38%;padding-right:10px}.mmeta td:last-child{word-break:break-word}
.mmeta details{margin-top:10px}.mmeta summary{cursor:pointer;color:var(--dim);font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.mmeta details table{margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:11px}
.mused{font-size:12px;color:var(--dim);margin:-4px 0 14px;line-height:1.5}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:3px 4px 3px 10px;font-size:12px}
.chip i{width:8px;height:8px;border-radius:50%;background:var(--c)}.chip button{border:0;background:none;cursor:pointer;color:var(--dim);font-size:14px;line-height:1}
.photo img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px;display:block;background:#000}
.photo .btn{margin-top:8px}
.mainwrap{position:relative}
.gal{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 6px}
.gal figure{margin:0;position:relative;width:128px;height:128px;flex:none;border-radius:10px;overflow:hidden;background:var(--line)}
.gal .gadd{width:128px;height:128px;flex:none;border:1.5px dashed var(--line);border-radius:10px;background:none;color:var(--dim);font:300 44px/1 inherit;cursor:pointer}
.gal .gadd:hover{border-color:var(--acc);color:var(--acc)}
.coverph{display:grid;place-items:center;aspect-ratio:16/10;border:1px dashed var(--line);border-radius:10px;color:var(--dim);font-size:12px;text-align:center;padding:16px}
#coverwrap img{display:block;width:100%;border-radius:10px}
.gal img{width:100%;height:100%;object-fit:cover;display:block}
.gal .gb{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;background:linear-gradient(transparent,rgba(0,0,0,.75));padding:10px 2px 2px}
.gal .gb button{background:none;border:0;color:#fff;cursor:pointer;font:inherit;font-size:13px;padding:2px 7px}.gal .gb button:disabled{opacity:.3;cursor:default}
.gal figure.cover::after{content:"Cover";position:absolute;top:5px;left:5px;font-size:10px;font-weight:700;letter-spacing:.06em;background:var(--acc);color:var(--on-acc);padding:1px 7px;border-radius:999px}

.mainwrap .mainph{display:grid;place-items:center;aspect-ratio:16/10;border:1px dashed var(--line);border-radius:10px;color:var(--dim);font-size:12px;text-align:center;padding:16px}
.mainwrap .ph-more.lone{position:static;margin-top:8px;width:auto;padding:0 12px;background:var(--panel);color:var(--ink);border:1px solid var(--line);font-size:12px}
.photo.drop img{outline:3px dashed var(--acc);outline-offset:3px}
.meta{font-size:11px;color:var(--dim);line-height:1.7;margin-top:14px}
@media(max-width:860px){.wrap{grid-template-columns:1fr;height:auto}aside{max-height:45dvh;border-right:0;border-bottom:1px solid var(--line)}.form{grid-template-columns:1fr}main{padding:16px}}
</style></head><body>
<header><h1>Legacy League Golf <span>· Content Studio</span></h1><span class="ver" title="Content Studio version">v${STUDIO_VERSION}</span>
  <nav class="snav" id="snav"><button data-v="stories" class="on">Stories</button><button data-v="photos">Photos</button><button data-v="videos">Videos</button><button data-v="shorts">Shorts</button><button data-v="alerts">Alerts</button><button data-v="people" hidden>People</button></nav>
  <span class="hright"><button class="btn" id="adminbtn" onclick="adminMenu(this)" hidden title="Administration">⚙︎ Admin</button><button class="btn" id="usagebtn" onclick="openUsage()">AI usage</button><button class="btn" id="whobtn" onclick="askName()" title="Your name, on the changes you make and the AI you use"></button>
  <a href="${site}" target="_blank" rel="noopener">Open the site ↗</a></span></header>
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
/* a store photo at the width it is shown at (320, 640, 1024 or 1600), made once by the site's worker */
const picw = (p, w) => { const u = pic(p); return /\\/content\\/photos\\//.test(u) && !/[?#]/.test(u) ? u + "?w=" + w : u; };
const statusOf = (s) => s.status || "published";
// a headline can stand for names, as the site shows it: {p0} the first tagged player, {c0} the first city
const shown = (s, t) => String(t || "").replace(/\{p0\}/g, PLAYER[(s.players || [])[0]] ? PLAYER[s.players[0]].name : "")
  .replace(/\{c0\}/g, CITY[(s.cities || [])[0]] ? CITY[s.cities[0]].name : "the league").replace(/\{author\}/g, "Legacy League Golf");
// the Desk's own stamps (made, changed, uploaded, AI requests) are UTC to the second without a zone; a story's time is as typed
const when = (iso) => iso ? new Date(/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d$/.test(iso) ? iso + "Z" : iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
let LEAGUE_NOW = null;                                             // the demo clock, from the Desk; the real time when there is none
const localNow = () => { if (LEAGUE_NOW) return LEAGUE_NOW.slice(0, 16); const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
/* ------------------------------------------------ the Studio's dialog
   modal({ title, text, img, fields, ok, cancel, danger, extra, validate }) resolves to the fields' values (or true when
   there are none), to { action } for the extra button, or to null when the editor cancels. Enter confirms, Esc cancels. */
function modal({ title, text = "", img = "", html = "", fields = [], custom = null, ok = "OK", cancel = "Cancel", danger = false, extra = null, validate = null }) {
  return new Promise((resolve) => {
    const back = document.createElement("div"); back.className = "mback";
    back.innerHTML = \`<div class="mbox\${img ? " split" : ""}" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">\${esc(title)}</h2>
      \${img ? \`<div class="msplit"><div class="mleft"><img class="mimg" src="\${esc(img)}" alt="">\${html}</div><div class="mright">\` : ""}
      \${text ? \`<p class="mtext">\${esc(text)}</p>\` : ""}\${img ? "" : html}
      \${fields.map((f) => \`<div class="mf" data-f="\${f.id}"><label for="mf-\${f.id}">\${esc(f.label)}\${f.required ? "" : "<em>optional</em>"}</label>
        \${f.type === "select" ? \`<select id="mf-\${f.id}">\${(f.options || []).map(([v, l]) => \`<option value="\${esc(v)}" \${v === f.value ? "selected" : ""}>\${esc(l)}</option>\`).join("")}</select>\`
          : f.type === "textarea" ? \`<textarea id="mf-\${f.id}" rows="\${f.rows || 2}" placeholder="\${esc(f.placeholder || "")}">\${esc(f.value || "")}</textarea>\`
          : \`<input id="mf-\${f.id}" type="\${f.type || "text"}" value="\${esc(f.value || "")}" placeholder="\${esc(f.placeholder || "")}" autocomplete="off">\`}
        \${f.hint ? \`<div class="hint">\${esc(f.hint)}</div>\` : ""}<div class="merr" hidden></div></div>\`).join("")}
      \${custom ? custom.html : ""}
      <div class="mbtns">\${extra ? \`<button type="button" class="btn left\${extra.danger ? " bad" : ""}" data-b="extra">\${esc(extra.label)}</button>\` : ""}
        <button type="button" class="btn" data-b="cancel">\${esc(cancel)}</button>
        <button type="button" class="btn \${danger ? "danger" : "pri"}" data-b="ok">\${esc(ok)}</button></div>\${img ? "</div></div>" : ""}</div>\`;
    document.body.appendChild(back);
    if (custom && custom.wire) custom.wire(back);
    const before = document.activeElement;
    const done = (v) => { back.parentNode && back.parentNode.removeChild(back); removeEventListener("keydown", keys, true); if (before && before.focus) before.focus(); resolve(v); };
    const values = () => Object.fromEntries(fields.map((f) => [f.id, back.querySelector(\`#mf-\${f.id}\`).value.trim()]));
    const showErr = (id, msg) => { const box = back.querySelector(\`[data-f="\${id}"]\`); box.classList.add("bad"); const e = box.querySelector(".merr"); e.textContent = msg; e.hidden = false; box.querySelector("input,textarea,select").focus(); };
    const confirmIt = () => {
      back.querySelectorAll(".mf[data-f]").forEach((b) => { b.classList.remove("bad"); b.querySelector(".merr").hidden = true; });
      const v = values();
      const missing = fields.find((f) => f.required && !v[f.id]);
      if (missing) return showErr(missing.id, missing.requiredText || "This is needed.");
      if (validate) { const r = validate(v); if (r) return showErr(r.field, r.message); }
      done(fields.length || custom ? { ...v, ...(custom ? custom.read(back) : {}) } : true);
    };
    const keys = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); }
      else if (e.key === "Enter" && !(e.target.tagName === "TEXTAREA" && !(e.metaKey || e.ctrlKey)) && e.target.dataset.b !== "cancel" && e.target.dataset.b !== "extra") { e.preventDefault(); confirmIt(); }
    };
    addEventListener("keydown", keys, true);
    back.addEventListener("mousedown", (e) => { if (e.target === back) done(null); });
    back.querySelector('[data-b="ok"]').onclick = confirmIt;
    back.querySelector('[data-b="cancel"]').onclick = () => done(null);
    if (extra) back.querySelector('[data-b="extra"]').onclick = () => done({ action: extra.value });
    setTimeout(() => (back.querySelector(".mf input,.mf textarea") || back.querySelector('[data-b="ok"]')).focus(), 20);
  });
}
const confirmModal = (title, text, ok, danger = false) => modal({ title, text, ok, danger });
const leaveUnsaved = () => !dirty ? Promise.resolve(true) : confirmModal("Leave without saving?", "Your changes to this story are not saved yet. They will be lost.", "Leave without saving", true);

/* who is working: the sign-in email when the Studio is behind Cloudflare Access; otherwise a name asked once and kept in this browser */
let EDITOR = "", SIGNED = null;
/* what this person may do (from the Desk) and the content structure (kinds, each on a format, and topics) */
let ME = { roles: ["editor"], can: {}, grantable: [] }, STRUCT = { kinds: [], topics: [] };
const kindDef = (id) => STRUCT.kinds.find((k) => k.id === id) || null;
const fmtOf = (id) => (kindDef(id) || {}).format || id;
const editorKinds = () => STRUCT.kinds.filter((k) => k.format !== "result");
const kindName = (id) => (kindDef(id) || {}).label || id;
try { EDITOR = localStorage.getItem("studio-editor") || ""; } catch (e) {}
function paintWho() { $("whobtn").textContent = EDITOR ? "👤 " + EDITOR : "👤 Your name"; }
async function askName() {
  if (SIGNED) {
    if (await modal({ title: "Signed in", text: \`You are signed in as \${SIGNED.email}. Your changes and AI requests carry this address.\`, ok: "Sign out", cancel: "Close" }))
      location.href = SIGNED.signout;
    return;
  }
  const v = await modal({ title: EDITOR ? "Your name" : "Welcome to the Content Studio", text: "Your name goes on the changes you make and the AI requests you send, so the team can see who did what.",
    fields: [{ id: "name", label: "Name", value: EDITOR, required: true, placeholder: "e.g. Carlo De Marchis", requiredText: "Type your name." }], ok: "Save" });
  if (!v) return;
  EDITOR = v.name.slice(0, 60);
  try { localStorage.setItem("studio-editor", EDITOR); } catch (e) {}
  paintWho();
}
async function call(path, body) {
  const who = { "x-editor": encodeURIComponent(EDITOR || "") };
  const r = await fetch(API + path, body ? { method: "POST", headers: { "content-type": "application/json", ...who }, body: JSON.stringify(body) } : { headers: who });
  const j = await r.json().catch(() => ({ error: "The desk did not answer." }));
  if (!r.ok) { const e = new Error(j.error || "Something went wrong."); e.conflict = r.status === 409; throw e; }
  return j;
}
async function load(keep) {
  const j = await call("stories");
  stories = j.stories; LEAGUE_NOW = j.now || null;
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
  // the stories last worked on in the Desk come first (made or changed, newest first), then the rest by story time
  const touched = (s) => s.updated_at || s.published_at || s.created_at || "";
  rows.sort((a, b) => (touched(b) > touched(a) ? 1 : touched(b) < touched(a) ? -1 : (b.at || "") > (a.at || "") ? 1 : (b.at || "") < (a.at || "") ? -1 : 0));
  $("list").innerHTML = rows.map((s) => \`<button class="row \${cur && cur.id === s.id ? "on" : ""}" onclick="pick('\${s.id}')"><img src="\${esc(picw(s.photo, 320))}" alt="" loading="lazy">
    <span><b>\${esc(shown(s, s.title))}</b><small><span class="st \${statusOf(s)}">\${statusOf(s)}</span>\${esc(kindName(s.kind))} · \${esc(when(s.at))}</small></span></button>\`).join("") ||
    '<div class="empty">No story matches.</div>';
  const on = $("list").querySelector(".row.on"); if (on) on.scrollIntoView({ block: "nearest" });
}
async function pick(id) {
  if (!(await leaveUnsaved())) return;
  show(id);
}
function remember() {
  const on = document.querySelector("#snav button.on"), v = on ? on.dataset.v : "stories";
  const h = v !== "stories" ? "#" + v : cur && cur.id ? "#story/" + cur.id : cur && dirty ? "#new" : "";
  if (location.hash !== h) history.replaceState(null, "", location.pathname + location.search + h);
}
function show(id, quiet) {
  setTimeout(() => { if (cur && cur.id === id) offerLocal(id); }, 0);
  closeLibrary(); closeSoon(); document.querySelectorAll("#snav button").forEach((b) => b.classList.toggle("on", b.dataset.v === "stories"));
  closeAI(); aiChat = []; aiChatId = null;
  const found = stories.find((s) => s.id === id);
  cur = found ? structuredClone(found) : null;          // a copy: unsaved edits never touch the list
  dirty = false;
  renderList(); renderForm(); if (!quiet) $("main").scrollTop = 0;
}
function blank() {
  const live = ref.events.find((e) => e.status === "live");          // a new story is about the event on now, until untagged
  const k = editorKinds().find((x) => x.format === "text") || editorKinds()[0] || { id: "article" };
  return { id: null, status: "draft", kind: k.id, topic: (STRUCT.topics[0] || { id: "league" }).id, title: "", dek: "", body: [], cities: [], players: [], events: live ? [live.id] : [], author: "", at: localNow() };
}
function renderForm(msg) {
  remember();
  const s = cur; if (!s) { $("main").innerHTML = '<div class="empty">Pick a story on the left, or make a new one.</div>'; return; }
  const st = s.id ? statusOf(s) : "new";
  const kinds = fmtOf(s.kind) === "result" ? [s.kind] : editorKinds().map((k) => k.id).concat(s.kind && !kindDef(s.kind) ? [s.kind] : []);
  const topics = STRUCT.topics.map((t) => t.id).concat(s.topic && !STRUCT.topics.some((t) => t.id === s.topic) ? [s.topic] : []);
  $("main").innerHTML = \`
  <div class="bar"><span class="msg" id="msg">\${s.id ? \`<span class="st \${st}">\${st}</span>\` : "New story, not saved yet"}</span>
    \${s.url ? \`<a class="btn" href="\${esc(s.url)}" target="_blank" rel="noopener">View on site ↗</a>\` : ""}
    <button class="btn" onclick="openPreview()" title="See it on the site, as a computer, tablet or phone shows it, before anyone else does">Preview</button>
    <button class="btn \${s.id ? "" : "pri"}" onclick="openAI()" title="Ask Claude Opus 5.5 for a headline, summary and article">✦ Draft with AI</button>
    <button class="btn" id="discard" onclick="discard()" \${s.id ? "hidden" : ""}>\${s.id ? "Discard changes" : "Cancel"}</button>
    \${s.id ? \`<button class="btn" onclick="openHistory()">History</button><button class="btn bad" onclick="del()">Delete</button>\` : ""}
    \${s.id && st === "published" ? \`<button class="btn" onclick="act('unpublish')">Unpublish</button>\` : ""}
    <button class="btn \${st === "published" ? "pri" : ""}" id="save" onclick="save()" \${dirty ? "" : "disabled"} title="\${dirty ? "" : "Nothing has changed yet"}">\${st === "published" ? "Save and update the site" : "Save draft"}</button>
    \${s.id && st === "scheduled" ? \`<span class="sched">Goes out \${esc(when(s.scheduled_at + ":00"))}</span><button class="btn" onclick="act('unpublish')">Unschedule</button>\` : ""}
    \${s.id && st === "draft" ? \`<button class="btn" onclick="scheduleStory()">Schedule…</button>\` : ""}
    \${s.id && st !== "published" ? \`<button class="btn pri" onclick="act('publish')">\${st === "scheduled" ? "Publish now" : "Publish"}</button>\` : ""}
  </div>
  <div class="form">
    <div>
      <div class="f" id="galrow" hidden><label>Gallery photos</label><div id="galgrid"></div><input type="file" id="galfile" accept="image/*" multiple hidden>
        <div class="hint">In the order fans see them: use the arrows to move a photo. ★ makes one the cover, wherever it is. At least two.</div></div>
      <div class="f"><label for="title">Headline</label><input id="title" value="\${esc(s.title)}">\${/\{(p0|c0|author)\}/.test(s.title) ? \`<div class="hint">Shows on the site as: \${esc(shown(s, s.title))}</div>\` : ""}</div>
      <div class="f"><label for="dek">Summary</label><textarea id="dek" rows="2">\${esc(s.dek)}</textarea><div class="hint">One or two sentences, shown under the headline on the tile and in the reader.</div></div>
      <div class="f"><label>Article</label><div class="rte"><div class="tb" id="tb">
          <button type="button" data-c="h" title="Subheading">H</button><button type="button" data-c="b" title="Bold (⌘B)"><b>B</b></button><button type="button" data-c="i" title="Italic (⌘I)"><i>I</i></button>
          <button type="button" data-c="a" title="Link (⌘K)">Link</button><i class="sep"></i>
          <button type="button" data-c="ul" title="Bulleted list">• List</button><button type="button" data-c="ol" title="Numbered list">1. List</button><button type="button" data-c="q" title="Quote: the site shows it as a pull quote. Put who said it on a last line starting with —">“ Quote</button>
          <i class="sep"></i><button type="button" data-c="img" title="Add a photo where the cursor is">Photo</button><button type="button" data-c="embed" title="Add a video or post from YouTube, Vimeo, X, TikTok, Instagram or Spotify">Embed</button><button type="button" data-c="board" title="Add a leaderboard: the event, the season or a city's round, frozen at a moment or live">Leaderboard</button><input type="file" id="pfile" accept="image/*" hidden></div>

          <div id="body"></div></div>
        <div class="hint">Subheadings, bold, italic, links, lists and photos (Photo button for the library, or paste or drop a picture). The site and the app set the style.</div></div>
    </div>
    <div>
      <div class="f photo" id="mainblock"><label id="mainlabel">Main photo</label><div id="coverwrap" hidden></div>
        <div class="mainwrap" id="mainwrap">\${s.photo ? \`<img id="mainpic" src="\${esc(picw(s.photo, 1024))}" alt="">\` : '<div class="mainph" id="mainph">A golf photo from the library is given to a new story when it is saved.</div>'}
          <button type="button" class="ph-more" id="mainmore" title="Main photo options" onclick="mainMenu(this)">⋯</button></div>
        \${s.photo_auto || !s.id ? '<div class="hint" id="mainauto">Picked from the library. The first photo you add to the article takes its place.</div>' : ""}
        <input type="file" id="mainfile" accept="image/*" hidden>
        <div class="hint" id="maincredit">\${s.photo_credit ? "Photo: " + esc(s.photo_credit) : ""}</div></div>
      <div class="f two"><div><label for="kind">Kind</label><select id="kind" \${kinds.length === 1 ? "disabled" : ""}>\${kinds.map((k) => \`<option value="\${esc(k)}" \${k === s.kind ? "selected" : ""}>\${esc(kindName(k))}</option>\`).join("")}</select></div>
        <div><label for="topic">Topic</label><select id="topic">\${topics.map((k) => \`<option value="\${esc(k)}" \${k === s.topic ? "selected" : ""}>\${esc((STRUCT.topics.find((t) => t.id === k) || { label: k }).label)}</option>\`).join("")}</select></div></div>
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
  wireMainPhoto();
  if (msg) say(msg[0], msg[1]);
}
/* the article field */
let ed = null;
function mountBody(blocks) {
  if (ed) ed.destroy();
  TT.setEmbeds(cur && cur.embeds); TT.setEmbedLookup((url) => call("embed?url=" + encodeURIComponent(url)));
  TT.setBoards(cur && cur.boards); TT.setBoardLookup((line) => call("board?line=" + encodeURIComponent(line)));
  ed = TT.makeEditor($("body"), blocks, touch, SITE, addPhotos, (m) => setTimeout(() => say("", m), 60));
  const paint = () => document.querySelectorAll("#tb button").forEach((b) => b.classList.toggle("on",
    { h: ed.isActive("heading"), b: ed.isActive("bold"), i: ed.isActive("italic"), a: ed.isActive("link"), ul: ed.isActive("bulletList"), ol: ed.isActive("orderedList"), q: ed.isActive("blockquote") }[b.dataset.c] || false));
  ed.on("transaction", paint); paint();
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
  else if (c === "q") ch.toggleBlockquote().run();
  else if (c === "img") photoFromLibrary();
  else if (c === "embed") askEmbed();
  else if (c === "board") askBoard();
  else if (c === "a") {
    linkDialog();
  }
}
/* a link: the address, made right (www. gets https://, an email address becomes mailto:), checked before it goes in */
async function linkDialog() {
  const was = ed.getAttributes("link").href || "";
  const { from, to } = ed.state.selection;
  const fix = (u) => /^www\\./i.test(u) ? "https://" + u : /^[^\\s@:\\/]+@[^\\s@]+\\.[^\\s@]+$/.test(u) ? "mailto:" + u : u;
  // a league page: a player, city or event, by the readable name the site answers to (/players/wes-sandoval)
  const slug = (t) => String(t || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/['’‘]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const pages = [["", "None: use the address above"],
    ...ref.players.slice().sort((a, b) => (a.name < b.name ? -1 : 1)).map((x) => [\`/players/\${slug(x.name)}\`, \`Player · \${x.name}\${CITY[x.city] ? " (" + CITY[x.city].short + ")" : ""}\`]),
    ...ref.cities.map((x) => [\`/cities/\${slug(x.name)}\`, \`City · \${x.name}\`]),
    ...ref.events.map((x) => [\`/events/\${x.id}\`, \`Event · \${x.name}\`])];
  const isPage = pages.some(([p]) => p && p === was);
  const v = await modal({
    title: was ? "Edit the link" : "Add a link",
    text: from === to && !was ? "No words are selected, so the link text will be the page's name or the address." : "",
    fields: [{ id: "url", label: "Address", value: isPage ? "" : was, placeholder: "https://…",
      hint: "A web address, an email address, or /stories/<name> for another league story." },
      { id: "page", label: "Or a league page", type: "select", value: isPage ? was : "", options: pages }],
    ok: was ? "Update link" : "Add link", extra: was ? { label: "Remove link", value: "remove", danger: true } : null,
    validate: (x) => x.page || TT.okUrl(fix(x.url)) ? null : { field: "url", message: "Type a web or email address, or pick a league page." },
  });
  const ch = ed.chain().focus().setTextSelection({ from, to });
  if (!v) return;
  if (v.action === "remove") { ch.extendMarkRange("link").unsetLink().run(); return; }
  const url = v.page || fix(v.url);
  const label = v.page ? (pages.find(([p]) => p === v.page) || ["", url])[1].replace(/^\\w+ · /, "").replace(/ \\(\\w+\\)$/, "") : url;
  if (from === to && !was) ch.insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href: url } }] }).run();
  else ch.extendMarkRange("link").setLink({ href: url }).run();
}
/* What a photo file says about itself, read before the browser shrinks it (shrinking drops it all).
   XMP, written by Lightroom, Photo Mechanic and most agencies (it carries the IPTC fields too), is read first;
   EXIF, written by the camera, fills what XMP leaves empty. Camera boilerplate ("OLYMPUS DIGITAL CAMERA") is ignored. */
async function readMeta(file) {
  const out = { all: {} };
  try {
    const u8 = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());
    const latin = new TextDecoder("latin1").decode(u8);
    const a = latin.indexOf("<x:xmpmeta"), b = latin.indexOf("</x:xmpmeta>");
    if (a >= 0 && b > a) {
      const doc = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(u8.subarray(a, b + 12)), "application/xml");
      const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
      const NS = { dc: "http://purl.org/dc/elements/1.1/", ps: "http://ns.adobe.com/photoshop/1.0/", iptc: "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/",
        exif: "http://ns.adobe.com/exif/1.0/", xmp: "http://ns.adobe.com/xap/1.0/", tiff: "http://ns.adobe.com/tiff/1.0/" };
      const val = (ns, name) => {
        const el = doc.getElementsByTagNameNS(NS[ns], name)[0];
        if (el) { const li = el.getElementsByTagNameNS(RDF, "li")[0]; return ((li || el).textContent || "").trim(); }
        for (const d of doc.getElementsByTagNameNS(RDF, "Description")) { const v = d.getAttributeNS(NS[ns], name); if (v) return v.trim(); }
        return "";
      };
      out.alt = val("iptc", "AltTextAccessibility");
      out.caption = val("dc", "description") || val("dc", "title");
      out.credit = val("ps", "Credit") || val("dc", "creator");
      out.taken = val("ps", "DateCreated") || val("exif", "DateTimeOriginal") || val("xmp", "CreateDate");
      out.camera = [val("tiff", "Make"), val("tiff", "Model")].filter(Boolean).join(" ");
      out.copyright = val("dc", "rights");
      // every simple XMP field, as "prefix:name": attributes and plain or listed values
      for (const d of doc.getElementsByTagNameNS(RDF, "Description")) {
        for (const at of d.attributes) if (!/^(xmlns|rdf:|xml:)/.test(at.name) && at.value.trim()) out.all[at.name] = at.value.trim();
        for (const el of d.children) {
          const lis = el.getElementsByTagNameNS(RDF, "li");
          const v = lis.length ? [...lis].map((x) => x.textContent.trim()).filter(Boolean).join("; ") : el.children.length ? "" : el.textContent.trim();
          if (v) out.all[el.tagName] = v;
        }
      }
    }
    // EXIF in a JPEG: the APP1 "Exif" block, a small TIFF of its own
    if (u8[0] === 0xff && u8[1] === 0xd8) {
      let i = 2;
      while (i + 4 < u8.length && u8[i] === 0xff) {
        const marker = u8[i + 1], len = (u8[i + 2] << 8) | u8[i + 3];
        if (marker === 0xe1 && latin.substr(i + 4, 6) === "Exif\\0\\0") {
          const t = i + 10, dv = new DataView(u8.buffer, u8.byteOffset + t, Math.min(len - 8, u8.length - t));
          const le = dv.getUint16(0) === 0x4949;
          const u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
          const ascii = (o) => { const n = u32(o + 4), at = n > 4 ? u32(o + 8) : o + 8; let s = ""; for (let k = 0; k < n - 1 && at + k < dv.byteLength; k++) s += String.fromCharCode(dv.getUint8(at + k)); return s.trim(); };
          const utf16 = (o) => { const n = u32(o + 4), at = n > 4 ? u32(o + 8) : o + 8; let s = ""; for (let k = 0; k + 1 < n && at + k + 1 < dv.byteLength; k += 2) { const c = dv.getUint16(at + k, true); if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
          const tags = {}, ifd = (o) => { const n = u16(o); for (let k = 0; k < n; k++) { const e = o + 2 + k * 12, tag = u16(e);
            if (u16(e + 2) === 2) tags[tag] = ascii(e); else if (tag === 0x9c9d || tag === 0x9c9b) tags[tag] = utf16(e); else if (tag === 0x8769) tags.exif = u32(e + 8); } };
          ifd(u32(4)); if (tags.exif) ifd(tags.exif);
          const junk = (x) => !x || /^(OLYMPUS DIGITAL CAMERA|SONY DSC|DCIM|default|image|untitled)/i.test(x);
          if (!junk(tags[0x010e])) { out.imageDescription = tags[0x010e]; if (!out.caption) out.caption = tags[0x010e]; }
          else if (!out.caption && !junk(tags[0x9c9b])) out.caption = tags[0x9c9b];            // the Windows title
          if (!out.credit) out.credit = tags[0x013b] || tags[0x9c9d] || "";                       // Artist, or the Windows author
          if (!out.copyright && tags[0x8298]) out.copyright = tags[0x8298];
          if (!out.taken && tags[0x9003]) out.taken = tags[0x9003];
          if (!out.camera) out.camera = [tags[0x010f], tags[0x0110]].filter(Boolean).join(" ");
          break;
        }
        i += 2 + len;
      }
    }
    if (u8[0] === 0xff && u8[1] === 0xd8) Object.assign(out.all, exifAll(u8, latin), { ...out.all });
  } catch (e) { /* a file that cannot be read for its data is uploaded without it */ }
  // a credit from the copyright line when nothing better: "© 2026 Jane Smith. All rights reserved." → "Jane Smith"
  // a licence ("Public Domain", "CC-BY-SA") says how it may be used, not who took it: it is never a credit
  if (!out.credit && out.copyright && !/public domain|cc[- ]?by|cc0|creative commons|gfdl/i.test(out.copyright)) out.credit = out.copyright.replace(/©|\\(c\\)|copyright|all rights reserved\\.?|\\b(19|20)\\d\\d\\b/gi, "").replace(/^[\\s,.\\-]+|[\\s,.\\-]+$/g, "");
  if (out.camera) { const w = out.camera.split(/\\s+/); out.camera = w.filter((x, k) => w.indexOf(x) === k).join(" "); }   // "Canon Canon EOS R5" → "Canon EOS R5"
  const d = String(out.taken || "").match(/^(\\d{4})[:-](\\d{2})[:-](\\d{2})(?:[T ](\\d{2}):(\\d{2}))?/);
  out.taken = d ? \`\${d[1]}-\${d[2]}-\${d[3]}\${d[4] ? "T" + d[4] + ":" + d[5] : ""}\` : "";
  if (!out.alt) out.alt = out.imageDescription || out.caption || "";
  delete out.imageDescription;
  for (const k of ["alt", "caption", "credit"]) out[k] = (out[k] || "").replace(/\\s+/g, " ").trim().slice(0, k === "credit" ? 120 : 200);
  return out;
}
/* Every EXIF field worth reading, by name: the main block, the camera block and GPS. */
const EXIF_TAGS = { 0x010e: "ImageDescription", 0x010f: "Make", 0x0110: "Model", 0x0112: "Orientation", 0x0131: "Software", 0x0132: "DateTime",
  0x013b: "Artist", 0x8298: "Copyright", 0x829a: "ExposureTime", 0x829d: "FNumber", 0x8822: "ExposureProgram", 0x8827: "ISO",
  0x9003: "DateTimeOriginal", 0x9004: "DateTimeDigitized", 0x9010: "OffsetTime", 0x9204: "ExposureBias", 0x9207: "MeteringMode", 0x9209: "Flash",
  0x920a: "FocalLength", 0xa002: "PixelWidth", 0xa003: "PixelHeight", 0xa405: "FocalLengthIn35mm", 0xa430: "CameraOwnerName",
  0xa431: "BodySerialNumber", 0xa433: "LensMake", 0xa434: "LensModel" };
const GPS_TAGS = { 1: "GPSLatitudeRef", 2: "GPSLatitude", 3: "GPSLongitudeRef", 4: "GPSLongitude", 6: "GPSAltitude" };
function exifAll(u8, latin) {
  const all = {};
  let i = 2;
  while (i + 4 < u8.length && u8[i] === 0xff) {
    const marker = u8[i + 1], len = (u8[i + 2] << 8) | u8[i + 3];
    if (marker === 0xe1 && latin.substr(i + 4, 6) === "Exif\\0\\0") {
      const t = i + 10, dv = new DataView(u8.buffer, u8.byteOffset + t, Math.min(len - 8, u8.length - t));
      const le = dv.getUint16(0) === 0x4949, u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le), s32 = (o) => dv.getInt32(o, le);
      const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
      const value = (e) => {
        const type = u16(e + 2), n = u32(e + 4), size = (SIZE[type] || 1) * n, at = size > 4 ? u32(e + 8) : e + 8;
        if (at + size > dv.byteLength) return null;
        if (type === 2) { let s = ""; for (let k = 0; k < n - 1; k++) s += String.fromCharCode(dv.getUint8(at + k)); return s.trim(); }
        const one = (k) => type === 3 ? u16(at + k * 2) : type === 4 ? u32(at + k * 4) : type === 9 ? s32(at + k * 4)
          : type === 5 ? [u32(at + k * 8), u32(at + k * 8 + 4)] : type === 10 ? [s32(at + k * 8), s32(at + k * 8 + 4)] : null;
        const vals = [...Array(Math.min(n, 8)).keys()].map(one);
        return vals.length === 1 ? vals[0] : vals;
      };
      const walk = (o, names, depth) => {
        if (o + 2 > dv.byteLength || depth > 2) return;
        const n = u16(o);
        for (let k = 0; k < n; k++) {
          const e = o + 2 + k * 12; if (e + 12 > dv.byteLength) break;
          const tag = u16(e);
          if (tag === 0x8769 || tag === 0x8825) { walk(u32(e + 8), tag === 0x8825 ? GPS_TAGS : EXIF_TAGS, depth + 1); continue; }
          const name = names[tag]; if (!name) continue;
          const v = value(e); if (v == null || v === "") continue;
          all["exif:" + name] = v;
        }
      };
      walk(u32(4), EXIF_TAGS, 0);
      break;
    }
    i += 2 + len;
  }
  // rationals and degrees, in words a person reads
  const r = (x) => Array.isArray(x) && x.length === 2 && typeof x[0] === "number" ? (x[1] ? x[0] / x[1] : 0) : x;
  const fmt = {};
  for (const [k, v] of Object.entries(all)) {
    if (k === "exif:ExposureTime" && Array.isArray(v)) fmt[k] = v[0] && v[1] / v[0] >= 2 ? "1/" + Math.round(v[1] / v[0]) + " s" : r(v) + " s";
    else if (k === "exif:FNumber" || k === "exif:FocalLength" || k === "exif:ExposureBias" || k === "exif:GPSAltitude") fmt[k] = +r(v).toFixed(2);
    else if ((k === "exif:GPSLatitude" || k === "exif:GPSLongitude") && Array.isArray(v)) { const [d, m, s] = v.map(r); fmt[k] = +(d + m / 60 + s / 3600).toFixed(6); }
    else fmt[k] = Array.isArray(v) ? v.map(r).join(", ") : v;
  }
  return fmt;
}
const metaNote = (m) => (m.caption || m.credit || m.alt || m.taken) ? "Filled in from the photo's own data" + (m.taken ? " (taken " + when(m.taken) + (m.camera ? ", " + m.camera : "") + ")" : "") + ": check it." : "";
/* photos in the article: shrunk in the browser, kept in the store, described and captioned, placed at the cursor */
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return { blob: await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.82)), w: cv.width, h: cv.height };
}
function askText(alt, caption, which = "", img = "", note = "") {
  return modal({
    title: (alt ? "Edit the photo's text" : "Describe the photo") + which, img, text: note,
    fields: [
      { id: "alt", label: "Description", value: alt, required: true, type: "textarea", rows: 2, requiredText: "Describe the photo: it is read aloud to people who cannot see it.",
        placeholder: "e.g. Omar Quintero hits a 5-wood to six feet on the 13th", hint: "What the photo shows, for people who cannot see it. Not shown on the page." },
      { id: "caption", label: "Caption", value: caption, placeholder: "e.g. The 13th at El Camaleón · Photo: Jane Smith", hint: "Shown under the photo. Add the credit here." },
    ],
    ok: alt ? "Save" : "Add photo",
  }).then((v) => v && { alt: v.alt, caption: v.caption });
}
/* the article's Photo button: a photo from the library, or a new one */
async function photoFromLibrary() {
  const { from } = ed.state.selection;
  const r = await choosePhoto("Add a photo to the article");
  if (!r) return;
  ed.chain().focus().setTextSelection(from).run();
  if (r.file) return addPhoto(r.file);
  const e = r.entry;
  const t = await askText(e.alt || "", photoText(e), "", picw(e.src, 1024)); if (!t) return;
  ed.chain().focus().setTextSelection(from).setImage({ src: SITE + "/" + e.src + (e.w ? "#" + e.w + "x" + e.h : ""), alt: t.alt, title: t.caption }).run();
  say("", "Photo added. Save to keep it.");
}
/* photos pasted or dropped in: one after the other, each described, each placed where it landed */
async function addPhotos(files, pos) {
  // a photo dropped on a paragraph goes after that paragraph, never into the middle of its words
  if (pos != null) { const $p = ed.state.doc.resolve(Math.min(pos, ed.state.doc.content.size)); pos = $p.depth ? $p.after(1) : pos; }
  for (let i = 0; i < files.length; i++) {
    const placed = await addPhoto(files[i], files.length > 1 ? \` (\${i + 1} of \${files.length})\` : "", pos);
    if (placed && pos != null) pos += 1;                       // the next one goes after the one just placed
  }
}
async function addPhoto(file, which = "", at = null) {
  say("", "Uploading the photo" + which + "…");
  try {
    const meta = await readMeta(file);
    const { blob, w, h } = await shrink(file);
    const preview = URL.createObjectURL(blob);
    say("", "");
    const t = await askText(meta.alt, [meta.caption, meta.credit ? "Photo: " + meta.credit : ""].filter(Boolean).join(" · "), which, preview, metaNote(meta));           // described first: a photo given up is never uploaded
    URL.revokeObjectURL(preview);
    if (!t) { say("", "Photo not added."); return false; }
    say("", "Uploading the photo" + which + "…");
    const j = await uploadBlob(blob, w, h, { alt: t.alt, caption: t.caption, credit: meta.credit, taken: meta.taken, camera: meta.camera, all: meta.all });
    const attrs = { src: SITE + "/" + j.src + "#" + w + "x" + h, alt: t.alt, title: t.caption };
    if (at != null) ed.chain().focus().insertContentAt(at, { type: "image", attrs }).run();
    else ed.chain().focus().setImage(attrs).run();
    say("", "Photo added. Save to keep it.");
    return true;
  } catch (e) { say("err", e.message || "That picture could not be read. Save it as a JPEG and try again."); }
}
/* the ⋯ menu on a photo in the article */
function closePhotoMenu() { const m = $("pmenu"); if (m) m.remove(); }
/* embeds: a link to YouTube, X… The site shows the real player; here a card stands for it. */
async function askEmbed() {
  const v = await modal({ title: "Embed a video or post", text: "Paste the link to a YouTube or Vimeo video, a post on X, TikTok or Instagram, or a Spotify track or episode. The site shows its player. Tip: pasting the link on an empty line of the article does the same.",
    fields: [{ id: "url", label: "Link", placeholder: "https://www.youtube.com/watch?v=…", required: true, requiredText: "Paste a link." }],
    ok: "Embed", validate: (f) => (TT.embedLink(f.url.trim()) ? null : { field: "url", message: "That link cannot be embedded. Use a link from YouTube, Vimeo, X, TikTok, Instagram or Spotify." }) });
  if (!v) return;
  TT.insertEmbed(ed, v.url.trim()); touch();
}
/* Leaderboards: which board, how many rows, and the moment it shows (frozen) or live. Frozen boards are fixed by the
   Desk when the story is saved, so a recap stays true; live ones always show the current standings. */
async function askBoard(line, pos) {
  const o = (line && TT.parseBoard(line)) || { board: "event", top: "5", at: "r1", round: "2" };
  const now = (LEAGUE_NOW || "").slice(11, 16) || "14:20";
  const v = await modal({ title: line ? "Change the leaderboard" : "Add a leaderboard",
    text: "Frozen: the board as it stood at that moment, fixed when you save, so a recap stays true. Live: always the current standings (event and season only).",
    fields: [
      { id: "board", label: "Board", type: "select", value: o.board, options: [["event", "Event: team leaderboard"], ["season", "Season: league points"], ["city", "A city's round: its players"]] },
      { id: "city", label: "City (for a city's round)", type: "select", value: o.city || (ref.cities[0] || {}).id, options: ref.cities.map((c) => [c.id, c.name]) },
      { id: "round", label: "Round (for a city's round)", type: "select", value: o.round || "2", options: [["1", "Round 1"], ["2", "Round 2"]] },
      { id: "top", label: "Rows", type: "select", value: o.top || "5", options: [["3", "Top 3"], ["5", "Top 5"], ["10", "Top 10"], ["all", "All"]] },
      { id: "at", label: "As of", type: "select", value: /^\\d/.test(o.at || "") ? "now" : o.at || "r1",
        options: [["r1", "Frozen after Round 1"], ["now", \`Frozen now (Round 2, \${now})\`], ["final", "Frozen at the end of the event"], ["live", "Live: always current"]] },
    ], ok: line ? "Change" : "Add" });
  if (!v) return;
  const spec = { board: v.board, top: v.board === "city" ? "all" : v.top, at: v.at === "now" ? now : v.at };
  if (v.board === "city") { spec.city = v.city; spec.round = v.round; if (spec.at === "live") spec.at = "final"; }
  const next = TT.boardLine(spec);
  if (pos != null) TT.setBoardLine(ed, pos, next); else TT.insertBoard(ed, next);
  touch();
  if (v.board === "city" && v.at === "live") say("", "A city's round cannot be live: it is frozen at the end of the event.");
}
addEventListener("board-menu", (e) => {
  closePhotoMenu();
  const { pos, line, x, y } = e.detail;
  ed.chain().setNodeSelection(pos).run();
  const m = document.createElement("div"); m.className = "pmenu"; m.id = "pmenu";
  m.innerHTML = '<button type="button" data-a="change">Change the leaderboard</button><button type="button" data-a="remove" class="bad">Remove from the article</button>';
  document.body.appendChild(m);
  m.style.left = Math.max(8, Math.min(x - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.min(y + 6, innerHeight - m.offsetHeight - 8) + "px";
  m.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    closePhotoMenu();
    if (b.dataset.a === "change") askBoard(line, pos);
    else { ed.chain().setNodeSelection(pos).deleteSelection().run(); touch(); }
  };
});
addEventListener("embed-menu", (e) => {
  closePhotoMenu();
  const { pos, url, x, y } = e.detail;
  ed.chain().setNodeSelection(pos).run();
  const m = document.createElement("div"); m.className = "pmenu"; m.id = "pmenu";
  m.innerHTML = '<button type="button" data-a="open">Open the link</button><button type="button" data-a="remove" class="bad">Remove from the article</button>';
  document.body.appendChild(m);
  m.style.left = Math.max(8, Math.min(x - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.min(y + 6, innerHeight - m.offsetHeight - 8) + "px";
  m.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    closePhotoMenu();
    if (b.dataset.a === "open") window.open(url, "_blank", "noopener");
    else { ed.chain().setNodeSelection(pos).deleteSelection().run(); touch(); }
  };
});
addEventListener("photo-menu", (e) => {
  closePhotoMenu();
  const { pos, x, y } = e.detail;
  ed.chain().setNodeSelection(pos).run();
  const a = ed.getAttributes("image");
  const m = document.createElement("div"); m.className = "pmenu"; m.id = "pmenu";
  m.innerHTML = \`\${a.alt ? "" : '<div class="note">Not described yet: people who cannot see it get nothing.</div>'}
    <button type="button" data-a="edit">Edit description and caption</button><button type="button" data-a="main">Use as main photo</button>
    <button type="button" data-a="remove" class="bad">Remove from the article</button>\`;
  document.body.appendChild(m);
  m.style.left = Math.max(8, Math.min(x - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.min(y + 6, innerHeight - m.offsetHeight - 8) + "px";
  m.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    closePhotoMenu(); ed.chain().setNodeSelection(pos).run();
    if (b.dataset.a === "edit") editPhoto();
    else if (b.dataset.a === "main") mainFromPhoto();
    else ed.chain().focus().deleteSelection().run();
  };
});
addEventListener("mousedown", (ev) => { if ($("pmenu") && !ev.target.closest("#pmenu") && !ev.target.closest(".ph-more")) closePhotoMenu(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") closePhotoMenu(); });
async function editPhoto() {
  const sel = ed.state.selection;
  const a = ed.getAttributes("image"); const t = await askText(a.alt, a.title, "", a.src); if (!t) return;
  ed.chain().setNodeSelection(sel.from).run();
  ed.chain().focus().updateAttributes("image", { alt: t.alt, title: t.caption }).run();
}
/* the main photo, changed in place: pick a file or drop one on it, see it in the dialog with its credit,
   and it is the story's main photo from the next Save */
function wireMainPhoto() {
  $("mainfile").onchange = () => { const f = $("mainfile").files[0]; $("mainfile").value = ""; if (f) newMainPhoto(f); };
  const box = document.querySelector(".f.photo");
  box.addEventListener("dragover", (e) => { if ([...e.dataTransfer.items].some((i) => i.kind === "file")) { e.preventDefault(); box.classList.add("drop"); } });
  box.addEventListener("dragleave", () => box.classList.remove("drop"));
  box.addEventListener("drop", (e) => {
    box.classList.remove("drop");
    const f = [...e.dataTransfer.files].find((x) => /^image\\//.test(x.type)); if (!f) return;
    e.preventDefault(); newMainPhoto(f);
  });
}
function showMain(path, credit) {
  if (!$("mainpic")) { const img = document.createElement("img"); img.id = "mainpic"; img.alt = ""; $("mainwrap").insertBefore(img, $("mainmore")); }
  if ($("mainph")) $("mainph").parentNode.removeChild($("mainph"));
  if ($("mainauto")) $("mainauto").parentNode.removeChild($("mainauto"));
  $("mainpic").src = picw(path, 1024);
  $("maincredit").textContent = credit ? "Photo: " + credit : "";
}
/* the ⋯ menu on the main photo: the same menu as on a photo in the article */
function mainMenu(btn) {
  closePhotoMenu();
  const r = btn.getBoundingClientRect();
  const m = document.createElement("div"); m.className = "pmenu"; m.id = "pmenu";
  m.innerHTML = \`<button type="button" data-a="lib">Choose from the library</button><button type="button" data-a="up">Upload a new photo</button>
    \${cur.photo ? '<button type="button" data-a="credit">Edit the credit</button>' : ""}\`;
  document.body.appendChild(m);
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + "px";
  m.onclick = (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    closePhotoMenu();
    if (b.dataset.a === "lib") mainFromLibrary();
    else if (b.dataset.a === "up") $("mainfile").click();
    else editMainCredit();
  };
}
async function mainFromLibrary() {
  const r = await choosePhoto("Choose the main photo");
  if (!r) return;
  if (r.file) return newMainPhoto(r.file);
  const e = r.entry;
  Object.assign(cur, { photo: e.src, photo_w: e.w || 0, photo_h: e.h || 0, photo_auto: false, photo_credit: e.credit || "", mainChanged: true });
  showMain(e.src, e.credit || "");
  touch(); say("", "New main photo. Save to keep it.");
}
async function newMainPhoto(file) {
  try {
    const meta = await readMeta(file);
    const { blob, w, h } = await shrink(file);
    const preview = URL.createObjectURL(blob);
    const v = await modal({ title: "New main photo", img: preview,
      text: "It shows on the story's tile, at the top of the story and in link previews. " + metaNote(meta),
      fields: [{ id: "credit", label: "Credit", value: meta.credit, placeholder: "e.g. Jane Smith", hint: "Who took the photo. Shown with the story." }],
      ok: "Use this photo" });
    URL.revokeObjectURL(preview);
    if (!v) return;
    say("", "Uploading the photo…");
    const j = await uploadBlob(blob, w, h, { credit: v.credit, alt: meta.alt, caption: meta.caption, taken: meta.taken, camera: meta.camera, all: meta.all });
    Object.assign(cur, { photo: j.src, photo_w: w, photo_h: h, photo_auto: false, photo_credit: v.credit, mainChanged: true });
    showMain(j.src, v.credit);
    touch(); say("", "New main photo. Save to keep it.");
  } catch (e) { say("err", e.message || "That picture could not be read. Save it as a JPEG and try again."); }
}
async function editMainCredit() {
  const v = await modal({ title: "Photo credit", img: picw(cur.photo, 1024),
    fields: [{ id: "credit", label: "Credit", value: cur.photo_credit || "", placeholder: "e.g. Jane Smith", hint: "Who took the photo. Leave empty for none." }], ok: "Save" });
  if (!v) return;
  cur.photo_credit = v.credit; cur.creditChanged = true;
  $("maincredit").textContent = v.credit ? "Photo: " + v.credit : "";
  touch();
}
function mainFromPhoto() {
  const src = ed.getAttributes("image").src || ""; const i = src.indexOf("/content/photos/"); if (i < 0) return;
  const [path, size] = src.slice(i + 1).split("#"); const wh = (size || "").split("x");
  cur.photo = path; cur.photo_w = +wh[0] || 0; cur.photo_h = +wh[1] || 0; cur.photo_auto = false; cur.photo_credit = ""; cur.mainChanged = true;
  showMain(path, "");
  touch(); say("", "Main photo changed. Save to keep it.");
}
function paintKind() {
  const k = fmtOf($("kind").value), s = cur;
  const gal = k === "gallery";
  // a gallery: its photos across the top of the middle column, the right column shows its cover (the first photo)
  $("galrow").hidden = !gal; $("coverwrap").hidden = !gal; $("mainlabel").textContent = gal ? "Cover" : "Main photo";
  ["mainwrap", "mainauto", "maincredit"].forEach((id) => { if ($(id)) $(id).hidden = gal; });
  $("kindx").innerHTML = k === "video" ? \`<label for="dur">Video length</label><input id="dur" value="\${esc(s.dur || "")}" placeholder="2:14">\` : "";
  ["dur"].forEach((id) => $(id) && $(id).addEventListener("input", touch));
  if (gal) {
    if (!cur.gallery) cur.gallery = (fmtOf(s.kind) === "gallery" && s.photos && s.photos.length ? s.photos : []).slice();
    if (!cur.cover) cur.cover = cur.gallery.includes(s.photo) ? s.photo : cur.gallery[0] || null;
    $("galfile").onchange = (e) => { const files = [...e.target.files]; e.target.value = ""; galUpload(files); };
    paintGallery();
  }
}
/* the + tile: from the library, or upload several at once */
function galAddMenu(btn) {
  closePhotoMenu();
  const r = btn.getBoundingClientRect();
  const m = document.createElement("div"); m.className = "pmenu"; m.id = "pmenu";
  m.innerHTML = '<button type="button" data-a="lib">Choose from the library</button><button type="button" data-a="up">Upload photos</button>';
  document.body.appendChild(m);
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + "px";
  m.onclick = (ev) => { const b = ev.target.closest("button"); if (!b) return; closePhotoMenu(); if (b.dataset.a === "lib") galFromLibrary(); else $("galfile").click(); };
}
/* the gallery's photos, in order: move them left or right, take one out, add from the library or upload several at once */
function paintGallery() {
  const g = cur.gallery || [], el = $("galgrid"); if (!el) return;
  if (!g.includes(cur.cover)) cur.cover = g[0] || null;       // the cover is one of the gallery's photos
  el.innerHTML = \`<div class="gal">\${g.map((src, i) => \`<figure class="\${src === cur.cover ? "cover" : ""}"><img src="\${esc(picw(src, 320))}" alt="" loading="lazy"><div class="gb">
      <button type="button" title="Move earlier" onclick="galMove(\${i},-1)" \${i ? "" : "disabled"}>←</button>\${src !== cur.cover ? \`<button type="button" title="Make it the cover" onclick="galCover(\${i})">★</button>\` : ""}<button type="button" title="Take out of the gallery" onclick="galDrop(\${i})">✕</button>
      <button type="button" title="Move later" onclick="galMove(\${i},1)" \${i < g.length - 1 ? "" : "disabled"}>→</button></div></figure>\`).join("")}
    <button type="button" class="gadd" title="Add photos" onclick="galAddMenu(this)">+</button></div>\`;
  $("coverwrap").innerHTML = g.length ? \`<img src="\${esc(picw(cur.cover, 1024))}" alt=""><div class="hint">Shown on the story's tile and in link previews. Click ★ on another gallery photo to change it.</div>\`
    : '<div class="coverph">The first photo you add to the gallery becomes the cover.</div>';
}
function galMove(i, d) { const g = cur.gallery, j = i + d; if (j < 0 || j >= g.length) return; [g[i], g[j]] = [g[j], g[i]]; paintGallery(); touch(); }
function galCover(i) { cur.cover = cur.gallery[i]; paintGallery(); touch(); say("", "New cover. Save to keep it."); }
function galDrop(i) { cur.gallery.splice(i, 1); paintGallery(); touch(); }
async function galFromLibrary() {
  const r = await choosePhoto("Add a photo to the gallery");
  if (!r) return;
  if (r.file) return galUpload([r.file]);
  if (cur.gallery.includes(r.entry.src)) { say("err", "That photo is already in the gallery."); return; }
  cur.gallery.push(r.entry.src); paintGallery(); touch(); say("", "Added. Save to keep it.");
}
async function galUpload(files) {
  let done = 0;
  for (const file of files) {
    say("", \`Uploading \${done + 1} of \${files.length}…\`);
    try {
      const meta = await readMeta(file);
      const { blob, w, h } = await shrink(file);
      const j = await uploadBlob(blob, w, h, { credit: meta.credit, alt: meta.alt, caption: meta.caption, taken: meta.taken, camera: meta.camera, all: meta.all });
      cur.gallery.push(j.src); done++; paintGallery(); touch();
    } catch (e) { say("err", (file.name || "A picture") + ": " + (e.message || "could not be read. Save it as a JPEG and try again.")); return; }
  }
  say("", \`\${done} photo\${done === 1 ? "" : "s"} added to the gallery and the library. Save to keep them.\`);
}
function paintPlayers() {
  $("pchips").innerHTML = (cur.players || []).map((id) => { const p = PLAYER[id] || { name: id }; const c = CITY[p.city];
    return \`<span class="chip" style="--c:\${c ? c.color : "var(--dim)"}"><i></i>\${esc(p.name)}<button type="button" title="Remove" onclick="dropPlayer('\${id}')">×</button></span>\`; }).join("");
}
function dropPlayer(id) { cur.players = cur.players.filter((x) => x !== id); paintPlayers(); touch(); }
/* a new story not saved yet goes away; a story with unsaved changes goes back to how it was saved */
async function discard() {
  if (dirty && !(await confirmModal(cur.id ? "Throw away your changes?" : "Throw away this new story?",
    cur.id ? "The story goes back to how it was last saved." : "It has not been saved, so nothing of it is kept.", cur.id ? "Throw away changes" : "Throw away", true))) return;
  dropLocal(cur.id); dirty = false;
  if (cur.id) { show(cur.id, true); say("", "Changes thrown away."); }
  else { cur = null; renderList(); renderForm(); }
}
function touch() { dirty = true; if ($("save")) { $("save").disabled = false; $("save").title = ""; } if ($("discard")) $("discard").hidden = false; say("", cur.id ? "Unsaved changes" : "New story, not saved yet"); keepLocal(); remember(); }
/* Unsaved work is kept in this browser as it is typed (studio-draft:<id>, or :new for a story not saved yet), so a reload,
   a crash or a closed tab loses nothing: the story offers it back the next time it opens. Save and Discard clear it. */
const draftKey = (id) => "studio-draft:" + (id || "new");
let keepTimer = null;
function keepLocal() {
  clearTimeout(keepTimer);
  keepTimer = setTimeout(() => {
    if (!cur || !dirty || !$("title")) return;
    try { localStorage.setItem(draftKey(cur.id), JSON.stringify({ at: new Date().toISOString(), base: cur.stamp || null, fields: fields(), main: cur.mainChanged ? { photo: cur.photo, w: cur.photo_w, h: cur.photo_h } : null })); } catch (e) {}
  }, 400);
}
function dropLocal(id) { clearTimeout(keepTimer); try { localStorage.removeItem(draftKey(id)); } catch (e) {} }
function readLocal(id) { try { return JSON.parse(localStorage.getItem(draftKey(id)) || "null"); } catch (e) { return null; } }
async function offerLocal(id) {
  const d = readLocal(id); if (!d || !d.fields) return;
  const changed = id && d.base && cur.stamp && d.base !== cur.stamp;
  const ok = await modal({ title: "Restore your unsaved changes?",
    text: \`You were editing \${id ? "this story" : "a new story"} on \${when(d.at)} and did not save. \` + (d.fields.title ? \`Headline: “\${d.fields.title}”. \` : "") +
      (changed ? "Someone has saved the story since: if you restore, Save will ask you to reload their version first." : ""),
    ok: "Restore", cancel: "Discard them", });
  if (!ok) { dropLocal(id); return; }
  applyLocal(d);
}
function applyLocal(d) {
  const f = d.fields;
  $("title").value = f.title || ""; $("dek").value = f.dek || ""; $("topic").value = f.topic || (STRUCT.topics[0] || {}).id || "";
  if (f.kind && [...$("kind").options].some((o) => o.value === f.kind)) { $("kind").value = f.kind; paintKind(); }
  if ($("dur") && f.dur != null) $("dur").value = f.dur;
  if (Array.isArray(f.photos)) { cur.gallery = f.photos.slice(); if (f.cover) cur.cover = f.cover; paintGallery(); }
  $("author").value = f.author || ""; if (f.at) $("at").value = f.at;
  document.querySelectorAll("#cities button").forEach((b) => b.classList.toggle("on", (f.cities || []).includes(b.dataset.id)));
  document.querySelectorAll("#events button").forEach((b) => b.classList.toggle("on", (f.events || []).includes(b.dataset.id)));
  cur.players = (f.players || []).filter((id) => PLAYER[id]); paintPlayers();
  ed.commands.setContent(TT.fromMd(String(f.body || "").split(/\\n\\s*\\n/).filter(Boolean)));
  if (d.main) { Object.assign(cur, { photo: d.main.photo, photo_w: d.main.w, photo_h: d.main.h, photo_auto: false, mainChanged: true }); showMain(d.main.photo, f.photo_credit || ""); }
  if (f.photo_credit != null) { cur.photo_credit = f.photo_credit; cur.creditChanged = true; if ($("maincredit")) $("maincredit").textContent = f.photo_credit ? "Photo: " + f.photo_credit : ""; }
  touch(); say("", "Unsaved changes restored. Save to keep them.");
}
function say(kind, text) { const m = $("msg"); if (m) { m.className = "msg " + kind; m.textContent = text; } }
function fields() {
  return { title: $("title").value, dek: $("dek").value, body: ed ? TT.toMd(ed.getJSON()) : "", kind: $("kind").value, topic: $("topic").value,
    author: $("author").value, at: $("at").value, dur: $("dur") ? $("dur").value.trim() : undefined, photos: fmtOf($("kind").value) === "gallery" ? (cur.gallery || []).slice() : undefined, cover: fmtOf($("kind").value) === "gallery" ? cur.cover || undefined : undefined,
    cities: [...document.querySelectorAll("#cities button.on")].map((b) => b.dataset.id), players: cur.players || [],
    events: [...document.querySelectorAll("#events button.on")].map((b) => b.dataset.id),
    ...(cur.mainChanged ? { photo: cur.photo, photo_w: cur.photo_w, photo_h: cur.photo_h } : {}),
    ...(cur.mainChanged || cur.creditChanged ? { photo_credit: cur.photo_credit || "" } : {}) };
}
async function run(fn, busy) {
  document.querySelectorAll(".bar .btn").forEach((b) => (b.disabled = true)); say("", busy);
  try { await fn(); }
  catch (e) {
    say("err", e.message);
    document.querySelectorAll(".bar .btn").forEach((b) => (b.disabled = false));
    if ($("save")) $("save").disabled = !dirty;               // Save stays off while there is nothing to save
    if (e.conflict) { const m = $("msg"); m.innerHTML = esc(e.message) + ' <button class="btn" onclick="dirty=false;load(cur.id)">Reload</button>'; }
  }
}
function save() {
  const live = cur.id && statusOf(cur) === "published";
  run(async () => {
    const j = await call("save", { id: cur.id, stamp: cur.stamp, fields: fields(), ai_chat: aiChatId });
    dropLocal(cur.id); dirty = false; await load(j.story.id); renderForm(["ok", live ? "Saved. The site shows the change on its next load." : "Draft saved."]);
  }, "Saving…");
}
async function act(what) {
  if (dirty) { say("err", "Save your changes first."); return; }
  const ok = what === "publish"
    ? await confirmModal("Publish this story?", "It is public on the site and in the app at once.", "Publish")
    : statusOf(cur) === "scheduled" ? await confirmModal("Unschedule this story?", "It goes back to drafts and will not go out.", "Unschedule")
    : await confirmModal("Take this story off the site?", "It leaves the site and the app at once and goes back to drafts.", "Unpublish", true);
  if (!ok) return;
  run(async () => {
    await call(what, { id: cur.id, stamp: cur.stamp });
    const was = statusOf(cur);
    await load(cur.id); renderForm(["ok", what === "publish" ? "Published. It is on the site now." : was === "scheduled" ? "Unscheduled: back in drafts." : "Back in drafts, off the site."]);
  }, what === "publish" ? "Publishing…" : "Taking it off the site…");
}
/* Schedule: the time is picked in this computer's time; the Desk keeps it in UTC and publishes it then (it checks
   every 5 minutes) */
async function scheduleStory() {
  if (dirty) { say("err", "Save your changes first."); return; }
  const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const v = await modal({ title: "Schedule this story", text: "It goes out on the site and in the app at this time, within 5 minutes. Until then it stays a draft for readers.",
    fields: [{ id: "at", label: "Goes out at (your time)", type: "datetime-local", value: local, required: true, requiredText: "Pick a date and time." }],
    ok: "Schedule", validate: (f) => (new Date(f.at).getTime() > Date.now() + 60000 ? null : { field: "at", message: "Pick a time in the future." }) });
  if (!v) return;
  const at = new Date(v.at).toISOString().slice(0, 16);
  run(async () => {
    await call("schedule", { id: cur.id, stamp: cur.stamp, at });
    await load(cur.id); renderForm(["ok", "Scheduled. It goes out " + when(at + ":00") + "."]);
  }, "Scheduling…");
}

/* Preview: the real site in a frame the size of a computer, tablet or phone, with this story in it as if it were
   published (as a tile in the feed, or opened). It sends the story as it is in the form, saved or not; nothing is
   published and only you see it. */
const PV_SIZES = { desktop: [1280, 800], tablet: [820, 1180], phone: [390, 844] };
let pvDevice = "phone", pvView = "story";
try { pvDevice = localStorage.getItem("studio-pv-device") || "phone"; } catch (e) {}
function previewStory() {
  const f = fields(), k = kindDef(f.kind) || {}, gal = fmtOf(f.kind) === "gallery" ? (cur.gallery || []) : null;
  return { kind: f.kind, topic: f.topic, title: f.title || "(No headline yet)", dek: f.dek, author: f.author || "Legacy League",
    at: f.at || localNow(), cities: f.cities, players: f.players, events: f.events,
    body: String(f.body || "").split(/\\n\\s*\\n/).map((x) => x.trim()).filter(Boolean),
    photo: gal && gal.length ? (cur.cover && gal.includes(cur.cover) ? cur.cover : gal[0]) : cur.photo || null,
    photos: gal || undefined, count: gal ? gal.length : undefined, dur: f.dur || undefined,
    size: cur.size || k.size || "m", embeds: cur.embeds || undefined, slug: cur.slug || undefined, source: cur.id || null };
}
function openPreview() {
  closePreview();
  const box = document.createElement("div"); box.className = "pv"; box.id = "pv";
  box.innerHTML = \`<header><h1>Preview</h1>
    <span class="seg2" id="pvdev"><button data-d="desktop">Desktop</button><button data-d="tablet">Tablet</button><button data-d="phone">Phone</button></span>
    <span class="seg2" id="pvview"><button data-v="story">Story</button><button data-v="feed">In the feed</button></span>
    <span class="note">\${cur && cur.id && statusOf(cur) === "published" ? "Your unsaved changes, not yet on the site" : "Not published: only you see this"}</span>
    <button class="btn" onclick="closePreview()">Close</button></header>
    <div class="stage" id="pvstage"><div class="dev" id="pvdevbox"><iframe id="pvframe" title="Preview" src="\${esc(SITE)}/stories?preview=1"></iframe></div></div>\`;
  document.body.appendChild(box);
  $("pvdev").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; pvDevice = b.dataset.d; try { localStorage.setItem("studio-pv-device", pvDevice); } catch (err) {} sizePreview(); };
  $("pvview").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; pvView = b.dataset.v; paintPvButtons(); sendPreview(); };
  sizePreview();
}
function paintPvButtons() {
  document.querySelectorAll("#pvdev button").forEach((b) => b.classList.toggle("on", b.dataset.d === pvDevice));
  document.querySelectorAll("#pvview button").forEach((b) => b.classList.toggle("on", b.dataset.v === pvView));
}
function sizePreview() {
  const st = $("pvstage"), dev = $("pvdevbox"), fr = $("pvframe"); if (!st) return;
  const [w, h] = PV_SIZES[pvDevice], pad = pvDevice === "desktop" ? 20 : 50;
  const k = Math.min(1, (st.clientWidth - pad) / w, (st.clientHeight - pad) / h);
  fr.style.width = w + "px"; fr.style.height = h + "px"; fr.style.transform = \`scale(\${k})\`;
  dev.style.width = Math.round(w * k) + "px"; dev.style.height = Math.round(h * k) + "px";
  dev.className = "dev " + pvDevice;
  paintPvButtons();
}
function sendPreview() {
  const fr = $("pvframe"); if (!fr || !fr.contentWindow) return;
  fr.contentWindow.postMessage({ type: "ll-preview", view: pvView, story: previewStory() }, new URL(SITE).origin);
}
function closePreview() { const x = $("pv"); if (x) x.remove(); }
addEventListener("message", (e) => { if (e.origin === new URL(SITE).origin && e.data && e.data.type === "ll-preview-ready") sendPreview(); });
addEventListener("resize", () => sizePreview());
addEventListener("keydown", (e) => { if (e.key === "Escape" && $("pv")) closePreview(); });

async function del() {
  if (!(await confirmModal("Delete this story?", (statusOf(cur) === "published" ? "It leaves the site and the app at once. " : "") + "It can be brought back from Deleted.", "Delete", true))) return;
  run(async () => { await call("delete", { id: cur.id, stamp: cur.stamp }); dropLocal(cur.id); cur = null; dirty = false; await load(); renderForm(); }, "Deleting…");
}
/* ------------------------------------------------ draft with AI */
let aiChat = [], aiChatId = null;                            // the chat's id ties its cost to the story it becomes
function openAI() {
  if ($("ai")) { $("aiq").focus(); return; }
  const box = document.createElement("div"); box.className = "ai"; box.id = "ai";
  box.innerHTML = \`<header><h1>Draft with AI <span class="model">· Claude Opus 5.5</span></h1><button class="btn" onclick="closeAI()">Close</button></header>
    <div id="aimsgs"></div>
    <div class="aiform"><textarea id="aiq" placeholder="What is the story? e.g. Round 2 recap for Boston, focus on Quintero's eagle on 13. Paste notes or quotes too."></textarea>
      <div class="row2"><p class="hint">It looks up the league's names, scores and stories. Nothing is saved until you apply the draft and press Save.<br><b id="aibudget"></b></p>
      <button class="btn pri" id="aisend" onclick="sendAI()">Send</button></div></div>\`;
  document.body.appendChild(box);
  $("aiq").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendAI(); });
  renderAI(); $("aiq").focus();
  call("budget").then(paintBudget).catch(() => {});
}
/* this week's AI allowance: every editor has a weekly amount, Draft with AI and photo descriptions together */
function paintBudget(b) {
  const el = $("aibudget"); if (!el || !b) return;
  el.textContent = b.league_over ? \`The league's AI allowance for this week is used up (€\${b.league_cap_eur.toFixed(2)} for everyone). It starts again on Monday.\`
    : b.over ? \`Your AI allowance for this week is used up (€\${b.cap_eur.toFixed(2)}). It starts again on Monday.\`
    : \`This week: €\${b.left_eur.toFixed(2)} of €\${b.cap_eur.toFixed(2)} left.\`;
  el.style.color = b.over ? "var(--bad, #e66)" : b.left_eur < 2 ? "var(--warn, #d9ad4e)" : "";
  if ($("aisend")) $("aisend").disabled = !!b.over;
}
function closeAI() { const a = $("ai"); if (a) a.remove(); }
function renderAI(waiting, error) {
  const EV = Object.fromEntries(ref.events.map((e) => [e.id, e]));
  const names = (ids, map) => (ids || []).map((x) => map[x] ? map[x].name : null).filter(Boolean).join(", ");
  $("aimsgs").innerHTML = (aiChat.length ? "" : '<div class="am a">Tell me what the story is about. I will check the board, the players and what is already published, then write a headline, a summary and the article for you to apply.</div>') +
    aiChat.map((m, i) => m.role === "user" ? \`<div class="am u">\${esc(m.content)}</div>\` :
      \`<div class="am a">\${esc(m.content)}\${m.proposal ? \`<div class="prop"><h3>\${esc(m.proposal.title)}</h3><p class="dek">\${esc(m.proposal.dek)}</p>
        <div class="art">\${TT.fromMd(m.proposal.body.split(/\\n\\s*\\n/))}</div>
        <div class="tags">\${[names(m.proposal.events, EV), names(m.proposal.cities, CITY), names(m.proposal.players, PLAYER)].filter(Boolean).join(" · ") || "No tags"}</div>
        \${(m.proposal.not_verified || []).length ? \`<div class="warn">Not verified: \${esc(m.proposal.not_verified.join("; "))}</div>\` : ""}
        <button class="btn pri" onclick="applyAI(\${i})">Apply to the story</button></div>\` : ""}
        <small>\${m.cost != null ? "This answer cost about $" + m.cost.toFixed(3) : ""}</small></div>\`).join("") +
    (waiting ? '<div class="am a wait">Looking things up and writing…</div>' : "") + (error ? \`<div class="am err">\${esc(error)}</div>\` : "");
  $("aimsgs").scrollTop = $("aimsgs").scrollHeight;
}
async function sendAI() {
  const q = $("aiq").value.trim(); if (!q || $("aisend").disabled) return;
  if (!aiChatId) aiChatId = crypto.randomUUID().slice(0, 18);
  aiChat.push({ role: "user", content: q }); $("aiq").value = ""; $("aisend").disabled = true; renderAI(true);
  try {
    const history = aiChat.map((m) => ({ role: m.role, content: m.role === "assistant" && m.proposal
      ? m.content + "\\n\\n[Proposed draft]\\nHeadline: " + m.proposal.title + "\\nSummary: " + m.proposal.dek + "\\nArticle:\\n" + m.proposal.body : m.content }));
    const j = await call("ai", { story_id: cur && cur.id, chat: aiChatId, messages: history, current: cur ? { title: $("title").value, dek: $("dek").value, body: ed ? TT.toMd(ed.getJSON()) : "" } : null });
    aiChat.push({ role: "assistant", content: j.reply, proposal: j.proposal, cost: j.cost });
    renderAI();
  } catch (e) { aiChat.pop(); $("aiq").value = q; renderAI(false, e.message); }
  $("aisend").disabled = false;
  call("budget").then(paintBudget).catch(() => {});
}
function applyAI(i) {
  const p = aiChat[i].proposal; if (!p || !cur) return;
  $("title").value = p.title; $("dek").value = p.dek;
  ed.commands.setContent(TT.fromMd(p.body.split(/\\n\\s*\\n/)));
  if ((p.cities || []).length) document.querySelectorAll("#cities button").forEach((b) => b.classList.toggle("on", p.cities.includes(b.dataset.id)));
  if ((p.events || []).length) document.querySelectorAll("#events button").forEach((b) => b.classList.toggle("on", p.events.includes(b.dataset.id)));
  if ((p.players || []).length) { cur.players = p.players.filter((id) => PLAYER[id]); paintPlayers(); }
  touch(); say("", "Draft applied. Read it, change what you like, then Save.");
}

/* ------------------------------------------------ photo library
   openLibrary() manages it; choosePhoto(title) uses the same page to pick one and resolves to
   { entry } (a photo from the library), { file } (a new one to upload) or null. */
let libPhotos = [];
const photoText = (e) => [e.caption, e.credit ? "Photo: " + e.credit : ""].filter(Boolean).join(" · ");
function libraryPage({ pick = false, title = "Photo library", resolve = null } = {}) {
  closeLibrary();
  // the Photos section is a page under the top menu; choosing a photo for a story is a dialog over the story
  const outer = document.createElement("div"); outer.id = "lib";
  let box = outer;
  if (pick) { outer.className = "mback libpick"; box = document.createElement("div"); box.className = "mbox libmodal"; outer.appendChild(box); }
  else outer.className = "lib";
  box.innerHTML = \`<div class="libbar"><h1>\${esc(title)}</h1><input type="search" id="libq" placeholder="Search descriptions, captions, credits, stories…" autocomplete="off">
      <div class="seg" id="libseg"><button data-s="all" class="on">All</button><button data-s="nodesc">No description</button><button data-s="unused">Not used</button><button data-s="review">To review</button></div>
      <span class="count" id="libcount"></span>
      \${pick ? "" : '<button type="button" class="btn" id="libsug" title="Claude looks at each photo without a description and suggests one for you to accept">✦ Suggest descriptions</button><button type="button" class="btn" id="liball" hidden>Accept all suggestions</button>'}
      <button type="button" class="btn pri" id="libup">\${pick ? "Upload new" : "Upload photos"}</button><input type="file" id="libfile" accept="image/*" \${pick ? "" : "multiple"} hidden>
      \${pick ? '<button type="button" class="btn" id="libclose">Cancel</button>' : ""}</div>
    <div class="grid" id="libgrid"><div class="empty">Loading the library…</div></div>\`;
  document.body.appendChild(outer);
  let filter = "all";
  const keys = (e) => { if (e.key === "Escape" && $("lib") === outer && !document.querySelector(".mback:not(.libpick)")) { e.preventDefault(); finish(null); } };
  const finish = (v) => { removeEventListener("keydown", keys, true); closeLibrary(); if (resolve) resolve(v); };
  if (pick) {
    $("libclose").onclick = () => finish(null);
    outer.addEventListener("mousedown", (e) => { if (e.target === outer) finish(null); });
    addEventListener("keydown", keys, true);
  }
  $("libup").onclick = () => $("libfile").click();
  $("libfile").onchange = () => {
    const files = [...$("libfile").files]; $("libfile").value = "";
    if (!files.length) return;
    if (pick) finish({ file: files[0] }); else uploadToLibrary(files);
  };
  $("libq").oninput = () => paintLibrary();
  if (!pick) {
    $("libsug").onclick = () => suggestFor(libPhotos.filter((e) => !e.alt && !e.suggested_alt));
    $("liball").onclick = async () => {
      const list = libPhotos.filter((e) => e.suggested_alt);
      if (!(await confirmModal("Accept " + list.length + " suggested descriptions?", "Each becomes the photo's description as written. You can still change any of them later.", "Accept all"))) return;
      for (const e of list) await call("libsave", { src: e.src, alt: e.suggested_alt, caption: e.caption, credit: e.credit });
      await loadLibrary(); paintLibrary();
    };
  }
  $("libseg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.s; $("libseg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); paintLibrary(); };
  if (!pick) {                                                // drop pictures anywhere on the library to add them
    box.addEventListener("dragover", (e) => { if ([...e.dataTransfer.items].some((i) => i.kind === "file")) { e.preventDefault(); box.classList.add("drop"); } });
    box.addEventListener("dragleave", (e) => { if (e.target === box || !box.contains(e.relatedTarget)) box.classList.remove("drop"); });
    box.addEventListener("drop", (e) => { box.classList.remove("drop"); const f = [...e.dataTransfer.files].filter((x) => /^image\\//.test(x.type)); if (f.length) { e.preventDefault(); uploadToLibrary(f); } });
  }
  /* which extra data the file carried (kept in e.meta): EXIF (camera), XMP (editing and rights), GPS (where it was taken) */
  const metaTags = (e) => {
    const k = Object.keys(e.meta || {}); if (!k.length) return "";
    const gps = k.filter((x) => x.startsWith("exif:GPS")).length, exif = k.filter((x) => x.startsWith("exif:")).length - gps, xmp = k.length - exif - gps;
    return \`<span class="mtags">\${exif ? \`<i class="exif" title="\${exif} EXIF fields: camera and settings">EXIF</i>\` : ""}\${xmp ? \`<i class="xmp" title="\${xmp} XMP fields: description, author, rights">XMP</i>\` : ""}\${gps ? \`<i class="gps" title="Where it was taken">GPS</i>\` : ""}</span>\`;
  };
  window.paintLibrary = () => {
    const words = $("libq").value.toLowerCase().split(/\\s+/).filter(Boolean);
    const rows = libPhotos.filter((e) => (filter === "all" || (filter === "nodesc" && !e.alt) || (filter === "unused" && !e.used_in.length) || (filter === "review" && e.suggested_alt)) &&
      words.every((w) => [e.alt, e.suggested_alt, e.caption, e.credit, e.src, ...tagNames(e), ...(e.terms || []), ...(e.suggested_terms || []), ...e.used_in.map((u) => shown(stories.find((s) => s.id === u.id) || {}, u.title))].join(" ").toLowerCase().includes(w)));
    const toReview = libPhotos.filter((e) => e.suggested_alt).length;
    if ($("liball")) { $("liball").hidden = !toReview; $("liball").textContent = "Accept all suggestions (" + toReview + ")"; }
    $("libcount").textContent = rows.length + " of " + libPhotos.length + " photos";
    $("libgrid").innerHTML = rows.map((e, i) => \`<button type="button" class="pcard" data-i="\${libPhotos.indexOf(e)}">\${metaTags(e)}<img src="\${esc(picw(e.src, 640))}" alt="" loading="lazy">
      <span>\${e.alt ? \`<b>\${esc(e.alt)}</b>\` : e.suggested_alt ? \`<i class="sug">\${esc(e.suggested_alt)}</i>\` : '<b class="none">No description yet</b>'}<small>\${tagNames(e).length ? esc(tagNames(e).slice(0, 3).join(", ")) + " · " : ""}\${esc(photoText(e) || "No caption")} · \${e.used_in.length ? "in " + e.used_in.length + " " + (e.used_in.length === 1 ? "story" : "stories") : "not used"}</small>
      \${pick || e.alt ? "" : \`<span class="pact">\${e.suggested_alt ? \`<span class="btn pri" data-act="accept">Accept</span>\` : \`<span class="btn" data-act="suggest">✦ Suggest</span>\`}</span>\`}</span></button>\`).join("") ||
      '<div class="empty" style="grid-column:1/-1">No photo matches.</div>';
  };
  $("libgrid").onclick = async (e) => {
    const c = e.target.closest(".pcard"); if (!c) return;
    const entry = libPhotos[+c.dataset.i];
    const act = e.target.closest("[data-act]");
    if (act && act.dataset.act === "accept") { await call("libsave", { src: entry.src, alt: entry.suggested_alt, caption: entry.caption, credit: entry.credit }); await loadLibrary(); paintLibrary(); return; }
    if (act && act.dataset.act === "suggest") { act.textContent = "Looking…"; await suggestFor([entry]); return; }
    if (pick) finish({ entry }); else editLibraryPhoto(entry);
  };
  loadLibrary().then(() => { paintLibrary(); $("libq").focus(); });
}
function closeLibrary() { const l = $("lib"); if (l) l.parentNode.removeChild(l); }
async function loadLibrary() { libPhotos = (await call("library")).photos; }
function openLibrary() { closeAI(); closeHistory(); closeUsage(); libraryPage(); }

/* ------------------------------------------------ the top menu: Stories, Photos, Videos, Shorts */
function closeAdmin() { const x = $("admin"); if (x) x.remove(); }
function adminBox(title) {
  const box = document.createElement("div"); box.className = "lib"; box.id = "admin";
  box.innerHTML = \`<div class="libbar"><h1>\${esc(title)}</h1><span class="msg" id="admmsg"></span></div><div class="adm" id="adm"><div class="empty">Loading…</div></div>\`;
  document.body.appendChild(box); return box;
}
const admSay = (kind, text) => { const m = $("admmsg"); if (m) { m.className = "msg " + kind; m.textContent = text; } };

/* ------------------------------------------------ the Admin menu: what the role allows, more to come */
function adminMenu(btn) {
  closePhotoMenu();
  const r = btn.getBoundingClientRect();
  const m = document.createElement("div"); m.className = "pmenu"; m.id = "pmenu";
  m.innerHTML = ME.can && ME.can.people ? '<button type="button" data-v="people">People and roles</button>' : "";
  document.body.appendChild(m);
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + "px";
  m.onclick = (ev) => { const b = ev.target.closest("button"); if (!b) return; closePhotoMenu(); goView(b.dataset.v); };
}

/* ------------------------------------------------ people and roles: the super admin manages everyone, a producer producers and editors */
let peopleInfo = null;
async function peoplePage() {
  adminBox("People");
  try { peopleInfo = await call("people"); paintPeople(); }
  catch (e) { $("adm").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; }
}
function paintPeople() {
  const P = peopleInfo, N = P.role_names, give = P.grantable;
  const roleBoxes = (pre, roles, editable) => P.roles.map((r) => \`<label><input type="checkbox" data-r="\${r}" \${roles.includes(r) ? "checked" : ""} \${editable && give.includes(r) ? "" : "disabled"}> \${esc(N[r])}</label>\`).join("");
  $("adm").innerHTML = \`
    <p class="hint"><b>Editors</b> write and publish in the Content Studio. <b>Producers</b> add producers and editors here, and change the structure (kinds, topics) in Claude Code. <b>Coders</b> change the code, in Claude Code. The <b>super admin</b> manages everyone. A person signs in with their email; adding them here lets them in.</p>
    <h2>Add a person</h2>
    <table><tr><th>Email</th><th>Name</th><th>Roles</th><th></th></tr>
      <tr id="padd-row"><td><input type="email" id="pnew-email" placeholder="name@example.com"></td><td><input type="text" id="pnew-name" placeholder="Optional"></td>
      <td class="roles">\${roleBoxes("new", ["editor"], true)}</td><td class="act"><button type="button" onclick="personSave(null)">Add</button></td></tr></table>
    <h2>Everyone (\${P.people.length})</h2>
    <table><tr><th>Email</th><th>Name</th><th>Roles</th><th>Added</th><th></th></tr>
    \${P.people.map((x, i) => \`<tr data-i="\${i}"><td>\${esc(x.email)}\${x.email === P.me ? " <small>(you)</small>" : ""}</td>
      <td><input type="text" value="\${esc(x.name || "")}" \${x.can_change ? "" : "readonly"}></td>
      <td class="roles">\${roleBoxes(i, x.roles, x.can_change)}</td>
      <td><small>\${esc(x.added_at ? when(x.added_at) : "")}\${x.added_by ? " · " + esc(x.added_by) : ""}</small></td>
      <td class="act">\${x.can_change ? \`<button type="button" onclick="personSave(\${i})">Save</button><button type="button" onclick="personRemove(\${i})">Remove</button>\` : ""}</td></tr>\`).join("")}</table>\`;
}
const rolesIn = (row) => [...row.querySelectorAll("input[data-r]:checked")].map((b) => b.dataset.r);
async function personSave(i) {
  const row = i == null ? $("padd-row") : $("adm").querySelector(\`tr[data-i="\${i}"]\`);
  const email = i == null ? $("pnew-email").value.trim() : peopleInfo.people[i].email;
  const name = i == null ? $("pnew-name").value.trim() : row.querySelector("input[type=text]").value.trim();
  admSay("", "Saving…");
  try {
    const j = await call("people", { action: "save", email, name, roles: rolesIn(row) });
    peopleInfo.people = j.people; paintPeople();
    admSay(j.access && !j.access.ok ? "err" : "ok", j.access && !j.access.ok ? j.access.note : i == null ? \`Added \${email}. They can sign in now.\` : "Saved.");
  } catch (e) { admSay("err", e.message); }
}
async function personRemove(i) {
  const x = peopleInfo.people[i];
  if (!(await confirmModal("Remove " + x.email + "?", "They can no longer use the Content Studio. Their stories and changes stay.", "Remove", true))) return;
  try {
    const j = await call("people", { action: "remove", email: x.email });
    peopleInfo.people = j.people; paintPeople();
    admSay(j.access && !j.access.ok ? "err" : "ok", j.access && !j.access.ok ? j.access.note : "Removed " + x.email + ".");
  } catch (e) { admSay("err", e.message); }
}
/* ------------------------------------------------ push alerts: compose and send or schedule, automatic alerts, history */
let AL = null, alTo = [];
async function alertsPage() {
  adminBox("Alerts");
  try { AL = await call("alerts"); paintAlerts(); }
  catch (e) { $("adm").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; }
}
const alName = (id) => CITY[id] ? CITY[id].name : PLAYER[id] ? PLAYER[id].name : id;
const alLink = (l) => !l ? "The app" : l === "live" ? "Live scores" : l.replace(/^story:/, "Story: ").replace(/^city:(.*)$/, (m, id) => "City: " + alName(id)).replace(/^player:(.*)$/, (m, id) => "Player: " + alName(id));
const alTarget = (t) => { try { t = JSON.parse(t); } catch (e) { return ""; } return t.all ? "Everyone" : "Following " + t.follows.slice(0, 3).map(alName).join(", ") + (t.follows.length > 3 ? " +" + (t.follows.length - 3) : ""); };
function paintAlerts() {
  const A = AL, D = A.devices;
  const opts = (o, sel) => Object.entries(o).map(([k, v]) => \`<option value="\${k}" \${k === sel ? "selected" : ""}>\${esc(v)}</option>\`).join("");
  const live = stories.filter((s) => (s.status || "published") === "published" || s.status === "scheduled").slice(0, 80);
  const fol = (id) => D.follows[id] ? \` <small>\${D.follows[id]}</small>\` : "";
  $("adm").innerHTML = \`
    <p class="hint">\${D.active} \${D.active === 1 ? "device" : "devices"} with alerts on (\${D.ios} iPhone, \${D.android} Android). No accounts: a device is its app install and what it follows.
      Each fan gets at most \${A.daily_cap} alerts a day, and never the same story twice. \${A.firebase ? "" : '<b style="color:var(--bad)">Firebase is not connected yet: nothing can be sent.</b>'}</p>
    <h2>New alert</h2>
    <div class="alform">
      <div class="alcol">
        <label>Title <em id="al-tn">0/65</em></label><input type="text" id="al-title" maxlength="65" placeholder="e.g. Austin lead after 9 holes" oninput="alCount()">
        <label>Text <em id="al-bn">0/178</em></label><textarea id="al-body" maxlength="178" rows="3" placeholder="One or two short sentences" oninput="alCount()"></textarea>
        <label>Kind</label><select id="al-type">\${opts(A.types, "news")}</select>
        <p class="hint">Fans choose which kinds they get in the app's Notifications screen.</p>
        <label>Opens</label>
        <div class="alrow"><select id="al-lk" onchange="alLinkKind()"><option value="">The app</option><option value="story">A story</option><option value="city">A city</option><option value="player">A player</option><option value="live">Live scores</option></select>
          <select id="al-lid" hidden></select></div>
      </div>
      <div class="alcol">
        <label>Send to</label>
        <div class="seg alseg" id="al-who"><button type="button" class="on" data-w="all">Everyone</button><button type="button" data-w="some">Followers of…</button></div>
        <div id="al-pick" hidden>
          <div class="events" id="al-cities">\${ref.cities.map((c) => \`<button type="button" data-id="\${c.id}">\${esc(c.name)}\${fol(c.id)}</button>\`).join("")}</div>
          <div class="alrow"><select id="al-player"><option value="">+ a player…</option>\${ref.players.slice().sort((a, b) => a.name < b.name ? -1 : 1).map((p) => \`<option value="\${p.id}">\${esc(p.name)}\${D.follows[p.id] ? " (" + D.follows[p.id] + ")" : ""}</option>\`).join("")}</select></div>
          <div class="events" id="al-players"></div>
          <p class="hint">A fan gets it if they follow any one of these. The numbers are devices following each.</p>
        </div>
        <label>When</label>
        <div class="seg alseg" id="al-when"><button type="button" class="on" data-w="now">Now</button><button type="button" data-w="later">Later</button></div>
        <input type="datetime-local" id="al-at" hidden>
        <div class="alphone"><div class="alnote"><i>LL</i><div><b id="al-pt">Legacy League</b><span id="al-pb">Your alert, as it shows on a phone.</span></div><small>now</small></div></div>
        <div class="alrow"><button class="btn pri" id="al-send" onclick="alSend()">Send now</button><span class="msg" id="al-msg"></span></div>
      </div>
    </div>
    \${A.may_rules ? \`<h2>Automatic alerts from the scoring feed</h2>
    <div class="alauto">\${Object.entries(A.auto_rules).map(([k, v]) => \`<label><input type="checkbox" data-rule="\${k}" \${A.rules[k] ? "checked" : ""} onchange="alRule(this)"> \${esc(v)}</label>\`).join("")}</div>
    <p class="hint">Each goes only to the fans who follow that city or player, once. In the demo, Round 2 at Mayakoba is replayed here: step the course clock or let it run (it moves every 5 minutes), and the alerts go out as things happen.</p>
    <div class="alrow alreplay"><b>Course clock \${esc(A.replay.clock)}</b> <small>Round 2, \${esc(A.replay.start)} to \${esc(A.replay.end)}\${A.replay.running ? " · running, +" + A.replay.step + " min every 5 minutes" : ""}</small>
      <button class="btn" onclick="alReplay('step', 10)">+10 min</button><button class="btn" onclick="alReplay('step', 30)">+30 min</button><button class="btn" onclick="alReplay('step', 120)">+2 h</button>
      <button class="btn" onclick="alReplay('\${A.replay.running ? "pause" : "run"}')">\${A.replay.running ? "Pause" : "Run by itself"}</button>
      <button class="btn" onclick="alReplay('reset')">Back to the first tee</button><span class="msg" id="al-rmsg"></span></div>\` : ""}
    <h2>Sent and scheduled</h2>
    \${A.alerts.length ? \`<table><tr><th>When</th><th>Alert</th><th>Opens</th><th>To</th><th class="n">Sent</th><th class="n">Skipped</th><th></th></tr>
    \${A.alerts.map((a) => \`<tr><td><small>\${esc(when(a.sent_at || a.send_at || a.created_at))}</small><br><small>\${a.status === "scheduled" ? "<b>scheduled</b>" : esc(a.status)}</small></td>
      <td><b>\${esc(a.title)}</b><br><small>\${esc(a.body)}</small><br><small>\${esc(A.types[a.type] || a.type)} · \${esc(a.source === "auto" ? a.created_by : "by " + a.created_by)}</small>\${a.note ? \`<br><small style="color:var(--bad)">\${esc(a.note)}</small>\` : ""}</td>
      <td><small>\${esc(alLink(a.link))}</small></td><td><small>\${esc(alTarget(a.target))}</small></td>
      <td class="n">\${a.status === "sent" ? a.sent + (a.failed ? \` <small style="color:var(--bad)">(\${a.failed} failed)</small>\` : "") : ""}</td>
      <td class="n"><small>\${a.status === "sent" && (a.dup || a.capped) ? [a.dup ? a.dup + " had it" : "", a.capped ? a.capped + " at the daily cap" : ""].filter(Boolean).join(", ") : ""}</small></td>
      <td class="act">\${a.status === "scheduled" ? \`<button type="button" onclick="alCancel('\${a.id}')">Cancel</button>\` : ""}</td></tr>\`).join("")}</table>\` : '<p class="hint">No alerts yet.</p>'}\`;
  const seg = (id, fn) => $(id).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); fn(b.dataset.w); };
  seg("al-who", (w) => { $("al-pick").hidden = w !== "some"; });
  seg("al-when", (w) => { $("al-at").hidden = w !== "later"; $("al-send").textContent = w === "later" ? "Schedule" : "Send now"; });
  $("al-cities").onclick = (e) => { const b = e.target.closest("button"); if (b) b.classList.toggle("on"); };
  $("al-player").onchange = (e) => { const id = e.target.value; e.target.value = ""; if (id && !alTo.includes(id)) { alTo.push(id); alPlayers(); } };
  alTo = []; alPlayers();
  $("al-lid").dataset.stories = JSON.stringify(live.map((s) => [s.id, s.title + (s.status === "scheduled" ? " (scheduled)" : "")]));
}
function alPlayers() {
  $("al-players").innerHTML = alTo.map((id) => \`<button type="button" class="on" data-id="\${id}" title="Remove">\${esc(alName(id))} ×</button>\`).join("");
  $("al-players").onclick = (e) => { const b = e.target.closest("button"); if (b) { alTo = alTo.filter((x) => x !== b.dataset.id); alPlayers(); } };
}
function alCount() {
  const t = $("al-title").value, b = $("al-body").value;
  $("al-tn").textContent = t.length + "/65"; $("al-bn").textContent = b.length + "/178";
  $("al-pt").textContent = t || "Legacy League"; $("al-pb").textContent = b || "Your alert, as it shows on a phone.";
}
function alLinkKind() {
  const k = $("al-lk").value, s = $("al-lid");
  const list = k === "story" ? JSON.parse(s.dataset.stories || "[]") : k === "city" ? ref.cities.map((c) => [c.id, c.name]) : k === "player" ? ref.players.map((p) => [p.id, p.name]).sort((a, b) => a[1] < b[1] ? -1 : 1) : [];
  s.hidden = !list.length;
  s.innerHTML = list.map(([id, name]) => \`<option value="\${id}">\${esc(name)}</option>\`).join("");
  s.onchange = () => { if (k === "story") { const st = stories.find((x) => x.id === s.value); if (st && !$("al-title").value.trim()) { $("al-title").value = st.title.slice(0, 65); alCount(); } } };
}
async function alSend(again) {
  const say = (k, t) => { const m = $("al-msg"); m.className = "msg " + k; m.textContent = t; };
  const later = !$("al-at").hidden, k = $("al-lk").value;
  const some = !$("al-pick").hidden, follows = some ? [...$("al-cities").querySelectorAll("button.on")].map((b) => b.dataset.id).concat(alTo) : [];
  if (some && !follows.length) return say("err", "Pick at least one city or player, or send to everyone.");
  if (later && !$("al-at").value) return say("err", "Pick when it goes out.");
  const body = { title: $("al-title").value.trim(), body: $("al-body").value.trim(), type: $("al-type").value,
    link: k ? { kind: k, id: $("al-lid").value } : null, target: some ? { follows } : { all: true },
    at: later ? new Date($("al-at").value).toISOString().slice(0, 16) : null, again: !!again };
  if (!later && !again && !(await confirmModal("Send this alert now?", \`"\${body.title}" goes to \${some ? "the fans following " + follows.map(alName).join(", ") : "everyone with the app"} right away. It cannot be taken back.\`, "Send now"))) return;
  say("", later ? "Scheduling…" : "Sending…"); $("al-send").disabled = true;
  try {
    const j = await call("alerts", body);
    if (j.duplicate) {
      $("al-send").disabled = false;
      if (await confirmModal("This story was already alerted", \`\${j.duplicate} \${j.duplicate === 1 ? "device has" : "devices have"} had an alert for it. Send to the others only? Those devices are skipped.\`, "Send to the others")) return alSend(true);
      return say("", "Not sent.");
    }
    AL = await call("alerts"); paintAlerts();
    const a = j.alert;
    say("ok", a.status === "scheduled" ? "Scheduled for " + when(a.send_at) + "." : \`Sent to \${a.sent} \${a.sent === 1 ? "device" : "devices"}\` + (a.dup || a.capped ? \` (\${[a.dup ? a.dup + " already had it" : "", a.capped ? a.capped + " at the daily cap" : ""].filter(Boolean).join(", ")})\` : "") + (a.failed ? \`, \${a.failed} failed\` : "") + ".");
  } catch (e) { say("err", e.message); $("al-send").disabled = false; }
}
async function alCancel(id) {
  if (!(await confirmModal("Cancel this alert?", "It will not go out.", "Cancel the alert", true))) return;
  try { await call("alerts", { action: "cancel", id }); AL = await call("alerts"); paintAlerts(); } catch (e) { admSay("err", e.message); }
}
async function alRule(box) {
  try { const j = await call("alertrules", { [box.dataset.rule]: box.checked }); AL.rules = j.rules; admSay("ok", "Saved."); } catch (e) { box.checked = !box.checked; admSay("err", e.message); }
}
async function alReplay(action, minutes) {
  try {
    const j = await call("replay", { action, minutes });
    AL = await call("alerts"); paintAlerts();
    const f = j.fired || [], m = $("al-rmsg");
    if (m && action === "step") { m.className = "msg ok"; m.textContent = f.length ? f.map((x) => \`\${x.title} → \${x.error ? "failed: " + x.error : x.sent + " sent"}\`).join(" · ") : "Nothing alert-worthy in those minutes."; }
  } catch (e) { admSay("err", e.message); }
}
function closeSoon() { const x = $("soon"); if (x) x.parentNode.removeChild(x); }
const SOON = {
  videos: ["Videos", "Highlights, documentaries and series, hosted with captions. To be decided: where the files live (Cloudflare Stream is in the plan), what a video entry holds (title, description, poster, captions, length, cities, players, events), and who uploads them."],
  shorts: ["Shorts", "Vertical clips for the app and social. To be decided what they are: their own feed, a kind of story, or clips cut from the videos, and what each one carries."],
};
function setView(v) {
  document.querySelectorAll("#snav button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  remember();
  closeLibrary(); closeSoon(); closeAI(); closeHistory(); closeUsage(); closeAdmin();
  if (v === "photos") libraryPage();
  else if (v === "people") peoplePage();
  else if (v === "alerts") alertsPage();
  else if (SOON[v]) {
    const box = document.createElement("div"); box.className = "lib"; box.id = "soon";
    box.innerHTML = \`<div class="soon"><div><h2>\${esc(SOON[v][0])}: coming</h2><p>\${esc(SOON[v][1])}</p></div></div>\`;
    document.body.appendChild(box);
  }
}
function goView(v) { setView(v); }                          // the open story stays as it is underneath, unsaved changes included
const choosePhoto = (title) => new Promise((resolve) => libraryPage({ pick: true, title, resolve }));
/* Events, cities and players for a photo: the same chips as on a story, inside a dialog */
function tagPicker(sel) {
  const has = (k, id) => (sel[k] || []).includes(id);
  return {
    html: \`<div class="mf"><label>Events<em>optional</em></label><div class="events" data-k="events">\${ref.events.map((e) => \`<button type="button" class="\${has("events", e.id) ? "on" : ""}" data-id="\${e.id}">\${esc(e.name)}\${e.status === "live" ? "<small>live</small>" : ""}</button>\`).join("")}</div></div>
      <div class="mf"><label>Cities<em>optional</em></label><div class="cities" data-k="cities">\${ref.cities.map((c) => \`<button type="button" style="--c:\${c.color}" class="\${has("cities", c.id) ? "on" : ""}" data-id="\${c.id}" title="\${esc(c.name)}">\${c.short}</button>\`).join("")}</div></div>
      <div class="mf"><label>Players<em>optional</em></label><input class="mpadd" list="mplist" placeholder="Type a name to add" autocomplete="off"><datalist id="mplist">\${ref.players.map((pl) => \`<option value="\${esc(pl.name)}">\${CITY[pl.city] ? CITY[pl.city].short : ""}</option>\`).join("")}</datalist><div class="chips mpchips"></div>
        <div class="hint">Only who is clearly in the photo. A player brings their city.</div></div>\`,
    wire(back) {
      let players = [...(sel.players || [])];
      const paint = () => { back.querySelector(".mpchips").innerHTML = players.map((id) => { const pl = PLAYER[id] || { name: id }, c = CITY[pl.city];
        return \`<span class="chip" style="--c:\${c ? c.color : "var(--dim)"}"><i></i>\${esc(pl.name)}<button type="button" data-drop="\${id}" title="Remove">×</button></span>\`; }).join(""); };
      back.querySelectorAll(".events,.cities").forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) b.classList.toggle("on"); }));
      back.querySelector(".mpchips").addEventListener("click", (e) => { const b = e.target.closest("[data-drop]"); if (b) { players = players.filter((x) => x !== b.dataset.drop); paint(); } });
      const input = back.querySelector(".mpadd");
      input.addEventListener("change", () => {
        const pl = ref.players.find((x) => x.name.toLowerCase() === input.value.trim().toLowerCase());
        if (pl && !players.includes(pl.id)) { players.push(pl.id); const cb = back.querySelector(\`.cities [data-id="\${pl.city}"]\`); if (cb) cb.classList.add("on"); paint(); }
        input.value = "";
      });
      back._players = () => players;
      paint();
    },
    read: (back) => ({
      events: [...back.querySelectorAll(".events button.on")].map((b) => b.dataset.id),
      cities: [...back.querySelectorAll(".cities button.on")].map((b) => b.dataset.id),
      players: back._players(),
    }),
  };
}
const tagNames = (e) => [...(e.events || []).map((id) => (ref.events.find((x) => x.id === id) || {}).name),
  ...(e.cities || []).map((id) => CITY[id] && CITY[id].name), ...(e.players || []).map((id) => PLAYER[id] && PLAYER[id].name)].filter(Boolean);
/* A photo's data in the details: the main facts in plain words, then every field the file carried */
function photoData(e) {
  const m = e.meta || {}, g = (k) => m["exif:" + k];
  const rows = [];
  const row = (k, v) => { if (v != null && v !== "") rows.push(\`<tr><td>\${esc(k)}</td><td>\${v}</td></tr>\`); };
  row("Size", e.w ? esc(e.w + " × " + e.h + " px") : "");
  row("Taken", e.taken_at ? esc(when(e.taken_at)) : "");
  row("Camera", esc(e.camera || [g("Make"), g("Model")].filter(Boolean).join(" ")));
  row("Lens", esc(g("LensModel") || m["aux:Lens"] || m["exifEX:LensModel"] || ""));
  row("Exposure", esc([g("ExposureTime"), g("FNumber") ? "f/" + g("FNumber") : "", g("ISO") ? "ISO " + g("ISO") : "", g("FocalLength") ? g("FocalLength") + " mm" : ""].filter(Boolean).join(" · ")));
  const lat = g("GPSLatitude"), lon = g("GPSLongitude");
  if (lat != null && lon != null) {
    const la = (g("GPSLatitudeRef") === "S" ? -1 : 1) * lat, lo = (g("GPSLongitudeRef") === "W" ? -1 : 1) * lon;
    row("Location", \`<a href="https://www.openstreetmap.org/?mlat=\${la}&mlon=\${lo}#map=16/\${la}/\${lo}" target="_blank" rel="noopener">\${esc(la.toFixed(5) + ", " + lo.toFixed(5))} ↗</a>\`);
  }
  row("Copyright", esc(m["dc:rights"] || g("Copyright") || ""));
  row("Software", esc(g("Software") || m["xmp:CreatorTool"] || ""));
  row("File", esc(e.src.split("/").pop()));
  row("Added", esc([e.added_at ? when(e.added_at) : "", e.added_by && e.added_by !== "store" ? "by " + e.added_by : e.added_by === "store" ? "(was in the store)" : ""].filter(Boolean).join(" ")));
  if (e.updated_by) row("Changed", esc(when(e.updated_at) + " by " + e.updated_by));
  const keys = Object.keys(m).sort();
  return \`<div class="mmeta"><table>\${rows.join("")}</table>\${keys.length
    ? \`<details><summary>All \${keys.length} fields in the file</summary><table>\${keys.map((k) => \`<tr><td>\${esc(k)}</td><td>\${esc(String(m[k]))}</td></tr>\`).join("")}</table></details>\`
    : '<p class="hint" style="margin-top:8px">The file carried no other data.</p>'}</div>\`;
}
async function editLibraryPhoto(e) {
  const uses = e.used_in.map((u) => shown(stories.find((s) => s.id === u.id) || {}, u.title) + " (" + u.how + ")");
  const sug = !e.alt && e.suggested_alt;
  const tagged = (e.events || []).length || (e.cities || []).length || (e.players || []).length;
  const fromStories = (k) => [...new Set(e.used_in.flatMap((u) => ((stories.find((s) => s.id === u.id) || {})[k]) || []))];
  const sel = tagged ? { events: e.events, cities: e.cities, players: e.players }
    : { events: fromStories("events"), cities: fromStories("cities"), players: fromStories("players") };
  const preTagged = !tagged && (sel.events.length || sel.cities.length || sel.players.length);
  const v = await modal({ custom: tagPicker(sel),
    title: "Photo details", img: picw(e.src, 1024), html: photoData(e),
    text: (uses.length ? "Used in: " + uses.join("; ") : "Not used in any story yet.") + (preTagged ? " Tags taken from the stories that use it: check them and save." : "") + (sug ? " The description is a suggestion from Claude: check it, add names if you know them, then save." : ""),
    fields: [
      { id: "alt", label: sug ? "Description (suggested)" : "Description", value: e.alt || e.suggested_alt || "", type: "textarea", rows: 2, required: true, requiredText: "Describe the photo: it is read aloud to people who cannot see it.", hint: "What the photo shows, for people who cannot see it." },
      { id: "caption", label: "Caption", value: e.caption, hint: "Shown under the photo when it goes in an article." },
      { id: "credit", label: "Credit", value: e.credit, placeholder: "e.g. Jane Smith", hint: "Who took it." },
    ],
    ok: "Save", extra: e.used_in.length ? null : { label: "Remove from library", value: "hide", danger: true },
  });
  if (!v) return;
  try {
    if (v.action === "hide") {
      if (!(await confirmModal("Remove this photo from the library?", "It is used in no story. The file stays in the store, so nothing on the site changes.", "Remove", true))) return;
      await call("libhide", { src: e.src });
    } else await call("libsave", { src: e.src, ...v });
    await loadLibrary(); paintLibrary();
  } catch (err) { await confirmModal("That did not work", err.message, "OK"); }
}
/* suggestions, one photo after another; each waits on its card for the editor */
async function suggestFor(list) {
  if (!list.length) { await confirmModal("Nothing to suggest", "Every photo has a description or a suggestion waiting.", "OK"); return; }
  if (list.length > 1 && !(await confirmModal("Suggest descriptions for " + list.length + " photos?",
    "Claude looks at each photo and writes a description for you to accept or change. It never names people. Each one costs a fraction of a cent (Claude Haiku) and shows in AI usage.", "Suggest"))) return;
  let cost = 0, done = 0, failed = 0, capped = null;
  if ($("libsug")) $("libsug").disabled = true;
  for (const e of list) {
    $("libcount").textContent = "Describing " + (done + failed + 1) + " of " + list.length + "…";
    try { const j = await call("describe", { src: e.src }); cost += j.cost || 0; done++; Object.assign(e, j.photo || {}); paintLibrary(); }
    catch (err) { failed++; if (/allowance/.test(err.message)) { capped = err.message; break; } }
  }
  if ($("libsug")) $("libsug").disabled = false;
  await loadLibrary(); paintLibrary();
  $("libcount").textContent = done + " suggested" + (failed ? ", " + failed + " could not be" : "") + " · about $" + cost.toFixed(2);
  if (capped) await confirmModal("AI allowance used up", capped, "OK");
}
async function uploadToLibrary(files) {
  for (let i = 0; i < files.length; i++) {
    const which = files.length > 1 ? \` (\${i + 1} of \${files.length})\` : "";
    try {
      const meta = await readMeta(files[i]);
      const { blob, w, h } = await shrink(files[i]);
      const preview = URL.createObjectURL(blob);
      const live = ref.events.find((x) => x.status === "live");
      const v = await modal({ title: "Add to the library" + which, img: preview, text: metaNote(meta), custom: tagPicker({ events: live ? [live.id] : [] }),
        fields: [
          { id: "alt", label: "Description", value: meta.alt, type: "textarea", rows: 2, required: true, requiredText: "Describe the photo: it is read aloud to people who cannot see it.", placeholder: "e.g. Omar Quintero hits a 5-wood on the 13th", hint: "What the photo shows. It also makes the photo easy to find." },
          { id: "caption", label: "Caption", value: meta.caption, placeholder: "e.g. The 13th at El Camaleón" },
          { id: "credit", label: "Credit", value: meta.credit, placeholder: "e.g. Jane Smith" },
        ], ok: "Add photo" });
      URL.revokeObjectURL(preview);
      if (!v) continue;
      $("libcount").textContent = "Uploading" + which + "…";
      const j = await uploadBlob(blob, w, h, { alt: v.alt, caption: v.caption, credit: v.credit, taken: meta.taken, camera: meta.camera, all: meta.all, library: true });
      if (v.events.length || v.cities.length || v.players.length) await call("libsave", { src: j.src, alt: v.alt, caption: v.caption, credit: v.credit, events: v.events, cities: v.cities, players: v.players });
    } catch (e) { await confirmModal("That photo could not be added", e.message || "Save it as a JPEG and try again.", "OK"); }
  }
  await loadLibrary(); paintLibrary();
}
const metaJson = (all) => {
  if (!all) return "";
  const keep = {};
  for (const [k, v] of Object.entries(all)) { const t = String(v); if (t.length <= 300 && Object.keys(keep).length < 80) keep[k] = typeof v === "number" ? v : t; }
  let j = JSON.stringify(keep);
  while (j.length > 6000) { const ks = Object.keys(keep); delete keep[ks[ks.length - 1]]; j = JSON.stringify(keep); }
  return Object.keys(keep).length ? j : "";
};
/* one upload for every place a photo comes from; the library records it with what is known about it */
async function uploadBlob(blob, w, h, meta = {}) {
  const enc = (x) => encodeURIComponent(x || "");
  const r = await fetch(API + "upload", { method: "POST", body: blob, headers: { "content-type": "image/jpeg", "x-photo-size": w + "x" + h,
    "x-editor": enc(EDITOR), "x-photo-alt": enc(meta.alt), "x-photo-caption": enc(meta.caption), "x-photo-credit": enc(meta.credit), "x-photo-taken": enc(meta.taken), "x-photo-camera": enc(meta.camera), "x-photo-meta": enc(metaJson(meta.all)), ...(meta.library ? { "x-library": "1" } : {}) } });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || "The upload failed.");
  return j;
}

/* ------------------------------------------------ AI usage */
function closeUsage() { const u = $("usage"); if (u) u.parentNode.removeChild(u); }
async function openUsage() {
  closeHistory(); closeUsage();
  const box = document.createElement("div"); box.className = "ai usage"; box.id = "usage";
  box.innerHTML = '<header><h1>AI usage <span class="model">· Draft with AI, Claude Opus 5.5</span></h1><button class="btn" onclick="closeUsage()">Close</button></header><div id="ubody" style="flex:1;overflow-y:auto;padding:16px 18px"><div class="empty">Loading…</div></div>';
  document.body.appendChild(box);
  try {
    const u = await call("usage");
    const $$ = (n) => "$" + (+n).toFixed(n < 1 ? 3 : 2);
    const table = (head, rows) => rows.length ? \`<table><tr>\${head.map((h, i) => \`<th\${i ? ' class="n"' : ""}>\${h}</th>\`).join("")}</tr>\${rows.join("")}</table>\` : '<p class="hint">Nothing yet.</p>';
    const art = (r) => r.title ? esc(shown(stories.find((s) => s.id === r.key || s.id === r.story) || {}, r.title)) : esc(r.key || r.story || "(never saved)");
    $("ubody").innerHTML = \`
      <div class="big">\${$$(u.total.cost)}</div><p class="hint">\${u.total.requests} AI request\${u.total.requests === 1 ? "" : "s"} in all, paid on the league's Anthropic account.</p>
      <h3>This week · €\${u.budget.cap_eur} each</h3>\${table(["Person", "Requests", "Spent"], u.week.map((r) => \`<tr><td>\${esc(r.key)}</td><td class="n">\${r.requests}</td><td class="n">€\${r.cost_eur.toFixed(2)} of €\${r.cap_eur}</td></tr>\`))}
      <p class="hint">You have €\${u.budget.left_eur.toFixed(2)} left this week. The whole league together: €\${u.budget.league_spent_eur.toFixed(2)} of €\${u.budget.league_cap_eur}. Every week starts on Monday at 00:00 UTC.</p>
      <h3>By person, all time</h3>\${table(["Person", "Requests", "Cost"], u.by_user.map((r) => \`<tr><td>\${esc(r.key)}</td><td class="n">\${r.requests}</td><td class="n">\${$$(r.cost)}</td></tr>\`))}
      <h3>By article</h3>\${table(["Article", "Requests", "Cost"], u.by_article.map((r) => \`<tr><td>\${art(r)}</td><td class="n">\${r.requests}</td><td class="n">\${$$(r.cost)}</td></tr>\`))}
      <h3>By month</h3>\${table(["Month", "Requests", "Cost"], u.by_month.map((r) => \`<tr><td>\${esc(r.key)}</td><td class="n">\${r.requests}</td><td class="n">\${$$(r.cost)}</td></tr>\`))}
      <h3>Latest requests</h3>\${table(["When · who · article", "", "Cost"], u.recent.map((r) => \`<tr><td>\${esc(when(r.at))} · \${esc(r.user)} · \${r.title ? art(r) : esc(r.story || "(never saved)")}<br><small style="color:var(--dim)">\${esc(r.asked || "")}</small></td><td></td><td class="n">\${$$(r.cost)}</td></tr>\`))}\`;
  } catch (e) { $("ubody").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; }
}

/* ------------------------------------------------ history */
function versionHtml(v) {
  const names = (ids, map) => (ids || []).map((x) => map[x] ? map[x].name : x).join(", ");
  const EV = Object.fromEntries(ref.events.map((e) => [e.id, e]));
  return \`\${v.photo ? \`<img src="\${esc(picw(v.photo, 1024))}" alt="">\` : ""}<span class="st \${statusOf(v)}">\${statusOf(v)}</span> <small style="color:var(--dim)">\${esc(v.kind || "")} · \${esc(when(v.at))}</small>
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
  if (!(await confirmModal("Restore this version?", (statusOf(cur) === "published" ? "The site shows it at once. " : "") + "The version it replaces is kept in the history.", "Restore")))
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
$("q").oninput = renderList;
$("snav").onclick = (e) => { const b = e.target.closest("button"); if (b) goView(b.dataset.v); };
$("seg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.s;
  try { localStorage.setItem("studio-filter", filter); } catch (err) {}
  document.querySelectorAll("#seg button").forEach((x) => x.classList.toggle("on", x === b));
  if (filter === "deleted") { $("list").innerHTML = '<div class="empty">Loading…</div>'; call("deleted").then((j) => { deleted = j.deleted; renderList(); }); }
  else renderList(); };
$("new").onclick = async () => { if (!(await leaveUnsaved())) return; closeAI(); aiChat = []; aiChatId = null; cur = blank(); dirty = false; renderList(); renderForm(); $("title").focus(); };
addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
(async () => {
  try {
    const me = await call("me"); ME = me;
    if (me.email) { SIGNED = me; EDITOR = me.email; $("whobtn").title = "Signed in as " + (me.roles || []).map((r) => (me.role_names || {})[r] || r).join(", ") + ": your changes and AI requests carry this address"; }
    $("adminbtn").hidden = !(me.can && me.can.people);              // the People view has no tab of its own: it opens from ⚙︎ Admin
  } catch (e) {}
  paintWho();
  if (!EDITOR) setTimeout(askName, 400);
  try {
    ref = await call("ref");
    STRUCT = (await call("structure")).structure;
    CITY = Object.fromEntries(ref.cities.map((c) => [c.id, c])); PLAYER = Object.fromEntries(ref.players.map((p) => [p.id, p]));
    await load();
    let saved = "all";
    try { saved = localStorage.getItem("studio-filter") || "all"; } catch (err) {}
    if (saved !== "all") { const b = document.querySelector(\`#seg [data-s="\${saved}"]\`); if (b) b.click(); }
    const h = location.hash, m = h.match(/^#story\\/([a-z]\\d+)$/);
    if (m && stories.find((s) => s.id === m[1])) show(m[1]);
    else if (h === "#new" && readLocal(null)) { cur = blank(); dirty = false; renderList(); renderForm(); offerLocal(null); }
    else if (/^#(photos|videos|shorts|alerts)$/.test(h) || (h === "#people" && ME.can && ME.can.people)) setView(h.slice(1));
  } catch (e) { $("main").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; }
})();
</script></body></html>`;
}
