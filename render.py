#!/usr/bin/env python3
"""template.html + data/*.json -> index.html (data inlined so the demo runs from file:// too)."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent
league = json.loads((root / "data/league.json").read_text())
feed = json.loads((root / "data/feed.json").read_text())
data = f"const LEAGUE={json.dumps(league, ensure_ascii=False)};\nconst FEED={json.dumps(feed, ensure_ascii=False)};"
html = (root / "template.html").read_text().replace("/*DATA*/", data)
(root / "index.html").write_text(html)
print("index.html", len(html), "bytes")
