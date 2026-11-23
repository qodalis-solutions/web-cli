# Plugin marketplace: implementation plan and contract

Design: `docs/superpowers/specs/2026-11-23-plugin-marketplace-design.md` (decisions D1-D6 approved on 2026-11-23 as
recommended; D4 hosting: `https://plugins.qodalis.com` on the apps VM 104 on pve1). Added on 2026-11-23: a **public
web interface** (browse, search, plugin pages, publishing guide, submit form) served by the marketplace plugin at
the root of `plugins.qodalis.com`. Moderation stays in the admin dashboard.

This file pins the contract every part builds against. Four parts are built in parallel:

| Part | Repo, branch | What |
|---|---|---|
| Server | cli-server-node, `feature/plugin-marketplace` | `plugins/marketplace` (`@qodalis/cli-server-plugin-marketplace`), the hosted app in `deploy/marketplace/` |
| CLI | web-cli, `feature/panel-theme-picker` (PR #237) | `pkg` changes, `create-cli-plugin`, docs |
| Moderation | cli-server-dashboard, `feature/plugin-marketplace` | Marketplace page in the dashboard |
| Site | cli-server-dashboard, `feature/plugin-marketplace` | `marketplace/` workspace, `@qodalis/cli-server-marketplace-site` |

## Base URL

A marketplace is identified by its **base URL** (`https://plugins.qodalis.com/`). The API lives at
`<base>api/v1/qcli/marketplace`. Every path below is relative to that API root.

## JSON types (TypeScript notation; every response is `application/json`)

```ts
type PluginStatus = 'pending' | 'listed' | 'rejected' | 'unlisted';
type VersionStatus = 'pending' | 'listed' | 'flagged' | 'unlisted' | 'rejected';
type Category = 'tools' | 'data' | 'games' | 'language' | 'server' | 'other';
type Ecosystem = 'npm' | 'pypi' | 'nuget';

interface MarketplacePublisher { id: string; name: string; verified: boolean }

interface MarketplaceServerPackage { ecosystem: Ecosystem; name: string; install: string } // install: e.g. "npm install @acme/x"

interface MarketplaceVersion {
    version: string;            // semver
    apiVersion: number;         // module API version the bundle needs (core's API_VERSION, today 2)
    coreRange: string | null;   // peer range on @qodalis/cli-core
    bundle: string;             // path inside the package, e.g. "umd/index.global.js"
    integrity: string;          // "sha384-<base64>" of the bundle's bytes
    size: number;               // bytes
    publishedAt: string;        // ISO
    status: VersionStatus;
    note?: string;              // why it was flagged / rejected / unlisted
    deprecated?: string;        // npm deprecation message
}

interface MarketplacePluginSummary {
    name: string;               // npm name, the key ("@qodalis/cli-guid", "cli-foo", "@acme/cli-bar")
    shortName: string;          // "guid" ("@qodalis/cli-guid" -> "guid", "@acme/cli-bar" -> "bar", "foo-plugin" -> "foo-plugin")
    description: string;
    category: Category;
    tags: string[];
    publisher: MarketplacePublisher;
    official: boolean;          // publisher id "@qodalis"
    featured: boolean;
    icon?: string;              // absolute URL (CDN) or undefined
    downloads: { weekly: number };
    latest: string | null;      // newest listed version
    compatible: boolean;        // a listed version fits the requested apiVersion (true when none was requested)
    version: string | null;     // newest listed version that fits the requested apiVersion (= latest when none requested)
    reason?: string;            // when !compatible: "needs CLI API 3 (this CLI has 2)"
    updatedAt: string;
}

interface MarketplacePlugin extends MarketplacePluginSummary {
    status: PluginStatus;       // public API only ever returns 'listed'
    author?: string;
    homepage?: string;
    repository?: string;
    license?: string;
    screenshots: string[];      // absolute URLs
    serverPackages: MarketplaceServerPackage[];
    readme: string;             // markdown from npm (may be ""); clients render without raw HTML
    versions: MarketplaceVersion[]; // newest first; public API: listed + flagged only (flagged so `pkg check` can warn)
    createdAt: string;
}

interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
interface ApiError { error: string }
```

## Public API (no sign-in, CORS `*`, credentials ignored)

| Method | Path | Answer |
|---|---|---|
| GET | `/plugins?query=&category=&apiVersion=&page=1&pageSize=24&sort=` | `Page<MarketplacePluginSummary>`; listed plugins only. `query` matches name, shortName, description, tags (case-insensitive, all words). `sort`: `relevance` (default with a query), `downloads` (default without), `updated`, `name`. `pageSize` 1-100. `Cache-Control: public, max-age=60` |
| GET | `/plugins/{name}?apiVersion=` | `MarketplacePlugin`, 404 when not listed. `{name}` is URL-encoded (`%40qodalis%2Fcli-guid`); the server also accepts the raw scoped form `/plugins/@qodalis/cli-guid` |
| GET | `/plugins/{name}/versions/{version}` | `MarketplaceVersion` (listed or flagged), 404 otherwise |
| GET | `/resolve?name=` | `{ matches: MarketplacePluginSummary[] }`: listed plugins whose `name` equals the input, or whose `shortName` equals it; an `official` match first. Empty array when none |
| GET | `/categories` | `{ categories: { id: Category; count: number }[] }` (listed plugins) |
| GET | `/stats` | `{ plugins: number; publishers: number; weeklyDownloads: number; indexedAt: string \| null }` |
| POST | `/submissions` | body `{ "name": "<npm name>" }` -> 202 `{ status: 'queued' \| 'known', plugin?: { name, status } }`. 400 for a name that is not a valid npm name, 429 when rate limited (10 per hour per address). Queues an index of that one package |

Errors: `{ "error": "<text>" }` with 400/404/429/500. Responses of 4xx are `Cache-Control: no-cache`.

## Moderation API (sign-in + permission `marketplace:moderate`)

Under the same root, prefix `/admin`. Every mutating call takes an optional `note` and writes the log.

| Method | Path | Answer |
|---|---|---|
| GET | `/admin/plugins?status=&query=&page=&pageSize=` | `Page<MarketplacePlugin>` without readme (all statuses; `status=pending` is the review queue: plugins pending **or** holding a pending version) |
| GET | `/admin/plugins/{name}` | `MarketplacePlugin` with every version |
| POST | `/admin/plugins/{name}/approve` | lists the plugin and its pending versions -> `MarketplacePlugin` |
| POST | `/admin/plugins/{name}/reject` | `{ note }` -> plugin `rejected` |
| POST | `/admin/plugins/{name}/unlist` / `/relist` | plugin status |
| PATCH | `/admin/plugins/{name}` | `{ category?, tags?, featured? }` overrides |
| POST | `/admin/plugins/{name}/versions/{version}/{action}` | action `approve` \| `flag` \| `unlist` \| `relist` \| `reject`, body `{ note? }` |
| GET | `/admin/publishers` | `{ items: (MarketplacePublisher & { plugins: number })[] }` |
| POST | `/admin/publishers/{id}/verify` / `/unverify` | publisher; verifying approves its pending versions |
| POST | `/admin/index` | runs the indexer now -> 202 `{ started: boolean }` (false when a run is in progress) |
| GET | `/admin/index` | `{ running: boolean; lastRun: { startedAt, finishedAt, packages, added, failed: { name, error }[] } \| null }` |
| GET | `/admin/log?name=&page=&pageSize=` | `Page<{ at, actor, action, plugin, version?, note? }>`; actor is a user name, `indexer` or `submit` |

The permission is registered in the server's permission catalog (`{ name: 'marketplace:moderate', description:
'Review, approve and unlist marketplace plugins', group: 'Marketplace' }`) so the dashboard's role editor shows it.
The installed-plugin entry (`/api/v1/qcli/plugins`) has id `marketplace`; the dashboard shows its page when that
plugin is installed and the user holds the permission.

## Plugin metadata read from npm

`package.json` of a version: keyword `qodalis-cli-plugin` (discovery), `unpkg` / `umd` / `main` (bundle, in that
order, `.js` only), `peerDependencies['@qodalis/cli-core']` (coreRange), and an optional block:

```json
"qodalis": { "apiVersion": 2, "category": "tools", "icon": "assets/icon.svg", "screenshots": ["assets/1.png"],
             "serverPackages": [{ "ecosystem": "npm", "name": "@acme/cli-server-plugin-foo" }] }
```

`apiVersion` falls back to the major of the core peer range (`^2.7.0` -> 2), then to 2. Relative `icon` /
`screenshots` become `https://cdn.jsdelivr.net/npm/<name>@<version>/<path>`. Official `@qodalis/cli-*` packages
without the block: category from a built-in map (lang-* -> language, games -> games, the data plugins -> data,
others tools). Indexed sources: npm search `keywords:qodalis-cli-plugin` and `scope:qodalis` (prefix
`@qodalis/cli-`, excluding `cli-core`, `cli-server-*`, `cli`, `cli-*-site`, and packages without a browser bundle).

## CLI side (web-cli)

- Source kind `'marketplace'` on `CliPackageSource` (`url` = base URL). Built-in source `qodalis` =
  `https://plugins.qodalis.com/`. `CliPackageSourcesOptions` gets `marketplace?: string | false` (URL replaces
  the built-in one, `false` turns it off) and `marketplaceOnly?: boolean`.
- Every marketplace request has a 4 s timeout; on failure `pkg` prints `Marketplace unreachable, searching npm`
  (or `... using npm`) once and runs today's code.
- `Package` (saved record) gains `integrity?: string`; startup injection sets `script.integrity` and
  `crossOrigin = 'anonymous'` when present.
- `pkg add` integrity check: SHA-384 of the downloaded text encoded as UTF-8 (`crypto.subtle.digest`), base64,
  prefixed `sha384-`. The indexer computes it over the raw bytes; bundles are UTF-8 so both match.
- New commands: `pkg search <text>`, `pkg info <name>`, `pkg publish <name>`.

## Web interface (marketplace site)

Vite + React + Tailwind like `cli-server-dashboard/portal`, built to `marketplace/dist` with a single
`<base href="/" />` the plugin rewrites to its mount. Routes: `/` (search box, category chips, featured row,
grid of cards), `/plugins/<name>` (header with icon, publisher + verified mark, description, `pkg add <shortName>`
copy line, readme rendered with markdown and no raw HTML, versions table with API version and status, server
packages with install commands, links), `/publish` (guide + a form posting `/submissions`). Reads the API with
relative URLs (`api/v1/qcli/marketplace/...` against the base). Light/dark from the system. The plugin serves it
like the portal plugin serves its site (`site/` copied by `scripts/copy-site.js` from the sibling
`cli-server-dashboard/marketplace/dist` or the npm package).

## Hosted instance

`cli-server-node/deploy/marketplace/`: a small server (`server.ts`) built on `createCliServer` with the users
plugin (admin seeded from `MARKETPLACE_ADMIN_USER` / `MARKETPLACE_ADMIN_PASSWORD`), the admin plugin
(dashboard at `/qcli/admin`) and the marketplace plugin with the JSON-file store at `MARKETPLACE_DATA`
(`/data/marketplace.json`) and the site at `/`. Dockerfile, compose example. Runs on the apps VM in
`/opt/apps/marketplace` on port 8120, proxied by NPM (pve2) for `plugins.qodalis.com`.
