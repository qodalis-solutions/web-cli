# Plugin marketplace (catalog server, `pkg` source, moderation, docs)

Date: 2026-11-23. Status: approved 2026-11-23 (D2-D6 as recommended; D1 changed: the service is private, see below). Issue: web-cli#230.

## Intent

`pkg` gets a catalog of its own. Today `pkg browse` searches npm for the `@qodalis/cli-` prefix and probes the
CDNs for a hard-coded list of official plugins, so a third-party plugin cannot be discovered, nothing is
reviewed, and the listing knows only what `package.json` says. A marketplace server becomes the catalog that
`pkg`, the docs site and the dashboard read: it indexes plugins that stay on npm, adds the metadata npm does
not have, records which CLI version each plugin version needs and the hash of its bundle, and lets a moderator
approve, flag or unlist.

## Goals

1. A **marketplace plugin** for the CLI server: a public catalog API (search, plugin details, versions,
   compatibility), an indexer that reads npm, and a moderation API.
2. `pkg browse`, `pkg search` and `pkg info` read the marketplace and fall back to npm when it is unreachable.
3. Plugins outside the `@qodalis/cli-` prefix can be found and installed by short name.
4. `pkg add` refuses a plugin version that does not fit the running CLI and a bundle whose hash differs from
   the one the marketplace recorded.
5. A host can point the CLI at its own (private) marketplace, or turn the marketplace off.
6. A moderation page in the dashboard; a plugins page on the docs site built from the same API; a guide for
   publishing a plugin.

## Non-goals

- Hosting packages. Plugins are published to npm as today; the marketplace stores metadata only (decision D3).
- Publisher accounts, ratings, reviews, comments, paid plugins (decision D2 keeps v1 without accounts).
- Installing server-side packages (npm, PyPI, NuGet) from the web CLI. Paired server packages are listed with
  their install command, nothing more.
- Sandboxing plugins. A plugin is still code running in the host page; the marketplace adds review and a
  pinned hash, not isolation.
- Telemetry from the CLI. Download counts come from npm (decision D6).

## Anti-goals

- `pkg` that stops working when the marketplace is down, slow or blocked: every command falls back to today's
  behaviour, with one line saying so.
- A bundle that changed after it was reviewed being injected silently.
- An unreviewed package appearing in the default listing.
- The marketplace becoming a second place plugin authors must publish code to.
- Hosts that do not want it getting new network calls to `plugins.qodalis.com` they cannot turn off.

## What exists (checked 2026-11-23, web-cli 2.7.1, servers 1.0.0-beta.29, dashboard 1.0.0-beta.26)

- Sources: `ScriptLoaderService` (`packages/cli/src/lib/services/script-loader.ts`) knows two kinds,
  `registry` (npm search API) and `file` (static files, probed). Built in: `unpkg`, `jsdelivr` (file), `npm`
  (registry). Hosts add sources with `options.packageSources.sources` and pick the primary one
  (`CliPackageSource`, `packages/core/src/lib/models/options.ts:12`); users switch with `pkg source get|set`.
- Discovery: `collectAvailablePackages` (`processors/system/packages/package-search.ts`) searches each
  registry for the prefix (250 results at most), filters with the heuristic `isWebPlugin`, then probes each
  file source for the 40 names in `KNOWN_PLUGIN_SHORT_NAMES` (`package-utils.ts`).
- Install: `CliPackageInstaller.install` (`package-installer.ts:131`) reads `<name>/package.json` from a file
  source, resolves the bundle (`unpkg`, then `umd`, then `main`), downloads it **as text** and injects it
  inline (`downloadAndInject`, :366). At startup, saved packages are injected by URL with source fallback
  (`injectFromUrl`, :445). The saved record is `Package { name, version, url, dependencies }`.
- Compatibility: modules declare `apiVersion`; the runtime's is `API_VERSION = 2`
  (`packages/core/src/lib/version.ts`). `CliModuleRegistry` skips an older module **after** its script ran.
  Nothing checks before download.
- `pkg` sub-commands: `ls`, `browse`, `add`, `remove`, `versions`, `check`, `update`, `source get|set`. No
  `search`, no `info`.
- Plugin packages carry no marker: `@qodalis/create-cli-plugin` writes keywords `cli`, `qodalis`, `terminal`,
  `<name>` and the `umd`/`unpkg` fields (`packages/create-cli-plugin/src/templates/package-json.ts`).
- Server side: plugins are built with a builder and mounted with `cli.mountPlugin(plugin)`; they declare
  permissions (`builder.addPermissions`), keep data behind store interfaces with an in-memory default (users,
  public-api) and may serve public routes on a protected server (docs, portal, public-api). The dashboard has
  a Plugins page for the **server's** installed plugins (`/api/v1/qcli/plugins`); it is unrelated to this.
- Docs site: a static `plugins` page and `plugin-detail` pages (`apps/docs/src/app/pages/docs/pages`).

## Approaches

- **A. A marketplace plugin on the server stack, plus one hosted instance (chosen).** The catalog is a server
  plugin like users or public-api: hosts that want a private marketplace mount it; `plugins.qodalis.com` is
  an ordinary CLI server with the marketplace, users and admin plugins. Moderation reuses the users plugin's
  permissions and the dashboard.
- **B. A standalone marketplace application** (own repo, own auth, own admin UI). Free to pick any stack, but
  it rebuilds sign-in, permissions, an admin UI and deployment that the server stack already has, and a
  private marketplace becomes a second product to run.
- **C. A static catalog** (a JSON file generated by CI from npm and a reviewed list in git, served from
  GitHub Pages). Cheapest and has no server to run, and a pull request is the moderation step. But no search
  on the server, no private marketplace without forking the pipeline, no dashboard moderation, and the issue
  asks for a server.

A is chosen because the issue asks for a server on the existing stack and for private marketplaces. C stays
available as a fallback inside A: the catalog API's list response can be exported as a static file, which is
what the docs site embeds at build time (Part 4).

## Decisions to confirm

Each has a recommendation; the design below assumes it.

- **D1 (decided: a private Qodalis service, not a published server plugin; the HTTP API is documented so others
  can implement a marketplace).** Originally: **Which servers get the plugin.** *Recommended: Node only in v1*, published as
  `@qodalis/cli-server-plugin-marketplace`, with the HTTP contract written so the .NET and Python servers can
  follow. The indexer talks to npm and unpkg, the hosted instance needs one implementation, and a private
  marketplace can run the Node server (or its Docker image) whatever the host's own stack is. This is the
  first plugin that is not on all three servers; the alternative is all three at roughly three times the
  server work (Phase 6).
- **D2. Submission model.** *Recommended: open, moderated, no publisher accounts.* A package enters the queue
  when it carries the npm keyword `qodalis-cli-plugin` (found by the indexer) or when anyone submits its
  name (`pkg publish <name>`, a rate-limited public endpoint that takes only a package name). Nothing is
  listed until a moderator approves it. Publishers are identified by npm scope or maintainer; a moderator
  marks one as verified, after which its new versions are approved automatically. `@qodalis` is verified
  from the start.
- **D3. Bundles.** *Recommended: not mirrored.* The marketplace stores the bundle's path, size and SHA-384;
  the CLI downloads from the npm CDNs (with its existing fallback between them) and checks the hash.
  Mirroring would make the marketplace a code host with storage, bandwidth and takedown duties.
- **D4. Hosting.** *Recommended: `plugins.qodalis.com`* on Qodalis' own infrastructure. Needs a DNS record and your go-ahead; nothing is
  deployed before that.
- **D5. Packages the marketplace does not list.** *Recommended: still installable by full name, with a
  one-line warning* ("not listed in the marketplace, not reviewed"), as today. A host can set
  `packageSources.marketplaceOnly: true` to refuse them.
- **D6. Install counts.** *Recommended: npm's weekly downloads*, fetched by the indexer. No request from the
  CLI when a plugin is installed.

## Part 1: marketplace plugin (server)

### Data

- **Plugin**: `name` (the npm name, the key), `shortName`, `description`, `categories[]`, `tags[]`,
  `publisher { id, name, verified }`, `author`, `homepage`, `repository`, `license`, `icon`, `screenshots[]`,
  `serverPackages[] { ecosystem: npm | pypi | nuget, name }`, `official`, `featured`, `downloads { weekly }`,
  `latest` (the newest listed version), `status` (`pending | listed | rejected | unlisted`), `createdAt`,
  `updatedAt`.
- **Version**: `version`, `apiVersion`, `coreRange` (the peer range on `@qodalis/cli-core`), `bundle`
  (path inside the package), `integrity` (`sha384-…`), `size`, `publishedAt`, `status`
  (`pending | listed | flagged | unlisted`), `note` (why it was flagged or rejected).
- **Publisher**: `id` (npm scope, or maintainer name for unscoped packages), `verified`.
- **Submission log**: who (or what: `indexer`, `submit`), when, the decision and the moderator.

Stores follow the users and public-api plugins: an `IMarketplaceStore` interface, an in-memory default and
one persistent implementation for the hosted instance (which one is pinned in the implementation plan after
reading what the Node server already depends on).

### Where the metadata comes from

`package.json` on npm, read by the indexer; nothing is typed into the marketplace by publishers.

```json
{
  "keywords": ["qodalis-cli-plugin"],
  "unpkg": "umd/index.global.js",
  "peerDependencies": { "@qodalis/cli-core": "^2.7.0" },
  "qodalis": {
    "apiVersion": 2,
    "category": "tools",
    "icon": "assets/icon.svg",
    "screenshots": ["assets/shot-1.png"],
    "serverPackages": [{ "ecosystem": "npm", "name": "@acme/cli-server-plugin-foo" }]
  }
}
```

`apiVersion` falls back to the major of the `@qodalis/cli-core` peer range when the field is absent, so the
existing official plugins index without a republish. Categories are a fixed list (tools, data, games,
language, server, other); an unknown one becomes `other`. A moderator can override category, tags and
`featured`.

### Indexer

A periodic task (every 30 minutes, and on demand from the moderation API):

1. Search npm for the keyword `qodalis-cli-plugin` and for the scope `@qodalis` (official plugins, so the
   catalog is full on day one without touching them).
2. For each package or version not yet known: read the version's `package.json`, resolve the bundle path as
   `pkg` does (`unpkg`, `umd`, `main`), download the bundle from the CDN, record its size and SHA-384.
3. Store the version as `listed` when the publisher is verified, `pending` otherwise. A version with no
   browser bundle is stored as `rejected` with a note (this replaces the `isWebPlugin` heuristic).
4. Refresh weekly downloads; mark versions npm no longer has (unpublished, deprecated) as `unlisted`.

It is bounded (page size, request timeout, a cap on bundle size) and a failing package never stops the run.

### Public API

No sign-in, credentials ignored (as the docs plugin), CORS open, `Cache-Control` set, error bodies
`{ "error": "<text>" }`. Mounted under `/api/v1/qcli/marketplace` by default; the exact mount and field
order are pinned in the implementation plan.

| Method | Path | Answer |
|---|---|---|
| GET | `/plugins?query=&category=&apiVersion=&page=&pageSize=&sort=` | Listed plugins, each with its newest version that fits `apiVersion` (`compatible: false` and the reason when none fits) |
| GET | `/plugins/{name}` | One plugin: metadata, readme (markdown, from npm), listed versions, paired server packages |
| GET | `/plugins/{name}/versions/{version}` | One version: `apiVersion`, `coreRange`, `bundle`, `integrity`, `size`, `status` |
| GET | `/resolve?name=` | Full names matching a short name (`guid` → `@qodalis/cli-guid`; several when ambiguous) |
| GET | `/categories` | The category list with counts |
| POST | `/submissions` | `{ "name": "<npm name>" }`: queues the package for indexing and review. Rate-limited per address |

### Moderation API

Requires sign-in and the permission `marketplace:moderate` (declared through the permission catalog, so it
shows in the dashboard's role editor): the review queue, approve / reject a plugin, flag / unlist / relist a
version (with a note), verify a publisher, edit category, tags and `featured`, run the indexer now. Every
decision is written to the submission log and, when the audit plugin is mounted, to the audit trail.

## Part 2: `pkg` (web-cli)

- **A third source kind, `marketplace`**, next to `registry` and `file` (`SourceKind`,
  `CliPackageSource.kind`). Built in: `qodalis` → `https://plugins.qodalis.com/`. Hosts configure it like the
  other sources, and with two new `packageSources` options: `marketplace` (`false` turns it off, a URL
  replaces the default with a private one) and `marketplaceOnly` (D5). `pkg source` lists it.
- **`pkg browse`** and the new **`pkg search <text>`** query the marketplace with the running `API_VERSION`.
  Rows show name, version, category, a verified mark and whether the plugin fits this CLI; below 60 columns
  one block per plugin, as today. When the marketplace does not answer within a short timeout, the current
  npm search and CDN probing run instead, after one line: `Marketplace unreachable, searching npm`.
- **`pkg info <name>`** (new): description, publisher (verified or not), category, versions and which fit,
  links, paired server packages with their install commands. Falls back to the npm registry document.
- **`pkg add <name>`**:
  1. Resolve the name: bundled check as today, then the marketplace (`/resolve` for a short name, so
     third-party plugins install by short name; an ambiguous one lists the candidates), then today's
     prefix-then-full-name lookup on the CDNs.
  2. Listed: pick the newest listed version that fits, or the requested one. A version that needs a newer
     CLI, or is flagged or unlisted, is refused with the reason and the newest version that would work.
  3. Download the bundle from the CDNs as today, compute SHA-384 with Web Crypto on the downloaded text and
     compare before injecting. A mismatch stops the install and says so; nothing is injected.
  4. Not listed: D5.
- **Saved packages keep the hash** (`Package.integrity`). Startup loading injects with the `integrity`
  attribute, so a CDN serving different content later is refused by the browser; the package is reported and
  skipped, the CLI still starts. Packages saved before this have no hash and load as today.
- **`pkg check` / `pkg update`** read versions from the marketplace when the package is listed, never offer
  an incompatible or unlisted version, and warn when an installed version has been flagged.
- **`pkg publish [name]`** (new): submits the package name to the marketplace (`POST /submissions`) and
  prints what happens next. It does not publish to npm.
- `KNOWN_PLUGIN_SHORT_NAMES` and `isWebPlugin` stay, used only by the npm fallback.
- **`@qodalis/create-cli-plugin`** writes the `qodalis-cli-plugin` keyword and the `qodalis` block, and its
  closing message links the publishing guide.

## Part 3: dashboard

A **Marketplace** page, shown only when the server has the marketplace plugin and the user holds
`marketplace:moderate`: the review queue (package, publisher, versions, bundle size, links to npm and the
repository, approve / reject with a note), the catalog (search, edit category / tags / featured, unlist), a
version list per plugin (flag, unlist, relist), publishers (verify), and "Index now". Translated into the
dashboard's 10 languages, with the per-page error boundary the other pages have.

## Part 4: docs

- The docs site's **Plugins** page is built from the catalog: the list is fetched at build time and embedded
  (so the page renders without the marketplace), then refreshed in the browser. Search, category filter,
  verified mark, `pkg add` line to copy.
- A **Publishing a plugin** guide: the keyword and the `qodalis` block, `pkg publish`, what review checks,
  how versions and compatibility are read, how to pair a server package.
- **Configuration** page: the `marketplace` source kind, private marketplaces, `marketplaceOnly`, turning it
  off. **Built-in commands**: `pkg search`, `pkg info`, `pkg publish`.
- The AI guide (`docs/ai`) gets the same, keeping its topic headings; mcp-cli's snapshot is resynced.
- README of the marketplace plugin (server repo): setup, the contract, running a private marketplace.

## Security

- The hash pins what a moderator saw: a version is reviewed once, and the CLI injects only bytes with that
  SHA-384, at install and at every start.
- Unlisting is the kill switch: an unlisted or flagged version is not offered, and installed copies are
  reported by `pkg check` and at startup.
- The marketplace serves no JavaScript in v1, only JSON. Readmes are markdown rendered by the client without
  raw HTML.
- The public submit endpoint accepts a package name and nothing else, is rate-limited, and only ever causes
  the indexer to read npm.
- The indexer treats npm content as untrusted: size caps, timeouts, strict parsing of `package.json`.

## Delivery

1. **Contract and Node plugin**: data, stores, indexer, public and moderation API, permission, tests
   (vitest + supertest, npm and the CDN faked). No deployment.
2. **web-cli**: the source kind and options, `browse` / `search` / `info` / `add` / `check` / `update` /
   `publish`, hash checks, the npm fallback, `create-cli-plugin`; Jasmine specs against a faked marketplace,
   and a run against the local Node server.
3. **Dashboard**: the Marketplace page, 10 languages, tests.
4. **Docs**: plugins page, publishing guide, configuration and command pages, AI guide, mcp-cli sync.
5. **Hosting** (after D4): deploy `plugins.qodalis.com`, index and approve the official plugins and the six
   games, then release.
6. **Optional, per D1**: .NET and Python ports of the plugin against the same contract.

Release order: dashboard (npm) → servers `1.0.0-beta.30`, every package bumped together, the marketplace
plugin new → deploy the hosted instance → web-cli `2.8.0` → pwa-cli and the four examples. Until the hosted
instance answers, a released web-cli simply takes the npm fallback, so the order is safe either way.

Each phase gets its own task-by-task implementation plan under `docs/superpowers/plans/` once this design is
approved; work goes on one `feature/plugin-marketplace` branch per repo.

## Acceptance (from the issue)

- [ ] Marketplace API with the catalog, plugin details and version compatibility (Part 1).
- [ ] `pkg browse` / `pkg search` / `pkg info` use it, with npm as the fallback (Part 2).
- [ ] Third-party plugins outside the `@qodalis/cli-` prefix can be found and installed (Parts 1 and 2).
- [ ] `pkg add` checks compatibility and the bundle's integrity (Part 2).
- [ ] Hosts can point the CLI at their own (private) marketplace (Parts 1 and 2).
- [ ] Docs: plugins page and publishing guide (Part 4).
