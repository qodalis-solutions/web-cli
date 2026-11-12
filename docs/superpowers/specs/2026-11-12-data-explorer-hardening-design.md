# Data explorer: per-source permissions, read-only mode, masking, audit and limits

Date: 2026-11-12. Issues: cli-server-dotnet#74, cli-server-node#59, cli-server-python#63 (use case: ratebell#86).
Applies to the data explorer of the three servers (next server release) and to web-cli's `data-explorer` plugin.

## Goal

A host can show a database to staff without leaking data. Today a source has only `timeout` and `maxRows`, and
every caller with `data:query` can run anything on every source.

## Source options (same JSON names on every server; .NET PascalCase, Python snake_case)

| Option | Default | Effect |
|---|---|---|
| `requiredPermissions` | none | The caller must hold all of them (besides `data:query`). `GET /sources` and MCP `data_sources` list only the sources the caller may use; `schema`, `execute` and the MCP tools answer 403 `forbidden: missing permission <p>` (MCP: an error result). Ignored on an open server (no auth provider) |
| `readOnly` | **true** | Queries may only read (rules below). SQL providers also run the query in a read-only transaction (Postgres `BEGIN READ ONLY`, MySQL `START TRANSACTION READ ONLY`, SQL Server a transaction that is always rolled back, SQLite `PRAGMA query_only`). Set `readOnly: false` for a source that must write |
| `allowedObjects` | all | Glob patterns (`*` matches anything, case-insensitive) of the tables (`schema.table` or `table`), collections, Redis keys or Elasticsearch indices the source shows and accepts. The schema lists only matching tables; a query that names another object is refused |
| `maskColumns` | none | Glob patterns of column/field names whose values are replaced by `***` in results (`null` stays `null`); nested document fields too |
| `dropColumns` | none | Glob patterns of columns/fields removed from results and from the schema |
| `audit` | true | Every execute is written to the audit log (when the server has one, i.e. the users plugin): event `data_query`, the caller, `metadata: { source, query (first 2000 characters), success, rowCount, durationMs, error? }` |
| `rateLimit` | none | `{ maxQueries, windowSeconds }`: at most that many executes per caller (user id, or client address when anonymous) per window and source; more answer 429 `Too many queries: at most N per S s` (MCP: an error result) |
| `exportPermissions` | none | Permissions needed to export results (`json`/`csv` output in the web CLI). `GET /sources` reports `canExport` per source; the web CLI refuses `\format json|csv` when it is false. Advisory: the table output shows the same rows |

`GET /sources` adds `readOnly` and `canExport` to each source.

## Read-only rules (checked by the server before the provider runs)

- `sql`: comments and string literals are ignored; exactly one statement (a trailing `;` is fine); it starts with
  `SELECT`, `WITH`, `EXPLAIN`, `SHOW`, `DESCRIBE`/`DESC`, `VALUES` or `TABLE`; and it contains none of `INSERT`,
  `UPDATE`, `DELETE`, `MERGE`, `UPSERT`, `REPLACE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `GRANT`, `REVOKE`, `COPY`,
  `CALL`, `EXEC`/`EXECUTE`, `INTO` (`SELECT ... INTO` writes), `LOCK`, `VACUUM`, `ATTACH`, `DETACH`, `PRAGMA`, `SET`
  as a keyword. The read-only transaction is the second line of defence.
- `shell` and `json` (MongoDB; hosts register Mongo sources with either language): `show collections|dbs|databases`, or `db.<collection>.<method>(...)` with method `find`,
  `findOne`, `countDocuments`, `estimatedDocumentCount`, `distinct` or `aggregate` (without `$out`/`$merge`).
- `redis`: the command is one of `GET MGET STRLEN GETRANGE HGET HMGET HGETALL HKEYS HVALS HLEN HEXISTS LRANGE LLEN
  LINDEX SMEMBERS SCARD SISMEMBER ZRANGE ZRANGEBYSCORE ZREVRANGE ZCARD ZSCORE TTL PTTL EXISTS TYPE KEYS SCAN INFO
  DBSIZE PING`.
- `elasticsearch`: `GET`/`HEAD`, or `POST` to a path ending in `_search`, `_count`, `_msearch`, `_mget`,
  `_field_caps` or `_validate/query`.
- Other languages (`graphql`): refused when read-only unless the provider says it only reads
  (`readOnlyQueries` flag on the provider; none of the built-in ones use these languages).

## Allowed objects (best effort)

Objects are read from the query: SQL names after `FROM`, `JOIN`, `INTO`, `UPDATE`, `TABLE` (CTE names defined by
`WITH` are exempt; quotes and brackets removed); MongoDB the collection in `db.<collection>`; Redis the key
arguments (`KEYS`/`SCAN` patterns too); Elasticsearch the index part of the path. A query naming an object outside
the list is refused. This is a convenience filter: the database account's own permissions are the real boundary,
and the docs say so.

## Order of checks for an execute

permissions → rate limit → read-only → allowed objects → provider (read-only transaction) → `maxRows` →
masking/dropping → audit (also for refused queries, with the refusal as `error`).

## Web CLI

- `\format json|csv` on a source with `canExport: false` prints `Export is not allowed on this source` and keeps
  the format.
- The source list shows `read-only` next to read-only sources.
- A source with `canExport: false` whose default output format is `json` or `csv` starts in table output (builder's call).
- 403 and 429 answers print the server's `error` text.
