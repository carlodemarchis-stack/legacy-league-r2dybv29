// The team board and one city's round, computed from the scoring feed in the store (scores/feed.json), the same
// way the site computes what fans see and the Mac desk's live_board and city_round do. Every score is strokes
// relative to par: negative is under par.
//
// The feed is provider-shaped: tee_sheet (pairing groups, tee times), scores (each player's hole scores per round),
// event.course.holes (par, yardage), sim.minutes_per_hole. In the demo a hole counts as played once its group has
// had time to finish it at the course time asked for; in production the feed itself says which holes are in.

const hhmm = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const minutes = (clock) => {
  const m = String(clock || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error("clock must be a course time like 14:20");
  return +m[1] * 60 + +m[2];
};

export function scoring(feed, site) {
  const PAR = feed.event.course.holes.map((h) => h.par);
  const RULES = site.rules;
  const PLAYER = Object.fromEntries(site.players.map((p) => [p.id, p]));
  const TEE = {}, SCORE = {};
  for (const g of feed.tee_sheet) {
    const [h, m] = g.tee_time.slice(11, 16).split(":").map(Number);
    for (const p of g.players) (TEE[p.id] = TEE[p.id] || {})[g.round_id] = h * 60 + m;
  }
  for (const s of feed.scores) (SCORE[s.round_id] = SCORE[s.round_id] || {})[s.player_id] = s.hole_scores;
  const mph = feed.sim.minutes_per_hole;
  const posted = (rid, pid, h, clock) => rid === "r1" || TEE[pid][rid] + (h + 1) * mph <= clock;
  const team = (cid) => site.players.filter((p) => p.city === cid).map((p) => p.id);

  function teamRound(cid, rid, clock) {
    const ids = team(cid);
    let toPar = 0, thru = 0;
    PAR.forEach((par, h) => {
      const got = ids.filter((pid) => posted(rid, pid, h, clock)).map((pid) => SCORE[rid][pid][h]).sort((a, b) => a - b);
      if (got.length === ids.length) { toPar += got.slice(0, RULES.best_balls).reduce((a, b) => a + b, 0) - par * RULES.best_balls; thru++; }
    });
    const rounds = ids.map((pid) => {
      const holes = PAR.map((_, h) => h).filter((h) => posted(rid, pid, h, clock));
      return holes.length ? { player: PLAYER[pid].name, thru: holes.length, to_par: holes.reduce((a, h) => a + SCORE[rid][pid][h] - PAR[h], 0) } : null;
    }).filter(Boolean).sort((a, b) => a.to_par - b.to_par);
    return { to_par: toPar, thru, final: thru === 18, best: rounds.slice(0, 2) };
  }

  const finalAt = () => hhmm(Math.max(...Object.values(TEE).map((v) => v.r2)) + 18 * mph);

  function board(clock) {
    const t = minutes(clock);
    const rows = site.cities.map((c) => {
      const r1 = teamRound(c.id, "r1", t), r2 = teamRound(c.id, "r2", t);
      return { city: c.name, short: c.short, id: c.id, r1: r1.to_par, today: r2.to_par, thru: r2.final ? "F" : r2.thru,
               total: r1.to_par + r2.to_par, best_today: r2.best };
    }).sort((a, b) => a.total - b.total || (a.city < b.city ? -1 : 1));
    for (let i = 0; i < rows.length;) {                       // tied places share the average of their points
      let j = i;
      while (j + 1 < rows.length && rows[j + 1].total === rows[i].total) j++;
      const pts = RULES.points.slice(i, j + 1).reduce((a, b) => a + b, 0) / (j - i + 1);
      for (let k = i; k <= j; k++) { rows[k].pos = (j > i ? "T" : "") + (i + 1); rows[k].points = Math.round(pts * 10) / 10; }
      i = j + 1;
    }
    return { event: feed.event.name, round: "Round 2", course_time: clock, final_at: finalAt(),
             final: rows.every((r) => r.thru === "F"), board: rows };
  }

  function cityRound(cid, clock, round) {
    const rid = `r${round}`;
    if (!SCORE[rid]) throw new Error("round must be 1 or 2");
    const now = minutes(clock), holes = feed.event.course.holes, ids = team(cid);
    const postedAt = (pid, i) => TEE[pid][rid] + (i + 1) * mph;
    const tally = Object.fromEntries(ids.map((pid) => [pid, { counted_scores: 0, counted_under_par: 0 }]));
    const teamHoles = [], countedOn = {};
    PAR.forEach((par, i) => {
      if (!ids.every((pid) => posted(rid, pid, i, now))) return;
      const best = ids.map((pid) => [SCORE[rid][pid][i], pid]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)).slice(0, RULES.best_balls);
      countedOn[i] = new Set(best.map(([, pid]) => pid));
      for (const [sc, pid] of best) { tally[pid].counted_scores++; if (sc < par) tally[pid].counted_under_par++; }
      teamHoles.push({ hole: i + 1, par, to_par: best.reduce((a, [sc]) => a + sc, 0) - par * RULES.best_balls,
                       counted: best.map(([sc, pid]) => ({ player: PLAYER[pid].name, to_par: sc - par })) });
    });
    const players = [], notable = [];
    for (const pid of ids) {
      const done = PAR.map((_, i) => i).filter((i) => posted(rid, pid, i, now));
      players.push({ id: pid, name: PLAYER[pid].name, captain: PLAYER[pid].captain, thru: done.length, finished: done.length === 18,
                     to_par: done.reduce((a, i) => a + SCORE[rid][pid][i] - PAR[i], 0),
                     birdies_or_better: done.filter((i) => SCORE[rid][pid][i] < PAR[i]).length, ...tally[pid] });
      for (const i of done) {
        const sc = SCORE[rid][pid][i];
        if (sc === 1 || sc <= PAR[i] - 2)
          notable.push({ what: sc === 1 ? "hole in one" : { 2: "eagle", 3: "albatross" }[PAR[i] - sc], player: PLAYER[pid].name, id: pid,
                         hole: i + 1, par: PAR[i], yardage: holes[i].yardage, score: sc, posted: hhmm(postedAt(pid, i)),
                         firm: i in countedOn, counted: i in countedOn ? countedOn[i].has(pid) : null });
      }
    }
    players.sort((a, b) => b.counted_under_par - a.counted_under_par || b.counted_scores - a.counted_scores || (a.name < b.name ? -1 : 1));
    notable.sort((a, b) => (a.posted < b.posted ? -1 : 1));
    return { round, course_time: rid === "r2" ? clock : "complete",
             team: { thru: teamHoles.length, to_par: teamHoles.reduce((a, x) => a + x.to_par, 0), holes: teamHoles }, players, notable };
  }

  return { board, cityRound };
}
