# Database migrations plugin

Date: 2026-11-23. Servers 1.0.0-beta.30 (with dashboard extensions), dashboard module `migrations`.

## Goal

One way to version relational schemas on every Qodalis CLI server (Node, .NET, Python): migrations are applied
under a lock, recorded with who/when/how long/what failed, and visible and runnable from the dashboard, the web
terminal and MCP. The host application's own database (RateBell: EF Core, 33 migrations) and the CLI's own stores
(users, jobs, audit, filesystem, public API) use the same plugin.

Not in scope: non-relational stores (Mongo, Redis, Elasticsearch), schema diffing/generation (EF generates its own;
SQL migrations are written by hand), ORMs on Node/Python (none is used there; the source interface is public so
knex/Alembic adapters can follow).

## Concepts

- **Database**: a name (`main`, `cli`), a dialect (`postgres`, `mysql`, `mssql`, `sqlite`) and a connection. One
  server can register several.
- **Source**: where a database's migrations come from. A database has one or more sources, applied in order.
  - `sql-folder`: files `NNNN_name.up.sql` (and optional `NNNN_name.down.sql`) in a folder; `--` comments,
    one transaction per file (a file starting with `-- qcli:no-transaction` runs outside one, for
    `CREATE INDEX CONCURRENTLY`).
  - `code`: migrations registered in code (`{ id, name, up, down? }`, SQL strings or functions getting the
    connection). This is how plugins ship their schema.
  - `ef-core` (.NET): a `DbContext` type. Status from `GetMigrations()` / `GetAppliedMigrationsAsync()`, applied
    with `IMigrator.MigrateAsync(target)`, SQL preview with `GenerateScript(from, to)`. EF keeps its own
    `__EFMigrationsHistory`; the plugin adds its run records next to it.
- **Migration**: id (sortable: `0001`, `20261120111649_PublicApi`), name, checksum (SHA-256 of the up script;
  EF sources have none: EF tracks its migrations by id), has-down.
- **Status** per migration: `applied`, `pending`, `changed` (applied, checksum differs), `missing` (applied, no
  longer in the source), `failed` (last attempt failed).
- **Run**: one invocation (startup, dashboard, terminal, MCP, API): database, direction (`up`/`down`), target,
  who, start/end, the migrations it applied with their durations, the error. Kept in `qcli_migration_runs`.

## History tables (per database)

Named by the plugin table rule below (cli-server-dotnet#99): prefix `Qcli` + PascalCase, PascalCase columns.

```
QcliMigrations     (Source, Id, Name, Checksum, AppliedAt, DurationMs, AppliedBy, RunId)   PK (Source, Id)
QcliMigrationRuns  (Id, Direction, Target, Trigger, Actor, StartedAt, FinishedAt, Status, Error, Applied)
```

EF Core sources write `QcliMigrationRuns` only (history stays in `__EFMigrationsHistory`, so `dotnet ef` keeps
working).

## Plugin table names (cli-server-dotnet#99, cli-server-node#77, cli-server-python#83)

Every table a CLI plugin creates is `Qcli` + PascalCase (decided 2026-11-23, replacing #99's `Cli`) with PascalCase columns, the same in the three servers:

| Today | New |
|---|---|
| `files` (filesystem-efcore, filesystem-sqlite) | `QcliFiles` |
| `job_executions`, `job_log_entries`, `job_states` | `QcliJobExecutions`, `QcliJobLogEntries`, `QcliJobStates` |
| `api_tokens` | `QcliApiTokens` |
| `audit_entries` | `QcliAuditEntries` |
| `qcli_api_usage` | `QcliApiUsage` |
| `qcli_users`, `qcli_groups`, `qcli_credentials`, `qcli_sessions`, `qcli_api_tokens`, `qcli_audit` (Node users-postgres) | `QcliUsers`, `QcliGroups`, `QcliCredentials`, `QcliSessions`, `QcliApiTokens`, `QcliAuditEntries` |

Indexes and keys follow (`IX_QcliJobExecutions_JobId`, `PK_QcliFiles`). Columns: `created_at` → `CreatedAt`, etc.

Options, one shared helper per server (abstractions: `QcliTableNames`): a global prefix (`tablePrefix` /
`table_prefix` / `TablePrefix`, default `Qcli`, `''` = plain PascalCase), per-table overrides on each store's options
(`tables: { files: 'MyFiles' }` / `Tables.Files`), a schema where the database has them (`schema` / `Schema`), and
`legacyTableNames` to keep the old names (opt-in: by default an upgrade migrates). Names are validated (identifier characters) and always quoted.

Upgrade keeps the data: each store's first migration renames the old table and its columns when the old table
exists and the new one does not (`ALTER TABLE … RENAME TO` / `RENAME COLUMN`, SQLite ≥ 3.25, `sp_rename` on SQL
Server), then creates what is missing. Without the migrations plugin the stores run the same steps themselves at
startup (as `EnsureCreated`/`UpgradeSchema` do today). Tested from the previous beta's schema on every dialect.

Hosts that map the stores' tables in their own EF model (RateBell) add an EF migration with the renames, or set
`legacyTableNames`.

## Runner

- Lock per database for the whole run: Postgres `pg_advisory_lock(hashtext('<prefix>migrations'))`, MySQL
  `GET_LOCK`, SQL Server `sp_getapplock`, SQLite `BEGIN IMMEDIATE` on a lock row. Two processes starting together
  (RateBell Api + Jobs) apply once; the second waits, then sees nothing pending.
- Up: pending migrations in order, each in its own transaction with its history row; stops at the first failure
  (recorded on the run and the migration). `--to <id>` stops after that id.
- Down: rolls back applied migrations newest first down to (not including) `<id>`; refused when one has no down
  script (EF: `Down` always exists).
- Refuses to run up while a migration is `changed` or `missing`, unless `force` (recorded on the run).
- Dry run: returns the SQL it would run (EF: `GenerateScript`), applies nothing.
- `applyOnStartup` per database (default false; RateBell and the CLI's own stores: true): the server waits for it
  before it listens; a failure stops startup with the error (as `MigrateAsync` does today).

## Server API (all three servers, `migrations` plugin)

Permissions: `migrations:read` (status, runs, SQL preview), `migrations:run` (up, down). Every run also goes to
the audit log (`migrations.up`, `migrations.down`).

```
GET  /api/v1/qcli/migrations                         -> { databases: [{ name, dialect, sources, applied, pending, problems, lastRun }] }
GET  /api/v1/qcli/migrations/{db}                    -> { name, dialect, migrations: [{ source, id, name, status, appliedAt, durationMs, appliedBy, hasDown }] }
GET  /api/v1/qcli/migrations/{db}/runs?page=&size=   -> { items: [run], total }
GET  /api/v1/qcli/migrations/{db}/sql?direction=&to= -> { sql }            (dry run)
POST /api/v1/qcli/migrations/{db}/up    { to?, force? }   -> run   (409 while another run holds the lock)
POST /api/v1/qcli/migrations/{db}/down  { to }            -> run
```

Errors as elsewhere: `{ "error": "..." }`; 404 unknown database, 409 busy or blocked (`changed`/`missing`).

Server commands (web terminal): `migrations` (list), `migrations status <db>`, `migrations up <db> [--to] [--dry-run]`,
`migrations down <db> --to <id> [--dry-run]`, with the same permissions. MCP tools: `migrations_status`,
`migrations_runs`, `migrations_sql`, `migrations_up`, `migrations_down` (the last two not in read-only mode).

Registration:

```ts
// Node
createCliServer().builder.addModule(new CliMigrationsBuilder()
  .addDatabase('main', { dialect: 'postgres', connection: process.env.DATABASE_URL, applyOnStartup: true })
  .addSqlFolder('main', './migrations')
  .build());
```
```csharp
// .NET
cli.AddMigrations(m => m
    .AddDatabase("main", db => db.UseNpgsql(connectionString).ApplyOnStartup())
    .AddEfCore<RateBellDbContext>("main"));        // Qodalis.Cli.Plugin.Migrations.EfCore
```
```python
# Python
builder.add_module(CliMigrationsBuilder()
    .add_database("main", dialect="postgres", url=os.environ["DATABASE_URL"], apply_on_startup=True)
    .add_sql_folder("main", "./migrations").build())
```

Plugins register their schema as a `code` source on a database the host names (or their own), e.g.
`users-postgres` → source `qcli-users` on the database it is given.

## The CLI's own stores (same release)

| Store | Today | With the plugin |
|---|---|---|
| Node `users-postgres` (not on npm yet, but live on plugins.qodalis.com) | own `runPostgresMigrations` (`qcli_schema_migrations`) | `code` source `qcli-users`: migration 1 renames the `qcli_*` tables when present, the history rows of `qcli_schema_migrations` are taken over |
| Node/Python/.NET `filesystem-sqlite` | `CREATE TABLE IF NOT EXISTS` | `code` source `qcli-filesystem` (migration 1 = today's schema, `IF NOT EXISTS`) |
| .NET `users-efcore`, `jobs-efcore`, `audit-efcore`, `filesystem-efcore`, `public-api-efcore` | `EnsureCreated` + `UpgradeSchema` | each ships a `code` source with SQL per dialect (`IF NOT EXISTS`, so tables a host already made are adopted); `EnsureCreated` stays as the default when the migrations plugin is not used |

Hosts that own the schema (RateBell maps the stores' entities into its `DbContext` and creates them in its EF
migrations) keep doing so: they do not register the stores' sources, and the EF source shows those tables'
migrations as part of the host's.

## Dashboard module

`modules/migrations` in cli-server-dashboard, built with the kit, published as
`@qodalis/cli-dashboard-module-migrations`, embedded by each server's migrations plugin and registered as a
dashboard extension (group `data`, permission `migrations:read`). Its own texts in the 11 languages.

- Databases: name, dialect, applied/pending counts, problems, last run (status, when, who).
- A database: its migrations by source with status badges (pending, changed, missing, failed stand out), applied
  at/by, duration; Run pending / Migrate to here / Roll back to here (with `migrations:run`), each showing the SQL
  (dry run) in the confirm dialog.
- Runs: history with trigger, who, duration, applied migrations, the error.
- Live: the page refreshes on the `migrations.run` server event.

## RateBell

- `RateBell.Api` and `RateBell.Jobs`: replace the startup `MigrateAsync()` with the plugin
  (`AddEfCore<RateBellDbContext>("ratebell")`, `ApplyOnStartup()` on PostgreSQL; SQLite keeps `EnsureCreated`).
- Its dashboard shows the 33+ migrations and every run; CI keeps `dotnet ef database update`.

## Order

0. The table-name helper and the renames in the stores (#99), in the three servers.
1. Node plugin (runner, dialects, sql-folder, code, API, commands, MCP) + tests on the four dialects (containers).
2. .NET plugin + `Migrations.EfCore` adapter; Python plugin. Same tests.
3. The stores move onto it (table above).
4. Dashboard module; embedded by the three plugins.
5. Release servers + dashboard 1.0.0-beta.30; RateBell switches.
