## Web plugins

### Scaffolding a web plugin with create-cli-plugin

`@qodalis/create-cli-plugin` generates a ready-to-build web plugin, either standalone (its own npm project) or inside the web-cli monorepo.

```bash
# Standalone, interactive
npx @qodalis/create-cli-plugin

# Standalone, non-interactive (all flags optional except --name)
npx @qodalis/create-cli-plugin --name weather --description "Weather forecasts" --processor-name Weather

# Inside the web-cli monorepo (builds the scaffolder first)
pnpm run create-plugin -- --name weather --description "Weather forecasts" --processor-name Weather
```

- Flags: `-n, --name <name>` (lowercase; becomes the command and `@qodalis/cli-<name>`), `-d, --description <description>` (default `CLI extension for <name>`), `-p, --processor-name <name>` (PascalCase; default: PascalCase of the name; the class is `Cli<ProcessorName>CommandProcessor`). Without `--name` it prompts.
- Monorepo mode is detected by walking up to a directory with a `pnpm-workspace.yaml` mentioning `packages/plugins`; the plugin is created in `packages/plugins/<name>/` with `project.json`, `tsconfig.spec.json`, a `tsconfig.base.json` path alias `@qodalis/cli-<name>` -> `./dist/<name>` and an `angular.json` Karma test entry. Build with `pnpm nx build <name>`, test with `pnpm nx test <name>`.
- Standalone mode creates `./qodalis-cli-<name>/`, runs `pnpm install` (or `npm install`), and also writes `.gitignore`, `pnpm-workspace.yaml` and `AGENTS.md`. Build with `npx tsup` (or `npm run build`), publish with `npm publish --access public`.

Generated layout (both modes):

```text
src/
  public-api.ts                        # exports the processor, version and `<name>Module: ICliModule`
  cli-entrypoint.ts                    # UMD entry: bootCliModule(module) for `pkg add`
  lib/
    index.ts                           # barrel
    version.ts                         # LIBRARY_VERSION, API_VERSION = 2
    processors/cli-<name>-command-processor.ts
  tests/index.spec.ts                  # Jasmine-style describe/it/expect
tsup.config.ts                         # CJS + ESM + d.ts, plus IIFE bundle in dist/umd
package.json                           # name @qodalis/cli-<name>, dependency @qodalis/cli-core
```

### ICliModule

`ICliModule` (from `@qodalis/cli-core`) is the unit a web plugin exports: it bundles command processors, services, guards, permissions and translations, plus lifecycle hooks.

```typescript
import { API_VERSION, ICliModule } from '@qodalis/cli-core';

export const weatherModule: ICliModule = {
    apiVersion: API_VERSION,          // required; modules below the runtime's API_VERSION (2) are rejected at boot
    name: '@qodalis/cli-weather',     // required; unique id
    version: '1.0.0',
    description: 'Weather forecasts',
    dependencies: [],                 // module names booted before this one
    priority: 0,                      // lower boots first (default 0)
    processors: [new CliWeatherCommandProcessor()],
    services: [],                     // CliProvider[] registered in the shared container
    guards: [],                       // ICliCommandGuard[] run before every command
    permissions: [],                  // CliPermissionDefinition[] ({ name: 'weather:read', description? })
    translations: { es: { 'cli.weather.description': 'Previsión del tiempo' } },
    async onInit(context) {},         // after services are registered, before processors initialize
    async onSetup(context) { return true; }, // first-run setup; true marks it done (persisted)
    async onAfterBoot(context) {},    // all modules booted, terminal interactive
    async onDestroy(context) {},      // teardown
};
```

- `config?: Record<string, any>` and `configure?(config): ICliModule` support configurable modules; implement `ICliConfigurableModule<TConfig>` and return a copy: `configure(config) { return { ...this, config }; }`. Hosts then pass `weatherModule.configure({ units: 'metric' })`.
- Only `apiVersion` and `name` are required. Use the `API_VERSION` constant (core exports `API_VERSION = 2`; scaffolded plugins keep their own copy in `src/lib/version.ts`).
- Removed in 2.0.0-rc.1: `ICliUmdModule`, `bootUmdModule`, `registerProcessor(s)`, `resolveCommandProcessorProvider`, `CliCommandProcessor_TOKEN` and the `processors` input/prop. Always wrap processors in a module.

### ICliCommandProcessor

`ICliCommandProcessor` is the interface every web command implements; only `command` and `processCommand` are required.

```typescript
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliHelloCommandProcessor implements ICliCommandProcessor {
    command = 'hello';
    aliases = ['hi'];
    description = 'Greets someone';
    author = { name: 'Jane Doe', email: 'jane@example.com' };
    version = '1.0.0';
    acceptsRawInput = true;           // text after the command -> command.value / command.positionals
    metadata = { icon: '👋', module: '@acme/cli-hello' };
    parameters = [
        { name: 'shout', aliases: ['s'], description: 'Upper-case the greeting', required: false, type: 'boolean' },
    ];

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const name = command.positionals?.[0] ?? 'world';
        const text = `Hello, ${name}!`;
        context.writer.writeln(command.args['shout'] ? text.toUpperCase() : text);
    }
}
```

All members:

| Member | Type | Purpose |
|---|---|---|
| `command` | `string` | Command word (matched case-insensitively). |
| `aliases?` | `string[]` | Alternative names. |
| `description?` | `string` | Shown by `help`; translated via key `cli.<command>.description`. |
| `author?` | `ICliCommandAuthor` | `{ name, email }`. `DefaultLibraryAuthor` is the Qodalis author; use your own for third-party plugins. |
| `version?` | `string` | Default `'1.0.0'`. |
| `acceptsRawInput?` | `boolean` | Capture text after the command as `command.value` instead of treating it as sub-commands. |
| `valueRequired?` | `boolean` | Like `acceptsRawInput`, and the engine errors (`Value required`) unless a positional value, piped data or named args are given; required-parameter checks are skipped when positional input exists. |
| `metadata?` | `CliProcessorMetadata` | `sealed`, `hidden`, `requireServer`, `module`, `icon`, `requiredCoreVersion`, `requiredCliVersion`, `requireAuth`, `requiredGroups`, `requiredPermissions`, `literalInput` (see the metadata topic). |
| `processors?` | `ICliCommandChildProcessor[]` | Sub-commands (`parent` is set by the engine). |
| `parameters?` | `ICliCommandParameterDescriptor[]` | Flags (`--name value`, `--name=value`, `-n`). |
| `hooks?` | `ICliProcessorHook[]` | `{ when: 'before' \| 'after', execute(context): Promise<void> }`. |
| `stateConfiguration?` | `CliStateConfiguration` | Per-processor persisted state (root processors only). |
| `configurationOptions?` | `ICliConfigurationOption[]` | Settings shown by the `configure` command. |
| `extendsProcessor?` | `boolean` | Wrap an existing processor with the same `command` instead of replacing it. |
| `originalProcessor?` | `ICliCommandProcessor` | Set by the registry when `extendsProcessor` is true; delegate with `this.originalProcessor.processCommand(command, context)`. |
| `processCommand(command, context)` | `Promise<void>` | Runs the command. |
| `writeDescription?(context)` | `void` | Custom long help text. |
| `validateBeforeExecution?(command, context)` | `{ valid, message? }` | Reject a command before it runs; `message` is printed as an error. |
| `initialize?(context)` | `Promise<void>` | Called once at boot (with the processor's own state store). |
| `onData?(data, context)` | `Promise<void>` | Raw terminal input while this processor is the context processor (full-screen apps). |
| `onResize?(cols, rows, context)` | `void` | Terminal resized while in full-screen mode. |
| `onDispose?(context)` | `void` | Full-screen mode ended, terminal disconnected or component destroyed. |

Execution order for one command: parse -> find processor -> global parameter handlers (`--help`, ...) -> extract `value`/`positionals` -> command guards -> `valueRequired` check -> required-parameter and `validator` checks -> `validateBeforeExecution` -> `before` hooks -> `processCommand` -> `after` hooks.

### CliProcessCommand and argument parsing

`CliProcessCommand` is the parsed command passed to `processCommand`: words, flags, positional values and piped data.

```typescript
type CliProcessCommand = {
    command: string;              // command text without flags, e.g. 'todo add'
    chainCommands: string[];      // command words, e.g. ['todo', 'add']
    rawCommand: string;           // the line as typed
    value?: string;               // text after the command/sub-command words (flags removed, quotes kept); only with acceptsRawInput/valueRequired
    positionals?: string[];       // shell-split arguments: quotes removed, escapes applied, flags excluded
    args: Record<string, any>;    // flags, keyed by parameter name AND each alias
    data?: any;                   // piped input from the previous command (`a | b`)
};
```

- Flag forms: `--name=value` (always works), `--name value` / `-n 5` (space form: only when the parameter is declared, its `type` is not `'boolean'`, **and** the processor accepts positional input via `acceptsRawInput` or `valueRequired`; otherwise the value word is taken as a sub-command and the command is not found), `-n5`, `-abc` (= `-a -b -c` when each letter is a declared boolean). A flag without value is `true`.
- Values that look numeric become numbers, `'true'`/`'false'` become booleans. For declared parameters: `type: 'boolean'` maps `true/'true'/'1'/'yes'/'y'/1` to `true`, anything else to `false`; `type: 'array'` collects repeated flags (`--tag a --tag b` -> `['a', 'b']`). Other types keep the parsed value; convert yourself (`Number(command.args['count'])`).
- Undeclared flags still land in `args` under their typed name.
- Read a flag that has aliases with `getParameterValue(descriptor, command.args)` (exported from `@qodalis/cli-core`), or just `command.args['name']` (aliases are mirrored for declared parameters).
- `defaultValue` is shown by `help` only; it is not injected into `args`. Apply it yourself: `const units = command.args['units'] ?? 'metric';`.
- Prefer `command.positionals` to `command.value` (quotes handled, `"my file.txt"` is one argument).

### Parameters

`ICliCommandParameterDescriptor` declares a flag: name, aliases, type, required, default (help only) and an optional validator.

```typescript
import { ICliCommandParameterDescriptor } from '@qodalis/cli-core';

const parameters: ICliCommandParameterDescriptor[] = [
    {
        name: 'count',
        aliases: ['c'],
        description: 'How many items to generate',
        required: false,
        type: 'number',            // 'string' | 'number' | 'boolean' | 'array' | 'object' | string
        defaultValue: 1,           // shown in help; not applied automatically
        validator: (value) =>
            Number(value) > 0 && Number(value) <= 100
                ? { valid: true }
                : { valid: false, message: 'count must be between 1 and 100' },
    },
    { name: 'json', description: 'Print JSON', required: false, type: 'boolean' },
];
```

- Set `acceptsRawInput = true` on a processor whose parameters take values if users should be able to type `--count 5`; without it only `--count=5` works.
- `required: true` parameters are checked only in named-argument mode (no positional value and no piped data); the error is `Missing required parameters: --name`.
- `validator` runs when the flag is present; failures print `Invalid parameters:` with each message and the command does not run.
- Every command also gets the global `--help` handling; a processor declaring a parameter with the same name or alias takes it over.

### Sub-commands

Sub-commands are nested processors in `processors`; the engine walks the command words down the tree and runs the deepest match.

```typescript
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

class NotesAddProcessor implements ICliCommandProcessor {
    command = 'add';
    description = 'Add a note';
    valueRequired = true;                      // `notes add buy milk` -> value 'buy milk'

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        const text = command.positionals!.join(' ');      // quotes removed; command.value keeps them
        const notes: string[] = context.state.getState()['notes'] ?? [];
        context.state.updateState({ notes: [...notes, text] });
        await context.state.persist();
        context.writer.writeSuccess('Note added');
    }
}

class NotesListProcessor implements ICliCommandProcessor {
    command = 'list';
    aliases = ['ls'];
    description = 'List notes';

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext) {
        const notes: string[] = context.state.getState()['notes'] ?? [];
        context.writer.writeList(notes, { ordered: true });
    }
}

export class CliNotesCommandProcessor implements ICliCommandProcessor {
    command = 'notes';
    description = 'Keep short notes';
    processors = [new NotesAddProcessor(), new NotesListProcessor()];
    stateConfiguration = { initialState: { notes: [] } };   // state is owned by the root processor

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        await context.executor.showHelp(command, context);  // `notes` alone prints help
    }
}
```

- Resolution: match the first word against root `command`/`aliases`, then each following word against the current processor's `processors`. If a word matches no child, the command is not found, unless the current processor has no children and `acceptsRawInput`/`valueRequired` is set (then the rest is its value).
- Children share the root processor's state store (`context.state`).
- Translation keys for sub-commands include the path: `cli.notes.add.description`.

### Processor metadata, access control and permissions

`metadata` (`CliProcessorMetadata`) flags how the engine treats a processor: sealing, visibility, server requirement, version requirements and access control.

```typescript
metadata = {
    icon: '🌦',                       // string or CliIcon, shown in help
    module: '@qodalis/cli-weather',  // owning module name
    hidden: false,                   // true: not listed by `help`, still runnable
    sealed: false,                   // true: cannot be replaced/removed (can still be extended)
    requireServer: false,            // the command needs a connected server
    requiredCoreVersion: '2.0.0',    // skip the processor at boot if @qodalis/cli-core is older
    requiredCliVersion: '2.0.0',     // same for @qodalis/cli
    literalInput: false,             // true: pass the whole line verbatim (no pipes, ;, &&, $VAR expansion)
    requireAuth: true,               // a signed-in user is required
    requiredGroups: ['admin'],       // user must be in one of these groups (implies requireAuth)
    requiredPermissions: ['weather:write'], // user must hold all (implies requireAuth)
};
```

- `requireAuth`, `requiredGroups` and `requiredPermissions` are enforced by core guards only when an auth module registers an `ICliAuthorizationService` (e.g. `@qodalis/cli-users`); without one they are informational.
- Declare the permission names your module uses in `ICliModule.permissions` (`{ name: 'weather:write', description: 'Change weather settings' }`) so admins can list and grant them.
- Inside a command, check ad hoc with the authorization service: `context.services.get(ICliAuthorizationService_TOKEN)?.can('weather:write')`.

### Command guards

An `ICliCommandGuard` runs before every command (across all modules) and can block it; contribute guards through `ICliModule.guards`.

```typescript
import { ICliCommandGuard, ICliModule, API_VERSION } from '@qodalis/cli-core';

const businessHoursGuard: ICliCommandGuard = {
    name: 'business-hours',
    priority: 10,                                          // lower runs first
    appliesTo: (processor) => processor.command === 'deploy',
    canActivate: (command, processor, context) => {
        const hour = new Date().getHours();
        return hour >= 9 && hour < 17 ? true : 'deploy is only allowed 09:00-17:00';
    },
};

export const deployModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@acme/cli-deploy',
    processors: [/* ... */],
    guards: [businessHoursGuard],
};
```

- `canActivate` returns `CliCommandGuardResult`: `true`/`undefined` allow; `false` blocks with a default message; a `string` blocks with that message; or `{ allowed: boolean, message?: string }`. May be async.
- A guard that throws blocks the command (fail closed). Blocked commands exit with code -1 and the message printed as an error.

### ICliExecutionContext

`ICliExecutionContext` is the second argument of `processCommand`: the command's access to the terminal, input, state, services, HTTP and process control.

| Member | Use |
|---|---|
| `writer: ICliTerminalWriter` | Output (`writeln`, `writeSuccess`, `writeError`, tables, JSON, ...). |
| `reader: ICliInputReader` | Interactive prompts (`readLine`, `readConfirm`, `readSelect`, ...). |
| `progressBar: ICliPercentageProgressBar` | `show(text?)`, `update(percent, { type?: 'replace' \| 'increment' })`, `setText`, `complete()`, `hide()`. |
| `spinner?: ICliSpinner` | `show(text?)`, `setText(text)`, `hide()`. |
| `textAnimator?: ICliTextAnimator` | `showText(text, { speed?, removeAfterTyping? })` typewriter effect. |
| `notifier: ICliNotifier` | Status line in the panel header: `info`, `success`, `warn`, `error`, `clear`; cleared when the command ends. |
| `state: ICliStateStore` | The processor's state store (see state topic). |
| `clipboard: ICliClipboard` | `write(text)`, `read()`. |
| `http: ICliHttpClient` | HTTP client wired to the command's abort signal. |
| `services: ICliServiceProvider` | DI container (`get`, `getRequired`, `getAll`, `has`, `set`). |
| `translator: ICliTranslationService` | `t(key, defaultValue, params?)`, `getLocale()`. |
| `executor: ICliCommandExecutorService` | `showHelp(command, context)`, `executeCommand(line, context)`. |
| `process: ICliExecutionProcess` | `exit(code?, { silent? })` ends the command (it throws to unwind unless `silent`), `output(data)` sets pipe data. |
| `signal?: AbortSignal` / `onAbort: Subject<void>` | Ctrl+C / kill; check for cooperative cancellation. |
| `backgroundServices: ICliBackgroundServiceRegistry` | Register/start daemons and jobs. |
| `events?: ICliEventBus` | Terminal event bus. |
| `logger: ICliLogger` | `log`, `info`, `warn`, `error`, `debug`. |
| `options?: CliOptions` | Host options (servers, logLevel, ...). |
| `userSession?: ICliUserSession` | Current user session, when an auth module is present. |
| `terminal: Terminal` | The raw xterm.js terminal (`cols`, `rows`, `write`). |
| `enterFullScreenMode(processor, { showCursor? })` / `exitFullScreenMode()` | Alternate screen; input routed to `processor.onData`. |
| `createInterval(cb, ms)` / `createTimeout(cb, ms)` | Managed timers, cleared on full-screen exit and destroy. |
| `setContextProcessor(processor, silent?, fullScreen?)` | Route subsequent input to a processor. |
| `submitCommand(line)` | Run a line as if typed (history + prompt). |
| `promptPathProvider?` | Set to `() => string \| null` to change the path shown in the prompt. |
| `showPrompt`, `currentLine`, `setCurrentLine`, `cursorPosition`, `clearLine`, `clearCurrentLine`, `refreshCurrentLine`, `promptLength` | Low-level line editing. |
| `isBooted?` | `true` once boot finished. |

```typescript
async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
    context.spinner?.show('Loading');
    try {
        const items = await context.http.get<{ name: string }[]>('https://api.example.com/items');
        context.spinner?.hide();
        context.writer.writeObjectsAsTable(items);
        context.process.output(items);              // available to the next command in a pipe
    } catch (e) {
        context.spinner?.hide();
        context.writer.writeError(`Request failed: ${e}`);
        context.process.exit(1);
    }
}
```

### Writer API

`context.writer` (`ICliTerminalWriter`) writes text, colors, tables, lists, JSON, boxes and links to the terminal.

```typescript
import { CliForegroundColor } from '@qodalis/cli-core';

const w = context.writer;
w.write('no newline');
w.writeln('line');                                   // writeln() alone prints an empty line
w.writeSuccess('Done');
w.writeInfo('FYI');
w.writeWarning('Careful');
w.writeError('Failed');                              // stderr in tests
w.writeln(w.wrapInColor('cyan text', CliForegroundColor.Cyan));
w.wrapInBackgroundColor('text', CliBackgroundColor.Blue);
w.writeJson({ a: 1 });                               // pretty, colorized
w.writeTable(['Name', 'Size'], [['a.txt', '1 KB']]);
w.writeObjectsAsTable([{ name: 'a', size: 1 }]);
w.writeList(['one', 'two'], { ordered: true, prefix: '-', color: CliForegroundColor.Green });
w.writeKeyValue({ Status: 'ok', Version: '1.0' }, { separator: ':', keyColor: CliForegroundColor.Yellow });
w.writeColumns(['a', 'b', 'c', 'd'], { columns: 2, padding: 2 });
w.writeDivider({ char: '-', length: 40, color: CliForegroundColor.White });
w.writeBox(['Line 1', 'Line 2'], { title: 'Notice', borderColor: CliForegroundColor.Cyan, padding: 1 });
w.writeLink('Docs', 'https://cli.qodalis.com');
w.writeIndented('indented', 2);                      // 2 spaces per level
w.writeToFile('report.txt', 'content');              // browser download
```

- Colors: `CliForegroundColor` / `CliBackgroundColor` enums (`Black`, `Red`, `Green`, `Yellow`, `Blue`, `Magenta`, `Cyan`, `White`, `Reset`).
- Use `\r\n` or `writeln` for new lines; xterm needs carriage returns with raw `write`.

### Input reader

`context.reader` (`ICliInputReader`) shows interactive prompts; every method resolves `null` when the user aborts (Ctrl+C or Escape).

```typescript
const name = await context.reader.readLine('Name: ', {
    default: 'guest',
    placeholder: 'your name',
    validate: (v) => (v.trim() ? null : 'Name is required'),   // string = error, null = ok
});
if (name === null) return;                                       // aborted

const password = await context.reader.readPassword('Password: ');
const ok = await context.reader.readConfirm('Continue?', true);  // boolean | null
const env = await context.reader.readSelect('Environment:', [
    { label: 'Production', value: 'prod', description: 'live', group: 'Remote' },
    { label: 'Staging', value: 'stage', group: 'Remote' },
    { label: 'Local', value: 'local', disabled: true },
], { default: 'stage', searchable: true, onChange: (v) => {} });
const size = await context.reader.readSelectInline('Size:', [
    { label: 'S', value: 's' }, { label: 'M', value: 'm' },
]);
const tags = await context.reader.readMultiSelect('Tags:', [
    { label: 'bug', value: 'bug', checked: true }, { label: 'feature', value: 'feature' },
], { searchable: true });                                        // string[] | null
const count = await context.reader.readNumber('Count:', { min: 1, max: 10, default: 3 });
const date = await context.reader.readDate('Due date:', { format: 'YYYY-MM-DD', min: '2026-01-01' });
const files = await context.reader.readFile('Pick a file', { multiple: false });  // CliFileResult[] | null
```

### State store and persistence

Each root processor gets its own state store (`context.state`) configured by `stateConfiguration`; sub-commands share their root's store.

```typescript
export class CliCounterCommandProcessor implements ICliCommandProcessor {
    command = 'counter';
    stateConfiguration = {
        initialState: { count: 0 },
        storeName: 'counter',     // default: the command name
        autoPersist: true,        // save after every change (else call persist())
        scope: 'global' as const, // 'global' (browser, all tabs) | 'user' (per signed-in user) | 'session' (this terminal, memory)
        version: 1,
        migrate: (state, fromVersion) => state,
        syncAcrossTabs: true,
    };

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext) {
        const { count } = context.state.getState<{ count: number }>();
        context.state.updateState({ count: count + 1 });
        // or: await context.state.update((s) => ({ count: s['count'] + 1 }));
        context.writer.writeln(`count = ${count + 1}`);
    }
}
```

- `ICliStateStore`: `getState<T>()`, `updateState(partial)`, `update(fn)`, `select(selector)` (Observable), `subscribe(cb)`, `reset()`, `persist()`, `initialize()`, `reload?()`.
- `configurationOptions` values (set with `configure`) are read with `getPluginConfigValue(context, '<command>', '<key>', defaultValue)` from `@qodalis/cli-core`.

### Configuration options

`configurationOptions` exposes processor settings in the built-in `configure` command (interactive menu and `configure get/set`).

```typescript
import { getPluginConfigValue, ICliConfigurationOption } from '@qodalis/cli-core';

configurationOptions: ICliConfigurationOption[] = [
    { key: 'units', label: 'Units', description: 'Temperature units', type: 'select', defaultValue: 'metric',
      options: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }] },
    { key: 'maxDays', label: 'Max days', description: 'Forecast length', type: 'number', defaultValue: 3,
      validator: (v) => (v >= 1 && v <= 7 ? { valid: true } : { valid: false, message: '1-7' }) },
];

// in processCommand
const units = getPluginConfigValue(context, 'weather', 'units', 'metric');
```

- Option `type`: `'string' | 'number' | 'boolean' | 'select'`; `category` overrides the grouping (default: the processor's command name, which is also the category passed to `getPluginConfigValue`).

### Services and dependency injection

Modules register services with `services: CliProvider[]`; commands resolve them from `context.services` by token.

```typescript
import { API_VERSION, createCliToken, ICliModule } from '@qodalis/cli-core';

export interface IWeatherApi { current(city: string): Promise<string>; }
export const IWeatherApi_TOKEN = createCliToken<IWeatherApi>('weather-api');   // typed string token

class WeatherApi implements IWeatherApi {
    constructor(private readonly baseUrl: string) {}
    async current(city: string) { return `${city}: sunny`; }
}

export const weatherModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@acme/cli-weather',
    services: [
        { provide: 'weather-base-url', useValue: 'https://api.example.com' },
        { provide: IWeatherApi_TOKEN, useClass: WeatherApi, deps: ['weather-base-url'] },
        // { provide: TOKEN, useFactory: (url: string) => new WeatherApi(url), deps: ['weather-base-url'] },
        // { provide: TOKEN, useValue: x, multi: true }   // multi-provider: read with getAll
    ],
    processors: [/* ... */],
};

// in processCommand
const api = context.services.getRequired(IWeatherApi_TOKEN);   // throws if missing; get() returns undefined
```

- `CliProvider` = `{ provide, sealed?, transient?, multi? }` plus one of `useValue`, `useClass` (+ `deps`), `useFactory` (+ `deps`). `useClass`/`useFactory` are created lazily on first `get`, so `deps` may be registered later.
- `sealed: true` prevents overriding the token; `transient: true` creates a new instance per `get`.
- Well-known tokens are exported from `@qodalis/cli-core` (e.g. `ICliAuthorizationService_TOKEN`, `ICliCommandGuard_TOKEN`, `ICliServerAuthTokenProvider_TOKEN`, `ICliTranslationService_TOKEN`).

### Translations (i18n)

Plugins ship translations in `ICliModule.translations` and translate at runtime with `context.translator.t(key, englishDefault, params?)`.

```typescript
export const weatherModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@acme/cli-weather',
    processors: [new CliWeatherCommandProcessor()],
    translations: {
        es: { 'cli.weather.description': 'Mostrar el tiempo', 'cli.weather.now': 'Ahora en {city}' },
        fr: { 'cli.weather.description': 'Afficher la météo', 'cli.weather.now': 'Maintenant à {city}' },
    },
};

// in processCommand: English default inline, {param} interpolation
context.writer.writeln(context.translator.t('cli.weather.now', 'Now in {city}', { city }));
```

- `help` translates descriptions automatically with key `cli.<command path>.description` (e.g. `cli.weather.forecast.description`).
- Locale codes used by the official language packs: `de`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `ro`, `ru`, `zh`. Missing keys fall back to the default string.

### HTTP client

`context.http` (`ICliHttpClient`) is a fetch wrapper that parses JSON, throws `CliHttpError` on non-2xx and aborts on Ctrl+C.

```typescript
import { CliHttpError } from '@qodalis/cli-core';

try {
    const user = await context.http.get<{ name: string }>('https://api.example.com/me', { timeout: 5000 });
    await context.http.post('https://api.example.com/items', { name: 'x' }, { headers: { 'X-Key': 'k' } });
} catch (e) {
    if (e instanceof CliHttpError) context.writer.writeError(`${e.status} ${e.statusText}`);
    else throw e;
}
```

- Methods: `fetch(url, init?)` (raw `Response`), `get`, `post(url, body?)`, `put`, `patch`, `delete`, `head` (returns `Response`), `options`. Options extend `RequestInit` (minus `method`/`body`) with `timeout` (ms).

### Background services and jobs

`context.backgroundServices` runs daemons (long-lived) and jobs (one-shot) outside the command, on the main thread or in a Web Worker.

```typescript
export const heartbeatModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@acme/cli-heartbeat',
    async onAfterBoot(context) {
        context.backgroundServices.register({
            name: 'heartbeat',
            description: 'Logs every 10s',
            type: 'daemon',                                   // 'daemon' | 'job'
            async onStart(ctx) {
                ctx.createInterval(() => ctx.log('beat'), 10000);
                ctx.emit({ source: 'heartbeat', type: 'started' });
            },
            async onStop(ctx) { ctx.log('stopped'); },
            onError(error, ctx) { ctx.log(error.message, 'error'); },
        });
        await context.backgroundServices.start('heartbeat');
    },
};

// one-shot job from a command
await context.backgroundServices.startJob('export', async (ctx) => {
    ctx.log('exporting...');
    if (ctx.signal.aborted) return;
});
```

- `ICliServiceContext` (`ctx`): `signal`, `emit(event)`, `log(message, level?)` (`'info' | 'warn' | 'error'`), `createInterval`, `createTimeout`, `state`, `services`.
- Registry: `register`, `start(name)`, `stop(name)`, `restart(name)`, `startJob(name, task, { workerCompatible? })`, `getStatus(name)`, `list()`, `getLogs(name, limit?)`, `on(handler, { source?, type? })` (returns unsubscribe), `destroyAll()`.
- Worker mode: set `workerCompatible: true` and `workerFactory: () => new Worker(...)`; `onStart` is the main-thread fallback. Users manage services with the built-in `services` command.

### Full-screen mode and raw input

A processor can take over the terminal (games, editors, pagers) with `enterFullScreenMode`, receiving every keystroke in `onData`.

```typescript
export class CliClockCommandProcessor implements ICliCommandProcessor {
    command = 'clock';
    description = 'Full-screen clock (q to quit)';
    private context?: ICliExecutionContext;

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        this.context = context;
        context.enterFullScreenMode(this);                    // alternate screen, cursor hidden
        this.render();
        context.createInterval(() => this.render(), 1000);    // cleared automatically on exit
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (data === 'q' || data === '\x1b') context.exitFullScreenMode();   // also restores the prompt
    }

    onResize(cols: number, rows: number): void { this.render(); }

    onDispose(): void { this.context = undefined; }

    private render(): void {
        const t = this.context?.terminal;
        if (!t) return;
        t.write('\x1b[H\x1b[2J');                             // home + clear
        t.write(new Date().toLocaleTimeString());
    }
}
```

- `onData` receives raw sequences: arrows `\x1b[A`/`\x1b[B`/`\x1b[C`/`\x1b[D`, Enter `\r`, Backspace `\x7f`, Escape `\x1b`, Ctrl+C `\x03` (passed through in full-screen mode).
- Pass `{ showCursor: true }` for REPL-style UIs.

### Extending an existing command

Set `extendsProcessor = true` to wrap a processor registered with the same `command` and delegate to `originalProcessor`.

```typescript
export class EchoTimestampProcessor implements ICliCommandProcessor {
    command = 'echo';
    extendsProcessor = true;
    acceptsRawInput = true;
    originalProcessor?: ICliCommandProcessor;              // set by the registry

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        context.writer.write(`[${new Date().toISOString()}] `);
        await this.originalProcessor?.processCommand(command, context);
    }
}
```

- Without `extendsProcessor`, registering a processor with an existing command replaces it (unless the existing one has `metadata.sealed`).

### Registering a module in a host app

Hosts pass plugin modules to the terminal: Angular DI or `[modules]`, React/Vue `modules` prop, or `CliEngine.registerModule` in plain TypeScript.

```typescript
// Angular (NgModule)
import { CliModule, resolveCliModuleProvider } from '@qodalis/angular-cli';
import { guidModule } from '@qodalis/cli-guid';

@NgModule({
    imports: [BrowserModule, CliModule],
    providers: [resolveCliModuleProvider(guidModule), resolveCliModuleProvider(weatherModule)],
})
export class AppModule {}
// template: <cli></cli> or <cli-panel></cli-panel>; or pass [modules]="modules" on either
```

```tsx
// React
import { Cli, CliConfigProvider } from '@qodalis/react-cli';

<Cli modules={[guidModule, weatherModule]} />
// or share config: <CliConfigProvider modules={modules} options={options}><Cli /></CliConfigProvider>
```

```html
<!-- Vue 3 -->
<script setup lang="ts">
import { Cli } from '@qodalis/vue-cli';
const modules = [guidModule, weatherModule];
</script>
<template>
  <Cli :modules="modules" />
</template>
```

```typescript
// Vanilla TypeScript
import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import { CliLogLevel } from '@qodalis/cli-core';

const engine = new CliEngine(document.getElementById('terminal')!, { logLevel: CliLogLevel.INFO });
engine.registerModule(weatherModule);          // or registerModules([...]); before start()
await engine.start();
```

- `<CliPanel>` (React/Vue) and `<cli-panel>` (Angular) accept the same `modules`.
- Configured modules: pass `weatherModule.configure({ ... })` instead of `weatherModule`.

### Runtime installation with pkg add (UMD)

Published plugins can be installed in a running terminal with `pkg add @qodalis/cli-<name>`, which loads the plugin's IIFE bundle and boots its module.

```bash
pkg add @qodalis/cli-weather     # alias: packages add
pkg ls
pkg remove @qodalis/cli-weather
```

```typescript
// src/cli-entrypoint.ts (bundled to dist/umd/index.global.js by tsup, format 'iife')
import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliWeatherCommandProcessor } from './lib/processors/cli-weather-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-weather',
    processors: [new CliWeatherCommandProcessor()],
};

bootCliModule(module);
```

- `package.json` fields `umd` and `unpkg` point at the IIFE bundle; packages are fetched from unpkg/jsdelivr by default (`CliOptions.packageSources` adds sources).
- `bootCliModule(module)` registers the module with the running terminal's module registry; it does nothing outside a browser terminal.
- UMD bundles must not use Angular decorators; use plain classes.

### Testing with CliTestHarness

`CliTestHarness` (from `@qodalis/cli`) runs commands through the real parser and executor without xterm or DOM, capturing output.

```typescript
import { CliTestHarness } from '@qodalis/cli';
import { CliNotesCommandProcessor } from '../lib/processors/cli-notes-command-processor';
import { CliGreetCommandProcessor } from '../lib/processors/cli-greet-command-processor';

describe('notes', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        harness.registerProcessor(new CliNotesCommandProcessor());
    });

    it('adds and lists notes', async () => {
        await harness.execute('notes add "buy milk"');
        const result = await harness.execute('notes list');
        expect(result.lists[0]).toEqual(['buy milk']);
        expect(result.exitCode).toBe(0);
    });

    it('answers prompts', async () => {
        harness.registerProcessor(new CliGreetCommandProcessor());   // calls readLine then readConfirm
        harness.setReaderResponses('Ada', true);     // consumed in order by readLine, readConfirm, ...
        const result = await harness.execute('greet');
        expect(result.output).toContain('Ada');
    });
});
```

- Result (`CliTestResult`): `stdout: string[]`, `stderr: string[]` (writeError/writeWarning), `output` (stdout joined by `\n`), `exitCode`, `data` (from `process.output`), `tables: { headers, rows }[]`, `lists: string[][]`.
- Harness API: `registerProcessor(p)`, `registerProcessors([...])`, `registerService(token, value)`, `initializeProcessors()`, `setReaderResponses(...values)`, `setUserSession(session)`, `setUserSessionProvider(fn)`, `execute(line)`, plus `registry`, `executor`, `services`, `translator`.
- Pipes work: `harness.execute('echo hello | grep hello')`. State is in memory per harness.
- In the monorepo, tests are Jasmine on Karma (`pnpm nx test <name>`, ChromeHeadless). Test files live in `src/tests/*.spec.ts`.

### Building and publishing a web plugin

Web plugins build with tsup into CJS, ESM, type declarations and an IIFE bundle for runtime loading, then publish to npm.

```bash
# standalone plugin
npx tsup                       # or npm run build -> dist/public-api.{js,mjs,d.ts}, dist/umd/index.global.js
npm publish --access public    # files: ["dist"]

# monorepo plugin
pnpm nx build <name>           # -> dist/<name>/
pnpm nx test <name>
pnpm nx lint <name>
```

- Mark `@qodalis/cli-core` as external in the library build (the scaffolded `tsup.config.ts` does); the IIFE build bundles everything (`noExternal: [/.*/]`).
- `@qodalis/cli-core` is a dependency; standalone plugins pin `^<scaffolder version>` (all `@qodalis/*` web packages share one version).

### Conventions for web plugins

Naming, structure and API-version rules that official and third-party web plugins follow.

- Package `@qodalis/cli-<name>` for official plugins (any scope for third-party); module export `<camelName>Module`; processor class `Cli<Name>CommandProcessor` in `src/lib/processors/cli-<name>-command-processor.ts`; module name = package name.
- Always set `apiVersion: API_VERSION` (2). Plugins depend only on `@qodalis/cli-core` (never on Angular/React/Vue).
- Translation keys: `cli.<command path>.<key>`; always pass the English default to `t()`.
- Use `context.writer` for output (never `console.log`), `context.http` for requests (abort on Ctrl+C), `context.reader` for prompts, `createInterval`/`createTimeout` for timers in full-screen apps.
- Check `null` from every reader method (user aborted). Exit with `context.process.exit(1)` on failure so pipes and `&&` stop (it throws to end the command; code after it does not run).
- TypeScript style in the monorepo: 4-space indent, single quotes, semicolons.
