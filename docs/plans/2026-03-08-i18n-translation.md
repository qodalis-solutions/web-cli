# I18n Translation Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add internationalization support to the CLI framework with English as default, language packs as separate packages, and language selection via the `configure` command.

**Architecture:** A centralized `ICliTranslationService` registered in DI provides `t(key, defaultValue, params?)` for string resolution. English strings are inline defaults (no separate English pack). Language packs are `ICliModule` implementations that call `translator.addTranslations()` in their `onInit()`. The `configure` command exposes a `language` system option.

**Tech Stack:** TypeScript, existing DI container (`ICliServiceProvider`), existing state persistence (`ICliStateStore`), tsup build system.

---

### Task 1: Add ICliTranslationService Interface and Token to Core

**Files:**
- Modify: `packages/core/src/lib/interfaces/index.ts` (add interface near line 552)
- Modify: `packages/core/src/lib/tokens.ts` (add token after line 23)
- Modify: `packages/core/src/lib/interfaces/execution-context.ts` (add translator field)

**Step 1: Add the token to core tokens**

In `packages/core/src/lib/tokens.ts`, add after the `ICliAuthService_TOKEN`:

```typescript
/**
 * Framework-agnostic token for the CLI translation service.
 * Used as a key in the service provider to retrieve the translation service.
 */
export const ICliTranslationService_TOKEN = 'cli-translation-service';
```

**Step 2: Add the ICliTranslationService interface**

In `packages/core/src/lib/interfaces/index.ts`, add before the `ICliServiceProvider` interface (before line 540):

```typescript
// ---------------------------------------------------------------------------
// Translation service
// ---------------------------------------------------------------------------

export const ICliTranslationService_TOKEN = 'cli-translation-service';

/**
 * Provides internationalization (i18n) support for CLI strings.
 *
 * Usage:
 * ```typescript
 * const msg = context.translator.t('cli.echo.description', 'Prints the specified text');
 * const msg2 = context.translator.t('core.error', 'Unknown: {command}', { command: 'foo' });
 * ```
 */
export interface ICliTranslationService {
    /**
     * Translate a key to the current locale.
     * @param key The translation key (e.g. 'cli.echo.description')
     * @param defaultValue The English fallback string (returned if no translation found)
     * @param params Optional interpolation parameters for `{param}` placeholders
     */
    t(key: string, defaultValue: string, params?: Record<string, string | number>): string;

    /**
     * Get the current locale code (e.g. 'en', 'es', 'fr').
     */
    getLocale(): string;

    /**
     * Set the active locale.
     * @param locale The locale code to switch to
     */
    setLocale(locale: string): void;

    /**
     * Register translations for a locale.
     * Can be called multiple times — translations are merged, with later calls overriding earlier ones.
     * @param locale The locale code
     * @param translations Flat key-value map of translation keys to translated strings
     */
    addTranslations(locale: string, translations: Record<string, string>): void;

    /**
     * Get all locale codes that have at least one registered translation.
     */
    getAvailableLocales(): string[];
}
```

**Important:** Remove the duplicate token from `tokens.ts` — define it only in `interfaces/index.ts` and re-export from `tokens.ts`:

Actually, follow the existing pattern: tokens are in `tokens.ts`. So add the token in `packages/core/src/lib/tokens.ts` and import it in `interfaces/index.ts`. But looking at the codebase, `ICliPermissionService_TOKEN` is defined directly in `interfaces/index.ts` at line 584. Follow that same pattern — define the token directly in `interfaces/index.ts`.

**Step 3: Add `translator` field to ICliExecutionContext**

In `packages/core/src/lib/interfaces/execution-context.ts`, add the import and field:

Add to the import block (line 7):
```typescript
import { ICliTranslationService } from '.';
```

Add after the `services` field (after line 180):
```typescript
    /**
     * The translation service for i18n string resolution.
     * Use `translator.t(key, defaultValue)` to get translated strings.
     */
    translator: ICliTranslationService;
```

**Step 4: Build core to verify compilation**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build core`
Expected: BUILD SUCCESS

**Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add ICliTranslationService interface and token"
```

---

### Task 2: Implement CliTranslationService in CLI Package

**Files:**
- Create: `packages/cli/src/lib/services/cli-translation-service.ts`
- Modify: `packages/cli/src/lib/services/index.ts` (export new service)

**Step 1: Create the translation service implementation**

Create `packages/cli/src/lib/services/cli-translation-service.ts`:

```typescript
import { ICliTranslationService } from '@qodalis/cli-core';

/**
 * Default implementation of the translation service.
 *
 * Maintains a map of locale -> flat key-value translations.
 * The 'en' locale is always implicitly available via defaultValue fallbacks.
 * Supports simple {param} interpolation.
 */
export class CliTranslationService implements ICliTranslationService {
    private locale = 'en';
    private readonly translations = new Map<string, Record<string, string>>();

    t(
        key: string,
        defaultValue: string,
        params?: Record<string, string | number>,
    ): string {
        let result: string | undefined;

        // 1. Try current locale
        if (this.locale !== 'en') {
            result = this.translations.get(this.locale)?.[key];
        }

        // 2. Try 'en' translations (if explicitly registered)
        if (result === undefined) {
            result = this.translations.get('en')?.[key];
        }

        // 3. Fall back to the default value
        if (result === undefined) {
            result = defaultValue;
        }

        // 4. Interpolate params
        if (params) {
            for (const [paramKey, paramValue] of Object.entries(params)) {
                result = result.replace(
                    new RegExp(`\\{${paramKey}\\}`, 'g'),
                    String(paramValue),
                );
            }
        }

        return result;
    }

    getLocale(): string {
        return this.locale;
    }

    setLocale(locale: string): void {
        this.locale = locale;
    }

    addTranslations(locale: string, translations: Record<string, string>): void {
        const existing = this.translations.get(locale) || {};
        this.translations.set(locale, { ...existing, ...translations });
    }

    getAvailableLocales(): string[] {
        const locales = new Set<string>(['en', ...this.translations.keys()]);
        return [...locales].sort();
    }
}
```

**Step 2: Export from services barrel**

In `packages/cli/src/lib/services/index.ts`, add (this file may not exist as a barrel — check and add export to wherever services are imported from, or to the main public-api):

If the file doesn't have a barrel, just ensure the service is importable. The engine file imports directly from path.

**Step 3: Build cli to verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS (may fail due to `ICliExecutionContext.translator` not being satisfied yet — that's OK, we'll wire it in the next task)

**Step 4: Commit**

```bash
git add packages/cli/src/lib/services/cli-translation-service.ts
git commit -m "feat(cli): implement CliTranslationService"
```

---

### Task 3: Wire Translation Service into Engine and Execution Context

**Files:**
- Modify: `packages/cli/src/lib/engine/cli-engine.ts` (register service ~line 198)
- Modify: `packages/cli/src/lib/context/cli-execution-context.ts` (add translator field)

**Step 1: Add translator field to CliExecutionContext class**

In `packages/cli/src/lib/context/cli-execution-context.ts`:

Add import:
```typescript
import { ICliTranslationService } from '@qodalis/cli-core';
```

Add public field (after `services` field, around line 89):
```typescript
    public readonly translator: ICliTranslationService;
```

In the constructor (after `this.services = deps.services;` around line 122), add:
```typescript
        this.translator = deps.translator;
```

Update `CliExecutionContextDeps` interface (line 51-56) to include:
```typescript
export interface CliExecutionContextDeps {
    services: ICliServiceProvider;
    logger: ICliLogger;
    commandHistory: CliCommandHistory;
    stateStoreManager: CliStateStoreManager;
    translator: ICliTranslationService;
}
```

**Step 2: Create and register CliTranslationService in the engine**

In `packages/cli/src/lib/engine/cli-engine.ts`:

Add imports:
```typescript
import { CliTranslationService } from '../services/cli-translation-service';
import { ICliTranslationService_TOKEN } from '@qodalis/cli-core';
```

After services are created (~line 168, after the existing `services.set([...])` block), add:
```typescript
        const translator = new CliTranslationService();
        services.set([
            { provide: ICliTranslationService_TOKEN, useValue: translator },
        ]);
```

Update the `CliExecutionContext` constructor call (~line 218) to pass `translator`:
```typescript
        this.executionContext = new CliExecutionContext(
            { services, logger, commandHistory, stateStoreManager, translator },
            this.terminal,
            executor,
            { ...(this.options ?? {}), terminalOptions },
        );
```

**Step 3: Build both core and cli**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build core && npx nx build cli`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/cli/src/lib/engine/cli-engine.ts packages/cli/src/lib/context/cli-execution-context.ts
git commit -m "feat(cli): wire translation service into engine and execution context"
```

---

### Task 4: Add Language Option to Configure Command

**Files:**
- Modify: `packages/cli/src/lib/processors/configure/cli-configure-command-processor.ts`

**Step 1: Add language to SYSTEM_OPTIONS**

In `packages/cli/src/lib/processors/configure/cli-configure-command-processor.ts`, add to the `SYSTEM_OPTIONS` array (after the `welcomeMessage` option, around line 48):

```typescript
    {
        key: 'language',
        label: 'Language',
        description: 'Display language for the CLI interface',
        type: 'select',
        defaultValue: 'en',
        options: [
            { label: 'English', value: 'en' },
        ],
    },
```

**Step 2: Apply language setting in applySystemSettings**

Add import at top:
```typescript
import { ICliTranslationService, ICliTranslationService_TOKEN } from '@qodalis/cli-core';
```

In the `applySystemSettings` method (around line 398), add after the log level block:

```typescript
        // Apply language
        if (settings['language']) {
            try {
                const translator = context.services.get<ICliTranslationService>(
                    ICliTranslationService_TOKEN,
                );
                translator.setLocale(settings['language']);
            } catch {
                // Translation service not available yet during early boot
            }
        }
```

**Step 3: Dynamically populate language options**

Override the language options at runtime when showing the configure menu. In the `showCategoryMenu` method, before displaying options, if the category is 'system', dynamically update the language option's choices from the translator's available locales.

Add to the `showCategoryMenu` method (around line 214), before the `while` loop:

```typescript
        // Dynamically populate language options from available locales
        if (stateKey === 'system') {
            const langOption = options.find(o => o.key === 'language');
            if (langOption) {
                try {
                    const translator = context.services.get<ICliTranslationService>(
                        ICliTranslationService_TOKEN,
                    );
                    const locales = translator.getAvailableLocales();
                    if (locales.length > 0) {
                        langOption.options = locales.map(l => ({
                            label: this.getLanguageLabel(l),
                            value: l,
                        }));
                    }
                } catch {
                    // ignore
                }
            }
        }
```

Add a helper method to the class:

```typescript
    private getLanguageLabel(locale: string): string {
        const labels: Record<string, string> = {
            en: 'English',
            es: 'Español',
            fr: 'Français',
            de: 'Deutsch',
            pt: 'Português',
            it: 'Italiano',
            ja: '日本語',
            ko: '한국어',
            zh: '中文',
            ru: 'Русский',
            ar: 'العربية',
            ro: 'Română',
        };
        return labels[locale] || locale;
    }
```

**Step 4: Build and verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/processors/configure/
git commit -m "feat(cli): add language option to configure command"
```

---

### Task 5: Migrate Built-in CLI Processors to Use t() Calls

**Files:**
- Modify: All processor files in `packages/cli/src/lib/processors/`

This is the largest task. Migrate the `description` fields and `writeDescription()` methods to use translation keys.

**Strategy for `description` field:** Since `description` is a static property read by the help command before execution context exists, we have two options:
1. Keep `description` as the English string and translate it in the help command when rendering
2. Use a getter that calls the translation service

Option 1 is simpler and requires fewer changes. The help command already has access to `context.translator`.

**Step 1: Update help command to translate descriptions at render time**

In `packages/cli/src/lib/processors/system/cli-help-command-processor.ts`:

Add a helper method:
```typescript
    private translateDescription(
        description: string | undefined,
        processorCommand: string,
        context: ICliExecutionContext,
    ): string {
        if (!description) return '';
        return context.translator.t(
            `cli.${processorCommand}.description`,
            description,
        );
    }
```

Update the help listing (around line 77-78) to translate:
```typescript
                    const desc = this.translateDescription(
                        processor.description,
                        processor.command,
                        context,
                    );
                    writer.writeln(`    ${icon}  ${name} ${desc}${aliasText}`);
```

Update the detail view (around line 152-153):
```typescript
        if (processor.description) {
            const desc = this.translateDescription(
                processor.description,
                processor.command,
                context,
            );
            writer.writeln(`  ${desc}`);
        }
```

Also update subcommand descriptions (around line 203):
```typescript
                const subDesc = this.translateDescription(
                    sub.description,
                    `${processor.command}.${sub.command}`,
                    context,
                );
                writer.writeln(
                    `    ${subName} ${subDesc}${subAliases}`,
                );
```

Translate the help command's own UI strings:
```typescript
    // Line 84-85: "Shortcuts" header
    writer.writeln(
        `  ${BOLD}${writer.wrapInColor(context.translator.t('cli.help.shortcuts', 'Shortcuts'), CliForegroundColor.Yellow)}${RESET}`,
    );

    // Line 91: hint text
    writer.writeln(
        `  ${DIM}${context.translator.t('cli.help.type', 'Type')}${RESET} ${writer.wrapInColor(context.translator.t('cli.help.help_command', 'help <command>'), CliForegroundColor.Cyan)} ${DIM}${context.translator.t('cli.help.for_details', 'for detailed information')}${RESET}`,
    );

    // Line 102: error
    writer.writeError(context.translator.t('cli.help.unknown_command', 'Unknown command: {command}', { command: commandsToHelp[0] }));

    // Line 166: "Extension chain"
    context.translator.t('cli.help.extension_chain', 'Extension chain')

    // Line 191: "Subcommands"
    context.translator.t('cli.help.subcommands', 'Subcommands')

    // Line 215: "Options"
    context.translator.t('cli.help.options', 'Options')

    // Line 226: "Global options"
    context.translator.t('cli.help.global_options', 'Global options')

    // Line 238: "Requires a connected server"
    context.translator.t('cli.help.requires_server', 'Requires a connected server')
```

**Step 2: Migrate writeDescription() in key processors**

For each processor that has `writeDescription()`, wrap user-visible strings with `context.translator.t()`. Example for `cli-echo-command-processor.ts`:

```typescript
writeDescription(context: ICliExecutionContext): void {
    const { writer, translator: t } = context;
    writer.writeln(t.t('cli.echo.detail', 'Prints text to the terminal'));
    writer.writeln();
    writer.writeln(t.t('cli.echo.usage_header', 'Usage:'));
    // ... etc
}
```

Apply this pattern to all processors that have `writeDescription()`. The key naming convention is:
- `cli.{command}.description` — the short description
- `cli.{command}.detail` — the first line of writeDescription
- `cli.{command}.usage_header` — "Usage:" (shared key: `cli.common.usage`)
- `cli.{command}.examples_header` — "Examples:" (shared key: `cli.common.examples`)

**Common shared keys** (reusable across processors):
```
cli.common.usage = "Usage:"
cli.common.examples = "Examples:"
cli.common.options = "Options:"
cli.common.error.no_input = "No input provided"
cli.common.error.invalid_format = "Invalid format"
```

**Step 3: Migrate configure command strings**

In `cli-configure-command-processor.ts`, wrap all user-facing strings:
- Menu labels: "System", "Exit", "Back"
- Messages: "Set {label} to {value}", "Reset cancelled", "All configuration reset to defaults"
- Error messages: "Invalid format", "Unknown configuration key"

**Step 4: Build everything**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS

**Step 5: Run tests**

Run: `cd /home/nicolas/work/cli-workspace/web-cli && npx nx test cli`
Expected: ALL TESTS PASS

**Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): migrate built-in processors to use translation service"
```

---

### Task 6: Create Example Spanish Language Pack

**Files:**
- Create: `packages/plugins/lang-es/` (full plugin scaffolding)

**Step 1: Scaffold the language pack**

Use the plugin scaffolding tool or create manually:

```bash
cd /home/nicolae/work/cli-workspace/web-cli
mkdir -p packages/plugins/lang-es/src/lib
```

Create `packages/plugins/lang-es/src/lib/translations.ts`:
```typescript
/**
 * Spanish translations for @qodalis/cli built-in commands.
 */
export const esTranslations: Record<string, string> = {
    // ── Help command ────────────────────────────────────────
    'cli.help.description': 'Muestra la ayuda de un comando',
    'cli.help.shortcuts': 'Atajos',
    'cli.help.type': 'Escribe',
    'cli.help.help_command': 'help <comando>',
    'cli.help.for_details': 'para información detallada',
    'cli.help.unknown_command': 'Comando desconocido: {command}',
    'cli.help.extension_chain': 'Cadena de extensiones',
    'cli.help.subcommands': 'Subcomandos',
    'cli.help.options': 'Opciones',
    'cli.help.global_options': 'Opciones globales',
    'cli.help.requires_server': 'Requiere un servidor conectado',

    // ── Common ──────────────────────────────────────────────
    'cli.common.usage': 'Uso:',
    'cli.common.examples': 'Ejemplos:',

    // ── Configure command ───────────────────────────────────
    'cli.configure.description': 'Gestionar la configuración del sistema y los complementos',

    // ── Echo command ────────────────────────────────────────
    'cli.echo.description': 'Imprime el texto especificado',

    // ── Clear command ───────────────────────────────────────
    'cli.clear.description': 'Limpia la terminal',

    // ── Version command ─────────────────────────────────────
    'cli.version.description': 'Muestra la versión',

    // ── History command ─────────────────────────────────────
    'cli.history.description': 'Muestra el historial de comandos',

    // Add more translations as needed...
};
```

Create `packages/plugins/lang-es/src/public-api.ts`:
```typescript
import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { esTranslations } from './lib/translations';

export const langEsModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-es',
    version: '1.0.0',
    description: 'Spanish language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.get<ICliTranslationService>(
            ICliTranslationService_TOKEN,
        );
        translator.addTranslations('es', esTranslations);
    },
};
```

Create `packages/plugins/lang-es/src/cli-entrypoint.ts`:
```typescript
import { bootCliModule } from '@qodalis/cli-core';
import { langEsModule } from './public-api';

bootCliModule(langEsModule);
```

Create `packages/plugins/lang-es/package.json`:
```json
{
    "name": "@qodalis/cli-lang-es",
    "version": "1.0.0",
    "description": "Spanish language pack for Qodalis CLI",
    "peerDependencies": {
        "@qodalis/cli-core": "workspace:*"
    }
}
```

Create `packages/plugins/lang-es/tsup.config.ts` — copy from an existing plugin (e.g., `packages/plugins/guid/tsup.config.ts`) and adjust the package name.

Create `packages/plugins/lang-es/project.json` — copy from an existing plugin and adjust name + output path.

**Step 2: Add path alias to tsconfig.base.json**

Add to `compilerOptions.paths`:
```json
"@qodalis/cli-lang-es": ["dist/lang-es"],
"@qodalis/cli-lang-es/*": ["dist/lang-es/*"]
```

**Step 3: Build the language pack**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build lang-es`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/plugins/lang-es/ tsconfig.base.json
git commit -m "feat: add Spanish language pack (@qodalis/cli-lang-es)"
```

---

### Task 7: Integration Test — Wire Language Pack into Demo App

**Files:**
- Modify: `apps/demo-angular/src/app/app.module.ts` (import lang-es module)

**Step 1: Add the language pack module to the demo Angular app**

In `apps/demo-angular/src/app/app.module.ts`, import and register the lang-es module alongside other plugin modules so it's available at runtime.

**Step 2: Build everything**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build`
Expected: BUILD SUCCESS for all 32 projects

**Step 3: Manual verification**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm run serve:angular-demo`

1. Open http://localhost:4303
2. Type `configure` → select System → verify "Language" option appears with "English" selected
3. Type `configure set system.language es`
4. Type `help` → verify Spanish descriptions appear for translated commands
5. Type `configure set system.language en` → verify English is restored

Kill the dev server after testing.

**Step 4: Commit**

```bash
git add apps/demo-angular/
git commit -m "feat(demo): integrate Spanish language pack for testing"
```

---

### Task 8: Final Build and Cleanup

**Step 1: Full build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build`
Expected: ALL PASS

**Step 2: Run all tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm test`
Expected: ALL PASS

**Step 3: Kill any leftover processes**

```bash
ps aux | grep "nx.js\|karma\|ChromeHeadless" | grep -v grep
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

**Step 4: Final commit if any remaining changes**

```bash
git add -A
git commit -m "chore: final i18n integration cleanup"
```
