# Security Policy

## Supported versions

Only the latest published `2.x` release of each `@qodalis/*` package receives
security fixes. `1.x` is no longer maintained.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub's private reporting form instead:
<https://github.com/qodalis-solutions/web-cli/security/advisories/new>.
Include the affected package and version, a description of the impact, and a
minimal way to reproduce it.

You will get an acknowledgement within a few days. Once a fix is published the
advisory is made public and credited to you unless you prefer otherwise.

## Scope notes

- The `eval` command runs arbitrary JavaScript in the host page and is disabled
  by default; enabling it is the host application's decision.
- The `users` plugin stores credentials in the browser (PBKDF2-HMAC-SHA256) when
  no server is configured. It protects a demo or a kiosk, not data behind a
  real login; use a server backend for that.
- Server-side issues belong to the server repositories
  (`cli-server-node`, `cli-server-python`, `cli-server-dotnet`), which have their
  own policies.
