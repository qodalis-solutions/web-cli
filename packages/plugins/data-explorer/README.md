# @qodalis/cli-data-explorer

Interactive, full-screen REPL for querying data sources — SQL databases, MongoDB, and custom providers — directly from the terminal.

## Installation

**At runtime** (no rebuild needed):

```bash
pkg add data-explorer
```

**At build time** (npm/pnpm):

```bash
npm install @qodalis/cli-data-explorer
```

## Setup

### Angular

```typescript
import { CliModule, resolveCliModuleProvider } from '@qodalis/angular-cli';
import { dataExplorerModule } from '@qodalis/cli-data-explorer';

@NgModule({
  imports: [CliModule],
  providers: [resolveCliModuleProvider(dataExplorerModule)],
})
export class AppModule {}
```

### React

```tsx
import { CliConfigProvider, Cli } from '@qodalis/react-cli';
import { dataExplorerModule } from '@qodalis/cli-data-explorer';

function App() {
  return (
    <CliConfigProvider
      modules={[dataExplorerModule]}
      options={{
        servers: [
          { name: 'node', url: 'http://localhost:8047' },
        ],
      }}
    >
      <Cli />
    </CliConfigProvider>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { CliConfigProvider, Cli } from '@qodalis/vue-cli';
import { dataExplorerModule } from '@qodalis/cli-data-explorer';
</script>

<template>
  <CliConfigProvider :modules="[dataExplorerModule]" :options="{ servers: [{ name: 'node', url: 'http://localhost:8047' }] }">
    <Cli />
  </CliConfigProvider>
</template>
```

### Server Configuration

The plugin requires at least one backend server with data explorer providers registered. Configure servers in the CLI options:

```typescript
const options: CliOptions = {
  servers: [
    { name: 'dotnet', url: 'http://localhost:8046' },
    { name: 'node', url: 'http://localhost:8047' },
    { name: 'python', url: 'http://localhost:8048' },
  ],
};
```

Each server must have at least one data explorer provider registered (SQL, MongoDB, etc.). See the server documentation for setup.

## Usage

```bash
data-explorer
```

This opens an interactive source selector. Choose a server and data source to enter the full-screen REPL.

### Querying

**SQL sources** — type SQL queries terminated with a semicolon:

```
data-explorer> SELECT * FROM users WHERE active = true;
```

**MongoDB sources** — use `db.collection.operation(...)` syntax:

```
data-explorer> db.users.find({"age": {"$gt": 25}})
data-explorer> db.orders.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}])
data-explorer> show collections
```

### REPL Commands

| Command | Description |
|---------|-------------|
| `\format <table\|json\|csv\|raw>` | Switch output format |
| `\templates` | List available query templates |
| `\use <name>` | Load a template query |
| `\history` | Show query history |
| `\clear` | Clear screen |
| `\help` | Show all commands |
| `\quit` or `\q` | Exit full-screen mode |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Up` / `Down` | Navigate query history |
| `Enter` | Execute query |
| `Escape` | Exit REPL |
| `Backspace` | Delete character |
| `Ctrl+C` | Clear line or exit |

### Output Formats

Results can be displayed in four formats, switchable with `\format`:

**Table** (default for SQL) — ASCII table with box-drawing characters:

```
┌────┬───────┬──────────────┐
│ id │ name  │ email        │
├────┼───────┼──────────────┤
│  1 │ Alice │ alice@ex.com │
│  2 │ Bob   │ bob@ex.com   │
└────┴───────┴──────────────┘
```

**JSON** (default for MongoDB) — pretty-printed JSON:

```json
[
  { "_id": "abc", "name": "Alice", "email": "alice@ex.com" },
  { "_id": "def", "name": "Bob", "email": "bob@ex.com" }
]
```

**CSV** — standard CSV with proper escaping:

```
id,name,email
1,Alice,alice@ex.com
2,Bob,bob@ex.com
```

**Raw** — unformatted server response.

## API

The plugin communicates with backend servers via two REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/qcli/data-explorer/sources` | List available data sources |
| POST | `/api/qcli/data-explorer/execute` | Execute a query |

### Execute Request

```json
{
  "source": "production-db",
  "query": "SELECT * FROM users LIMIT 10",
  "parameters": {}
}
```

### Execute Response

```json
{
  "success": true,
  "source": "production-db",
  "language": "sql",
  "defaultOutputFormat": "table",
  "executionTime": 12,
  "columns": ["id", "name", "email"],
  "rows": [[1, "Alice", "alice@ex.com"], [2, "Bob", "bob@ex.com"]],
  "rowCount": 2,
  "truncated": false,
  "error": null
}
```

For document-oriented sources (MongoDB), `columns` is `null` and `rows` contains objects.

## Build

Builds two outputs:

- **Module** (CJS + ESM): `dist/public-api.js` and `dist/public-api.mjs`
- **IIFE bundle**: `dist/umd/index.js` (for browser runtime loading via `pkg add`)
