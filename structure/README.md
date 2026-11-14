# Content structure

`structure.json` is the league's content structure: the **kinds** of story editors can pick and the **topics**
stories are about. It is data, kept apart from the code. Producers change it in Claude Code; it is never edited
in the Content Studio.

## Who changes what

| | Data (this folder) | Code |
|---|---|---|
| **Producer** | kinds, topics, their names, tile sizes, filters | no |
| **Coder** | yes | formats, the Studio, the Desk, the site |

The line: a **kind** is a **format** with a name. A new kind on an existing format is data: add it here. A new
format, with different fields in the Studio or a different look on the site, is code (`hosted-desk/src/structure.js`
`FORMATS`, plus the Studio and `template.html`).

Formats: `text`, `gallery`, `video`, `quote`, `result` (made by the Desk from the scores; keep its kind).

## Fields

Kinds, in the order editors see them and filters appear:

- `id`: lower-case letters, digits or dashes. Never change it once stories use it.
- `format`: one of the formats above. A kind used by stories keeps its format.
- `label`: its name on tiles and in the Studio.
- `filter_label`: its name on the site's filter chip (default: `label`).
- `size`: default tile size. One of `s`, `m`, `l`, `xl`, `p`, `r`.
- `filter`: `true` to give it a filter chip on the site's Stories card.

Topics:

- `id`, `label`.
- `filter`: a filter chip on the site.
- `badge`: its name shows on its stories instead of the kind's.
- `style`: `"mission"` or none. A style is code.
- `author`: default byline.

## Publishing a change

From `hosted-desk/`:

```bash
node tools/structure.mjs check
```

This shows what would change and whether it is allowed. A kind or topic still used by stories cannot be removed.

```bash
node tools/structure.mjs push
```

This publishes the change, live on the next page load with no deploy. The replaced version is kept in the store at
`desk/structure-history/`.

```bash
node tools/structure.mjs pull
```

This copies what is live into this file.
