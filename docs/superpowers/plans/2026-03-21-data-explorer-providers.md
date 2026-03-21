# Data Explorer: 5 New Providers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostgreSQL, MySQL, MS SQL Server, Redis, and Elasticsearch providers to the data explorer plugin system across all three servers (Node.js, .NET, Python) and update the frontend to support two new query languages.

**Architecture:** Each provider is a standalone plugin package per server (15 new packages total). The frontend gets two new `DataExplorerLanguage` enum values (`redis`, `elasticsearch`) with corresponding syntax highlighters and query completeness logic. Docker Compose services enable local testing.

**Tech Stack:** TypeScript (Node.js), C#/.NET 8 (dotnet), Python/FastAPI (Python), xterm.js (frontend), Docker Compose (infrastructure)

---

## File Structure

### Frontend (web-cli)

| File | Action | Responsibility |
|---|---|---|
| `packages/plugins/data-explorer/src/lib/models/data-explorer-types.ts` | Modify | Add `Redis`, `Elasticsearch` enum values |
| `packages/plugins/data-explorer/src/lib/syntax/highlighter.ts` | Modify | Add `highlightRedis()` and `highlightElasticsearch()` functions |
| `packages/plugins/data-explorer/src/lib/processors/cli-data-explorer-command-processor.ts` | Modify | Add `redis`/`elasticsearch` cases to `isQueryComplete()` |

### Node.js Server (cli-server-node)

| File | Action | Responsibility |
|---|---|---|
| `packages/abstractions/src/data-explorer-types.ts` | Modify | Add `Redis`, `Elasticsearch` enum values |
| `plugins/data-explorer-postgres/index.ts` | Create | Re-exports |
| `plugins/data-explorer-postgres/postgres-data-explorer-provider.ts` | Create | PostgreSQL provider |
| `plugins/data-explorer-postgres/package.json` | Create | Package manifest |
| `plugins/data-explorer-postgres/tsconfig.json` | Create | TypeScript config |
| `plugins/data-explorer-mysql/index.ts` | Create | Re-exports |
| `plugins/data-explorer-mysql/mysql-data-explorer-provider.ts` | Create | MySQL provider |
| `plugins/data-explorer-mysql/package.json` | Create | Package manifest |
| `plugins/data-explorer-mysql/tsconfig.json` | Create | TypeScript config |
| `plugins/data-explorer-mssql/index.ts` | Create | Re-exports |
| `plugins/data-explorer-mssql/mssql-data-explorer-provider.ts` | Create | MS SQL provider |
| `plugins/data-explorer-mssql/package.json` | Create | Package manifest |
| `plugins/data-explorer-mssql/tsconfig.json` | Create | TypeScript config |
| `plugins/data-explorer-redis/index.ts` | Create | Re-exports |
| `plugins/data-explorer-redis/redis-data-explorer-provider.ts` | Create | Redis provider |
| `plugins/data-explorer-redis/package.json` | Create | Package manifest |
| `plugins/data-explorer-redis/tsconfig.json` | Create | TypeScript config |
| `plugins/data-explorer-elasticsearch/index.ts` | Create | Re-exports |
| `plugins/data-explorer-elasticsearch/elasticsearch-data-explorer-provider.ts` | Create | Elasticsearch provider |
| `plugins/data-explorer-elasticsearch/package.json` | Create | Package manifest |
| `plugins/data-explorer-elasticsearch/tsconfig.json` | Create | TypeScript config |
| `demo/index.ts` | Modify | Register all 5 new providers |

### .NET Server (cli-server-dotnet)

| File | Action | Responsibility |
|---|---|---|
| `src/Qodalis.Cli.Abstractions/DataExplorer/DataExplorerTypes.cs` | Modify | Add `Redis`, `Elasticsearch` enum values |
| `plugins/data-explorer-postgres/PostgresDataExplorerProvider.cs` | Create | PostgreSQL provider |
| `plugins/data-explorer-postgres/DataExplorerPostgresExtensions.cs` | Create | DI extension |
| `plugins/data-explorer-postgres/Qodalis.Cli.Plugin.DataExplorer.Postgres.csproj` | Create | Project file |
| `plugins/data-explorer-mysql/MysqlDataExplorerProvider.cs` | Create | MySQL provider |
| `plugins/data-explorer-mysql/DataExplorerMysqlExtensions.cs` | Create | DI extension |
| `plugins/data-explorer-mysql/Qodalis.Cli.Plugin.DataExplorer.Mysql.csproj` | Create | Project file |
| `plugins/data-explorer-mssql/MssqlDataExplorerProvider.cs` | Create | MS SQL provider |
| `plugins/data-explorer-mssql/DataExplorerMssqlExtensions.cs` | Create | DI extension |
| `plugins/data-explorer-mssql/Qodalis.Cli.Plugin.DataExplorer.Mssql.csproj` | Create | Project file |
| `plugins/data-explorer-redis/RedisDataExplorerProvider.cs` | Create | Redis provider |
| `plugins/data-explorer-redis/DataExplorerRedisExtensions.cs` | Create | DI extension |
| `plugins/data-explorer-redis/Qodalis.Cli.Plugin.DataExplorer.Redis.csproj` | Create | Project file |
| `plugins/data-explorer-elasticsearch/ElasticsearchDataExplorerProvider.cs` | Create | Elasticsearch provider |
| `plugins/data-explorer-elasticsearch/DataExplorerElasticsearchExtensions.cs` | Create | DI extension |
| `plugins/data-explorer-elasticsearch/Qodalis.Cli.Plugin.DataExplorer.Elasticsearch.csproj` | Create | Project file |
| `demo/Program.cs` | Modify | Register all 5 new providers |

### Python Server (cli-server-python)

| File | Action | Responsibility |
|---|---|---|
| `packages/abstractions/src/qodalis_cli_server_abstractions/data_explorer_types.py` | Modify | Add `Redis`, `Elasticsearch` enum values |
| `plugins/data-explorer-postgres/qodalis_cli_data_explorer_postgres/__init__.py` | Create | Re-exports |
| `plugins/data-explorer-postgres/qodalis_cli_data_explorer_postgres/postgres_provider.py` | Create | PostgreSQL provider |
| `plugins/data-explorer-postgres/pyproject.toml` | Create | Package manifest |
| `plugins/data-explorer-mysql/qodalis_cli_data_explorer_mysql/__init__.py` | Create | Re-exports |
| `plugins/data-explorer-mysql/qodalis_cli_data_explorer_mysql/mysql_provider.py` | Create | MySQL provider |
| `plugins/data-explorer-mysql/pyproject.toml` | Create | Package manifest |
| `plugins/data-explorer-mssql/qodalis_cli_data_explorer_mssql/__init__.py` | Create | Re-exports |
| `plugins/data-explorer-mssql/qodalis_cli_data_explorer_mssql/mssql_provider.py` | Create | MS SQL provider |
| `plugins/data-explorer-mssql/pyproject.toml` | Create | Package manifest |
| `plugins/data-explorer-redis/qodalis_cli_data_explorer_redis/__init__.py` | Create | Re-exports |
| `plugins/data-explorer-redis/qodalis_cli_data_explorer_redis/redis_provider.py` | Create | Redis provider |
| `plugins/data-explorer-redis/pyproject.toml` | Create | Package manifest |
| `plugins/data-explorer-elasticsearch/qodalis_cli_data_explorer_elasticsearch/__init__.py` | Create | Re-exports |
| `plugins/data-explorer-elasticsearch/qodalis_cli_data_explorer_elasticsearch/elasticsearch_provider.py` | Create | Elasticsearch provider |
| `plugins/data-explorer-elasticsearch/pyproject.toml` | Create | Package manifest |
| `demo/main.py` | Modify | Register all 5 new providers |

### Infrastructure (workspace root)

| File | Action | Responsibility |
|---|---|---|
| `docker-compose.yml` | Modify | Add 5 database service containers |

---

## Batch 0: Frontend Updates

### Task 1: Add Redis and Elasticsearch enum values to all locations

**Files:**
- Modify: `web-cli/packages/plugins/data-explorer/src/lib/models/data-explorer-types.ts`
- Modify: `cli-server-node/packages/abstractions/src/data-explorer-types.ts`
- Modify: `cli-server-dotnet/src/Qodalis.Cli.Abstractions/DataExplorer/DataExplorerTypes.cs`
- Modify: `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/data_explorer_types.py`

- [ ] **Step 1: Read all 4 enum files to understand current shape**

Read all 4 files listed above.

- [ ] **Step 2: Add `Redis` and `Elasticsearch` to the frontend TypeScript enum**

In `web-cli/packages/plugins/data-explorer/src/lib/models/data-explorer-types.ts`, add after `Graphql = 'graphql'`:

```typescript
Redis = 'redis',
Elasticsearch = 'elasticsearch',
```

- [ ] **Step 3: Add to Node.js abstractions enum**

In `cli-server-node/packages/abstractions/src/data-explorer-types.ts`, add the same two values.

- [ ] **Step 4: Add to .NET enum**

In `cli-server-dotnet/src/Qodalis.Cli.Abstractions/DataExplorer/DataExplorerTypes.cs`, add:

```csharp
Redis,
Elasticsearch,
```

- [ ] **Step 5: Add to Python enum**

In `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/data_explorer_types.py`, add:

```python
REDIS = "redis"
ELASTICSEARCH = "elasticsearch"
```

- [ ] **Step 6: Build frontend to verify**

Run: `cd web-cli && npx nx build data-explorer`
Expected: SUCCESS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add Redis and Elasticsearch to DataExplorerLanguage enum"
```

### Task 2: Add Redis syntax highlighter

**Files:**
- Modify: `web-cli/packages/plugins/data-explorer/src/lib/syntax/highlighter.ts`

- [ ] **Step 1: Read highlighter.ts**

Read the full file to understand existing patterns.

- [ ] **Step 2: Add `highlightRedis` function**

Add after the Shell section, before closing. Follow the same regex-scanner pattern as the other highlighters.

```typescript
// -- Redis ----------------------------------------------------------------

const REDIS_COMMANDS = new Set([
    'GET', 'SET', 'DEL', 'KEYS', 'HGET', 'HSET', 'HGETALL', 'HDEL',
    'HKEYS', 'HVALS', 'LPUSH', 'RPUSH', 'LRANGE', 'LLEN', 'SADD',
    'SMEMBERS', 'SCARD', 'ZADD', 'ZRANGE', 'ZRANGEBYSCORE', 'INCR',
    'DECR', 'EXPIRE', 'TTL', 'PTTL', 'EXISTS', 'TYPE', 'MGET', 'MSET',
    'SCAN', 'INFO', 'DBSIZE', 'PING', 'FLUSHDB',
]);

const REDIS_FLAGS = new Set([
    'EX', 'PX', 'NX', 'XX', 'KEEPTTL', 'GT', 'LT', 'CH', 'WITHSCORES',
    'MATCH', 'COUNT', 'LIMIT', 'REV', 'BYSCORE', 'BYLEX',
]);

const REDIS_TOKEN_RE =
    /('(?:[^'\\]|\\.)*'?)|(\"(?:[^\"\\]|\\.)*\"?)|(--\w[\w-]*)|((?:^|\s)-?\d+(?:\.\d+)?(?=\s|$))|\b([a-zA-Z_][\w]*)\b/g;

function highlightRedis(text: string): string {
    let result = '';
    let lastIndex = 0;

    REDIS_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = REDIS_TOKEN_RE.exec(text)) !== null) {
        if (m.index > lastIndex) {
            result += text.slice(lastIndex, m.index);
        }

        const token = m[0];

        if (m[1] !== undefined || m[2] !== undefined) {
            result += G + token + R;                     // string
        } else if (m[3] !== undefined) {
            result += C + token + R;                     // --flag
        } else if (m[4] !== undefined) {
            result += Y + token.trimStart() + R;         // number
            // preserve leading whitespace
            const leading = token.length - token.trimStart().length;
            if (leading > 0) {
                result = result.slice(0, result.length - token.trimStart().length - R.length)
                    + token.slice(0, leading) + Y + token.trimStart() + R;
            }
        } else if (m[5] !== undefined) {
            const upper = token.toUpperCase();
            if (REDIS_COMMANDS.has(upper)) {
                result += BB + token + R;                // command
            } else if (REDIS_FLAGS.has(upper)) {
                result += C + token + R;                 // flag like EX, NX
            } else {
                result += token;                         // key or value
            }
        }

        lastIndex = m.index + token.length;
    }

    if (lastIndex < text.length) {
        result += text.slice(lastIndex);
    }
    return result;
}
```

- [ ] **Step 3: Add Redis case to `highlightLine` switch**

```typescript
case DataExplorerLanguage.Redis:
    return highlightRedis(text);
```

- [ ] **Step 4: Build to verify**

Run: `cd web-cli && npx nx build data-explorer`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Redis syntax highlighter to data explorer"
```

### Task 3: Add Elasticsearch syntax highlighter

**Files:**
- Modify: `web-cli/packages/plugins/data-explorer/src/lib/syntax/highlighter.ts`

- [ ] **Step 1: Add `highlightElasticsearch` function**

Add after the Redis section. The first line of an ES query is `VERB /path?params`, subsequent lines are JSON body.

```typescript
// -- Elasticsearch --------------------------------------------------------

const ES_VERBS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'HEAD']);

const ES_FIRST_LINE_RE =
    /^(\s*)(GET|POST|PUT|DELETE|HEAD)(\s+)(\/?\S+)(.*)$/i;

function highlightElasticsearch(text: string): string {
    // Try to match as a first-line (verb + path)
    const firstLineMatch = ES_FIRST_LINE_RE.exec(text);
    if (firstLineMatch) {
        const [, leading, verb, space, path, rest] = firstLineMatch;
        let result = leading + BB + verb + R + space;

        // Split path from query params
        const qIdx = path.indexOf('?');
        if (qIdx >= 0) {
            result += C + path.slice(0, qIdx) + R + Y + path.slice(qIdx) + R;
        } else {
            result += C + path + R;
        }

        if (rest.trim()) {
            result += rest; // trailing content on verb line
        }
        return result;
    }

    // Check if line looks like a bare path shortcut (starts with _ or /)
    const barePathMatch = /^(\s*)(\/?\w[\w\-.*\/]*)(\?.*)?$/.exec(text);
    if (barePathMatch) {
        const [, leading, path, params] = barePathMatch;
        let result = leading + C + path + R;
        if (params) {
            result += Y + params + R;
        }
        return result;
    }

    // Otherwise treat as JSON body
    return highlightJson(text);
}
```

- [ ] **Step 2: Add Elasticsearch case to `highlightLine` switch**

```typescript
case DataExplorerLanguage.Elasticsearch:
    return highlightElasticsearch(text);
```

- [ ] **Step 3: Build to verify**

Run: `cd web-cli && npx nx build data-explorer`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Elasticsearch syntax highlighter to data explorer"
```

### Task 4: Update query completeness for Redis and Elasticsearch

**Files:**
- Modify: `web-cli/packages/plugins/data-explorer/src/lib/processors/cli-data-explorer-command-processor.ts`

- [ ] **Step 1: Read the processor file, find `isQueryComplete` method**

Search for `isQueryComplete` in the processor file.

- [ ] **Step 2: Add Redis case**

Redis commands are always single-line, so always return `true`:

```typescript
case DataExplorerLanguage.Redis:
    return true;
```

- [ ] **Step 3: Add Elasticsearch case**

Elasticsearch queries are complete when: (a) no `{` follows the verb+path line, or (b) JSON braces are balanced:

```typescript
case DataExplorerLanguage.Elasticsearch: {
    const fullText = this.lines.join('\n');
    const openCount = (fullText.match(/\{/g) || []).length;
    const closeCount = (fullText.match(/\}/g) || []).length;
    // If no braces at all (verb+path only), complete
    if (openCount === 0) return true;
    // If braces are balanced, complete
    return openCount > 0 && openCount === closeCount;
}
```

- [ ] **Step 4: Build to verify**

Run: `cd web-cli && npx nx build data-explorer`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add query completeness logic for Redis and Elasticsearch"
```

---

## Batch 1: SQL Providers (PostgreSQL, MySQL, MS SQL Server)

All three SQL providers follow the same pattern: connect via driver, run SQL, return rows/columns, introspect via `information_schema`. Before implementing, read the existing SQLite provider in each server to follow the established pattern exactly.

### Task 5: PostgreSQL provider — Node.js

**Files:**
- Create: `cli-server-node/plugins/data-explorer-postgres/postgres-data-explorer-provider.ts`
- Create: `cli-server-node/plugins/data-explorer-postgres/index.ts`
- Create: `cli-server-node/plugins/data-explorer-postgres/package.json`
- Create: `cli-server-node/plugins/data-explorer-postgres/tsconfig.json`
- Reference: `cli-server-node/plugins/data-explorer-sqlite/` (existing pattern to follow)

- [ ] **Step 1: Read the existing SQLite provider for Node.js**

Read all files in `cli-server-node/plugins/data-explorer-sqlite/` to understand the pattern.

- [ ] **Step 2: Read the IDataExplorerProvider interface in Node.js abstractions**

Read `cli-server-node/packages/abstractions/src/data-explorer-types.ts` and related interfaces.

- [ ] **Step 3: Create package.json**

```json
{
    "name": "@qodalis/cli-data-explorer-postgres",
    "version": "1.0.0",
    "private": true,
    "main": "index.ts",
    "dependencies": {
        "pg": "^8.13.0"
    },
    "peerDependencies": {
        "@qodalis/cli-server-abstractions": "*"
    }
}
```

- [ ] **Step 4: Create tsconfig.json**

Follow the same pattern as the SQLite plugin's tsconfig.

- [ ] **Step 5: Create the provider implementation**

In `postgres-data-explorer-provider.ts`:

```typescript
import { Client } from 'pg';
import {
    IDataExplorerProvider,
    DataExplorerLanguage,
    DataExplorerResult,
    DataExplorerSchemaTable,
} from '@qodalis/cli-server-abstractions';

export interface PostgresProviderConfig {
    connectionString: string;
}

export class PostgresDataExplorerProvider implements IDataExplorerProvider {
    readonly language = DataExplorerLanguage.Sql;

    private config: PostgresProviderConfig;

    constructor(config: PostgresProviderConfig) {
        this.config = config;
    }

    async executeAsync(query: string): Promise<DataExplorerResult> {
        const client = new Client({ connectionString: this.config.connectionString });
        try {
            await client.connect();
            const res = await client.query(query);
            const columns = res.fields?.map(f => f.name) ?? [];
            return {
                columns,
                rows: res.rows?.map(row => columns.map(c => row[c])) ?? [],
                rowCount: res.rowCount ?? 0,
            };
        } finally {
            await client.end();
        }
    }

    async getSchemaAsync(): Promise<DataExplorerSchemaTable[]> {
        const client = new Client({ connectionString: this.config.connectionString });
        try {
            await client.connect();
            const tablesRes = await client.query(
                `SELECT table_name FROM information_schema.tables
                 WHERE table_schema = 'public' ORDER BY table_name`
            );
            const tables: DataExplorerSchemaTable[] = [];
            for (const row of tablesRes.rows) {
                const tableName = row.table_name;
                const colsRes = await client.query(
                    `SELECT column_name, data_type FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = $1
                     ORDER BY ordinal_position`,
                    [tableName]
                );
                tables.push({
                    name: tableName,
                    columns: colsRes.rows.map(c => ({
                        name: c.column_name,
                        type: c.data_type,
                    })),
                });
            }
            return tables;
        } finally {
            await client.end();
        }
    }
}
```

- [ ] **Step 6: Create index.ts**

```typescript
export { PostgresDataExplorerProvider, PostgresProviderConfig } from './postgres-data-explorer-provider';
```

- [ ] **Step 7: Install the `pg` dependency**

Run: `cd cli-server-node && npm install pg && npm install -D @types/pg`

- [ ] **Step 8: Build to verify**

Run: `cd cli-server-node && npm run build`
Expected: SUCCESS

- [ ] **Step 9: Commit**

```bash
cd cli-server-node && git add -A && git commit -m "feat: add PostgreSQL data explorer provider"
```

### Task 6: MySQL provider — Node.js

**Files:**
- Create: `cli-server-node/plugins/data-explorer-mysql/mysql-data-explorer-provider.ts`
- Create: `cli-server-node/plugins/data-explorer-mysql/index.ts`
- Create: `cli-server-node/plugins/data-explorer-mysql/package.json`
- Create: `cli-server-node/plugins/data-explorer-mysql/tsconfig.json`

- [ ] **Step 1: Create package.json**

Same pattern as Task 5, with `"mysql2": "^3.11.0"` as dependency.

- [ ] **Step 2: Create tsconfig.json**

Same pattern as postgres plugin.

- [ ] **Step 3: Create the provider implementation**

In `mysql-data-explorer-provider.ts`, use `mysql2/promise`. Key differences from Postgres:
- Use `mysql.createConnection(connectionString)` to connect
- Query returns `[rows, fields]` — extract column names from `fields[].name`
- Schema: same `information_schema` queries but filter by `table_schema = DATABASE()` instead of `'public'`
- Close with `connection.end()`

- [ ] **Step 4: Create index.ts**

Export provider and config type.

- [ ] **Step 5: Install dependency**

Run: `cd cli-server-node && npm install mysql2`

- [ ] **Step 6: Build and commit**

```bash
cd cli-server-node && npm run build && git add -A && git commit -m "feat: add MySQL data explorer provider"
```

### Task 7: MS SQL provider — Node.js

**Files:**
- Create: `cli-server-node/plugins/data-explorer-mssql/mssql-data-explorer-provider.ts`
- Create: `cli-server-node/plugins/data-explorer-mssql/index.ts`
- Create: `cli-server-node/plugins/data-explorer-mssql/package.json`
- Create: `cli-server-node/plugins/data-explorer-mssql/tsconfig.json`

- [ ] **Step 1: Create package.json**

Same pattern, with `"mssql": "^11.0.0"` as dependency.

- [ ] **Step 2: Create tsconfig.json**

Same pattern.

- [ ] **Step 3: Create the provider implementation**

In `mssql-data-explorer-provider.ts`, use the `mssql` package. Key differences:
- Parse connection string into config object: `const config = parseSqlConnectionString(connectionString)`
- Use `sql.connect(config)` then `pool.request().query(query)`
- Result: `result.recordset` (rows), `result.recordset.columns` (field metadata)
- Schema: same `information_schema` queries, filter by `TABLE_SCHEMA = 'dbo'`
- Close pool with `pool.close()`

- [ ] **Step 4: Create index.ts and install dependency**

Run: `cd cli-server-node && npm install mssql && npm install -D @types/mssql`

- [ ] **Step 5: Build and commit**

```bash
cd cli-server-node && npm run build && git add -A && git commit -m "feat: add MS SQL data explorer provider"
```

### Task 8: PostgreSQL provider — .NET

**Files:**
- Create: `cli-server-dotnet/plugins/data-explorer-postgres/PostgresDataExplorerProvider.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-postgres/DataExplorerPostgresExtensions.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-postgres/Qodalis.Cli.Plugin.DataExplorer.Postgres.csproj`
- Reference: `cli-server-dotnet/plugins/data-explorer-sqlite/` (existing pattern)

- [ ] **Step 1: Read the existing SQLite provider for .NET**

Read all files in `cli-server-dotnet/plugins/data-explorer-sqlite/`.

- [ ] **Step 2: Create .csproj**

Target `net8.0`, add `Npgsql` NuGet dependency, reference `Qodalis.Cli.Abstractions`.

- [ ] **Step 3: Create provider**

Use `NpgsqlConnection` + `NpgsqlCommand`. Same `information_schema` queries. Return `DataExplorerResult` with columns from reader metadata.

- [ ] **Step 4: Create DI extension**

```csharp
public static class DataExplorerPostgresExtensions
{
    public static ICliBuilder AddDataExplorerPostgres(
        this ICliBuilder builder, string connectionString)
    {
        // Register provider following SQLite pattern
    }
}
```

- [ ] **Step 5: Build and commit**

```bash
cd cli-server-dotnet && dotnet build && git add -A && git commit -m "feat: add PostgreSQL data explorer provider (.NET)"
```

### Task 9: MySQL provider — .NET

**Files:**
- Create: `cli-server-dotnet/plugins/data-explorer-mysql/MysqlDataExplorerProvider.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-mysql/DataExplorerMysqlExtensions.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-mysql/Qodalis.Cli.Plugin.DataExplorer.Mysql.csproj`

- [ ] **Step 1: Create .csproj with `MySqlConnector` dependency**

- [ ] **Step 2: Create provider using `MySqlConnection` + `MySqlCommand`**

Same pattern as Postgres .NET but with MySqlConnector types. Schema uses `information_schema` with `TABLE_SCHEMA = DATABASE()`.

- [ ] **Step 3: Create DI extension and build**

```bash
cd cli-server-dotnet && dotnet build && git add -A && git commit -m "feat: add MySQL data explorer provider (.NET)"
```

### Task 10: MS SQL provider — .NET

**Files:**
- Create: `cli-server-dotnet/plugins/data-explorer-mssql/MssqlDataExplorerProvider.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-mssql/DataExplorerMssqlExtensions.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-mssql/Qodalis.Cli.Plugin.DataExplorer.Mssql.csproj`

- [ ] **Step 1: Create .csproj with `Microsoft.Data.SqlClient` dependency**

- [ ] **Step 2: Create provider using `SqlConnection` + `SqlCommand`**

Schema uses `information_schema` with `TABLE_SCHEMA = 'dbo'`.

- [ ] **Step 3: Create DI extension, build and commit**

```bash
cd cli-server-dotnet && dotnet build && git add -A && git commit -m "feat: add MS SQL data explorer provider (.NET)"
```

### Task 11: PostgreSQL provider — Python

**Files:**
- Create: `cli-server-python/plugins/data-explorer-postgres/qodalis_cli_data_explorer_postgres/__init__.py`
- Create: `cli-server-python/plugins/data-explorer-postgres/qodalis_cli_data_explorer_postgres/postgres_provider.py`
- Create: `cli-server-python/plugins/data-explorer-postgres/pyproject.toml`
- Reference: `cli-server-python/plugins/data-explorer-sqlite/` (existing pattern)

- [ ] **Step 1: Read the existing SQLite provider for Python**

Read all files in `cli-server-python/plugins/data-explorer-sqlite/`.

- [ ] **Step 2: Create pyproject.toml**

```toml
[project]
name = "qodalis-cli-data-explorer-postgres"
version = "0.1.0"
dependencies = ["asyncpg>=0.29.0"]

[build-system]
requires = ["setuptools"]
build-backend = "setuptools.backends._legacy:_Backend"
```

- [ ] **Step 3: Create provider using `asyncpg`**

```python
import asyncpg
from qodalis_cli_server_abstractions import (
    IDataExplorerProvider,
    DataExplorerLanguage,
    DataExplorerResult,
    DataExplorerSchemaTable,
)

class PostgresDataExplorerProvider(IDataExplorerProvider):
    language = DataExplorerLanguage.SQL

    def __init__(self, connection_string: str):
        self._connection_string = connection_string

    async def execute_async(self, query: str) -> DataExplorerResult:
        conn = await asyncpg.connect(self._connection_string)
        try:
            stmt = await conn.prepare(query)
            columns = [a.name for a in stmt.get_attributes()]
            records = await stmt.fetch()
            rows = [[record[c] for c in columns] for record in records]
            return DataExplorerResult(
                columns=columns,
                rows=rows,
                row_count=len(rows),
            )
        finally:
            await conn.close()

    async def get_schema_async(self) -> list[DataExplorerSchemaTable]:
        conn = await asyncpg.connect(self._connection_string)
        try:
            table_rows = await conn.fetch(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' ORDER BY table_name"
            )
            tables = []
            for row in table_rows:
                col_rows = await conn.fetch(
                    "SELECT column_name, data_type FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = $1 "
                    "ORDER BY ordinal_position",
                    row['table_name'],
                )
                tables.append(DataExplorerSchemaTable(
                    name=row['table_name'],
                    columns=[{'name': c['column_name'], 'type': c['data_type']} for c in col_rows],
                ))
            return tables
        finally:
            await conn.close()
```

- [ ] **Step 4: Create __init__.py and install**

```bash
cd cli-server-python && pip install -e plugins/data-explorer-postgres/
```

- [ ] **Step 5: Commit**

```bash
cd cli-server-python && git add -A && git commit -m "feat: add PostgreSQL data explorer provider (Python)"
```

### Task 12: MySQL provider — Python

**Files:**
- Create: `cli-server-python/plugins/data-explorer-mysql/qodalis_cli_data_explorer_mysql/__init__.py`
- Create: `cli-server-python/plugins/data-explorer-mysql/qodalis_cli_data_explorer_mysql/mysql_provider.py`
- Create: `cli-server-python/plugins/data-explorer-mysql/pyproject.toml`

- [ ] **Step 1: Create pyproject.toml with `aiomysql` dependency**

- [ ] **Step 2: Create provider using `aiomysql`**

Use `aiomysql.connect()`, run queries with cursor, extract column names from `cursor.description`. Schema queries use `information_schema` with `TABLE_SCHEMA = DATABASE()`.

- [ ] **Step 3: Create __init__.py, install and commit**

```bash
cd cli-server-python && pip install -e plugins/data-explorer-mysql/ && git add -A && git commit -m "feat: add MySQL data explorer provider (Python)"
```

### Task 13: MS SQL provider — Python

**Files:**
- Create: `cli-server-python/plugins/data-explorer-mssql/qodalis_cli_data_explorer_mssql/__init__.py`
- Create: `cli-server-python/plugins/data-explorer-mssql/qodalis_cli_data_explorer_mssql/mssql_provider.py`
- Create: `cli-server-python/plugins/data-explorer-mssql/pyproject.toml`

- [ ] **Step 1: Create pyproject.toml with `pymssql` dependency**

- [ ] **Step 2: Create provider using `pymssql`**

`pymssql` is sync-only. Wrap blocking calls with `asyncio.to_thread()`:

```python
import asyncio
import pymssql

class MssqlDataExplorerProvider(IDataExplorerProvider):
    language = DataExplorerLanguage.SQL

    def __init__(self, connection_string: str):
        self._connection_string = connection_string

    async def execute_async(self, query: str) -> DataExplorerResult:
        return await asyncio.to_thread(self._execute_sync, query)

    def _execute_sync(self, query: str) -> DataExplorerResult:
        # Parse connection string into host, user, password, database
        conn = pymssql.connect(server=..., user=..., password=..., database=...)
        try:
            cursor = conn.cursor()
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = [list(row) for row in cursor.fetchall()]
            return DataExplorerResult(columns=columns, rows=rows, row_count=len(rows))
        finally:
            conn.close()
```

- [ ] **Step 3: Create __init__.py, install and commit**

```bash
cd cli-server-python && pip install -e plugins/data-explorer-mssql/ && git add -A && git commit -m "feat: add MS SQL data explorer provider (Python)"
```

---

## Batch 2: Redis Provider

### Task 14: Redis provider — Node.js

**Files:**
- Create: `cli-server-node/plugins/data-explorer-redis/redis-data-explorer-provider.ts`
- Create: `cli-server-node/plugins/data-explorer-redis/index.ts`
- Create: `cli-server-node/plugins/data-explorer-redis/package.json`
- Create: `cli-server-node/plugins/data-explorer-redis/tsconfig.json`

- [ ] **Step 1: Create package.json with `ioredis` dependency**

- [ ] **Step 2: Create the provider**

Key implementation details:
- Parse input as `COMMAND arg1 arg2 ...` (split on whitespace, respect quotes)
- Validate command against allowlist from spec
- Call `redis.call(command, ...args)` dynamically
- Normalize result based on command type:
  - String commands (`GET`, `SET`, etc.): `[{ key, value }]`
  - Hash commands (`HGETALL`, etc.): `[{ field, value }, ...]`
  - List commands (`LRANGE`, etc.): `[{ index, value }, ...]`
  - Set commands (`SMEMBERS`, etc.): `[{ member }, ...]`
  - Info/status: `[{ property, value }, ...]`
- `getSchemaAsync`: Use `SCAN` with `COUNT 100` in bounded loop (max 1000 keys), group by `TYPE`, return one `DataExplorerSchemaTable` per Redis type with the column schema from the spec

- [ ] **Step 3: Create index.ts, install `ioredis`**

```bash
cd cli-server-node && npm install ioredis
```

- [ ] **Step 4: Build and commit**

```bash
cd cli-server-node && npm run build && git add -A && git commit -m "feat: add Redis data explorer provider"
```

### Task 15: Redis provider — .NET

**Files:**
- Create: `cli-server-dotnet/plugins/data-explorer-redis/RedisDataExplorerProvider.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-redis/DataExplorerRedisExtensions.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-redis/Qodalis.Cli.Plugin.DataExplorer.Redis.csproj`

- [ ] **Step 1: Create .csproj with `StackExchange.Redis` dependency**

- [ ] **Step 2: Create provider using `ConnectionMultiplexer`**

Key differences from Node:
- Use `ConnectionMultiplexer.Connect(connectionString)` then `db = multiplexer.GetDatabase()`
- Parse command and args, dispatch via `db.Execute(command, args)`
- Schema: use `server.Keys(pattern: "*", pageSize: 100)` with max 1000 keys, then `db.KeyType(key)` per key

- [ ] **Step 3: Create DI extension, build and commit**

```bash
cd cli-server-dotnet && dotnet build && git add -A && git commit -m "feat: add Redis data explorer provider (.NET)"
```

### Task 16: Redis provider — Python

**Files:**
- Create: `cli-server-python/plugins/data-explorer-redis/qodalis_cli_data_explorer_redis/__init__.py`
- Create: `cli-server-python/plugins/data-explorer-redis/qodalis_cli_data_explorer_redis/redis_provider.py`
- Create: `cli-server-python/plugins/data-explorer-redis/pyproject.toml`

- [ ] **Step 1: Create pyproject.toml with `redis[hiredis]` dependency**

- [ ] **Step 2: Create provider using `redis.asyncio`**

Use `redis.asyncio.from_url(connection_string)`. Parse command, call `r.execute_command(command, *args)`. Normalize results same as Node version. Schema uses async `SCAN` + `TYPE`.

- [ ] **Step 3: Create __init__.py, install and commit**

```bash
cd cli-server-python && pip install -e plugins/data-explorer-redis/ && git add -A && git commit -m "feat: add Redis data explorer provider (Python)"
```

---

## Batch 3: Elasticsearch Provider

### Task 17: Elasticsearch provider — Node.js

**Files:**
- Create: `cli-server-node/plugins/data-explorer-elasticsearch/elasticsearch-data-explorer-provider.ts`
- Create: `cli-server-node/plugins/data-explorer-elasticsearch/index.ts`
- Create: `cli-server-node/plugins/data-explorer-elasticsearch/package.json`
- Create: `cli-server-node/plugins/data-explorer-elasticsearch/tsconfig.json`

- [ ] **Step 1: Create package.json with `@elastic/elasticsearch` dependency**

- [ ] **Step 2: Create the provider**

Key implementation details:
- Parse query: first line = `VERB /path`, remaining lines = JSON body
- Handle convenience shortcuts: bare path without verb defaults to `GET`
- Supported verbs: `GET`, `POST`, `PUT`, `DELETE`, `HEAD`
- Use `client.transport.request({ method, path, body })` for generic requests
- Result mapping:
  - `_search` responses: flatten `hits.hits[]`, extract `_source` fields as columns
  - `_cat` responses: append `?format=json` to force JSON, parse as array of objects
  - Other: return raw JSON as single-row result
- `getSchemaAsync`: call `GET /_cat/indices?format=json`, then for each index call `GET /<index>/_mapping` and extract field names/types from mapping properties

- [ ] **Step 3: Create index.ts, install `@elastic/elasticsearch`**

```bash
cd cli-server-node && npm install @elastic/elasticsearch
```

- [ ] **Step 4: Build and commit**

```bash
cd cli-server-node && npm run build && git add -A && git commit -m "feat: add Elasticsearch data explorer provider"
```

### Task 18: Elasticsearch provider — .NET

**Files:**
- Create: `cli-server-dotnet/plugins/data-explorer-elasticsearch/ElasticsearchDataExplorerProvider.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-elasticsearch/DataExplorerElasticsearchExtensions.cs`
- Create: `cli-server-dotnet/plugins/data-explorer-elasticsearch/Qodalis.Cli.Plugin.DataExplorer.Elasticsearch.csproj`

- [ ] **Step 1: Create .csproj with `Elastic.Clients.Elasticsearch` dependency**

- [ ] **Step 2: Create provider**

Use `ElasticsearchClient` with low-level `DoRequestAsync` for generic verb+path+body requests. Parse query same as Node. Result mapping follows same rules.

- [ ] **Step 3: Create DI extension, build and commit**

```bash
cd cli-server-dotnet && dotnet build && git add -A && git commit -m "feat: add Elasticsearch data explorer provider (.NET)"
```

### Task 19: Elasticsearch provider — Python

**Files:**
- Create: `cli-server-python/plugins/data-explorer-elasticsearch/qodalis_cli_data_explorer_elasticsearch/__init__.py`
- Create: `cli-server-python/plugins/data-explorer-elasticsearch/qodalis_cli_data_explorer_elasticsearch/elasticsearch_provider.py`
- Create: `cli-server-python/plugins/data-explorer-elasticsearch/pyproject.toml`

- [ ] **Step 1: Create pyproject.toml with `elasticsearch[async]` dependency**

- [ ] **Step 2: Create provider using `AsyncElasticsearch`**

Use `es.perform_request(method, path, body=body)` for generic requests. Parse query and map results same as Node version.

- [ ] **Step 3: Create __init__.py, install and commit**

```bash
cd cli-server-python && pip install -e plugins/data-explorer-elasticsearch/ && git add -A && git commit -m "feat: add Elasticsearch data explorer provider (Python)"
```

---

## Batch 4: Docker Compose & Demo Registration

### Task 20: Add database services to Docker Compose

**Files:**
- Modify: `docker-compose.yml` (workspace root)

- [ ] **Step 1: Read existing docker-compose.yml**

- [ ] **Step 2: Add 5 new services**

```yaml
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: demo
    restart: unless-stopped

  mysql:
    image: mysql:8
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: demo
      MYSQL_DATABASE: demo
    restart: unless-stopped

  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    ports:
      - "1433:1433"
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "Demo@12345"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

  elasticsearch:
    image: elasticsearch:8.12.0
    ports:
      - "9200:9200"
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
    restart: unless-stopped
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml && git commit -m "infra: add database services for data explorer providers"
```

### Task 21: Register providers in Node.js demo

**Files:**
- Modify: `cli-server-node/demo/index.ts`

- [ ] **Step 1: Read current demo/index.ts**

- [ ] **Step 2: Add imports and registrations**

Import all 5 providers and register with demo connection strings from the spec:
- `postgresql://demo:demo@localhost:5432/demo`
- `mysql://root:demo@localhost:3306/demo`
- `Server=localhost,1433;Database=master;User Id=sa;Password=Demo@12345;TrustServerCertificate=true`
- `redis://localhost:6379`
- `http://localhost:9200`

- [ ] **Step 3: Build and commit**

```bash
cd cli-server-node && npm run build && git add -A && git commit -m "feat: register all data explorer providers in Node.js demo"
```

### Task 22: Register providers in .NET demo

**Files:**
- Modify: `cli-server-dotnet/demo/Program.cs`

- [ ] **Step 1: Read current demo/Program.cs**

- [ ] **Step 2: Add using statements and `.AddDataExplorer<Name>(connectionString)` calls**

Use the same demo connection strings as Task 21.

- [ ] **Step 3: Build and commit**

```bash
cd cli-server-dotnet && dotnet build && git add -A && git commit -m "feat: register all data explorer providers in .NET demo"
```

### Task 23: Register providers in Python demo

**Files:**
- Modify: `cli-server-python/demo/main.py`

- [ ] **Step 1: Read current demo/main.py**

- [ ] **Step 2: Import all 5 providers and register with `builder.add_data_explorer_provider(...)`**

Use the same demo connection strings as Task 21.

- [ ] **Step 3: Commit**

```bash
cd cli-server-python && git add -A && git commit -m "feat: register all data explorer providers in Python demo"
```
