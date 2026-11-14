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
