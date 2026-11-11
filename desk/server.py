#!/usr/bin/env python3
"""Legacy League Golf — editorial desk (MCP server prototype).

Editors talk to Claude; Claude calls these tools; the tools write the same files
a human editor would: content/stories/<id>.md, front matter + Markdown body.
The static build (tools/build.py) renders those files into the Stories collage.
Nothing here replaces a CMS studio: every new story is a draft until
`publish_story` is called, every call is logged with the editor's name, and the
live site only changes when `deploy_site(confirm=True)` runs.

Run (stdio):   desk/.venv/bin/python desk/server.py
Editor name:   DESK_EDITOR=Jonathan desk/.venv/bin/python desk/server.py
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

import yaml
from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from build import story as _parse  # noqa: E402  the build's own reader, so both sides agree on the format

STORIES = ROOT / "content" / "stories"
ALERTS = ROOT / "data" / "alerts.json"
LOG = ROOT / "data" / "desk-log.jsonl"
LEAGUE = json.loads((ROOT / "data" / "league.json").read_text())
FEED = json.loads((ROOT / "data" / "feed.json").read_text())
EDITOR = os.environ.get("DESK_EDITOR", "editor")
INBOX = Path(os.environ.get("DESK_PHOTO_INBOX", "~/Downloads")).expanduser()   # where editors drop photos
PHOTO_TYPES = (".jpg", ".jpeg", ".png", ".webp", ".heic")
LIVE_URL = "https://carlodemarchis-stack.github.io/legacy-league-r2dybv29/"
LOCAL_URL = "http://localhost:8793/#3"
STORE_URL = "https://legacy-league-7awe9upn.legacy-league-demo.workers.dev/#3"   # the site that reads the content store

CITY = {c["id"]: c for c in LEAGUE["cities"]}
PLAYER = {p["id"]: p for p in LEAGUE["players"]}
KINDS = {"video": "l", "gallery": "m", "article": "m", "quote": "m", "result": "r"}
TOPICS = ("league", "city", "mission")
SIZES = ("s", "m", "l", "xl", "p", "r")
PAR = [h["par"] for h in FEED["event"]["course"]["holes"]]
RULES = LEAGUE["rules"]

mcp = FastMCP(
    "legacy-desk",
    instructions=(
        "Editorial desk for Legacy League Golf. Draft first, publish second. "
        "Use league_reference and find_players to resolve city and player tags before drafting. "
        "Use live_board when a story quotes scores and city_round to name the players behind them. "
        "Read a story with get_story before changing it. An editor's own photo comes from the photo inbox: "
        "photo_inbox lists what is waiting, add_photo attaches one. "
        "publish_story is public at once: it sends the story to the content store, and the site that reads the store "
        "shows it on its next load. So ask the editor before publishing, and before changing, unpublishing or deleting "
        "a story that is already published. render_site previews locally; "
        "deploy_site(confirm=True) also rebuilds and pushes the page itself and must be asked for explicitly."
    ),
)

# ----------------------------------------------------------------- helpers

def _load(path: Path, key: str) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text()).get(key, [])


def _save(path: Path, key: str, items: list) -> None:
    path.write_text(json.dumps({key: items}, indent=1, ensure_ascii=False))


def _log(tool: str, args: dict, result: str) -> None:
    with LOG.open("a") as f:
        f.write(json.dumps({"ts": dt.datetime.now().isoformat(timespec="seconds"), "editor": EDITOR,
                            "tool": tool, "args": args, "result": result}, ensure_ascii=False) + "\n")


def _city_id(x: str) -> str:
    x = x.strip().lower()
    for c in LEAGUE["cities"]:
        if x in (c["id"], c["short"].lower(), c["name"].lower()):
            return c["id"]
    raise ValueError(f"Unknown city '{x}'. Cities: " + ", ".join(f"{c['name']} ({c['id']})" for c in LEAGUE["cities"]))


def _player_id(x: str) -> str:
    x = x.strip().lower()
    if x in PLAYER:
        return x
    hits = [p for p in LEAGUE["players"] if x == p["name"].lower()]
    if not hits:
        hits = [p for p in LEAGUE["players"] if x in p["name"].lower()]
    if len(hits) == 1:
        return hits[0]["id"]
    if not hits:
        raise ValueError(f"No player matches '{x}'. Use find_players.")
    raise ValueError(f"'{x}' is ambiguous: " + ", ".join(f"{p['name']} ({p['id']}, {CITY[p['city']]['short']})" for p in hits[:6]))


def _pool() -> list[str]:
    files = sorted((ROOT / "img" / "action").glob("*.jpg")) + sorted((ROOT / "img" / "course").glob("*.webp"))
    return [str(f.relative_to(ROOT)) for f in files]


def _pick_photo(seed: str) -> str:
    pool = _pool()
    return pool[int(hashlib.sha1(seed.encode()).hexdigest(), 16) % len(pool)]


class _Dumper(yaml.SafeDumper):
    pass


def _str(dumper, s):
    style = "|" if "\n" in s else ('"' if any(ch in s for ch in ":#{}[]") or s.strip() != s or s == "" else None)
    return dumper.represent_scalar("tag:yaml.org,2002:str", s, style=style)


_Dumper.add_representer(str, _str)


def _all() -> list[dict]:
    """Every story in content/stories (the English file; <id>.es.md is its Spanish sibling)."""
    return [_parse(p) for p in sorted(STORIES.glob("*.md")) if not p.name.endswith(".es.md")]


def _write(s: dict, name: Optional[str] = None) -> None:
    """One story -> content/stories/<id>.md: front matter, then the body as blank-line separated paragraphs."""
    front = {k: v for k, v in s.items() if k != "body"}
    fm = yaml.dump(front, Dumper=_Dumper, allow_unicode=True, sort_keys=False, width=1000).rstrip()
    (STORIES / (name or f"{s['id']}.md")).write_text(f"---\n{fm}\n---\n\n" + "\n\n".join(s.get("body") or []) + "\n")


def _paras(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _write_es(sid: str, title_es: Optional[str], dek_es: Optional[str], body_es: Optional[str]) -> None:
    """Create or update the Spanish sibling <id>.es.md. Only the fields given change."""
    if not (title_es or dek_es or body_es):
        return
    p = STORIES / f"{sid}.es.md"
    es = _parse(p) if p.exists() else {"id": sid, "lang": "es"}
    if title_es: es["title"] = title_es.strip()
    if dek_es: es["dek"] = dek_es.strip()
    if body_es: es["body"] = _paras(body_es)
    _write(es, p.name)


def _live(s: dict) -> bool:
    return s.get("status", "published") == "published"


def _store_push() -> dict:
    """Send the published stories and their photos to the content store (tools/store.py). The site that reads the
    store shows the change on its next load; no page is rebuilt."""
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "store.py"), "push"], capture_output=True, text=True, cwd=ROOT)
    ok = r.returncode == 0
    line = (r.stdout.strip().splitlines() or [""])[0] if ok else (r.stderr or r.stdout).strip()[-300:]
    _log("store_push", {}, line)
    return {"ok": True, "live": STORE_URL, "detail": line} if ok else {"ok": False, "error": line,
            "note": "The story file is saved, but the content store was not updated. Nothing changed on the public site."}


def _inbox_files() -> list[Path]:
    """Image files in the photo inbox, newest first."""
    try:
        files = [f for f in INBOX.iterdir() if f.is_file() and f.suffix.lower() in PHOTO_TYPES and not f.name.startswith(".")]
    except (FileNotFoundError, PermissionError) as e:
        raise ValueError(f"The desk cannot read the photo inbox ({INBOX}): {type(e).__name__}. On a Mac, allow Claude to "
                         "use that folder in System Settings > Privacy & Security > Files and Folders.")
    return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)


def _new_id() -> str:
    n = max([int(s["id"][1:]) for s in _all() if re.fullmatch(r"d\d+", s["id"])] or [0]) + 1
    return f"d{n:03d}"


def _feed_now() -> str:
    return FEED["generated_at"][:16]


def _story(sid: str) -> dict:
    p = STORIES / f"{sid}.md"
    if not re.fullmatch(r"[a-z]\d+", sid) or not p.exists():
        raise ValueError(f"No story '{sid}'. Use list_stories.")
    return _parse(p)


def _public(s: dict) -> dict:
    keep = ("id", "status", "kind", "topic", "at", "author", "title", "dek", "cities", "players", "size", "photo", "dur", "count")
    return {"status": "published", **{k: s.get(k) for k in keep if s.get(k) not in (None, [], "")},
            "spanish": (STORIES / f"{s['id']}.es.md").exists()}


# ----------------------------------------------------------------- scoring
# A Python twin of the page's teamRound/leaderboard, so Claude can write
# recaps from the same numbers the fans see.

def _tee_minutes() -> dict:
    tee: dict = {}
    for g in FEED["tee_sheet"]:
        h, m = map(int, g["tee_time"][11:16].split(":"))
        for p in g["players"]:
            tee.setdefault(p["id"], {})[g["round_id"]] = h * 60 + m
    return tee


TEE = _tee_minutes()
SCORE = {}
for s in FEED["scores"]:
    SCORE.setdefault(s["round_id"], {})[s["player_id"]] = s["hole_scores"]


def _posted(rid: str, pid: str, h: int, clock: int) -> bool:
    if rid == "r1":
        return True
    return TEE[pid][rid] + (h + 1) * FEED["sim"]["minutes_per_hole"] <= clock


def _team_round(cid: str, rid: str, clock: int) -> dict:
    ids = [p["id"] for p in LEAGUE["players"] if p["city"] == cid]
    to_par, thru = 0, 0
    best_player = None
    for h, par in enumerate(PAR):
        got = sorted((SCORE[rid][pid][h], pid) for pid in ids if _posted(rid, pid, h, clock))
        if len(got) == len(ids):
            counted = got[: RULES["best_balls"]]
            to_par += sum(s for s, _ in counted) - par * RULES["best_balls"]
            thru += 1
    # individual rounds (posted holes only)
    rounds = []
    for pid in ids:
        holes = [SCORE[rid][pid][h] for h in range(18) if _posted(rid, pid, h, clock)]
        if holes:
            rounds.append({"player": PLAYER[pid]["name"], "thru": len(holes), "to_par": sum(holes) - sum(PAR[: len(holes)])})
    rounds.sort(key=lambda r: r["to_par"])
    return {"to_par": to_par, "thru": thru, "final": thru == 18, "best": rounds[:2]}


def _final_at() -> str:
    """Course time on day 2 when the last group has posted its 18th hole."""
    t = max(v["r2"] for v in TEE.values()) + 18 * FEED["sim"]["minutes_per_hole"]
    return f"{t // 60:02d}:{t % 60:02d}"


def _board(clock_hhmm: str) -> list[dict]:
    h, m = map(int, clock_hhmm.split(":"))
    clock = h * 60 + m
    rows = []
    for c in LEAGUE["cities"]:
        r1, r2 = _team_round(c["id"], "r1", clock), _team_round(c["id"], "r2", clock)
        rows.append({"city": c["name"], "short": c["short"], "id": c["id"], "r1": r1["to_par"], "today": r2["to_par"],
                     "thru": "F" if r2["final"] else r2["thru"], "total": r1["to_par"] + r2["to_par"], "best_today": r2["best"]})
    rows.sort(key=lambda r: (r["total"], r["city"]))
    i = 0
    while i < len(rows):
        j = i
        while j + 1 < len(rows) and rows[j + 1]["total"] == rows[i]["total"]:
            j += 1
        pts = sum(RULES["points"][i: j + 1]) / (j - i + 1)
        for k in range(i, j + 1):
            rows[k]["pos"] = ("T" if j > i else "") + str(i + 1)
            rows[k]["points"] = round(pts, 1)
        i = j + 1
    return rows


# ------------------------------------------------------------------- tools

@mcp.tool()
def league_reference() -> dict:
    """Cities (ids, names, codes, heritage teams, captain), schedule, scoring rules, story kinds and sizes. Call this first."""
    return {
        "cities": [{"id": c["id"], "name": c["name"], "short": c["short"], "teams": c["teams"],
                    "captain": PLAYER[c["captain"]]["name"], "charity": c["charity"]} for c in LEAGUE["cities"]],
        "schedule": LEAGUE["schedule"],
        "rules": RULES,
        "story_kinds": {"video": "needs dur like 2:14", "gallery": "needs count", "article": "news", "quote": "title is the quote",
                        "result": "live board tile, rendered from the feed"},
        "topics": TOPICS, "sizes": {"s": "2x1 small", "m": "2x2", "l": "3x2 wide", "xl": "4x3 hero", "p": "2x3 portrait photo", "r": "3x3 result board"},
        "feed_time": _feed_now(), "editor": EDITOR,
    }


@mcp.tool()
def find_players(query: str, city: Optional[str] = None) -> list[dict]:
    """Find players by name fragment, former team, role or sport; optionally within one city."""
    q = query.strip().lower()
    cid = _city_id(city) if city else None
    out = []
    for p in LEAGUE["players"]:
        if cid and p["city"] != cid:
            continue
        hay = " ".join(str(x) for x in (p["name"], p.get("team"), p["role"], p["sport"], CITY[p["city"]]["name"])).lower()
        if q in hay:
            out.append({"id": p["id"], "name": p["name"], "city": CITY[p["city"]]["name"], "sport": p["sport"],
                        "team": p.get("team"), "role": p["role"], "captain": p["captain"]})
    return out[:25]


@mcp.tool()
def live_board(clock: str = "14:20") -> dict:
    """The team leaderboard as the fans see it at a course time (HH:MM on day 2; 14:20 = where the demo opens).
    Returns positions, today, thru, total, league points and each city's best individual rounds today.
    final_at is the course time when the last group finishes: ask for that time, or later, to get the final board.
    Every score (r1, today, total, to_par) is strokes relative to par: negative is under par, positive is over."""
    rows = _board(clock)
    return {"event": FEED["event"]["name"], "round": "Round 2", "course_time": clock, "final_at": _final_at(),
            "final": all(r["thru"] == "F" for r in rows), "board": rows}


@mcp.tool()
def city_round(city: str, clock: str = "14:20", round: int = 2) -> dict:
    """Who is doing what for one city: each player's holes played and score, how many of the team's counted scores
    each has supplied, the team's score hole by hole, and the notable holes (eagles, holes in one).
    Use it to name players in a story. clock = course time HH:MM on day 2 (ignored for round 1, which is complete).
    A hole is firm once every player on the team has finished it. Only firm holes are on the board, and whether a
    score counted is known only for firm holes. Every score is strokes relative to par: negative is under par."""
    cid, rid = _city_id(city), f"r{int(round)}"
    if rid not in SCORE:
        raise ValueError("round must be 1 or 2")
    h, m = map(int, clock.split(":"))
    now, mph, holes = h * 60 + m, FEED["sim"]["minutes_per_hole"], FEED["event"]["course"]["holes"]
    ids = [p["id"] for p in LEAGUE["players"] if p["city"] == cid]
    posted_at = lambda pid, i: TEE[pid][rid] + (i + 1) * mph
    hhmm = lambda t: f"{t // 60:02d}:{t % 60:02d}"
    tally = {pid: {"counted_scores": 0, "counted_under_par": 0} for pid in ids}
    team, counted_on = [], {}
    for i, par in enumerate(PAR):
        if not all(_posted(rid, pid, i, now) for pid in ids):
            continue
        best = sorted((SCORE[rid][pid][i], pid) for pid in ids)[: RULES["best_balls"]]
        counted_on[i] = {pid for _, pid in best}
        for sc, pid in best:
            tally[pid]["counted_scores"] += 1
            tally[pid]["counted_under_par"] += sc < par
        team.append({"hole": i + 1, "par": par, "to_par": sum(sc for sc, _ in best) - par * RULES["best_balls"],
                     "counted": [{"player": PLAYER[pid]["name"], "to_par": sc - par} for sc, pid in best]})
    players, notable = [], []
    for pid in ids:
        done = [i for i in range(18) if _posted(rid, pid, i, now)]
        players.append({"id": pid, "name": PLAYER[pid]["name"], "captain": PLAYER[pid]["captain"], "thru": len(done),
                        "finished": len(done) == 18, "to_par": sum(SCORE[rid][pid][i] - PAR[i] for i in done),
                        "birdies_or_better": sum(SCORE[rid][pid][i] < PAR[i] for i in done), **tally[pid]})
        for i in done:
            sc = SCORE[rid][pid][i]
            if sc == 1 or sc <= PAR[i] - 2:
                what = "hole in one" if sc == 1 else {2: "eagle", 3: "albatross"}[PAR[i] - sc]
                notable.append({"what": what, "player": PLAYER[pid]["name"], "id": pid, "hole": i + 1, "par": PAR[i],
                                "yardage": holes[i]["yardage"], "score": sc, "posted": hhmm(posted_at(pid, i)),
                                "firm": i in counted_on, "counted": (pid in counted_on[i]) if i in counted_on else None})
    players.sort(key=lambda r: (-r["counted_under_par"], -r["counted_scores"], r["name"]))
    notable.sort(key=lambda r: r["posted"])
    return {"city": CITY[cid]["name"], "round": int(round), "course_time": clock if rid == "r2" else "complete",
            "team": {"thru": len(team), "to_par": sum(x["to_par"] for x in team), "holes": team},
            "players": players, "notable": notable}


@mcp.tool()
def list_stories(status: str = "all", limit: int = 30) -> list[dict]:
    """Stories (status draft | scheduled | published | all), newest first. A file with no status is published."""
    rows = [s for s in _all() if status == "all" or s.get("status", "published") == status]
    rows.sort(key=lambda s: s.get("at", ""), reverse=True)
    return [_public(s) for s in rows[:limit]]


@mcp.tool()
def get_story(id: str) -> dict:
    """One story in full: every field, the body paragraphs, and the Spanish version if there is one.
    Read this before correcting a story, so the change reaches every place the fact appears, in both languages.
    {p0} and {c0} in the text stand for the first tagged player and city; leave them as they are."""
    s = _story(id)
    p = STORIES / f"{id}.es.md"
    es = _parse(p) if p.exists() else None
    return {"story": {"status": "published", **s},
            "spanish": {k: es[k] for k in ("title", "dek", "body") if k in es} if es else None}


@mcp.tool()
def draft_story(kind: str, title: str, dek: str, cities: Optional[list[str]] = None, players: Optional[list[str]] = None,
                topic: str = "league", author: Optional[str] = None, dur: Optional[str] = None, count: Optional[int] = None,
                photo_url: Optional[str] = None, size: Optional[str] = None, at: Optional[str] = None,
                body: Optional[str] = None, title_es: Optional[str] = None, dek_es: Optional[str] = None,
                body_es: Optional[str] = None) -> dict:
    """Create a DRAFT story for the Stories collage. body = the article text, paragraphs separated by blank lines
    (2–4 short paragraphs; the collage shows title + dek, the reader shows the body). kind: video | gallery | article | quote. Cities and players may be names or ids.
    video needs dur ("2:14"); gallery needs count. Without photo_url a golf photo from the library is picked.
    at = ISO time in the demo's event timeline (default: the feed's current time, shows as "just now").
    title_es, dek_es, body_es = the Spanish version (Mexican Spanish), saved as the story's Spanish file. The site is
    bilingual: without them Spanish readers see the English text."""
    kind = kind.strip().lower()
    if kind not in KINDS or kind == "result":
        raise ValueError("kind must be video, gallery, article or quote")
    if topic not in TOPICS:
        raise ValueError(f"topic must be one of {TOPICS}")
    if size and size not in SIZES:
        raise ValueError(f"size must be one of {SIZES}")
    if kind == "video" and not dur:
        raise ValueError("a video needs dur, e.g. '2:14'")
    if kind == "gallery" and not count:
        raise ValueError("a gallery needs count")
    cids = [_city_id(c) for c in (cities or [])]
    pids = [_player_id(p) for p in (players or [])]
    for pid in pids:
        if PLAYER[pid]["city"] not in cids:
            cids.append(PLAYER[pid]["city"])
    sid = _new_id()
    if not author:
        author = f"{CITY[cids[0]]['name']} desk" if len(cids) == 1 else ("Legacy League · Mission" if topic == "mission" else "Legacy League")
    story = {
        "id": sid, "status": "draft", "kind": kind, "topic": topic, "at": at or _feed_now(), "author": author,
        "title": title.strip(), "dek": dek.strip(), "cities": cids, "players": pids,
        "likes": 0, "comments": 0, "size": size or KINDS[kind],
        "photo": photo_url or _pick_photo(sid + title), "created_by": EDITOR,
        "created_at": dt.datetime.now().isoformat(timespec="seconds"),
    }
    if body:
        story["body"] = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if dur:
        story["dur"] = dur
    if count:
        story["count"] = int(count)
    if kind == "gallery":
        story["photos"] = [story["photo"], _pick_photo(sid + "b"), _pick_photo(sid + "c")]
    _write(story)
    _write_es(sid, title_es, dek_es, body_es)
    _log("draft_story", {"id": sid, "kind": kind, "title": title}, "draft")
    return {"ok": True, "story": _public(story), "next": "publish_story(id) to show it in the collage, then render_site() to preview."}


@mcp.tool()
def photo_inbox(limit: int = 12) -> dict:
    """The newest photos waiting in the photo inbox, newest first. The inbox is a folder on the desk's computer
    (normally Downloads): the editor saves a photo there and names it. A picture pasted into the chat cannot reach the desk."""
    return {"inbox": str(INBOX), "photos": [
        {"file": f.name, "kb": round(f.stat().st_size / 1024), "saved": dt.datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="minutes")}
        for f in _inbox_files()[: max(1, min(int(limit), 40))]]}


@mcp.tool()
def add_photo(id: str, file: str, credit: Optional[str] = None) -> dict:
    """Attach a photo from the photo inbox to a story. file = the exact file name as photo_inbox lists it.
    The photo is copied into the site, resized for the web and set as the story's picture; the original stays where it is.
    credit = who took it. When a photo shows people, ask the editor for the credit and for the right to publish it."""
    s = _story(id)
    src = INBOX / file
    if Path(file).name != file or src not in _inbox_files():
        raise ValueError(f"No photo '{file}' in the inbox. Use photo_inbox for the exact name.")
    if src.stat().st_size > 30 * 1024 * 1024:
        raise ValueError("That photo is over 30 MB. Export a smaller copy first.")
    out_dir = ROOT / "img" / "stories"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{id}-{hashlib.sha1(src.read_bytes()).hexdigest()[:8]}.jpg"   # new name per photo, so browsers never show a stale one
    size = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(src)], capture_output=True, text=True).stdout
    big = max([int(n) for n in re.findall(r"pixel(?:Width|Height): (\d+)", size)] or [0]) > 1600
    r = subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "82"] + (["-Z", "1600"] if big else []) + [str(src), "--out", str(out)],
                       capture_output=True, text=True)   # shrink large photos; never enlarge small ones
    if r.returncode != 0 or not out.exists():
        raise ValueError("The photo could not be converted: " + (r.stderr or r.stdout).strip()[-200:])
    for old in out_dir.glob(f"{id}-*.jpg"):
        if old != out:
            old.unlink()
    s["photo"] = str(out.relative_to(ROOT))
    if credit:
        s["photo_credit"] = credit.strip()
    s["updated_by"], s["updated_at"] = EDITOR, dt.datetime.now().isoformat(timespec="seconds")
    _write(s)
    _log("add_photo", {"id": id, "file": file}, s["photo"])
    out_ = {"ok": True, "story": _public(s), "kb": round(out.stat().st_size / 1024), "next": "render_site() to preview."}
    if _live(s):
        out_["store"] = _store_push()                         # already public: the new picture goes to the store now
    return out_


@mcp.tool()
def update_story(id: str, title: Optional[str] = None, dek: Optional[str] = None, cities: Optional[list[str]] = None,
                 players: Optional[list[str]] = None, size: Optional[str] = None, photo_url: Optional[str] = None,
                 author: Optional[str] = None, at: Optional[str] = None, body: Optional[str] = None,
                 title_es: Optional[str] = None, dek_es: Optional[str] = None, body_es: Optional[str] = None) -> dict:
    """Change fields of a story (draft or published). body replaces the article text (paragraphs separated by blank lines).
    title_es, dek_es, body_es change the Spanish version (created if missing). English and Spanish are separate texts:
    when you change one, pass the matching change for the other, or they drift apart."""
    s = _story(id)
    if title: s["title"] = title.strip()
    if dek: s["dek"] = dek.strip()
    if cities is not None: s["cities"] = [_city_id(c) for c in cities]
    if players is not None: s["players"] = [_player_id(p) for p in players]
    if size:
        if size not in SIZES: raise ValueError(f"size must be one of {SIZES}")
        s["size"] = size
    if photo_url: s["photo"] = photo_url
    if author: s["author"] = author
    if at: s["at"] = at
    if body: s["body"] = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    s["updated_by"], s["updated_at"] = EDITOR, dt.datetime.now().isoformat(timespec="seconds")
    _write(s)
    _write_es(id, title_es, dek_es, body_es)
    _log("update_story", {"id": id}, "updated")
    out = {"ok": True, "story": _public(s)}
    if _live(s):
        out["store"] = _store_push()                          # already public: the change goes to the store now
    return out


@mcp.tool()
def publish_story(id: str, schedule_at: Optional[str] = None) -> dict:
    """Publish a draft (status -> published) or schedule it (ISO time, status -> scheduled). Publishing is PUBLIC at once:
    the story goes to the content store, and the site that reads the store shows it on its next load. Ask the editor first.
    A scheduled story is not sent until something is published after its time has come."""
    s = _story(id)
    s["status"] = "scheduled" if schedule_at else "published"
    if schedule_at:
        s["scheduled_at"] = schedule_at
    s["published_by"], s["published_at"] = EDITOR, dt.datetime.now().isoformat(timespec="seconds")
    _write(s)
    _log("publish_story", {"id": id, "schedule_at": schedule_at}, s["status"])
    out = {"ok": True, "story": _public(s)}
    if _live(s):
        out["store"] = _store_push()
    else:
        out["next"] = "Scheduled. It is sent to the content store with the first publish after its time has come."
    return out


@mcp.tool()
def unpublish_story(id: str) -> dict:
    """Take a story back to draft. If it was published, it leaves the public site at once (the content store is updated)."""
    s = _story(id)
    was_live = _live(s)
    s["status"] = "draft"
    _write(s)
    _log("unpublish_story", {"id": id}, "draft")
    out = {"ok": True, "story": _public(s)}
    if was_live:
        out["store"] = _store_push()
    return out


@mcp.tool()
def delete_story(id: str) -> dict:
    """Delete a story permanently (its Spanish file too). If it was published, it leaves the public site at once."""
    s = _story(id)
    for p in (STORIES / f"{id}.md", STORIES / f"{id}.es.md"):
        p.unlink(missing_ok=True)
    _log("delete_story", {"id": id, "title": s["title"]}, "deleted")
    out = {"ok": True, "deleted": id}
    if _live(s):
        out["store"] = _store_push()
    return out


@mcp.tool()
def draft_push_alert(city: str, title: str, body: str, players: Optional[list[str]] = None) -> dict:
    """Draft a push notification for the followers of a city (and optionally players). Stored for review; nothing is sent."""
    cid = _city_id(city)
    pids = [_player_id(p) for p in (players or [])]
    alerts = _load(ALERTS, "alerts")
    a = {"id": f"a{len(alerts) + 1:03d}", "status": "draft", "city": cid, "players": pids, "title": title.strip()[:60],
         "body": body.strip()[:140], "audience": f"followers of {CITY[cid]['name']}" + (f" and {len(pids)} player(s)" if pids else ""),
         "created_by": EDITOR, "created_at": dt.datetime.now().isoformat(timespec="seconds")}
    alerts.append(a)
    _save(ALERTS, "alerts", alerts)
    _log("draft_push_alert", {"id": a["id"], "city": cid}, "draft")
    return {"ok": True, "alert": a, "limits": "title ≤ 60 chars, body ≤ 140 chars, max 15 per fan per event day (brief)"}


@mcp.tool()
def render_site() -> dict:
    """Rebuild index.html from content/ (published + due scheduled stories, newest first) and refresh the local preview."""
    r = subprocess.run(["python3", str(ROOT / "render.py")], capture_output=True, text=True, cwd=ROOT)
    sync = ROOT / "tools" / "sync_preview.sh"
    if sync.exists():
        subprocess.run(["sh", str(sync)], capture_output=True, text=True, cwd=ROOT)
    n = len([s for s in _all() if s.get("status", "published") == "published"])
    _log("render_site", {}, r.stdout.strip() or r.stderr.strip()[-200:])
    return {"ok": r.returncode == 0, "output": (r.stdout or r.stderr).strip(), "published_stories": n, "preview": LOCAL_URL}


@mcp.tool()
def deploy_site(message: str = "Desk publish", confirm: bool = False) -> dict:
    """Render, then commit and push the content and the rebuilt page to the PUBLIC demo site. Nothing else in the
    folder is published. Requires confirm=True; ask the editor before calling it."""
    if not confirm:
        return {"ok": False, "error": "deploy_site changes the public demo. Call again with confirm=True after the editor agrees."}
    render_site()
    paths = ["content", "data/league.json", "data/stories", "index.html"]   # what an editor can change; never code, tools or stray files
    if (ROOT / "img" / "stories").exists():
        paths.append("img/stories")                            # photos added through add_photo
    cmds = [["git", "add", "--"] + paths, ["git", "commit", "-q", "-m", f"{message} (desk: {EDITOR})", "--"] + paths,
            ["git", "push", "-q", "origin", "main"]]
    out = []
    for c in cmds:
        r = subprocess.run(c, capture_output=True, text=True, cwd=ROOT)
        out.append((r.returncode, (r.stdout or r.stderr).strip()))
        if r.returncode != 0 and c[1] != "commit":
            _log("deploy_site", {"message": message}, f"failed at {c[1]}")
            return {"ok": False, "step": c[1], "error": out[-1][1]}
    _log("deploy_site", {"message": message}, "pushed")
    return {"ok": True, "live": LIVE_URL, "note": "GitHub Pages rebuilds in about a minute."}


if __name__ == "__main__":
    mcp.run()
