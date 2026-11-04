#!/bin/sh
# mirror the folder into the scratchpad the Claude preview server serves from (no regeneration)
cd "$(dirname "$0")/.." && rsync -a --delete --exclude .git --exclude tools --exclude desk ./ "/private/tmp/claude-501/-Users-carlodemarchis--claude-spares-spare-6JUP13/e2442ceb-0434-4f0f-8223-aaa5f70fdc50/scratchpad/legacy/"
