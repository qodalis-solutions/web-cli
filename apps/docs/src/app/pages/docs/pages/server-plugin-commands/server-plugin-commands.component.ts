import { Component } from '@angular/core';

/** One terminal command of a server plugin. */
export interface PluginCommand {
    /** Syntax, e.g. `databases runs [<db>] [-n 20] [--json]` */
    syntax: string;
    description: string;
    /** Permission(s) needed on a protected server; empty: `commands:execute` only (or a sign-in) */
    permission: string;
    /**
     * `server`: a command processor of the server, run there (`commands:execute`
     * plus the permission). Otherwise the web-cli package that provides the
     * command and calls the plugin's REST API.
     */
    source: string;
}

/** The commands of one server plugin. */
export interface ServerPluginCommands {
    id: string;
    name: string;
    /** Server package (Node name; .NET and Python packages match) */
    serverPackage: string;
    intro: string;
    commands: PluginCommand[];
}

const SERVER = 'server';
const JOBS = '@qodalis/cli-server-jobs';
const USERS = '@qodalis/cli-users';

const awsRead = (syntax: string, description: string): PluginCommand => ({
    syntax,
    description,
    permission: 'aws:read',
    source: SERVER,
});
const awsWrite = (syntax: string, description: string): PluginCommand => ({
    syntax,
    description,
    permission: 'aws:read, aws:write',
    source: SERVER,
});

export const SERVER_PLUGIN_COMMANDS: ServerPluginCommands[] = [
    {
        id: 'config',
        name: 'Config (server core)',
        serverPackage: 'built into every server',
        intro:
            'The server\'s configuration through its config providers (see Configuration providers on the Server Integration page). Paths are <provider>.<section>.<key>; values are read as the setting\'s type, and secrets are accepted but never printed. Leave the command out with createCliServer({ config: { command: false } }).',
        commands: [
            { syntax: 'config, config list', description: 'Providers and their sections (setting count, version)', permission: 'config:read', source: SERVER },
            { syntax: 'config get <provider>[.<section>[.<key>]]', description: 'A provider, a section, or one setting with its default, source, rules and version', permission: 'config:read', source: SERVER },
            { syntax: 'config set <provider>.<section>.<key> <value> [--expected-version v]', description: 'Change a setting; a stale --expected-version is refused with the current version', permission: 'config:write', source: SERVER },
            { syntax: 'config reset <provider>.<section>.<key> [--expected-version v]', description: 'Back to the default (clears a secret, removes a free key of the custom provider)', permission: 'config:write', source: SERVER },
        ],
    },
    {
        id: 'admin',
        name: 'Admin',
        serverPackage: '@qodalis/cli-server-plugin-admin',
        intro:
            'The server\'s status, command modules, connected clients and log history, read from the same services as the admin routes. Every sub-command needs admin:access; admin logs also needs logs:read. Lists take --json (the payload of the matching route). The server\'s settings are the core config command; the live log stream is a web-cli command.',
        commands: [
            { syntax: 'admin, admin status [--json]', description: 'Server package and version, platform, uptime, memory, CPU, connections, commands, jobs, features (GET /status)', permission: 'admin:access', source: SERVER },
            { syntax: 'admin status --history [--minutes 1-1440] [--json]', description: 'Summary of the status samples of the last minutes (default 60): count, min/avg/max memory and CPU, peak connections', permission: 'admin:access', source: SERVER },
            { syntax: 'admin plugins, admin plugins list [--json]', description: 'Command modules: id, name, version, enabled or disabled, commands', permission: 'admin:access', source: SERVER },
            { syntax: 'admin plugins enable <id>, admin plugins disable <id>', description: 'Turn a module\'s commands on or off; idempotent (says when it already is). The admin module cannot be disabled from the terminal', permission: 'admin:access', source: SERVER },
            { syntax: 'admin clients [--json]', description: 'Connected WebSocket clients: id, type, connected since, address', permission: 'admin:access', source: SERVER },
            { syntax: 'admin logs [--level warn,error] [--search <text>] [--service <source>] [--since 5m|1h|7d|<ISO date>] [-n 1-1000] [--json]', description: 'The newest matching log entries (default 50), oldest first, from the log history', permission: 'admin:access, logs:read', source: SERVER },
            { syntax: 'server logs [--level <lvl>] [--pattern <regex>] [--server <name>] [--file]', description: 'Stream the server\'s log lines live until Ctrl+C', permission: 'logs:read', source: '@qodalis/cli-server-logs' },
        ],
    },
    {
        id: 'audit',
        name: 'Audit',
        serverPackage: '@qodalis/cli-server-plugin-audit',
        intro: 'The audit log (sign-ins, user, group, session, token and config changes). The users plugin adds it; the commands come with the web-cli users package.',
        commands: [
            { syntax: 'audit', description: 'The security audit log, newest first', permission: 'audit:read', source: USERS },
            { syntax: 'audit clear', description: 'Clear the audit log (asks first)', permission: 'audit:clear', source: USERS },
            { syntax: 'last [user]', description: 'Sign-in history: logins, logouts, failures', permission: 'audit:read', source: USERS },
        ],
    },
    {
        id: 'aws',
        name: 'AWS',
        serverPackage: '@qodalis/cli-server-plugin-aws',
        intro:
            'AWS from the server\'s credentials. Every command needs aws:read (on the root aws command); aws configure set, s3 cp/rm/mb/rb, ec2 start/stop/reboot, lambda invoke, sqs send/purge and sns publish also need aws:write. Common flags: --region (-r), --output table|json|text (-o), --dry-run on destructive commands.',
        commands: [
            awsWrite('aws configure set', 'Set the AWS credentials and region'),
            awsRead('aws configure get', 'Current configuration, secrets masked'),
            awsRead('aws configure profiles', 'Available AWS profiles'),
            awsRead('aws status', 'Test the connection (STS GetCallerIdentity)'),
            awsRead('aws s3 ls [bucket]', 'Buckets, or the objects of a bucket'),
            awsWrite('aws s3 cp <source> <dest>', 'Copy objects between S3 locations'),
            awsWrite('aws s3 rm <path>', 'Delete an object'),
            awsWrite('aws s3 mb <name>', 'Create a bucket'),
            awsWrite('aws s3 rb <name>', 'Delete a bucket'),
            awsRead('aws s3 presign <path>', 'A pre-signed URL'),
            awsRead('aws ec2 list', 'EC2 instances'),
            awsRead('aws ec2 describe <id>', 'One instance'),
            awsWrite('aws ec2 start <id>, stop <id>, reboot <id>', 'Start, stop or reboot an instance'),
            awsRead('aws ec2 sg list', 'Security groups'),
            awsRead('aws lambda list', 'Lambda functions'),
            awsWrite('aws lambda invoke <name> [--payload <json>]', 'Invoke a function'),
            awsRead('aws lambda logs <name>', 'Recent logs of a function'),
            awsRead('aws cloudwatch alarms', 'CloudWatch alarms'),
            awsRead('aws cloudwatch logs <group>', 'Log events of a log group'),
            awsRead('aws cloudwatch metrics <namespace>', 'Metrics of a namespace'),
            awsRead('aws sns topics', 'SNS topics'),
            awsWrite('aws sns publish <arn> --message <msg>', 'Publish a message to a topic'),
            awsRead('aws sns subscriptions [arn]', 'Subscriptions'),
            awsRead('aws sqs list', 'SQS queues'),
            awsWrite('aws sqs send <url> --message <msg>', 'Send a message to a queue'),
            awsRead('aws sqs receive <url> [--max <n>]', 'Receive messages'),
            awsWrite('aws sqs purge <url>', 'Purge a queue'),
            awsRead('aws iam users, aws iam roles, aws iam policies', 'IAM users, roles and customer-managed policies'),
            awsRead('aws dynamodb tables', 'DynamoDB tables'),
            awsRead('aws dynamodb describe <table>', 'One table'),
            awsRead('aws dynamodb scan <table> [--limit <n>]', 'Scan items'),
            awsRead('aws dynamodb query <table> --key <expr>', 'Query items'),
            awsRead('aws ecs clusters', 'ECS clusters'),
            awsRead('aws ecs services <cluster>, aws ecs tasks <cluster>', 'Services or tasks of a cluster'),
        ],
    },
    {
        id: 'data-explorer',
        name: 'Data explorer',
        serverPackage: '@qodalis/cli-server-plugin-data-explorer (+ a provider: sql, postgres, mysql, mssql, mongo, redis, elasticsearch)',
        intro:
            'Queries against the server\'s data sources, in a full-screen console with \\format, \\templates, \\schema and the other console commands. A source can ask for more permissions (e.g. data:billing) and exports for data:export.',
        commands: [
            { syntax: 'data-explorer [--server <name|url>]', description: 'Pick a data source and open the query console', permission: 'data:query (+ the source\'s own)', source: '@qodalis/cli-data-explorer' },
        ],
    },
    {
        id: 'databases',
        name: 'Databases',
        serverPackage: '@qodalis/cli-server-plugin-databases',
        intro: 'The databases the server knows, their load and their migrations. <db> can be left out when there is one database.',
        commands: [
            { syntax: 'databases, databases list (alias db)', description: 'The databases: size, applied and pending migrations', permission: 'databases:read', source: SERVER },
            { syntax: 'databases stats [<db>]', description: 'Size, connections, load counters and largest tables', permission: 'databases:read', source: SERVER },
            { syntax: 'databases migrations [<db>]', description: 'The migrations of a database and their status', permission: 'databases:read', source: SERVER },
            { syntax: 'databases runs [<db>] [-n 1-100] [--json]', description: 'Migration run history, newest first (default 20): start, direction, status, migrations run, trigger and who ran it, target, error', permission: 'databases:read', source: SERVER },
            { syntax: 'databases up [<db>] [--to <id>] [--dry-run] [--force]', description: 'Apply the pending migrations (--dry-run prints the SQL)', permission: 'databases:migrate', source: SERVER },
            { syntax: 'databases down [<db>] --to <id|base> [--dry-run]', description: 'Roll back what came after --to', permission: 'databases:migrate', source: SERVER },
        ],
    },
    {
        id: 'docs',
        name: 'Docs',
        serverPackage: '@qodalis/cli-server-plugin-docs',
        intro: 'The documentation pages the docs plugin serves, readable in the terminal. The pages are public, so no permission is needed.',
        commands: [
            { syntax: 'docs, docs list (alias ls) [--group <group>] [--json]', description: 'Slug and title of every page, by group, in page order', permission: '', source: SERVER },
            { syntax: 'docs read <slug> (aliases show, cat) [--json]', description: 'The page\'s markdown with the variables replaced', permission: '', source: SERVER },
        ],
    },
    {
        id: 'filesystem',
        name: 'Filesystem',
        serverPackage: 'built into every server (opt-in); storage: filesystem-json, filesystem-s3, filesystem-sqlite',
        intro: 'The server\'s file API (/api/qcli/fs), only for the paths the server allows.',
        commands: [
            { syntax: 'scp ls <server> <path>, scp cat <server> <path>, scp stat <server> <path>', description: 'List a directory, print a file, show file information', permission: 'files:read', source: '@qodalis/cli-scp' },
            { syntax: 'scp download <server> <remote> [local] [--save], scp <server>:<remote> [local]', description: 'Download into the virtual file system, or through the browser', permission: 'files:read', source: '@qodalis/cli-scp' },
            { syntax: 'scp upload <server> <local> <remote> [--local], scp <local> <server>:<remote>', description: 'Upload a file', permission: 'files:write', source: '@qodalis/cli-scp' },
            { syntax: 'scp mkdir <server> <path>, scp rm <server> <path>', description: 'Create a directory, delete a file (no confirmation)', permission: 'files:write', source: '@qodalis/cli-scp' },
        ],
    },
    {
        id: 'jobs',
        name: 'Jobs',
        serverPackage: '@qodalis/cli-server-plugin-jobs',
        intro:
            'Background jobs, as server jobs sub-commands of the built-in server command. A job is picked by name (any case) or ID on every connected server; --server limits a command to one.',
        commands: [
            { syntax: 'server jobs, server jobs list [--group <g>] [--tag <t>]', description: 'The jobs of every connected server', permission: 'jobs:read', source: JOBS },
            { syntax: 'server jobs info <name|id>', description: 'Schedule, retries, timeout, overlap policy, current and last run', permission: 'jobs:read', source: JOBS },
            { syntax: 'server jobs trigger|pause|resume|stop|cancel <name|id>', description: 'Run now, pause or resume the schedule, stop, cancel the run in progress', permission: 'jobs:manage', source: JOBS },
            { syntax: 'server jobs edit <name|id>', description: 'Change the job\'s settings step by step', permission: 'jobs:manage', source: JOBS },
            { syntax: 'server jobs history <name|id> [--limit 20] [--offset 0] [--status <s>]', description: 'Past runs of a job', permission: 'jobs:read', source: JOBS },
            { syntax: 'server jobs history clear <name|id> [--status <s>] [--yes]', description: 'Delete the finished runs of a job (asks unless --yes)', permission: 'jobs:manage', source: JOBS },
            { syntax: 'server jobs history rm <name|id> <run-id> [--yes]', description: 'Delete one run, by ID or short ID (asks unless --yes)', permission: 'jobs:manage', source: JOBS },
            { syntax: 'server jobs runs [--job <name|id>] [--status <s>] [-n 20]', description: 'The latest runs of every job, newest first', permission: 'jobs:read', source: JOBS },
            { syntax: 'server jobs stats', description: 'Runs of the last 24 hours: outcomes, success rate, average and p95 duration, per job', permission: 'jobs:read', source: JOBS },
            { syntax: 'server jobs logs <name|id> [--exec <id>]', description: 'Log entries of the latest run, or of one run', permission: 'jobs:read', source: JOBS },
            { syntax: 'server jobs watch', description: 'Job events live, until Ctrl+C', permission: 'jobs:read', source: JOBS },
        ],
    },
    {
        id: 'portal',
        name: 'Portal',
        serverPackage: '@qodalis/cli-server-plugin-portal',
        intro:
            'The documentation portal at a glance: where it is mounted, whether its site was found and where from, the sections it publishes (docs with the page count, the API reference) and the branding. The portal stays public; the command needs config:read because it shows the portal\'s settings. Change the branding with config set portal.branding.<key> <value> (name, logoUrl, themeMode, footerLinks): it applies to the next /portal.json, no restart. The site\'s content comes from the docs and public-api commands.',
        commands: [
            { syntax: 'portal, portal status [--json]', description: 'Path, site (found, where from), sections, branding; --json: portal.json with docs.pageCount, and site { path, found, source, dir }', permission: 'config:read', source: SERVER },
            { syntax: 'config set portal.branding.name|logoUrl|themeMode|footerLinks <value>', description: 'Change the branding live (the builder\'s values are the defaults; config reset brings them back)', permission: 'config:write', source: SERVER },
        ],
    },
    {
        id: 'public-api',
        name: 'Public API',
        serverPackage: '@qodalis/cli-server-plugin-public-api',
        intro: 'Requests counted per token and UTC day by the public API guard. The guarded routes are the host\'s own, so the plugin does not list them.',
        commands: [
            { syntax: 'api, api usage [--days 1-30] [--json]', description: 'Your requests per token and day (default 7 days, today included), totals, today\'s requests of every token (revoked ones too) and your quota', permission: '', source: SERVER },
            { syntax: 'api usage --user <name|id> [--days 1-30] [--json]', description: 'The same for another account', permission: 'tokens:read', source: SERVER },
        ],
    },
    {
        id: 'users',
        name: 'Users',
        serverPackage: '@qodalis/cli-server-plugin-users (store: users-postgres)',
        intro:
            'Accounts, groups, sessions, API tokens and terminal links. With usersModule.configure({ server }) the web-cli users package works against the server; the same commands also work locally, without a server, except token and link.',
        commands: [
            { syntax: 'login [user], logout, su <user>', description: 'Sign in, sign out, switch user', permission: '', source: USERS },
            { syntax: 'whoami, id [user], groups [user], perms [user]', description: 'Who you are, groups and effective permissions (others: users:read)', permission: 'sign-in', source: USERS },
            { syntax: 'passwd [user]', description: 'Change your password, or reset another user\'s', permission: 'sign-in (others: users:update)', source: USERS },
            { syntax: 'adduser [name], usermod <user>, userdel <user> [--force]', description: 'Create, change or delete a user', permission: 'users:create, users:update, users:delete', source: USERS },
            { syntax: 'listusers [--query <q>]', description: 'List users', permission: 'users:read', source: USERS },
            { syntax: 'groupadd <name>, groupmod <group>, groupdel <name>', description: 'Create, change or delete a group (role)', permission: 'groups:create, groups:update, groups:delete', source: USERS },
            { syntax: 'w, sessions, session-kick <id>', description: 'Who is signed in, active sessions, end a session', permission: 'sign-in; sessions: sessions:read; others\' sessions: sessions:revoke', source: USERS },
            { syntax: 'token create <name> [--expires <days>|never] [--permissions a,b|--select]', description: 'Create an API token (shown once)', permission: 'sign-in (session)', source: USERS },
            { syntax: 'token list [--all], token revoke <id>, token permissions [--all]', description: 'List, revoke API tokens; the permissions a token can carry', permission: 'sign-in (--all: tokens:read / users:read; others\' tokens: tokens:revoke)', source: USERS },
            { syntax: 'link approve <code> [--yes]', description: 'Approve another terminal\'s link request (server add there): shows it, asks, creates an API token acting as you', permission: 'sign-in (session)', source: USERS },
            { syntax: 'link deny <code>', description: 'Deny another terminal\'s link request', permission: 'sign-in', source: USERS },
        ],
    },
    {
        id: 'weather',
        name: 'Weather (example)',
        serverPackage: '@qodalis/cli-server-plugin-weather',
        intro: 'The example plugin: a command with sub-commands.',
        commands: [
            { syntax: 'weather [location], weather current [location] [-l <location>]', description: 'Current conditions (London by default)', permission: '', source: SERVER },
            { syntax: 'weather forecast [location]', description: 'A 3-day forecast', permission: '', source: SERVER },
        ],
    },
];

/** Plugins with nothing to do from a terminal. */
export const PLUGINS_WITHOUT_COMMANDS: { name: string; note: string }[] = [
    { name: 'Data explorer providers (sql, postgres, mysql, mssql, mongo, redis, elasticsearch)', note: 'Data sources of the data explorer: use data-explorer.' },
    { name: 'Filesystem storage (filesystem-json, filesystem-s3, filesystem-sqlite)', note: 'Where the filesystem API keeps files: use scp.' },
    { name: 'users-postgres', note: 'Stores the users plugin\'s data in PostgreSQL: use the users commands.' },
];

@Component({
    standalone: false,
    selector: 'docs-server-plugin-commands',
    templateUrl: './server-plugin-commands.component.html',
})
export class ServerPluginCommandsComponent {
    readonly plugins = SERVER_PLUGIN_COMMANDS;
    readonly withoutCommands = PLUGINS_WITHOUT_COMMANDS;
}
