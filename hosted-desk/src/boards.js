/* Leaderboards in articles: a paragraph that is only a line like
     leaderboard: board=event event=mayakoba top=5 at=r1
   becomes a leaderboard on the site and in the app, drawn in the site's own style. The site carries a copy of
   parseBoard in template.html (search "BOARDS"): keep the two in step.

   board  event    the event's team leaderboard (today, thru, total, league points)
          season   league points, the season table (one event so far: Mayakoba)
          city     one city's round: each player, holes played, score, counted scores
   event  the event's id (default: the event being played)
   city   the city's id, for board=city
   round  1 or 2, for board=city (default 2)
   top    how many rows: 3, 5, 10 or all (default 5; a city shows all its players)
   at     live     the current standings, always (event and season only)
          r1       frozen after Round 1
          HH:MM    frozen at that course time on Round 2 day
          final    frozen at the end of the event
   A frozen board is calculated by the Desk when the story is saved and kept with it (s.boards), so it never changes. */

export const BOARD_KINDS = { event: "Event leaderboard", season: "Season standings", city: "A city's round" };
const KEYS = ["board", "event", "city", "round", "top", "at"];

export function parseBoard(line) {
  const m = String(line || "").trim().match(/^leaderboard:\s*(.*)$/i);
  if (!m) return null;
  const o = {};
  for (const part of m[1].split(/\s+/).filter(Boolean)) {
    const [k, v] = part.split("=");
    if (KEYS.includes(k) && v && /^[\w:.-]{1,40}$/.test(v)) o[k] = v.toLowerCase();
  }
  if (!BOARD_KINDS[o.board]) return null;
  if (o.board === "city" && !o.city) return null;
  o.top = o.top === "all" ? "all" : String(Math.min(30, Math.max(1, parseInt(o.top || (o.board === "city" ? "30" : "5"), 10) || 5)));
  o.round = o.board === "city" ? (o.round === "1" ? "1" : "2") : undefined;
  o.at = o.at === "live" && o.board !== "city" ? "live" : /^(r1|final|\d{1,2}:\d{2})$/.test(o.at || "") ? o.at : o.board === "city" ? "final" : "live";
  return o;
}
/* the line for a spec, keys in a fixed order, so the same board always reads the same */
export const boardLine = (o) => "leaderboard: " + KEYS.filter((k) => o[k] != null && o[k] !== "").map((k) => `${k}=${o[k]}`).join(" ");
export const isBoardLine = (line) => !!parseBoard(line);
