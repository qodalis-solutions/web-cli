# Cli extension

The `@qodalis/cli-curl` package is a CLI extension designed to execute HTTP requests on your server. Supports GET, POST, PUT, DELETE, headers, and body data.

# Installation

```bash
packages add @qodalis/cli-curl
packages add curl #short version
```

# Usage

```bash
curl post https://api.example.com/users -d='{"name":"John"}' -H="Content-Type: application/json"
```

This command downloads and registers the extension for use within the CLI environment.
