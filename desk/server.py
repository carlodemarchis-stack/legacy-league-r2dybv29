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
LIVE_URL = "https://carlodemarchis-stack.github.io/legacy-league-r2dybv29/"
LOCAL_URL = "http://localhost:8793/#3"

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
        "Use live_board when a story quotes scores. render_site previews locally; "
        "deploy_site(confirm=True) publishes to the public demo and must be asked for explicitly."
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
    """The team leaderboard as the fans see it at a course time (HH:MM on day 2, 14:20 = where the demo opens; 15:40 = final).
    Returns positions, today, thru, total, league points and each city's best individual rounds today."""
    rows = _board(clock)
    return {"event": FEED["event"]["name"], "round": "Round 2", "course_time": clock,
            "final": all(r["thru"] == "F" for r in rows), "board": rows}


@mcp.tool()
def list_stories(status: str = "all", limit: int = 30) -> list[dict]:
    """Stories (status draft | scheduled | published | all), newest first. A file with no status is published."""
    rows = [s for s in _all() if status == "all" or s.get("status", "published") == status]
    rows.sort(key=lambda s: s.get("at", ""), reverse=True)
    return [_public(s) for s in rows[:limit]]


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
    return {"ok": True, "story": _public(s)}


@mcp.tool()
def publish_story(id: str, schedule_at: Optional[str] = None) -> dict:
    """Publish a draft (status -> published) or schedule it (ISO time, status -> scheduled). Publishing changes the local
    build on the next render_site(); the public demo changes only with deploy_site(confirm=True)."""
    s = _story(id)
    s["status"] = "scheduled" if schedule_at else "published"
    if schedule_at:
        s["scheduled_at"] = schedule_at
    s["published_by"], s["published_at"] = EDITOR, dt.datetime.now().isoformat(timespec="seconds")
    _write(s)
    _log("publish_story", {"id": id, "schedule_at": schedule_at}, s["status"])
    return {"ok": True, "story": _public(s), "next": "render_site() to preview locally."}


@mcp.tool()
def unpublish_story(id: str) -> dict:
    """Take a story back to draft."""
    s = _story(id)
    s["status"] = "draft"
    _write(s)
    _log("unpublish_story", {"id": id}, "draft")
    return {"ok": True, "story": _public(s)}


@mcp.tool()
def delete_story(id: str) -> dict:
    """Delete a story permanently (its Spanish file too)."""
    s = _story(id)
    for p in (STORIES / f"{id}.md", STORIES / f"{id}.es.md"):
        p.unlink(missing_ok=True)
    _log("delete_story", {"id": id, "title": s["title"]}, "deleted")
    return {"ok": True, "deleted": id}


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
    """Render, commit and push to the PUBLIC demo site. Requires confirm=True; ask the editor before calling it."""
    if not confirm:
        return {"ok": False, "error": "deploy_site changes the public demo. Call again with confirm=True after the editor agrees."}
    render_site()
    cmds = [["git", "add", "-A"], ["git", "commit", "-q", "-m", f"{message} (desk: {EDITOR})"], ["git", "push", "-q", "origin", "main"]]
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
