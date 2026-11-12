#!/usr/bin/env python3
"""The content store: everything the editors own, kept in a Cloudflare R2 bucket.

    python3 tools/store.py push            send profiles, schedule, rules, wording and photos that changed
    python3 tools/store.py push --dry      say what would be sent, send nothing
    python3 tools/store.py seed-desk       ONE-OFF: copy every story in content/stories into the store as the
                                           hosted desk's records, replacing what the desk has there

Stories belong to the hosted desk (hosted-desk/): it keeps them in the store and writes the list the site
reads. So `push` leaves stories alone, and content/stories is only a copy from before the desk was hosted.

What goes up, under the bucket's root:
  stories/index.json            every published story as the page lists it (no article text), newest first
  stories/<id>.<hash>.json      one article text each, English and Spanish; the name carries a hash of the content
  photos/<path>                 the pictures those stories use (img/<path> in the project)
  site/index.json               which package of everything else is current: {"rev": "<hash>"}
  site/site.<hash>.json         that package: city and player profiles, schedule, rules, and the interface wording

The site on Cloudflare hands these out under /content/ (worker/index.js). The page asks for the index when it
opens and shows what it finds, so a story published here appears without rebuilding the page.

Files go up through wrangler, with the Cloudflare login already on this machine: no keys are kept here.
A list of what was sent last time (.store-sent.json, not in git) keeps a push to what changed.
"""
import concurrent.futures, glob, hashlib, json, mimetypes, os, pathlib, shutil, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build  # noqa: E402  the build's own reader: the store and the page list the same stories in the same order

BUCKET = "legacy-league-content"
SENT = ROOT / ".store-sent.json"
PREFIX = "content/"                      # where the site serves the bucket


def _npx():
    """wrangler runs through npx. A program started by the Claude app has a short PATH, so look where node usually is."""
    found = shutil.which("npx")
    if not found:
        places = sorted(glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin/npx"))) + ["/opt/homebrew/bin/npx", "/usr/local/bin/npx"]
        found = next((p for p in reversed(places) if os.path.exists(p)), None)
    if not found:
        raise SystemExit("npx (Node.js) was not found, so nothing can be sent to the store.")
    return found


def collect():
    """key -> bytes for every file the store should hold, and key -> bytes for the indexes that point at them."""
    objects = {}
    content = build.load_content()
    ui = {}                                                    # English only: no interface translations
    rev, pack = build.site_content(content, ui)
    objects[f"site/site.{rev}.json"] = json.dumps({"rev": rev, **pack}, ensure_ascii=False).encode()

    def photo(path):
        if not isinstance(path, str) or not path.startswith("img/"):
            return path                                    # a web address, or nothing: left as it is
        src = ROOT / path
        if not src.exists():
            return path
        key = "photos/" + path[4:]
        objects[key] = src.read_bytes()
        return PREFIX + key

    tiles = []
    for s in content["stories"]:
        s = dict(s)
        body = {"body": s.pop("body")} if "body" in s else {}
        if body:
            raw = json.dumps(body, ensure_ascii=False).encode()
            key = f"stories/{s['id']}.{hashlib.sha1(raw).hexdigest()[:8]}.json"
            objects[key] = raw
            s["body_ref"] = PREFIX + key
        if s.get("photo"):
            s["photo"] = photo(s["photo"])
        if s.get("photos"):
            s["photos"] = [photo(p) for p in s["photos"]]
        tiles.append(s)
    raw = json.dumps(tiles, ensure_ascii=False)
    index = {"rev": hashlib.sha1(raw.encode()).hexdigest()[:12], "stories": tiles}
    return objects, {"stories/index.json": json.dumps(index, ensure_ascii=False).encode(),
                     "site/index.json": json.dumps({"rev": rev}).encode()}


def _put(npx, key, data):
    kind = mimetypes.guess_type(key)[0] or "application/octet-stream"
    with tempfile.NamedTemporaryFile(suffix=pathlib.Path(key).suffix, delete=False) as f:
        f.write(data)
    try:
        env = dict(os.environ, PATH=os.path.dirname(npx) + os.pathsep + os.environ.get("PATH", ""))
        r = subprocess.run([npx, "--yes", "wrangler", "r2", "object", "put", f"{BUCKET}/{key}", "--file", f.name,
                            "--content-type", kind, "--remote"], capture_output=True, text=True, cwd=ROOT, env=env)
        if r.returncode != 0:
            raise RuntimeError(f"{key}: {(r.stderr or r.stdout).strip()[-300:]}")
    finally:
        os.unlink(f.name)
    return key


def desk_records():
    """Every story in content/stories, drafts included, as the hosted desk keeps them: one record each,
    photos addressed in the store."""
    photos, out = {}, {}

    def photo(path):
        if not isinstance(path, str) or not path.startswith("img/") or not (ROOT / path).exists():
            return path
        photos["photos/" + path[4:]] = (ROOT / path).read_bytes()
        return PREFIX + "photos/" + path[4:]

    for p in sorted((ROOT / "content/stories").glob("*.md")):
        s = build.english_only(build.story(p))
        if s.get("photo"):
            s["photo"] = photo(s["photo"])
        if s.get("photos"):
            s["photos"] = [photo(x) for x in s["photos"]]
        out[s["id"]] = s
    return list(out.values()), photos


def seed_desk():
    records, photos = desk_records()
    feed = json.loads((ROOT / "data/feed.json").read_text())
    npx = _npx()
    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        list(pool.map(lambda kv: _put(npx, *kv), photos.items()))
    _put(npx, "desk/config.json", json.dumps({"now": feed["generated_at"][:16]}).encode())
    _put(npx, "desk/stories.json", json.dumps(records, ensure_ascii=False).encode())
    return {"records": len(records), "drafts": len([r for r in records if r.get("status", "published") != "published"]), "photos": len(photos)}


def push(dry=False):
    objects, indexes = collect()
    # stories are the hosted desk's: this tool no longer sends them, or it would undo what editors published there
    objects = {k: v for k, v in objects.items() if not k.startswith("stories/")}
    indexes = {k: v for k, v in indexes.items() if not k.startswith("stories/")}
    sent = json.loads(SENT.read_text()) if SENT.exists() else {}
    sha = lambda b: hashlib.sha1(b).hexdigest()
    todo = {k: v for k, v in objects.items() if sent.get(k) != sha(v)}
    changed = [k for k, v in indexes.items() if sent.get(k) != sha(v)]
    result = {"site_rev": json.loads(indexes["site/index.json"])["rev"],
              "sent": sorted(todo), "index_changed": bool(changed), "indexes": changed}
    if dry:
        return result
    npx = _npx()
    with concurrent.futures.ThreadPoolExecutor(6) as pool:      # article texts and photos first
        for key in pool.map(lambda kv: _put(npx, *kv), todo.items()):
            sent[key] = sha(objects[key])
            SENT.write_text(json.dumps(sent, indent=0))
    for key in changed:                                          # the indexes last: one must never point at a file not yet there
        _put(npx, key, indexes[key])
        sent[key] = sha(indexes[key])
        SENT.write_text(json.dumps(sent, indent=0))
    return result


if __name__ == "__main__":
    if sys.argv[1:2] == ["seed-desk"]:
        print(json.dumps(seed_desk()))
        raise SystemExit
    if sys.argv[1:2] != ["push"]:
        raise SystemExit(__doc__)
    out = push(dry="--dry" in sys.argv)
    print(json.dumps({**out, "sent": len(out["sent"])}))
    for k in out["sent"]:
        print("  " + k)
