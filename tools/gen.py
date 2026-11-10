#!/usr/bin/env python3
"""Scoring fixture: content/ (players, cities, course, schedule) -> data/feed.json

The payload is shaped like a Golf Genius API v2 response (event / rounds /
tee_sheet / scores). Field names are modelled on Golf Genius' public API and
must be confirmed against the real contract once Legacy grants access.

Content is not generated here any more: cities, players and stories live in
content/ as files the editors own (see tools/build.py). This script only plays
the role of the scoring provider for the demo. Deterministic (seeded).
"""
import json, random, pathlib, datetime as dt, yaml

random.seed(20270124)
ROOT = pathlib.Path(__file__).resolve().parent.parent
C = ROOT / "content"
Y = lambda p: yaml.safe_load(p.read_text())

course = Y(C / "course.yaml")
HOLES = [(h["number"], h["par"], h["yardage"]) for h in course["holes"]]
PAR = [p for _, p, _ in HOLES]
cities = [Y(p) for p in sorted((C / "cities").glob("*.yaml"))]
order = {c["id"]: i for i, c in enumerate(cities)}
players = sorted((Y(p) for p in (C / "players").glob("*.yaml")), key=lambda p: (order.get(p["city"], 99), p["id"]))
event = Y(C / "schedule.yaml")["events"][0]
league = Y(C / "league.yaml")

def hole_score(par, skill, pressure=0.0):
    """One hole for one player. skill = expected strokes over par per round (2..16)."""
    base = skill / 18.0 + pressure
    r = random.random()
    p_eagle = 0.012 if par == 5 else 0.004
    p_birdie = max(0.025, 0.15 - base * 0.12)
    p_par = max(0.24, 0.50 - base * 0.22)
    p_bogey = 0.28 + base * 0.12
    if r < p_eagle: d = -2
    elif r < p_eagle + p_birdie: d = -1
    elif r < p_eagle + p_birdie + p_par: d = 0
    elif r < p_eagle + p_birdie + p_par + p_bogey: d = 1
    else: d = 2 if random.random() < .72 else 3
    return par + d

skill = {p["id"]: p["handicap"] * 1.15 + random.uniform(-1, 1) for p in players}

# pairings: groups of 3, one player per city where possible, 11-minute intervals from 08:00
def make_tee_sheet(round_id, day):
    pool = {c["id"]: [p["id"] for p in players if p["city"] == c["id"]] for c in cities}
    for v in pool.values(): random.shuffle(v)
    groups = []
    while any(pool.values()):
        cs = sorted([k for k, v in pool.items() if v], key=lambda k: -len(pool[k]))
        groups.append([pool[k].pop() for k in cs[:3]])
    sheet = []
    t = dt.datetime.fromisoformat(f"{day}T08:00:00")
    for i, g in enumerate(groups):
        sheet.append(dict(round_id=round_id, pairing_group_id=f"{round_id}-g{i+1:02d}", tee_time=t.isoformat(),
                          starting_hole=1, players=[dict(id=x, team_id=next(p["city"] for p in players if p["id"] == x)) for x in g]))
        t += dt.timedelta(minutes=11)
    return sheet

d1 = (dt.date.fromisoformat(event["end"]) - dt.timedelta(days=1)).isoformat()
ROUNDS = [dict(id="r1", index=1, name="Round 1", date=d1, status="completed"),
          dict(id="r2", index=2, name="Round 2", date=event["end"], status="in_progress")]
tee_sheet = make_tee_sheet("r1", d1) + make_tee_sheet("r2", event["end"])

# hole-by-hole for every player, both rounds. Round 2 is generated in full; the
# client reveals holes against a simulated clock (tee time + 13 min per hole).
scores = []
for rd in ROUNDS:
    for p in players:
        pressure = 0.03 if rd["id"] == "r2" else 0.0
        hs = [hole_score(par, skill[p["id"]], pressure) for par in PAR]
        scores.append(dict(round_id=rd["id"], player_id=p["id"], team_id=p["city"], hole_scores=hs,
                           status="F" if rd["id"] == "r1" else "in_progress"))

feed = dict(
    provider="golfgenius", api_version="v2 (modelled)", generated_at=f"{event['end']}T14:20:00-05:00",
    event=dict(id=f"legacy-{event['start'][:7]}", name=f"{league['name']} — {event['name']}", start_date=event["start"], end_date=event["end"],
               course=dict(name=course["name"], location=course["location"], par=course["par"], yardage=course["yardage"],
                           holes=[dict(number=n, par=p, yardage=y) for n, p, y in HOLES])),
    rounds=ROUNDS, tee_sheet=tee_sheet, scores=scores,
    sim=dict(clock_start=f"{event['end']}T14:20:00", minutes_per_hole=13, timezone="America/Cancun"))

(ROOT / "data" / "feed.json").write_text(json.dumps(feed, indent=1, ensure_ascii=False))
print(f"feed: {len(players)} players, {len(tee_sheet)} tee-sheet groups, {len(scores)} score lines")
