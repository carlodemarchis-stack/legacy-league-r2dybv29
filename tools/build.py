#!/usr/bin/env python3
"""Static build: content/ + data/feed.json + template.html -> index.html

content/            what the editors own, one record per file (the CMS, as files)
  league.yaml       name, tagline, mission, hero photos, leaderboard sponsor, resources
  rules.yaml        best balls per hole, points table, tie rule
  course.yaml       the venue's holes
  schedule.yaml     the season's events, with programme and where-to-watch text
  cities/*.yaml     one city hub each (story, charity, sponsors, photos)
  players/*.yaml    one player each (bio, role, headshots)
  stories/*.md      one story each: front matter + Markdown body.
                    Written by hand or by the editorial desk (desk/server.py), same format.
                    status: draft | scheduled | published; no status means published.
data/feed.json      the scoring provider's payload (fixture from tools/gen.py)
template.html       markup, styles, behaviour. No copy.

The output is static files. Nothing here runs on a server.

index.html           the page, with what the first screen needs inside it
data/stories/*.json  what is fetched later: one small file per article body, and the tiles of the
                     older stories beyond the first screen. Names carry a hash of the content, so a
                     file never changes once published and can be cached for good.
"""
import hashlib, json, os, pathlib, datetime as dt, yaml

FIRST_STORIES = int(os.environ.get("FIRST_STORIES", 24))   # story tiles carried inside the page

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
        s = story(p); stories[s["id"]] = s
    now = dt.datetime.now().isoformat(timespec="minutes")
    live = [s for s in stories.values() if s.get("status", "published") == "published"
            or (s["status"] == "scheduled" and s.get("scheduled_at", "9999") <= now)]
    # newest first; stories with the same timestamp go most recently created first
    live.sort(key=lambda s: s["id"]); live.sort(key=lambda s: (s.get("at", ""), s.get("created_at", "")), reverse=True)
    for s in live:
        s.setdefault("cities", []); s.setdefault("players", []); s.setdefault("photos", [])
    cities = [Y(p) for p in sorted((C / "cities").glob("*.yaml"))]
    order = {c["id"]: i for i, c in enumerate(cities)}
    players = [Y(p) for p in sorted((C / "players").glob("*.yaml"))]
    players.sort(key=lambda p: (order.get(p["city"], 99), p["id"]))
    return english_only(dict(
        league=dict(name=league["name"], season=league["season"], tagline=league["tagline"], mission=league["mission"],
                    leaderboard_sponsor=league.get("leaderboard_sponsor")),
        cities=cities, players=players, schedule=Y(C / "schedule.yaml")["events"], rules=Y(C / "rules.yaml"),
        stories=live, hero=league["hero"], resources=league["resources"]))

def english_only(x):
    """The website and the apps are in English only. Spanish fields still in the content files
    (bio_es, story_es, a programme's "es" line…) are left out of everything that is published."""
    if isinstance(x, list):
        return [english_only(v) for v in x]
    if isinstance(x, dict):
        return {k: english_only(v) for k, v in x.items() if not k.endswith("_es") and not (k == "es" and "en" in x)}
    return x

SITE_KEYS = ("league", "cities", "players", "schedule", "rules", "hero", "resources")

def site_content(league, ui):
    """Everything an editor owns that is not a story: profiles, schedule, rules, and the interface wording.
    Returned with a short hash of itself. The page carries that hash, and the content store holds the same
    package under the same hash, so each side can tell whether the other has something newer."""
    pack = {"site": {k: league[k] for k in SITE_KEYS}, "ui": ui}
    rev = hashlib.sha1(json.dumps(pack, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:8]
    return rev, pack

def split_stories(league):
    """What the page carries of the stories: the newest tiles, without bodies. Everything else goes to data/stories/."""
    out = ROOT / "data/stories"
    out.mkdir(parents=True, exist_ok=True)
    wanted = set()
    def put(stem, obj):
        raw = json.dumps(obj, ensure_ascii=False)
        name = f"{stem}.{hashlib.sha1(raw.encode()).hexdigest()[:8]}.json"
        wanted.add(name)
        if not (out / name).exists():                       # the name is a hash of the content: an existing file is already right
            (out / name).write_text(raw)
        return f"data/stories/{name}"
    tiles = []
    for s in league["stories"]:
        s = dict(s)
        body = {"body": s.pop("body")} if "body" in s else {}
        if body: s["body_ref"] = put(s["id"], body)
        tiles.append(s)
    first, older = tiles[:FIRST_STORIES], tiles[FIRST_STORIES:]
    more = put("older", older) if older else None
    for f in out.iterdir():                                 # files no story points to any more, and stray copies
        if f.name not in wanted: f.unlink()
    return dict(league, stories=first, story_count=len(tiles), more_stories=more)

def build():
    league = load_content()
    feed = json.loads((ROOT / "data/feed.json").read_text())
    ui = {}                                                   # English only: no interface translations
    page = split_stories(league)
    page["site_rev"] = site_content(league, ui)[0]
    data = f"const LEAGUE={json.dumps(page, ensure_ascii=False)};\nconst FEED={json.dumps(feed, ensure_ascii=False)};"
    html = (ROOT / "template.html").read_text()
    assert "/*DATA*/" in html and "/*UI*/" in html, "template placeholders missing"
    html = html.replace("/*DATA*/", data).replace("/*UI*/", f"const T = {json.dumps(ui, ensure_ascii=False)};")
    (ROOT / "index.html").write_text(html)
    files = list((ROOT / "data/stories").glob("*.json"))
    print(f"index.html {len(html)} bytes, {len(league['cities'])} cities, {len(league['players'])} players, "
          f"{len(page['stories'])} of {len(league['stories'])} stories in the page, {len(files)} story files, {len(ui)} ui strings")
    # also keep data/league.json as the machine-readable export of the content tree (what a CMS API would return)
    (ROOT / "data/league.json").write_text(json.dumps(league, indent=1, ensure_ascii=False))

if __name__ == "__main__":
    build()
