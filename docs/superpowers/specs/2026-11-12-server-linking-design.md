# Link servers from the terminal: `server add`, browser approval, encrypted tokens

Date: 2026-11-12. Issues: web-cli#208 (and its comment "link through the browser"), cli-server-dotnet#73,
cli-server-node#58, cli-server-python#62, cli-server-dashboard#44.

## Goal

A user of any host (the PWA/Android app, the docs site, a plain page) connects the terminal to their own Node, .NET
or Python server without the host configuring it, keeps it across reloads, and never leaves a secret in plain text.

## Server: link requests (users plugin, the same on the three servers)

A link request is the OAuth device flow: the terminal asks for a request, the user approves it in a browser signed in
to the server, and the terminal receives a scoped API token (`qcli_pat_…`).

| Route | Auth | Answer |
|---|---|---|
| `POST /api/v1/qcli/link` | public, at most 10 per minute per client address (429) | `201 { linkId, userCode, verificationUrl, expiresIn, interval }` |
| `GET /api/v1/qcli/link/{linkId}` | public (the `linkId` is the secret) | `200 { status: "pending" }`, `{ status: "denied" }`, `{ status: "approved", token, userName, expiresAt }` (once), `404 { status: "expired" }` for unknown, expired or already collected requests |
| `GET /api/v1/qcli/link/code/{userCode}` | signed in (session) | `200 { userCode, client, origin, remoteAddress, permissions, createdAt, expiresAt }`; 404 when unknown or expired |
| `POST /api/v1/qcli/link/code/{userCode}/approve` | signed in with a session (not an API token: 403) | `200 { tokenId, tokenName }`; the request's permissions must be the approver's (403 `forbidden: cannot grant <p>` as for tokens) |
| `POST /api/v1/qcli/link/code/{userCode}/deny` | signed in | `204` |

- Body of `POST /link`: `{ client: string, permissions?: string[] }`. `client` is 1-100 characters and names the
  device ("Qodalis CLI on Pixel 7"); `permissions` asks for a scoped token (absent: the approver's permissions, as a
  token created without `permissions`). Invalid body: 400 `{ error }`.
- `linkId`: 32 random bytes, base64url. `userCode`: 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, shown as
  `ABCD-2345`; lookups ignore case and the dash and compare in constant time (the server keeps code hashes).
- `expiresIn`: 600 seconds. `interval`: 2 seconds (the terminal polls at this pace). At most 100 pending requests per
  server; the oldest is dropped when full. Requests live in memory: a restart drops them.
- `verificationUrl`: the approval page with the code, root-relative by default (`/qcli/admin/link?code=ABCD-2345`); the
  terminal resolves it against the server URL it used. Hosts set their own page with the users plugin's
  `linkApprovalUrl` option (Node `setLinkApprovalUrl`, .NET `LinkApprovalUrl`, Python `link_approval_url`), absolute
  or root-relative; `{code}` in it is replaced, otherwise `?code=` is appended.
- `origin`: the `Origin` header of `POST /link` when present; `remoteAddress`: the client address (proxy rules as
  elsewhere).
- Approval creates an API token for the approver, named `link <client>` (characters outside `[A-Za-z0-9._ -]`
  replaced by `-`, cut to 64, a numeric suffix when the name is taken), with the request's permissions and the
  default expiry (90 days). It is a normal token: `token list`, revocable, `token_created` in the audit log. The
  request then hands the token out once to the polling terminal and is deleted.
- Audit: `link_approved` (metadata `client`, `origin`, `tokenId`) and `link_denied` (metadata `client`, `origin`).
- Approve and deny are single-use: a second call answers 404. A denied or expired request never hands out a token.
- A server whose users plugin has an external auth adapter (no sessions) answers approve with 501, as token creation does.

## Dashboard: approval page

`/qcli/admin/link?code=…`, outside the dashboard layout and without `admin:access`: any user of the server may link
a terminal. It uses the users plugin's sign-in (`POST /api/v1/qcli/sessions`), keeping that session in memory only,
unless the dashboard already holds a working token. It shows the device name, origin, client address, the
permissions asked (or "all your permissions") and the code to compare, with Approve and Deny, then "You can go
back to your terminal". Phone friendly, translated (the dashboard's 10 languages). Codes typed by hand are accepted
when the URL has none.

## Web CLI

### Commands (`server`)

```
server add [name] [url] [--token <qcli_pat_…>] [--default] [--no-browser]
server remove <name>
server edit <name> [--url <url>] [--token <qcli_pat_…>]
server forget-all
server list            # host servers and linked servers, marked "linked"
```

`server add` asks for every missing value:

1. URL (`https://` added when no scheme is given). `http:` is accepted only for `localhost`, `127.0.0.1`, `::1` and
   private addresses (10/8, 172.16/12, 192.168/16, `*.local`), after a confirmation; otherwise refused. A page served
   over https warns that the browser blocks an http server (mixed content).
2. Checks `GET /api/qcli/versions` and `GET /api/v1/qcli/capabilities` and shows the server (version, OS, shell,
   features). Not a Qodalis server: refused.
3. How to link: **Open the server in the browser and approve** (recommended, when `POST /link` exists), **Paste an
   API token** (hidden input), **Sign in with user and password** (creates an API token `Qodalis CLI <device>` with
   the session, then signs the session out), or **No sign-in** (open servers). `--token` picks the token path;
   `--no-browser` hides the browser path.
4. Name (default from the host name, letters, digits, `-` and `_`, unique among host and linked servers).
5. Connects at once (commands, events) and registers its commands, like a host server. `--default` makes it the
   default.

Browser approval prints the clickable link and the code, opens the link (`window.open`), and polls every `interval`
seconds until approved, denied, expired (10 minutes) or Ctrl+C.

### Storage

- Linked servers (name, URL, added at) are kept in the key-value store (IndexedDB) under `qcli-linked-servers`.
- Tokens are kept apart, encrypted with AES-GCM by a non-extractable Web Crypto key kept in IndexedDB
  (`qcli-secret-key`), each with its own random IV. A host replaces the store with its own (Android Keystore,
  Keychain, Electron `safeStorage`) by providing the service `ICliSecretStore` (`get`, `set`, `delete`, `clear`).
  Without Web Crypto (an insecure page) tokens are not saved and `server add` says why.
- Tokens are never printed again (`server list` shows `token ••••` and the last 4 characters), never stored in the
  command history (a `--token` value is replaced by `***` in the history), and never put in WebSocket URLs (sockets
  use the users plugin's tickets).
- At boot the linked servers connect after the host servers.

### Host control

- `CliOptions.userServers`: `true` (default), `false` (no linking: `server add` and boot restore are off), or
  `{ allowedOrigins: string[] }` (only server origins matching these, `*` wildcards in the host name).
- Host servers cannot be removed, edited or shadowed by a linked server of the same name.

### Errors

- A linked server answering 401: `Server '<name>' rejected its token. Link it again with server add <name>, or set a
  new token with server edit <name> --token.`

## Non-goals (this round)

- The reverse flow (a link on the server's page that opens the CLI with `server add` filled in).
- A tokens page in the dashboard (tokens are listed and revoked with `token list`/`token revoke`).
- Native secret stores in pwa-cli and electron-cli (the service is the hook; they follow).
