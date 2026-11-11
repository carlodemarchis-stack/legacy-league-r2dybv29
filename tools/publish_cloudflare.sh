#!/bin/sh
# Build the page and publish it to Cloudflare as static files.
# Only what a reader's browser loads goes up: the page, the story files, the images. No content sources, no tools.
set -e
cd "$(dirname "$0")/.."
python3 tools/build.py
rm -rf .site && mkdir -p .site/data
cp index.html favicon.svg .site/
cp -R data/stories .site/data/stories
rsync -a --exclude .DS_Store img/ .site/img/
# Caching: the page is revalidated on every visit (Cloudflare's default for files), so a publish shows at once.
# Story files carry a hash of their content in the name, so they never change and can be kept for good.
cat > .site/_headers <<'H'
/*
  X-Robots-Tag: noindex
/data/stories/*
  Cache-Control: public, max-age=31536000, immutable
/img/*
  Cache-Control: public, max-age=604800
H
npx --yes wrangler deploy
