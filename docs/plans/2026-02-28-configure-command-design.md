# Configure Command Design

## Overview

A unified `configure` command for the Qodalis CLI that provides both an interactive category-based menu and non-interactive subcommands for managing system preferences and plugin configuration options.

## New Interface: ICliConfigurationOption

Added to `projects/core/src/lib/interfaces/`, declares how plugins expose configurable settings:

```typescript
interface ICliConfigurationOption {
    key: string;              // e.g. 'maxResults'
    label: string;            // e.g. 'Maximum Results'
    description: string;      // e.g. 'Max number of search results to show'
    type: 'string' | 'number' | 'boolean' | 'select';
    defaultValue: any;
    options?: { label: string; value: any }[];  // for type: 'select'
    validator?: (value: any) => { valid: boolean; message?: string };
    category?: string;        // override grouping (defaults to processor command name)
}
```

Added as optional `configurationOptions?: ICliConfigurationOption[]` on `ICliCommandProcessor`.

## Storage

Dedicated IndexedDB store via `stateConfiguration` with store name `'configure'`. State shape:

```typescript
{
    system: {
        logLevel: 'ERROR',
        welcomeMessage: 'always',
        theme: 'default'
    },
    plugins: {
        'todo': { maxItems: 100 },
        'guid': { copyByDefault: false },
    }
}
```

Changes persist immediately on selection. No explicit save step.

## Built-in System Preferences

- `logLevel` — select from None/Debug/Log/Info/Warn/Error
- `welcomeMessage` — select from always/once/daily/never
- `theme` — delegates to `theme apply`

## Interactive Menu Flow

Running `configure` with no arguments opens a category-based menu:

1. **Top level:** Categories — "System" (always first), then one entry per processor with `configurationOptions`, plus "Exit"
2. **Category level:** Lists options with current values in brackets, plus "Back"
3. **Option level:** Input appropriate to type — `readSelect` for select/boolean, `readLine` for string, `readNumber` for number
4. After setting a value, returns to category level
5. Escape/Ctrl+C goes up one level

## Non-Interactive Subcommands

```
configure list                    # Show all config keys with current values
configure get <key>               # Get a single value (dot-notation: system.logLevel)
configure set <key> <value>       # Set a value
configure reset                   # Reset all config to defaults (with confirmation)
configure reset <category>        # Reset a single category
```

Key format: dot-notation — `system.logLevel`, `todo.maxItems`. First segment is category, second is option key.

`configure get` outputs raw value via `process.output()` for piping support.

## Plugin Opt-In

Plugins declare `configurationOptions` on their processor:

```typescript
configurationOptions = [
    {
        key: 'maxItems',
        label: 'Maximum Items',
        description: 'Maximum number of todo items allowed',
        type: 'number' as const,
        defaultValue: 100,
        validator: (v: any) => ({
            valid: v > 0 && v <= 10000,
            message: 'Must be between 1 and 10000',
        }),
    },
];
```

Auto-discovered at runtime by iterating `registry.processors`. No registration step needed.

## Reading Config Values

Utility function exported from core:

```typescript
import { getConfigValue } from '@qodalis/cli-core';

const maxItems = getConfigValue(context, 'todo', 'maxItems', 100);
```

Reads from the configure store in IndexedDB. Falls back to `defaultValue` from the option descriptor.

## Location

Built-in command in `projects/cli/src/lib/processors/configure/`, alongside theme, help, etc. The `ICliConfigurationOption` interface and `getConfigValue` utility go in `projects/core/`.
