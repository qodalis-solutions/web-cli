# Data Explorer: 5 New Providers

**Date**: 2026-03-21
**Status**: Approved

## Goal

Add PostgreSQL, MySQL, MS SQL Server, Redis, and Elasticsearch providers to the data explorer plugin system across all three servers (Node.js, .NET, Python) and update the frontend to support two new query languages.

## Current State

- 2 providers exist: SQLite (`sql` language) and MongoDB (`shell` language)
- Each provider implements `IDataExplorerProvider` with `executeAsync` + optional `getSchemaAsync`
- Each lives in its own plugin directory per server
- Frontend supports 4 languages: `sql`, `json`, `shell`, `graphql`

## What We Are Building

15 new plugin packages (5 providers x 3 servers) + frontend updates for 2 new language modes.

## Provider Specifications

### PostgreSQL

| Attribute | Value |
|---|---|
| Language | `sql` (existing) |
| Query syntax | Standard SQL, `;` terminator |
| Driver (Node) | `pg` |
| Driver (.NET) | `Npgsql` |
| Driver (Python) | `asyncpg` |
| Schema introspection | `information_schema.tables` + `information_schema.columns` |
| Connection config | `{ connectionString }` |
| Plugin directory | `data-explorer-postgres` |

### MySQL

| Attribute | Value |
|---|---|
| Language | `sql` (existing) |
| Query syntax | Standard SQL, `;` terminator |
| Driver (Node) | `mysql2` |
| Driver (.NET) | `MySqlConnector` |
| Driver (Python) | `aiomysql` |
| Schema introspection | `information_schema.tables` + `information_schema.columns` |
| Connection config | `{ connectionString }` |
| Plugin directory | `data-explorer-mysql` |

### MS SQL Server

| Attribute | Value |
|---|---|
| Language | `sql` (existing) |
| Query syntax | T-SQL, `;` terminator (no `GO` — it is a client tool artifact, not SQL) |
| Driver (Node) | `mssql` (tedious) |
| Driver (.NET) | `Microsoft.Data.SqlClient` |
| Driver (Python) | `pymssql` (sync-only; wrap in `asyncio.to_thread()`) |
| Schema introspection | `information_schema.tables` + `information_schema.columns` |
| Connection config | `{ connectionString }` |
| Plugin directory | `data-explorer-mssql` |

### Redis

| Attribute | Value |
|---|---|
| Language | `redis` (new enum value) |
| Query syntax | Raw commands: `GET key`, `HGETALL user:1` |
| Driver (Node) | `ioredis` |
| Driver (.NET) | `StackExchange.Redis` |
| Driver (Python) | `redis.asyncio` |
| Schema introspection | `SCAN` + `TYPE` (see schema details below) |
| Connection config | `{ connectionString }` (Redis URL format) |
| Plugin directory | `data-explorer-redis` |

**Supported commands**: `GET`, `SET`, `DEL`, `KEYS`, `HGET`, `HSET`, `HGETALL`, `HDEL`, `HKEYS`, `HVALS`, `LPUSH`, `RPUSH`, `LRANGE`, `LLEN`, `SADD`, `SMEMBERS`, `SCARD`, `ZADD`, `ZRANGE`, `ZRANGEBYSCORE`, `INCR`, `DECR`, `EXPIRE`, `TTL`, `PTTL`, `EXISTS`, `TYPE`, `MGET`, `MSET`, `SCAN`, `INFO`, `DBSIZE`, `PING`, `FLUSHDB`.

**Result mapping**: Each command returns a different shape. Normalize to rows:
- String commands: `[{ key, value }]`
- Hash commands: `[{ field, value }, ...]`
- List commands: `[{ index, value }, ...]`
- Set commands: `[{ member }, ...]`
- Info/status commands: `[{ property, value }, ...]`

**Query completeness**: Always single-line. Each command executes immediately on Enter.

**Schema details**: Use `SCAN` with `COUNT 100` in a bounded loop (max 1000 keys sampled). Group scanned keys by type (via `TYPE` command). Return one `DataExplorerSchemaTable` per Redis type (`string`, `hash`, `list`, `set`, `zset`), with a `columns` array describing the shape:
- `string`: columns `[{ name: "key" }, { name: "value" }]`
- `hash`: columns `[{ name: "key" }, { name: "field" }, { name: "value" }]`
- `list`: columns `[{ name: "key" }, { name: "index" }, { name: "value" }]`
- `set`: columns `[{ name: "key" }, { name: "member" }]`
- `zset`: columns `[{ name: "key" }, { name: "member" }, { name: "score" }]`

Each table's `name` is the type name (e.g., `"string"`, `"hash"`). The sampled keys are not listed individually — the schema shows the structural shape per type.

### Elasticsearch

| Attribute | Value |
|---|---|
| Language | `elasticsearch` (new enum value) |
| Query syntax | `VERB /path\n{ json body }` (Kibana Dev Tools style) |
| Driver (Node) | `@elastic/elasticsearch` |
| Driver (.NET) | `Elastic.Clients.Elasticsearch` |
| Driver (Python) | `elasticsearch[async]` |
| Schema introspection | `GET /<index>/_mapping` to list fields with types |
| Connection config | `{ node }` (Elasticsearch URL) |
| Plugin directory | `data-explorer-elasticsearch` |

**Supported verbs**: `GET`, `POST`, `PUT`, `DELETE`, `HEAD`.

**Convenience shortcuts**: Bare paths without a verb default to `GET`:
- `_cat/indices` -> `GET /_cat/indices`
- `_cluster/health` -> `GET /_cluster/health`

**Query format examples**:
```
GET /my-index/_search
{
  "query": { "match_all": {} }
}
```

```
POST /my-index/_doc
{
  "name": "test",
  "value": 42
}
```

```
_cat/indices?v
```

**Result mapping**:
- `_search` responses: flatten `hits.hits[]`, extract `_source` fields as columns
- `_cat` responses: append `?format=json` to force JSON output, then parse as array of objects
- Other responses: return raw JSON

**Query completeness**: If the first line contains only verb + path (no body), execute immediately. If a `{` follows, wait for balanced braces.

## Frontend Changes

### DataExplorerLanguage Enum

Add two new values in all locations where the enum is defined:
- **Frontend**: `web-cli/packages/plugins/data-explorer/src/lib/models/data-explorer-types.ts`
- **Node.js**: `cli-server-node/packages/abstractions/src/data-explorer-types.ts`
- **.NET**: `cli-server-dotnet/src/Qodalis.Cli.Abstractions/DataExplorer/DataExplorerTypes.cs`
- **Python**: `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/data_explorer_types.py`
```typescript
export enum DataExplorerLanguage {
    Sql = 'sql',
    Json = 'json',
    Shell = 'shell',
    Graphql = 'graphql',
    Redis = 'redis',           // NEW
    Elasticsearch = 'elasticsearch', // NEW
}
```

### Syntax Highlighter

Add two new functions to `packages/plugins/data-explorer/src/lib/syntax/highlighter.ts`:

**`highlightRedis(text)`**:
- Commands (bold blue): `GET`, `SET`, `HGETALL`, `LPUSH`, `KEYS`, etc.
- Strings (green): single and double quoted
- Numbers (yellow): integer arguments
- Flags/options (cyan): arguments starting with `--` or uppercase like `EX`, `NX`, `XX`

**`highlightElasticsearch(text)`**:
- HTTP verbs (bold blue): `GET`, `POST`, `PUT`, `DELETE`, `HEAD`
- Paths (cyan): `/index/_search`, `_cat/indices`
- JSON body: delegate to existing `highlightJson()` logic
- Query parameters (yellow): `?v`, `?pretty`

### Query Completeness

Update `isQueryComplete()` in the REPL processor:

- **Redis**: always complete (single-line commands)
- **Elasticsearch**: complete when (a) no body follows verb+path, or (b) JSON braces are balanced

## Plugin Directory Structure

Each server follows its existing pattern. Per provider per server:

**Node.js** (`plugins/data-explorer-<name>/`):
```
<name>-data-explorer-provider.ts   # IDataExplorerProvider implementation
index.ts                           # Re-exports
package.json
tsconfig.json
```

**.NET** (`plugins/data-explorer-<name>/`):
```
<PascalName>DataExplorerProvider.cs         # IDataExplorerProvider implementation
DataExplorer<PascalName>Extensions.cs       # AddDataExplorer<Name>() convenience method
Qodalis.Cli.Plugin.DataExplorer.<Name>.csproj
```

**Python** (`plugins/data-explorer-<name>/`):
```
qodalis_cli_data_explorer_<name>/
    __init__.py
    <name>_provider.py             # IDataExplorerProvider implementation
pyproject.toml
```

## Demo Server Updates

Each server's demo app registers all available providers for local testing:

**Node.js** (`demo/index.ts`):
```typescript
builder.addDataExplorerProvider(new PostgresProvider({ connectionString: '...' }), { name: 'demo-postgres', ... });
builder.addDataExplorerProvider(new MysqlProvider({ connectionString: '...' }), { name: 'demo-mysql', ... });
builder.addDataExplorerProvider(new MssqlProvider({ connectionString: '...' }), { name: 'demo-mssql', ... });
builder.addDataExplorerProvider(new RedisProvider({ connectionString: '...' }), { name: 'demo-redis', ... });
builder.addDataExplorerProvider(new ElasticsearchProvider({ node: '...' }), { name: 'demo-elasticsearch', ... });
```

Equivalent registrations in .NET and Python demos.

**Docker Compose** (workspace root `docker-compose.yml`): Add these services:

| Service | Image | Port | Key env vars |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | `POSTGRES_USER=demo`, `POSTGRES_PASSWORD=demo`, `POSTGRES_DB=demo` |
| `mysql` | `mysql:8` | 3306 | `MYSQL_ROOT_PASSWORD=demo`, `MYSQL_DATABASE=demo` |
| `mssql` | `mcr.microsoft.com/mssql/server:2022-latest` | 1433 | `ACCEPT_EULA=Y`, `MSSQL_SA_PASSWORD=Demo@12345` |
| `redis` | `redis:7-alpine` | 6379 | (none) |
| `elasticsearch` | `elasticsearch:8.12.0` | 9200 | `discovery.type=single-node`, `xpack.security.enabled=false` |

Demo connection strings:
- PostgreSQL: `postgresql://demo:demo@localhost:5432/demo`
- MySQL: `mysql://root:demo@localhost:3306/demo`
- MS SQL: `Server=localhost,1433;Database=master;User Id=sa;Password=Demo@12345;TrustServerCertificate=true`
- Redis: `redis://localhost:6379`
- Elasticsearch: `http://localhost:9200`

## Implementation Order

### Batch 1: SQL Providers (PostgreSQL, MySQL, MS SQL Server)
These share the `sql` language, existing syntax highlighting, and similar `information_schema` patterns. Mostly driver-specific wiring.

### Batch 2: Redis
New `redis` language, new syntax highlighter, different result mapping model.

### Batch 3: Elasticsearch
New `elasticsearch` language, new syntax highlighter, multi-line query parsing with verb+path+body format.

## Out of Scope

- Connection pooling configuration (use driver defaults)
- Authentication UI (connection strings include credentials)
- SSL/TLS certificate configuration
- Read replicas or failover configuration
- Database/schema switching within a session
