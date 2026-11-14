#!/bin/sh
# Copy the rendered demo into the app bundle and sync the native projects.
set -e
cd "$(dirname "$0")"
rm -rf www && mkdir -p www
cp ../index.html ../favicon.svg www/
cp -R ../img www/img
mkdir -p www/data && cp -R ../data/stories www/data/stories   # article bodies the page fetches when a story is opened
cp native.js www/native.js
# inject the native bridge script before </body>
python3 - <<'PY'
import pathlib
p = pathlib.Path("www/index.html"); t = p.read_text()
if "native.js" not in t:
    t = t.replace("</body>", '<script type="module" src="native.js"></script>\n</body>')
    p.write_text(t)
PY
npx cap sync
