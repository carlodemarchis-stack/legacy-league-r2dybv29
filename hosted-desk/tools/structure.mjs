#!/usr/bin/env node
/* The content structure (kinds of story and topics) lives as data in ../structure/structure.json, apart from the
   code. Producers change that file in Claude Code; this script checks it and puts it in the store
   (site/structure.json), where the Desk, the Content Studio and the site read it. No code deploy is involved.

     node tools/structure.mjs check   compare the file with the store: what would change, and whether it is allowed
     node tools/structure.mjs push    check, then publish it (the version it replaces goes to desk/structure-history/)
     node tools/structure.mjs pull    write what the store has into the file (to start from what is live)

   The rules are the Desk's own (src/structure.js): ids, names, formats that exist, a kind or topic still used by
   stories is not removed, a used kind keeps its format. Run from the hosted-desk folder (wrangler must be signed in). */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { clean, problems, formatChanges, DEFAULT_STRUCTURE, FORMATS } from "../src/structure.js";

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, "../../structure/structure.json");
const BUCKET = "legacy-league-content", KEY = "site/structure.json";
const wrangler = (args, input) => execFileSync("npx", ["wrangler", ...args], { cwd: join(here, ".."), input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 << 20 });
const get = (key) => { try { return JSON.parse(wrangler(["r2", "object", "get", `${BUCKET}/${key}`, "--remote", "--pipe"])); } catch (e) { return null; } };
const put = (key, obj) => {
  const f = join(mkdtempSync(join(tmpdir(), "structure-")), "s.json");
  writeFileSync(f, JSON.stringify(obj));
  wrangler(["r2", "object", "put", `${BUCKET}/${key}`, "--file", f, "--content-type", "application/json", "--remote"]);
};

/* what changes between two structures, in words */
function changes(a, b) {
  const out = [];
  for (const list of ["kinds", "topics"]) {
    const was = Object.fromEntries(a[list].map((x) => [x.id, x])), now = Object.fromEntries(b[list].map((x) => [x.id, x]));
    for (const id of Object.keys(now)) if (!was[id]) out.push(`+ ${list.slice(0, -1)} "${id}" (${now[id].label}${now[id].format ? ", " + now[id].format : ""})`);
    for (const id of Object.keys(was)) if (!now[id]) out.push(`- ${list.slice(0, -1)} "${id}" (${was[id].label})`);
    for (const id of Object.keys(now)) if (was[id]) {
      const diff = [...new Set([...Object.keys(was[id]), ...Object.keys(now[id])])].filter((k) => !["updated_at", "updated_by"].includes(k) && JSON.stringify(was[id][k]) !== JSON.stringify(now[id][k]));
      if (diff.length) out.push(`~ ${list.slice(0, -1)} "${id}": ` + diff.map((k) => `${k} ${JSON.stringify(was[id][k])} → ${JSON.stringify(now[id][k])}`).join(", "));
    }
    if (a[list].map((x) => x.id).join() !== b[list].map((x) => x.id).join() && !out.some((l) => l.includes(list.slice(0, -1)))) out.push(`~ ${list}: new order ${b[list].map((x) => x.id).join(", ")}`);
  }
  return out;
}

const cmd = process.argv[2];
if (cmd === "pull") {
  const live = get(KEY);
  const s = clean(live || DEFAULT_STRUCTURE); delete s.updated_at; delete s.updated_by;
  writeFileSync(FILE, JSON.stringify(s, null, 2) + "\n");
  console.log(live ? "Wrote the live structure to structure/structure.json." : "The store has no structure yet (the site uses the built-in one). Wrote that to structure/structure.json.");
  process.exit(0);
}
if (cmd !== "check" && cmd !== "push") { console.log("Usage: node tools/structure.mjs check | push | pull"); process.exit(1); }

let raw;
try { raw = JSON.parse(readFileSync(FILE, "utf8")); } catch (e) { console.error("structure/structure.json is not valid JSON: " + e.message); process.exit(1); }
const next = clean(raw), liveRaw = get(KEY), live = clean(liveRaw || DEFAULT_STRUCTURE);
const stories = get("desk/stories.json") || [];
const errs = [...problems(next, stories), ...formatChanges(live, next, stories)];
const diff = changes(live, next);

console.log(`Formats (code): ${Object.keys(FORMATS).join(", ")}`);
console.log(`Stories checked: ${stories.length}`);
console.log(diff.length ? "Changes:\n  " + diff.join("\n  ") : "No changes: the file is the same as what is live.");
if (errs.length) { console.error("Not allowed:\n  " + errs.join("\n  ")); process.exit(2); }
if (cmd === "check" || !diff.length) process.exit(0);

if (liveRaw) put(`desk/structure-history/${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`, liveRaw);
let by = "Claude Code"; try { by = execFileSync("git", ["config", "user.email"], { encoding: "utf8" }).trim() || by; } catch (e) {}
put(KEY, { ...next, updated_at: new Date().toISOString().slice(0, 19), updated_by: by });
console.log("Published. The site and the Content Studio use it on their next load.");
