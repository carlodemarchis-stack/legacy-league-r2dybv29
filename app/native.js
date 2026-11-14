// Native touches for the Capacitor shell. Does nothing in a plain browser.
const cap = window.Capacitor;
if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
  const { StatusBar, Haptics, ImpactStyle, Browser, App, SplashScreen } = cap.Plugins;
  document.documentElement.classList.add("native");
  StatusBar && StatusBar.setStyle({ style: "DARK" }).catch(() => {});
  SplashScreen && SplashScreen.hide().catch(() => {});
  // Haptic tick on every card change (the film updates the hash on navigation).
  let last = location.hash;
  window.addEventListener("hashchange", () => {
    if (location.hash !== last) { last = location.hash; Haptics && Haptics.impact({ style: "LIGHT" }).catch(() => {}); }
  });
  // External links open in the system browser sheet instead of inside the web view.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href^='http']");
    if (a && !a.href.startsWith(location.origin)) { e.preventDefault(); Browser && Browser.open({ url: a.href }); }
  });
  // Android back button steps back through cards, then exits.
  App && App.addListener("backButton", ({ canGoBack }) => { canGoBack ? history.back() : App.exitApp(); });
}

/* Push alerts. No account: the phone keeps a random device id, its alert choices and what it follows (the page's
   own follow list, ll.follow); the Desk keeps the same, with the Firebase token, to know who gets what.
   Permission is asked after the first follow, with a short explanation first, never at launch. */
if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.FirebaseMessaging) {
  const FM = cap.Plugins.FirebaseMessaging;
  const DESK = "https://legacy-league-desk.legacy-league-demo.workers.dev";
  const TYPES = [["results", "Results", "Each round's result and your city's finish"], ["leaders", "Round leaders", "Lead changes, eagles and holes in one"],
                 ["news", "News", "League news and stories"], ["mission", "Mission", "The league's mental-health work"]];
  const get = (k, d) => { try { const v = localStorage.getItem("ll." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem("ll." + k, JSON.stringify(v)); } catch (e) {} };
  let id = get("push.id", null);
  if (!id) { id = crypto.randomUUID(); set("push.id", id); }
  const follows = () => get("follow", []);
  const types = () => get("push.types", TYPES.map((t) => t[0]));
  const on = () => get("push.on", true);
  const granted = async () => (await FM.checkPermissions()).receive === "granted";

  // tell the Desk what this phone wants (after a follow, a change of choices, or a new token)
  let timer = null;
  const sync = () => { clearTimeout(timer); timer = setTimeout(register, 600); };
  async function register() {
    try {
      if (!(await granted())) return;
      const { token } = await FM.getToken();
      if (!token) return;
      await fetch(DESK + "/push/register", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, token, platform: cap.getPlatform(), follows: follows(), types: types(), enabled: on(), app: "0.1" }) });
    } catch (e) { console.warn("push register", e); }
  }
  FM.addListener("tokenReceived", sync);

  // a tapped alert opens what it is about: a story, a city, a player or the live board
  function open(link) {
    const [kind, key] = String(link || "").split(/:(.*)/s);
    try {
      if (kind === "story" && key) openStoryByKey(key);
      else if (kind === "city" && key) goCity(key);
      else if (kind === "player" && key) goPlayer(key);
      else if (kind === "live") go(SEC.live);
    } catch (e) { console.warn("push open", e); }
  }
  FM.addListener("notificationActionPerformed", (e) => open(e.notification && e.notification.data && e.notification.data.link));

  // a small sheet in the page's own look: the ask after the first follow, and the Notifications screen
  const css = document.createElement("style");
  css.textContent = `#tb-bell{flex:0 0 auto;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:rgba(var(--veil),.06);color:var(--ink);display:grid;place-items:center}
#tb-bell svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}#tb-bell.off svg{opacity:.45}
@media(max-aspect-ratio:1/1){#tb-bell{position:absolute;top:calc(4px + env(safe-area-inset-top));right:calc(clamp(14px,4vw,22px) + 38px);width:30px;height:30px}#topbar .tb-l{padding-right:78px}}
#pushsheet .mbox{width:min(460px,94vw);gap:12px;overflow-y:auto}#pushsheet h3{margin:0;font-size:20px}#pushsheet p{margin:0;color:var(--dim);font-size:14px;line-height:1.45}
#pushsheet .prow{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line)}#pushsheet .prow span{flex:1}#pushsheet .prow small{display:block;color:var(--dim);font-size:12px;margin-top:2px}
#pushsheet .sw{flex:none;width:46px;height:28px;border-radius:999px;background:var(--line);position:relative;transition:.2s}#pushsheet .sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:.2s}
#pushsheet .sw.on{background:var(--green)}#pushsheet .sw.on::after{left:21px}#pushsheet .dimmed{opacity:.4;pointer-events:none}
#pushsheet .pbtns{display:flex;gap:10px;justify-content:flex-end;margin-top:6px}#pushsheet .pbtns button{padding:10px 16px;border-radius:999px;border:1px solid var(--line);color:var(--ink);font-weight:600}
#pushsheet .pbtns .go{background:var(--green);border-color:var(--green);color:#fff}#pushsheet .chips{display:flex;flex-wrap:wrap;gap:6px}`;
  document.head.appendChild(css);
  const sheet = document.createElement("div");
  sheet.className = "modal"; sheet.id = "pushsheet";
  sheet.innerHTML = `<div class="mbox"><button class="mclose" aria-label="Close">&times;</button><div id="pushbody"></div></div>`;
  sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest(".mclose")) sheet.classList.remove("on"); });
  document.body.appendChild(sheet);
  const body = () => document.getElementById("pushbody");
  const name = (f) => (typeof CITY !== "undefined" && CITY[f] ? CITY[f].name : typeof PLAYER !== "undefined" && PLAYER[f] ? PLAYER[f].name : f);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function ask(first) {
    body().innerHTML = `<h3>Get alerts for ${esc(name(first))}?</h3>
      <p>Round leaders, final results and news for the cities and players you follow. At most 15 a day, never the same story twice. No account: your choices stay on this phone and with the league's alert service.</p>
      <div class="pbtns"><button data-a="no">Not now</button><button class="go" data-a="yes">Turn on alerts</button></div>`;
    sheet.classList.add("on");
    const yes = await new Promise((res) => { body().onclick = (e) => { const b = e.target.closest("[data-a]"); if (b) res(b.dataset.a === "yes"); };
      sheet.addEventListener("click", function c(e) { if (e.target === sheet || e.target.closest(".mclose")) { sheet.removeEventListener("click", c); res(false); } }); });
    sheet.classList.remove("on");
    set("push.asked", true);
    if (!yes) return;
    const r = await FM.requestPermissions().catch(() => ({}));
    if (r.receive === "granted") { set("push.on", true); register(); }
    paintBell();
  }

  async function screen() {
    const ok = await granted(), denied = (await FM.checkPermissions()).receive === "denied", f = follows();
    body().innerHTML = `<h3>Notifications</h3>
      ${denied ? `<p>Alerts are turned off for this app in your phone's Settings. Turn them on there (Settings → Notifications → Legacy League) to get them.</p>` :
        !ok ? `<p>Alerts are not on yet.</p><div class="pbtns"><button class="go" data-a="allow">Turn on alerts</button></div>` : ""}
      <div class="${ok ? "" : "dimmed"}">
        <div class="prow"><span><b>Alerts</b><small>For the cities and players you follow</small></span><button class="sw ${on() ? "on" : ""}" data-t="all" aria-label="Alerts"></button></div>
        <div class="${on() ? "" : "dimmed"}">${TYPES.map(([k, label, sub]) => `<div class="prow"><span>${label}<small>${sub}</small></span><button class="sw ${types().includes(k) ? "on" : ""}" data-t="${k}" aria-label="${label}"></button></div>`).join("")}</div>
      </div>
      <div class="prow"><span>Following<small>${f.length ? "" : "Nobody yet: follow a city or a player to get their alerts."}</small>
        <div class="chips">${f.map((x) => `<span class="pill">${esc(name(x))}</span>`).join("")}</div></span></div>
      <p style="font-size:12px">No account and no personal data: this phone has a random id, and the league keeps only that id, what you follow and these choices. At most 15 alerts a day.</p>`;
    body().onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "allow") { const r = await FM.requestPermissions().catch(() => ({})); set("push.asked", true); if (r.receive === "granted") register(); return screen().then(paintBell); }
      if (b.dataset.t === "all") set("push.on", !on());
      else if (b.dataset.t) { const t = new Set(types()); t.has(b.dataset.t) ? t.delete(b.dataset.t) : t.add(b.dataset.t); set("push.types", [...t]); }
      sync(); screen(); paintBell();
    };
    sheet.classList.add("on");
  }

  // the bell in the top bar opens the Notifications screen
  const bell = document.createElement("button");
  bell.id = "tb-bell"; bell.title = "Notifications"; bell.setAttribute("aria-label", "Notifications");
  bell.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/></svg>`;
  bell.onclick = screen;
  const search = document.getElementById("tb-search");
  if (search) search.before(bell);
  async function paintBell() { bell.classList.toggle("off", !(on() && (await granted()))); }
  paintBell();

  // follows change on the page: the first one asks, every one updates the Desk
  addEventListener("ll:follow", (e) => {
    const f = e.detail || [];
    if (f.length && !get("push.asked", false)) granted().then((g) => g ? (set("push.asked", true), sync()) : ask(f[f.length - 1]));
    else sync();
  });
  register();                                   // on every launch: the token may have changed
}
