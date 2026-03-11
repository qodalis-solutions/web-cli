# I18n / Translation Support Design

**Date:** 2026-03-08
**Status:** Approved

## Overview

Add internationalization (i18n) support to the CLI framework. English remains the default language with all current strings preserved as-is. Additional languages are delivered as separate installable language packs. Language selection is managed via the existing `configure` command.

## Architecture

### Core Components

1. **`ICliTranslationService`** (interface in `@qodalis/cli-core`)
   - `t(key: string, defaultValue: string, params?: Record<string, string>): string` — resolve a translation key
   - `getLocale(): string` — current locale code
   - `setLocale(locale: string): void` — change active locale
   - `addTranslations(locale: string, translations: Record<string, string>): void` — register translations
   - `getAvailableLocales(): string[]` — list registered locales

2. **`CliTranslationService`** (implementation in `@qodalis/cli`)
   - Stores translations as `Map<string, Record<string, string>>` (locale -> flat key-value map)
   - English (`en`) is always available — the `defaultValue` argument acts as the English string
   - Supports simple interpolation: `t('key', 'Hello {name}', { name: 'World' })` -> `"Hello World"`
   - Registered in DI via `ICliTranslationService_TOKEN`

3. **`context.translator`** (added to `ICliExecutionContext`)
   - Every command processor accesses translations via `context.translator.t(...)`

4. **Language setting** in `configure` command
   - New system option: `language` (type: `select`, default: `en`)
   - Options populated dynamically from `translator.getAvailableLocales()`
   - Persisted in configure state under `system.language`
   - Applied on boot via `initialize()` and on change via `applySystemSettings()`

### Language Packs

Language packs are separate npm packages following the naming convention `@qodalis/cli-lang-{locale}`:

```typescript
// @qodalis/cli-lang-es
import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN } from '@qodalis/cli-core';

const translations: Record<string, string> = {
    'cli.echo.description': 'Imprime el texto especificado',
    'cli.help.description': 'Muestra la ayuda disponible',
    // ...
};

export const esLanguageModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-es',
    description: 'Spanish language pack',
    async onInit(context) {
        const translator = context.services.get<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('es', translations);
    },
};
```

This pattern means:
- No core code changes needed to add a new language
- Language packs are tree-shakeable — only loaded if imported
- Language packs can be split across plugins (each plugin can ship its own translations in its module's `onInit`)

### Translation Key Convention

Keys follow a hierarchical dot-notation:

```
{package}.{processor}.{field}

Examples:
  cli.echo.description        -> "Prints the specified text"
  cli.configure.description   -> "Manage system and plugin configuration"
  cli.help.usage              -> "Usage:"
  core.errors.unknown_command -> "Unknown command: {command}"
  plugins.guid.description    -> "Generate and manage GUIDs/UUIDs"
```

### Usage in Processors

```typescript
// Static description field — use a getter that reads from translator
get description() {
    return this._translator?.t('cli.echo.description', 'Prints the specified text')
        ?? 'Prints the specified text';
}

// Dynamic strings in processCommand / writeDescription
async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
    const { translator: t } = context;
    context.writer.writeError(t.t('cli.echo.no_input', 'No input provided'));
}
```

For the `description` field (which is read before context is available — e.g., by the help command), the help command will resolve translations at display time by looking up the key if it matches the `{package}.{processor}.{field}` pattern, falling back to the raw string.

**Simpler alternative for description:** The help command already has access to the context. It can call `context.translator.t(processor.description, processor.description)` — if the description is a translation key, it resolves; if it's a plain English string, it returns as-is (since `defaultValue` = the key = the English string for untranslated processors).

### Interpolation

Simple `{param}` replacement:

```typescript
t.t('core.errors.unknown', 'Unknown command: {command}', { command: 'foo' })
// -> "Comando desconocido: foo" (es)
// -> "Unknown command: foo" (en / fallback)
```

### Fallback Chain

1. Look up key in current locale's translations
2. Look up key in `en` translations
3. Return `defaultValue` argument (the English string literal)

This means the system works perfectly with zero language packs installed — all `t()` calls simply return their default value.

## Scope

### Phase 1 (This Implementation)

- `ICliTranslationService` interface + token in `@qodalis/cli-core`
- `CliTranslationService` implementation in `@qodalis/cli`
- Add `translator` to `ICliExecutionContext`
- Add `language` system option to `configure` command
- Migrate built-in CLI processors (`@qodalis/cli`) to use `t()` calls
- Create one example language pack (`@qodalis/cli-lang-es`) as a reference

### Phase 2 (Future)

- Migrate all plugin processors to use `t()` calls
- Community language pack contributions
- Pluralization support
- RTL considerations

## Integration Points

| Component | Change |
|---|---|
| `packages/core/src/lib/interfaces/index.ts` | Add `ICliTranslationService` interface + token |
| `packages/core/src/lib/interfaces/execution-context.ts` | Add `translator: ICliTranslationService` |
| `packages/core/src/public-api.ts` | Export new interface + token |
| `packages/cli/src/lib/services/cli-translation-service.ts` | New: implementation |
| `packages/cli/src/lib/cli-module.ts` (or equivalent bootstrap) | Register service in DI |
| `packages/cli/src/lib/processors/configure/` | Add `language` system option |
| `packages/cli/src/lib/processors/**/*.ts` | Migrate strings to `t()` calls |
| New: `packages/plugins/lang-es/` | Example Spanish language pack |
