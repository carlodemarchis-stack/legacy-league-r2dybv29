#!/usr/bin/env python3
"""template.html + data/*.json -> index.html (data inlined so the demo runs from file:// too).

data/league.json   generated seed (tools/gen.py): cities, players, schedule, rules, seed stories
data/stories.json  the editorial desk's store (desk/server.py): published stories go in front
"""
import json, pathlib, datetime as dt
root = pathlib.Path(__file__).resolve().parent
league = json.loads((root / "data/league.json").read_text())
feed = json.loads((root / "data/feed.json").read_text())

store = root / "data/stories.json"
if store.exists():
    now = dt.datetime.now().isoformat(timespec="minutes")
    desk = [s for s in json.loads(store.read_text()).get("stories", [])
            if s.get("status") == "published" or (s.get("status") == "scheduled" and s.get("scheduled_at", "9999") <= now)]
    desk.sort(key=lambda s: s.get("at", ""), reverse=True)
    seen = {s["id"] for s in desk}
    league["stories"] = desk + [s for s in league["stories"] if s["id"] not in seen]

data = f"const LEAGUE={json.dumps(league, ensure_ascii=False)};\nconst FEED={json.dumps(feed, ensure_ascii=False)};"
html = (root / "template.html").read_text().replace("/*DATA*/", data)
(root / "index.html").write_text(html)
print("index.html", len(html), "bytes,", len(league["stories"]), "stories")
