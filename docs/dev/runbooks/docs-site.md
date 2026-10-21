# Runbook: previewing and deploying the user docs

The user docs are a VitePress site built from `docs/` and served at
<https://davidcristian.github.io/Kalandra/>. VitePress turns each markdown page into an HTML page
under the base path `/Kalandra/`. The developer docs in `docs/dev/` are left out of the site and
read on GitHub ([ADR-0008](../adr/ADR-0008-developer-docs-layout.md)). The prose rules for every
page are in [AGENTS.md](../../../AGENTS.md#prose). Setting up a machine:
[DEVELOPING.md](../../../DEVELOPING.md).

## Setup

Node 24, the version CI uses. In `docs/`:

```shell
npm ci
```

## Preview while writing

```shell
npm run dev
```

`vitepress dev` prints the local address, `http://localhost:5173/Kalandra/` unless port 5173 is in
use. The renderer's dev server also uses port 5173, and the server started second moves to the
next free port. Start this one after the renderer's dev server, since main loads only port 5173
(`main/build/script.mjs`). A page updates when its file is saved.

## Build and preview the build

```shell
npm run build
npm run preview
```

`vitepress build` writes the site to `docs/.vitepress/dist`. It fails on a dead internal link: it
prints `(!) Found dead link <link> in file <file>` for each one, then stops with
`<n> dead link(s) found.` `vitepress preview` serves the built site on
`http://localhost:4173/Kalandra/`.

The Docs job of `.github/workflows/test.yml` runs this build, so a dead link fails the pull
request's checks ([architecture.md](../architecture.md#ci) lists what each workflow runs and when).

## Add or change a page

1. **The file** is `docs/<page>.md`. Its address is `/Kalandra/<page>`, and other pages link it as
   `/<page>`, without `.md`. The home page is `docs/index.md`, linked as `/`.
2. **The title** goes in frontmatter, and the page has no H1 of its own, because the site layout
   (`docs/.vitepress/theme/Layout.vue`) shows the frontmatter `title` as the heading of every page
   except the home page:

   ```markdown
   ---
   title: Stash search
   ---
   ```

3. **The sidebar entry** goes in `themeConfig.sidebar` in `docs/.vitepress/config.js`. The sidebar
   has five groups, shown with their names: Get started, Price check, Widgets, Settings and
   Problems. Add `{ text: 'Page name', link: '/page' }` to the `items` of its group. A page without
   an entry is still built, but a reader reaches it only through a link.
4. **Images** go in `docs/reference-images/` and a page references them as
   `/reference-images/<file>`. The build copies each referenced image into the site with a hashed
   name and leaves out every image no page references. Images are kept in the repo, never linked
   from another host.
5. **Classes.** `{:.text-sm}` after an element adds a class to it: `markdown.attrs` in `config.js`
   sets `{:` and `}` as the delimiters. Tailwind classes work in pages, because the Tailwind
   `content` list in `docs/package.json` includes `./*.md`.
6. **Values from the config.** A page reads `themeConfig` values in a `<script setup>` block with
   `useData()` from `vitepress`. `docs/download.md` builds its download links from `appVersion` this
   way.
7. **Links to a developer doc** use the GitHub address,
   `https://github.com/davidcristian/Kalandra/blob/master/docs/dev/<path>`. A relative link or a
   `/dev/` link points at a page that is not built, so the build reports it as dead.
8. **Game text** in a page, such as a log line or an item's copied text, keeps its characters
   exactly as the game writes them.

## Where docs/dev/ fits

`srcExclude: ['dev/**']` in `docs/.vitepress/config.js` keeps `docs/dev/` out of the build. A
developer doc is plain GitHub markdown: one H1, no frontmatter, relative links to other developer
docs and to repo files. The build's dead link check does not read `docs/dev/`. The `linkcheck`
pre-commit hook, `scripts/linkcheck.py`, checks those links instead: each relative link must name a
file in the repo, and a heading that file has. It does not open web addresses, so check those by
hand. The developer index is [docs/dev/index.md](../index.md).

## Deploy

The Docs workflow, `.github/workflows/pages.yml`, deploys the site.
[architecture.md](../architecture.md#ci) lists which pushes start it and which start the Build
workflow. To start it by hand: Actions, Docs, Run workflow, with `master` as the branch. Its one
job runs `npm ci` and `npm run build` in `docs/`, then `actions/configure-pages`,
`actions/upload-pages-artifact` with `docs/.vitepress/dist`, and `actions/deploy-pages` into the
`github-pages` environment.

You should see the site address under the deploy job on the run's page, and the site serve the new
pages a short time later.

## When it fails

- **`Found dead link`.** Fix the link the message names and push again. The deploy job stops
  before it uploads anything, so the site keeps the last deployed version.
- **`npm ci` reports that `package.json` and `package-lock.json` are not in sync.** A dependency
  in `docs/package.json` changed without its lock file. Run `npm install` in `docs/` and commit
  `package-lock.json` together with `package.json`.
- **`configure-pages` or `deploy-pages` fails.** The repository's Pages source is not GitHub
  Actions (Settings, Pages, Build and deployment, Source), or the `github-pages` environment's
  deployment branch rule does not allow the branch the run started from (Settings, Environments).
- **An image works in a preview on Windows and not in CI.** The case of its path differs from the
  file name. Windows ignores the difference, and the Linux runner of the Docs job does not.
- **A page is missing from the sidebar.** It has no entry in `themeConfig.sidebar`.
- **The download links return 404.** `appVersion` names a release that is not published yet. See
  [release.md](release.md).
