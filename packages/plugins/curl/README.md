# @qodalis/cli-curl

CLI extension for making HTTP requests with a real curl-like interface.

## Installation

```
packages add @qodalis/cli-curl
packages add curl
```

## Usage

```bash
# Simple GET request
curl https://api.example.com/users

# POST with JSON body
curl https://api.example.com/users -X POST -d '{"name":"John"}' -H 'Content-Type: application/json'

# PUT request
curl https://api.example.com/users/1 -X PUT -d '{"name":"Jane"}'

# DELETE request
curl https://api.example.com/users/1 -X DELETE

# HEAD request
curl https://api.example.com/status -X HEAD -v

# Verbose output with pretty-printed JSON
curl https://api.example.com/users -v --pretty

# With timeout and proxy
curl https://api.example.com/data --timeout 5000 --proxy

# Silent mode (body only)
curl https://api.example.com/users -s
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--request` | `-X` | HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) |
| `--header` | `-H` | Add header (repeatable) |
| `--data` | `-d` | Request body (auto-detects JSON) |
| `--data-raw` | | Request body as-is |
| `--verbose` | `-v` | Show headers and timing |
| `--pretty` | | Pretty-print JSON response |
| `--timeout` | | Timeout in ms (default: 30000) |
| `--location` | `-L` | Follow redirects (default: true) |
| `--proxy` | | Route through CORS proxy |
| `--silent` | `-s` | Only output body |

## CORS

Browser security prevents cross-origin requests by default. Use `--proxy` to route requests through `proxy.qodalis.com` to bypass CORS restrictions.
