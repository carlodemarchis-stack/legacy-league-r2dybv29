#!/usr/bin/env python3
"""Static build: content/ + data/feed.json + template.html -> index.html

content/            what the editors own, one record per file (the CMS, as files)
  league.yaml       name, tagline, mission, hero photos, leaderboard sponsor, resources
  rules.yaml        best balls per hole, points table, tie rule
  course.yaml       the venue's holes
  schedule.yaml     the season's events, with programme and where-to-watch text
  cities/*.yaml     one city hub each (story, story_es, charity, sponsors, photos)
  players/*.yaml    one player each (bio, bio_es, role, role_es, headshots)
  stories/*.md      one story each: front matter + Markdown body; <id>.es.md = Spanish
  ui/es.json        interface strings, keyed by the English text
data/feed.json      the scoring provider's payload (fixture from tools/gen.py)
data/stories.json   the editorial desk's store; published items go in front of the file stories
template.html       markup, styles, behaviour. No copy.

The output is one static file. Nothing here runs on a server.
"""
import json, pathlib, datetime as dt, yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
C = ROOT / "content"
Y = lambda p: yaml.safe_load(p.read_text())

def story(path):
    """<id>.md -> dict: front matter + body paragraphs (blank-line separated)."""
    txt = path.read_text()
    assert txt.startswith("---\n"), path
    _, fm, body = txt.split("---\n", 2)
    s = yaml.safe_load(fm) or {}
    paras = [p.strip() for p in body.strip().split("\n\n") if p.strip()]
    if paras: s["body"] = paras
    return s

def load_content():
    league = Y(C / "league.yaml")
    stories = {}
    for p in sorted((C / "stories").glob("*.md")):
        if p.name.endswith(".es.md"): continue
        s = story(p); stories[s["id"]] = s
    for p in sorted((C / "stories").glob("*.es.md")):
        es = story(p); s = stories.get(es["id"])
        if not s: continue
        for k in ("title", "dek", "body"):
            if es.get(k): s[k + "_es"] = es[k]
    for s in stories.values():
        s.setdefault("cities", []); s.setdefault("players", []); s.setdefault("photos", [])
    cities = [Y(p) for p in sorted((C / "cities").glob("*.yaml"))]
    order = {c["id"]: i for i, c in enumerate(cities)}
    players = [Y(p) for p in sorted((C / "players").glob("*.yaml"))]
    players.sort(key=lambda p: (order.get(p["city"], 99), p["id"]))
    return dict(
        league=dict(name=league["name"], season=league["season"], tagline=league["tagline"], mission=league["mission"],
                    leaderboard_sponsor=league.get("leaderboard_sponsor")),
        cities=cities, players=players, schedule=Y(C / "schedule.yaml")["events"], rules=Y(C / "rules.yaml"),
        stories=sorted(stories.values(), key=lambda s: s["id"]), hero=league["hero"], resources=league["resources"])

def merge_desk(league):
    store = ROOT / "data/stories.json"
    if not store.exists(): return
    now = dt.datetime.now().isoformat(timespec="minutes")
    desk = [s for s in json.loads(store.read_text()).get("stories", [])
            if s.get("status") == "published" or (s.get("status") == "scheduled" and s.get("scheduled_at", "9999") <= now)]
    desk.sort(key=lambda s: s.get("at", ""), reverse=True)
    seen = {s["id"] for s in desk}
    league["stories"] = desk + [s for s in league["stories"] if s["id"] not in seen]

def build():
    league = load_content()
    merge_desk(league)
    feed = json.loads((ROOT / "data/feed.json").read_text())
    ui = json.loads((C / "ui/es.json").read_text())
    data = f"const LEAGUE={json.dumps(league, ensure_ascii=False)};\nconst FEED={json.dumps(feed, ensure_ascii=False)};"
    html = (ROOT / "template.html").read_text()
    assert "/*DATA*/" in html and "/*UI*/" in html, "template placeholders missing"
    html = html.replace("/*DATA*/", data).replace("/*UI*/", f"const T = {json.dumps(ui, ensure_ascii=False)};")
    (ROOT / "index.html").write_text(html)
    print(f"index.html {len(html)} bytes, {len(league['cities'])} cities, {len(league['players'])} players, {len(league['stories'])} stories, {len(ui)} ui strings")
    # also keep data/league.json as the machine-readable export of the content tree (what a CMS API would return)
    (ROOT / "data/league.json").write_text(json.dumps(league, indent=1, ensure_ascii=False))

if __name__ == "__main__":
    build()
