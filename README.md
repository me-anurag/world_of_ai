# Atlas of AI

A reference map of artificial intelligence: 1,505 topics in 15 fields, each with a definition, prerequisites, what it leads to, and the paper that introduced it. Static site built with Astro.

## Run it locally

Needs Node 20+ and Python 3.

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # full build into dist/, with checks
npm run preview    # serve dist/
```

`npm run build` does five things in order and stops at the first failure:

1. `scripts/check_and_build_data.py` checks the source files in `content/topics/` (every link resolves, no prerequisite loops, no duplicate names, required fields present) and writes `build/atlas.json`.
2. `scripts/prepare-data.mjs` assigns URL slugs, computes learning paths, and writes the site data and the public downloads.
3. `scripts/lint-content.mjs` rejects filler phrasing, more than one em dash per definition, and sentences over 40 words.
4. `astro build`, then Pagefind builds the search index.
5. `scripts/lint-site.mjs` checks every built page for broken internal links and banned phrasing.

## Editing the map

All content lives in `content/topics/*.txt`, one file per field or part of a field. An entry looks like this:

```
== dl.arch.transformer | Transformer
def: Stacks of self-attention and feed-forward blocks with residual connections ...
pre: dl.arch.attention.self, dl.arch.cnn.resnet, dl.norm.layer
x: hist.timeline.deep.transformer
paper: Vaswani et al. | Attention Is All You Need | 2017
yr: 2017
st: dominant
```

| Key | Meaning |
|---|---|
| `== id \| Name` | The id's dotted prefix is the parent. Ids never change once published. |
| `def:` | Definition. What it is, then why it matters. |
| `pre:` | Prerequisites (ids). Do not list an ancestor; pages inherit those automatically. |
| `to:` | What this led to or made possible. |
| `x:` | Related topic in another field. |
| `paper:` | `Authors \| Title \| Year` |
| `st:` | foundational, dominant, active, classic, superseded, milestone, debate, border |
| `d:` | beg, int, adv |
| `rev:` | `Reviewer \| YYYY-MM-DD`. Add only after reading the entry line by line. Pages then show "Reviewed". |

URLs are locked in `content/slugs.json`. Renaming a topic does not change its URL. Commit that file.

## Checking the key papers

```sh
npm run verify:papers
```

Looks every cited paper up on arXiv and Crossref (about 15 minutes; needs internet) and writes `build/paper-report.csv` with a status for each: `match`, `year-differs`, `title-differs` or `not-found`. Fix or confirm every non-match by hand. Then update the paper-verification sentence in `src/pages/methodology.astro`.

## Deploying on Cloudflare Pages

1. Push this repository to GitHub.
2. In Cloudflare: Workers & Pages → Create → Pages → Connect to Git → choose the repository.
3. Build settings:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables: `SITE_URL` = your final address, for example `https://atlasofai.org` (no trailing slash); `NODE_VERSION` = `20`; optionally `SITE_EDITOR` = the editor's name shown on the About page.
4. Deploy. The site is live at `<project>.pages.dev`.
5. Custom domain: Pages project → Custom domains → Set up a domain. Then update `SITE_URL` and the address in `public/robots.txt`, and redeploy.

## Before the public launch

- Run `npm run verify:papers` and resolve every non-match.
- Review the 150 most-required topics and add `rev:` lines.
- Set `beta: false` in `src/site.config.mjs` to remove the Beta badge.
- Add a changelog entry in `src/pages/changelog.astro`.

## Licence

Code: MIT. Text and data: CC BY 4.0. See `LICENSE`.
