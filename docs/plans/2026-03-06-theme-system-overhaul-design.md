# Theme System Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the CLI theme system — fix existing themes, add 18 new themes, introduce theme metadata/categories, and enhance the theme command with search, random, export, and import.

**Architecture:** Theme colors live in `packages/core/src/lib/themes/index.ts` (the `DefaultThemes` map). A new `theme-info.ts` alongside it provides `CliThemeInfo` metadata (category, tags, description) for each theme. The command processor in `packages/cli` consumes both maps. New sub-commands (`search`, `random`, `export`, `import`) are added as nested processors in the existing `CliThemeCommandProcessor`.

**Tech Stack:** TypeScript, xterm.js `ITheme`, Jasmine (Karma), Nx, tsup

---

## Task 1: Complete the `default` theme and rename `yellow`

**Files:**
- Modify: `packages/core/src/lib/themes/index.ts`

**Step 1: Update `default` theme with full 16-color palette**

Replace the sparse default theme (lines 19-25) with a complete, polished dark palette:

```typescript
default: {
    background: '#0c0c0c',
    foreground: '#cccccc',
    cursor: '#cccccc',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#0c0c0c',
    red: '#c50f1f',
    green: '#13a10e',
    yellow: '#c19c00',
    blue: '#0037da',
    magenta: '#881798',
    cyan: '#3a96dd',
    white: '#cccccc',
    brightBlack: '#767676',
    brightRed: '#e74856',
    brightGreen: '#16c60c',
    brightYellow: '#f9f1a5',
    brightBlue: '#3b78ff',
    brightMagenta: '#b4009e',
    brightCyan: '#61d6d6',
    brightWhite: '#f2f2f2',
},
```

This is the Windows Terminal default palette — familiar, well-tested, and complete.

**Step 2: Rename `yellow` to `highContrastLight`**

- Rename the key from `yellow` to `highContrastLight`
- Add `yellow` as an alias pointing to the same object after the definition
- Update the type declaration at the top to include `highContrastLight` and keep `yellow`

```typescript
// In the type declaration, add:
highContrastLight: CliTheme;
// Keep yellow too:
yellow: CliTheme;

// After DefaultThemes definition, the yellow entry becomes:
highContrastLight: {
    background: '#FFFACD',
    foreground: '#000000',
    cursor: '#FFA500',
    // ... same colors as current yellow ...
},

// Then after the object, alias:
// yellow is set inside the object pointing to the same value
```

Actually, since `yellow` is inside the object with an index signature, just keep both keys. Define `highContrastLight` with the colors, then set `yellow` to reference it:

```typescript
// Inside DefaultThemes:
highContrastLight: { /* ... full colors ... */ },
// After highContrastLight definition:
yellow: undefined as any, // placeholder, set below

// After object:
DefaultThemes.yellow = DefaultThemes.highContrastLight;
```

Simpler approach — just duplicate the reference inside the object:

```typescript
highContrastLight: {
    background: '#FFFACD',
    // ... all colors ...
},
```

Then after the object closing: `DefaultThemes.yellow = DefaultThemes.highContrastLight;`

And remove `yellow` from the typed keys (keep it accessible via `[key: string]` index).

**Step 3: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build core`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/core/src/lib/themes/index.ts
git commit -m "feat(themes): complete default palette and rename yellow to highContrastLight"
```

---

## Task 2: Add new theme definitions (18 themes)

**Files:**
- Modify: `packages/core/src/lib/themes/index.ts`

**Step 1: Add all new themes to `DefaultThemes`**

Add these themes inside the `DefaultThemes` object, before the closing brace. Each must have all 16 ANSI colors + background + foreground + cursor. Use accurate color values from each theme's official source.

**Popular Dark themes:**

```typescript
tokyoNight: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    selectionBackground: '#33467c',
    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#414868',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5',
},
catppuccinMocha: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#45475a',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
},
catppuccinFrappe: {
    background: '#303446',
    foreground: '#c6d0f5',
    cursor: '#f2d5cf',
    selectionBackground: '#51576d',
    black: '#51576d',
    red: '#e78284',
    green: '#a6d189',
    yellow: '#e5c890',
    blue: '#8caaee',
    magenta: '#f4b8e4',
    cyan: '#81c8be',
    white: '#b5bfe2',
    brightBlack: '#626880',
    brightRed: '#e78284',
    brightGreen: '#a6d189',
    brightYellow: '#e5c890',
    brightBlue: '#8caaee',
    brightMagenta: '#f4b8e4',
    brightCyan: '#81c8be',
    brightWhite: '#a5adce',
},
rosePine: {
    background: '#191724',
    foreground: '#e0def4',
    cursor: '#524f67',
    selectionBackground: '#2a283e',
    black: '#26233a',
    red: '#eb6f92',
    green: '#31748f',
    yellow: '#f6c177',
    blue: '#9ccfd8',
    magenta: '#c4a7e7',
    cyan: '#ebbcba',
    white: '#e0def4',
    brightBlack: '#6e6a86',
    brightRed: '#eb6f92',
    brightGreen: '#31748f',
    brightYellow: '#f6c177',
    brightBlue: '#9ccfd8',
    brightMagenta: '#c4a7e7',
    brightCyan: '#ebbcba',
    brightWhite: '#e0def4',
},
kanagawa: {
    background: '#1f1f28',
    foreground: '#dcd7ba',
    cursor: '#c8c093',
    selectionBackground: '#2d4f67',
    black: '#16161d',
    red: '#c34043',
    green: '#76946a',
    yellow: '#c0a36e',
    blue: '#7e9cd8',
    magenta: '#957fb8',
    cyan: '#6a9589',
    white: '#c8c093',
    brightBlack: '#727169',
    brightRed: '#e82424',
    brightGreen: '#98bb6c',
    brightYellow: '#e6c384',
    brightBlue: '#7fb4ca',
    brightMagenta: '#938aa9',
    brightCyan: '#7aa89f',
    brightWhite: '#dcd7ba',
},
everforestDark: {
    background: '#2d353b',
    foreground: '#d3c6aa',
    cursor: '#d3c6aa',
    selectionBackground: '#543a48',
    black: '#475258',
    red: '#e67e80',
    green: '#a7c080',
    yellow: '#dbbc7f',
    blue: '#7fbbb3',
    magenta: '#d699b6',
    cyan: '#83c092',
    white: '#d3c6aa',
    brightBlack: '#475258',
    brightRed: '#e67e80',
    brightGreen: '#a7c080',
    brightYellow: '#dbbc7f',
    brightBlue: '#7fbbb3',
    brightMagenta: '#d699b6',
    brightCyan: '#83c092',
    brightWhite: '#d3c6aa',
},
ayuDark: {
    background: '#0b0e14',
    foreground: '#bfbdb6',
    cursor: '#e6b450',
    selectionBackground: '#1b3a4b',
    black: '#01060e',
    red: '#ea6c73',
    green: '#91b362',
    yellow: '#f9af4f',
    blue: '#53bdfa',
    magenta: '#fae994',
    cyan: '#90e1c6',
    white: '#c7c7c7',
    brightBlack: '#686868',
    brightRed: '#f07178',
    brightGreen: '#c2d94c',
    brightYellow: '#ffb454',
    brightBlue: '#59c2ff',
    brightMagenta: '#ffee99',
    brightCyan: '#95e6cb',
    brightWhite: '#ffffff',
},
```

**Popular Light themes:**

```typescript
catppuccinLatte: {
    background: '#eff1f5',
    foreground: '#4c4f69',
    cursor: '#dc8a78',
    selectionBackground: '#acb0be',
    black: '#5c5f77',
    red: '#d20f39',
    green: '#40a02b',
    yellow: '#df8e1d',
    blue: '#1e66f5',
    magenta: '#ea76cb',
    cyan: '#179299',
    white: '#acb0be',
    brightBlack: '#6c6f85',
    brightRed: '#d20f39',
    brightGreen: '#40a02b',
    brightYellow: '#df8e1d',
    brightBlue: '#1e66f5',
    brightMagenta: '#ea76cb',
    brightCyan: '#179299',
    brightWhite: '#bcc0cc',
},
rosePineDawn: {
    background: '#faf4ed',
    foreground: '#575279',
    cursor: '#9893a5',
    selectionBackground: '#dfdad9',
    black: '#f2e9e1',
    red: '#b4637a',
    green: '#286983',
    yellow: '#ea9d34',
    blue: '#56949f',
    magenta: '#907aa9',
    cyan: '#d7827e',
    white: '#575279',
    brightBlack: '#9893a5',
    brightRed: '#b4637a',
    brightGreen: '#286983',
    brightYellow: '#ea9d34',
    brightBlue: '#56949f',
    brightMagenta: '#907aa9',
    brightCyan: '#d7827e',
    brightWhite: '#575279',
},
everforestLight: {
    background: '#fdf6e3',
    foreground: '#5c6a72',
    cursor: '#5c6a72',
    selectionBackground: '#e6e2cc',
    black: '#5c6a72',
    red: '#f85552',
    green: '#8da101',
    yellow: '#dfa000',
    blue: '#3a94c5',
    magenta: '#df69ba',
    cyan: '#35a77c',
    white: '#dfddc8',
    brightBlack: '#708089',
    brightRed: '#f85552',
    brightGreen: '#8da101',
    brightYellow: '#dfa000',
    brightBlue: '#3a94c5',
    brightMagenta: '#df69ba',
    brightCyan: '#35a77c',
    brightWhite: '#e8e5d0',
},
githubLight: {
    background: '#ffffff',
    foreground: '#24292f',
    cursor: '#044289',
    selectionBackground: '#0969da33',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f',
},
```

**Fun/Retro themes:**

```typescript
cyberpunk: {
    background: '#0a0a1a',
    foreground: '#0abdc6',
    cursor: '#ff2079',
    selectionBackground: '#1a1a3a',
    black: '#000000',
    red: '#ff2079',
    green: '#00ff9c',
    yellow: '#fed230',
    blue: '#0abdc6',
    magenta: '#ea00d9',
    cyan: '#0abdc6',
    white: '#c7c7c7',
    brightBlack: '#686868',
    brightRed: '#ff4a9e',
    brightGreen: '#3df5b6',
    brightYellow: '#fef465',
    brightBlue: '#3ff1de',
    brightMagenta: '#ff79f0',
    brightCyan: '#3ff1de',
    brightWhite: '#ffffff',
},
retroGreen: {
    background: '#0a0a0a',
    foreground: '#33ff00',
    cursor: '#33ff00',
    selectionBackground: '#1a3a1a',
    black: '#0a0a0a',
    red: '#ff0000',
    green: '#33ff00',
    yellow: '#ffff00',
    blue: '#0066ff',
    magenta: '#cc00ff',
    cyan: '#00ffff',
    white: '#33ff00',
    brightBlack: '#1a5c1a',
    brightRed: '#ff3333',
    brightGreen: '#66ff33',
    brightYellow: '#ffff66',
    brightBlue: '#3399ff',
    brightMagenta: '#e550ff',
    brightCyan: '#66ffff',
    brightWhite: '#66ff33',
},
retroAmber: {
    background: '#0a0a00',
    foreground: '#ffb000',
    cursor: '#ffb000',
    selectionBackground: '#3a2a00',
    black: '#0a0a00',
    red: '#ff0000',
    green: '#ffb000',
    yellow: '#ffcc00',
    blue: '#cc8800',
    magenta: '#ff8800',
    cyan: '#ffcc66',
    white: '#ffb000',
    brightBlack: '#665500',
    brightRed: '#ff3333',
    brightGreen: '#ffc033',
    brightYellow: '#ffdd33',
    brightBlue: '#ddaa33',
    brightMagenta: '#ffaa33',
    brightCyan: '#ffdd99',
    brightWhite: '#ffc033',
},
matrix: {
    background: '#000000',
    foreground: '#00ff41',
    cursor: '#00ff41',
    selectionBackground: '#003300',
    black: '#000000',
    red: '#00ff41',
    green: '#00ff41',
    yellow: '#00ff41',
    blue: '#00cc33',
    magenta: '#009926',
    cyan: '#00ff41',
    white: '#00ff41',
    brightBlack: '#005500',
    brightRed: '#33ff66',
    brightGreen: '#33ff66',
    brightYellow: '#33ff66',
    brightBlue: '#00ff41',
    brightMagenta: '#00cc33',
    brightCyan: '#33ff66',
    brightWhite: '#66ff88',
},
synthwave: {
    background: '#2b213a',
    foreground: '#f0e4fc',
    cursor: '#72f1b8',
    selectionBackground: '#463465',
    black: '#2b213a',
    red: '#fe4450',
    green: '#72f1b8',
    yellow: '#fede5d',
    blue: '#2ee2fa',
    magenta: '#ff7edb',
    cyan: '#03edf9',
    white: '#f0e4fc',
    brightBlack: '#614d85',
    brightRed: '#fe4450',
    brightGreen: '#72f1b8',
    brightYellow: '#fede5d',
    brightBlue: '#2ee2fa',
    brightMagenta: '#ff7edb',
    brightCyan: '#03edf9',
    brightWhite: '#ffffff',
},
```

**Accessibility themes:**

```typescript
highContrastDark: {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#3b78ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
    brightBlack: '#808080',
    brightRed: '#ff3333',
    brightGreen: '#33ff33',
    brightYellow: '#ffff33',
    brightBlue: '#6699ff',
    brightMagenta: '#ff33ff',
    brightCyan: '#33ffff',
    brightWhite: '#ffffff',
},
```

Also update the type declaration at the top of the file to include all new theme names.

**Step 2: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build core`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/core/src/lib/themes/index.ts
git commit -m "feat(themes): add 18 new themes across popular, retro, and accessibility categories"
```

---

## Task 3: Create theme metadata (`CliThemeInfo`)

**Files:**
- Create: `packages/core/src/lib/themes/theme-info.ts`
- Modify: `packages/core/src/lib/themes/index.ts` (add re-export)

**Step 1: Create `theme-info.ts`**

```typescript
import { ITheme } from '@xterm/xterm';
import { DefaultThemes } from './index';

export type CliThemeCategory = 'dark' | 'light';

export interface CliThemeInfo {
    theme: ITheme;
    category: CliThemeCategory;
    tags: string[];
    description: string;
}

export const DefaultThemeInfos: Record<string, CliThemeInfo> = {
    default: {
        theme: DefaultThemes.default,
        category: 'dark',
        tags: ['built-in'],
        description: 'Default terminal palette',
    },
    dracula: {
        theme: DefaultThemes.dracula,
        category: 'dark',
        tags: ['popular'],
        description: 'Popular dark theme with vibrant colors',
    },
    monokai: {
        theme: DefaultThemes.monokai,
        category: 'dark',
        tags: ['popular'],
        description: 'Classic code editor dark theme',
    },
    solarizedDark: {
        theme: DefaultThemes.solarizedDark,
        category: 'dark',
        tags: ['popular'],
        description: 'Ethan Schoonover\'s precision dark palette',
    },
    solarizedLight: {
        theme: DefaultThemes.solarizedLight,
        category: 'light',
        tags: ['popular'],
        description: 'Ethan Schoonover\'s precision light palette',
    },
    gruvboxDark: {
        theme: DefaultThemes.gruvboxDark,
        category: 'dark',
        tags: ['popular'],
        description: 'Retro groove dark color scheme',
    },
    gruvboxLight: {
        theme: DefaultThemes.gruvboxLight,
        category: 'light',
        tags: ['popular'],
        description: 'Retro groove light color scheme',
    },
    nord: {
        theme: DefaultThemes.nord,
        category: 'dark',
        tags: ['popular'],
        description: 'Arctic, north-bluish clean palette',
    },
    oneDark: {
        theme: DefaultThemes.oneDark,
        category: 'dark',
        tags: ['popular'],
        description: 'Atom\'s iconic dark theme',
    },
    material: {
        theme: DefaultThemes.material,
        category: 'dark',
        tags: ['popular'],
        description: 'Material Design inspired dark theme',
    },
    highContrastLight: {
        theme: DefaultThemes.highContrastLight,
        category: 'light',
        tags: ['accessibility'],
        description: 'High contrast light theme for accessibility',
    },
    tokyoNight: {
        theme: DefaultThemes.tokyoNight,
        category: 'dark',
        tags: ['popular'],
        description: 'Cool blue-purple dark theme',
    },
    catppuccinMocha: {
        theme: DefaultThemes.catppuccinMocha,
        category: 'dark',
        tags: ['popular', 'pastel'],
        description: 'Soothing pastel dark theme (warmest)',
    },
    catppuccinFrappe: {
        theme: DefaultThemes.catppuccinFrappe,
        category: 'dark',
        tags: ['popular', 'pastel'],
        description: 'Soothing pastel mid-dark theme',
    },
    catppuccinLatte: {
        theme: DefaultThemes.catppuccinLatte,
        category: 'light',
        tags: ['popular', 'pastel'],
        description: 'Soothing pastel light theme',
    },
    rosePine: {
        theme: DefaultThemes.rosePine,
        category: 'dark',
        tags: ['popular'],
        description: 'All natural pine, faux fur, and a bit of soho vibes',
    },
    rosePineDawn: {
        theme: DefaultThemes.rosePineDawn,
        category: 'light',
        tags: ['popular'],
        description: 'Rose Pine light variant',
    },
    kanagawa: {
        theme: DefaultThemes.kanagawa,
        category: 'dark',
        tags: ['popular'],
        description: 'Dark theme inspired by Katsushika Hokusai',
    },
    everforestDark: {
        theme: DefaultThemes.everforestDark,
        category: 'dark',
        tags: ['popular'],
        description: 'Comfortable green-tinted dark theme',
    },
    everforestLight: {
        theme: DefaultThemes.everforestLight,
        category: 'light',
        tags: ['popular'],
        description: 'Comfortable green-tinted light theme',
    },
    ayuDark: {
        theme: DefaultThemes.ayuDark,
        category: 'dark',
        tags: ['popular'],
        description: 'Simple, bright and elegant dark theme',
    },
    githubLight: {
        theme: DefaultThemes.githubLight,
        category: 'light',
        tags: ['popular'],
        description: 'GitHub\'s clean light interface theme',
    },
    cyberpunk: {
        theme: DefaultThemes.cyberpunk,
        category: 'dark',
        tags: ['retro', 'fun'],
        description: 'Neon-lit cyberpunk aesthetic',
    },
    retroGreen: {
        theme: DefaultThemes.retroGreen,
        category: 'dark',
        tags: ['retro', 'fun'],
        description: 'Classic green phosphor CRT monitor',
    },
    retroAmber: {
        theme: DefaultThemes.retroAmber,
        category: 'dark',
        tags: ['retro', 'fun'],
        description: 'Warm amber CRT monitor',
    },
    matrix: {
        theme: DefaultThemes.matrix,
        category: 'dark',
        tags: ['retro', 'fun'],
        description: 'Enter the Matrix — green on black',
    },
    synthwave: {
        theme: DefaultThemes.synthwave,
        category: 'dark',
        tags: ['retro', 'fun'],
        description: '80s synthwave purple/pink aesthetic',
    },
    highContrastDark: {
        theme: DefaultThemes.highContrastDark,
        category: 'dark',
        tags: ['accessibility'],
        description: 'Maximum contrast dark theme',
    },
};
```

**Step 2: Re-export from themes index**

In `packages/core/src/lib/themes/index.ts`, add at the bottom:

```typescript
export * from './theme-info';
```

Since `packages/core/src/public-api.ts` already has `export * from './lib/themes'`, the new exports will be available automatically.

**Step 3: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build core`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/core/src/lib/themes/theme-info.ts packages/core/src/lib/themes/index.ts
git commit -m "feat(themes): add CliThemeInfo metadata with categories, tags, and descriptions"
```

---

## Task 4: Update theme types in CLI package

**Files:**
- Modify: `packages/cli/src/lib/processors/theme/types/index.ts`

**Step 1: Import and re-export theme infos**

Replace the current file contents:

```typescript
import { DefaultThemes, DefaultThemeInfos, CliThemeInfo } from '@qodalis/cli-core';
import { ITheme } from '@xterm/xterm';

export type ThemeState = {
    selectedTheme?: string;
    customOptions?: ITheme;
};

export const themes = {
    ...DefaultThemes,
};

export const themeInfos: Record<string, CliThemeInfo> = {
    ...DefaultThemeInfos,
};
```

**Step 2: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/cli/src/lib/processors/theme/types/index.ts
git commit -m "feat(themes): wire theme infos into CLI package types"
```

---

## Task 5: Update `theme list` with dark/light grouping

**Files:**
- Modify: `packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts`

**Step 1: Update the `list` sub-command processor**

Replace the `list` processCommand (lines 94-123) with grouped output:

```typescript
processCommand: async (
    _: CliProcessCommand,
    context: ICliExecutionContext,
) => {
    const state = context.state.getState<ThemeState>();
    const currentName = state.selectedTheme || '';

    const darkThemes = Object.entries(themeInfos).filter(
        ([, info]) => info.category === 'dark',
    );
    const lightThemes = Object.entries(themeInfos).filter(
        ([, info]) => info.category === 'light',
    );

    const renderGroup = (
        label: string,
        entries: [string, CliThemeInfo][],
    ) => {
        context.writer.writeln(
            context.writer.wrapInColor(
                `  ${label}`,
                CliForegroundColor.Yellow,
            ),
        );
        context.writer.writeln();
        for (const [name, info] of entries) {
            const active =
                name === currentName ? ' (active)' : '';
            const swatches = PALETTE_KEYS.map((k) =>
                colorSwatch(info.theme[k] as string),
            ).join('');
            const label = context.writer.wrapInColor(
                name.padEnd(22),
                CliForegroundColor.Cyan,
            );
            context.writer.writeln(
                `    ${swatches} ${label} ${info.description}${active}`,
            );
        }
        context.writer.writeln();
    };

    context.writer.writeln('Available themes:');
    context.writer.writeln();
    renderGroup('Dark', darkThemes);
    renderGroup('Light', lightThemes);

    context.writer.writeInfo(
        `Use ${context.writer.wrapInColor('theme apply <name>', CliForegroundColor.Cyan)} or ${context.writer.wrapInColor('theme apply', CliForegroundColor.Cyan)} to select interactively`,
    );
},
```

Also add the import for `themeInfos` and `CliThemeInfo` at the top of the file:

```typescript
import { themes, ThemeState, themeInfos } from './types';
import { CliThemeInfo } from '@qodalis/cli-core';
```

**Step 2: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts
git commit -m "feat(themes): group theme list by dark/light with descriptions"
```

---

## Task 6: Add `theme search` sub-command

**Files:**
- Modify: `packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts`

**Step 1: Add `search` sub-processor**

Add this to the `this.processors` array in the constructor, after `preview`:

```typescript
{
    command: 'search',
    description: 'Search themes by name, tag, or description',
    valueRequired: true,
    processCommand: async (
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ) => {
        const query = command.value!.toLowerCase();
        const matches = Object.entries(themeInfos).filter(
            ([name, info]) =>
                name.toLowerCase().includes(query) ||
                info.description.toLowerCase().includes(query) ||
                info.tags.some((t) => t.toLowerCase().includes(query)),
        );

        if (matches.length === 0) {
            context.writer.writeWarning(
                `No themes matching "${command.value}"`,
            );
            return;
        }

        context.writer.writeln(
            `Found ${matches.length} theme${matches.length > 1 ? 's' : ''} matching "${command.value}":`,
        );
        context.writer.writeln();

        for (const [name, info] of matches) {
            const swatches = PALETTE_KEYS.map((k) =>
                colorSwatch(info.theme[k] as string),
            ).join('');
            const label = context.writer.wrapInColor(
                name.padEnd(22),
                CliForegroundColor.Cyan,
            );
            const tags = info.tags
                .map((t) =>
                    context.writer.wrapInColor(
                        `#${t}`,
                        CliForegroundColor.Magenta,
                    ),
                )
                .join(' ');
            context.writer.writeln(
                `  ${swatches} ${label} ${info.description}  ${tags}`,
            );
        }
    },
},
```

**Step 2: Update `writeDescription` help text**

Add the search usage line to the help output (after the preview line):

```typescript
writer.writeln(
    `  ${writer.wrapInColor('theme search <keyword>', CliForegroundColor.Cyan)}           Search themes by name, tag, or description`,
);
```

And add a search example:

```typescript
writer.writeln(
    `  theme search retro                ${writer.wrapInColor('# Find retro-style themes', CliForegroundColor.Green)}`,
);
```

**Step 3: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts
git commit -m "feat(themes): add theme search sub-command"
```

---

## Task 7: Add `theme random` sub-command

**Files:**
- Modify: `packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts`

**Step 1: Add `random` sub-processor**

Add after the `search` processor in the array:

```typescript
{
    command: 'random',
    description:
        'Apply a random theme (optionally filter by "dark" or "light")',
    processCommand: async (
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ) => {
        const filter = command.value?.toLowerCase() as
            | 'dark'
            | 'light'
            | undefined;
        let candidates = Object.entries(themeInfos);

        if (filter === 'dark' || filter === 'light') {
            candidates = candidates.filter(
                ([, info]) => info.category === filter,
            );
        }

        const [name, info] =
            candidates[
                Math.floor(Math.random() * candidates.length)
            ];

        context.terminal.options.theme = info.theme;

        context.state.updateState({
            selectedTheme: name,
            customOptions: null,
        });

        await context.state.persist();
        this.applyStyles(context);

        context.writer.writeSuccess(
            `Random theme "${name}" applied`,
        );
    },
},
```

**Step 2: Update help text**

Add usage and example lines for `random`.

**Step 3: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts
git commit -m "feat(themes): add theme random sub-command"
```

---

## Task 8: Add `theme export` sub-command

**Files:**
- Modify: `packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts`

**Step 1: Add `export` sub-processor**

Add after `random`:

```typescript
{
    command: 'export',
    description: 'Export the current theme as JSON',
    processCommand: async (
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ) => {
        const currentTheme = context.terminal.options.theme;
        const json = JSON.stringify(currentTheme, null, 2);

        context.writer.writeln(json);

        context.process.output({ json });
    },
},
```

**Step 2: Update help text**

**Step 3: Verify build and commit**

```bash
git add packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts
git commit -m "feat(themes): add theme export sub-command"
```

---

## Task 9: Add `theme import` sub-command

**Files:**
- Modify: `packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts`

**Step 1: Add `import` sub-processor**

Add after `export`:

```typescript
{
    command: 'import',
    description: 'Import a theme from JSON',
    processCommand: async (
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ) => {
        context.writer.writeln(
            'Paste your theme JSON (single line or multi-line, then press Enter on an empty line):',
        );

        let jsonStr = '';
        while (true) {
            const line = await context.reader.readLine('');
            if (line === null || line.trim() === '') break;
            jsonStr += line;
        }

        if (!jsonStr.trim()) {
            context.writer.writeWarning('Import cancelled — no input');
            return;
        }

        let imported: ITheme;
        try {
            imported = JSON.parse(jsonStr);
        } catch {
            context.writer.writeError(
                'Invalid JSON. Please provide a valid theme object.',
            );
            return;
        }

        if (
            typeof imported !== 'object' ||
            imported === null ||
            !imported.background ||
            !imported.foreground
        ) {
            context.writer.writeError(
                'Theme must be an object with at least "background" and "foreground" properties.',
            );
            return;
        }

        context.terminal.options.theme = imported;

        context.state.updateState({
            selectedTheme: null,
            customOptions: imported,
        });

        await context.state.persist();
        this.applyStyles(context);

        context.writer.writeSuccess('Custom theme imported and applied');
    },
},
```

**Step 2: Update help text**

**Step 3: Verify build and commit**

```bash
git add packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts
git commit -m "feat(themes): add theme import sub-command"
```

---

## Task 10: Update tab completion for new themes

**Files:**
- Modify: `packages/cli/src/lib/completion/cli-theme-name-completion-provider.ts`

**Step 1: Add `search` and `random` to sub-commands that accept theme-related values**

The completion provider already dynamically reads `Object.keys(DefaultThemes)`, so new theme names are picked up automatically. However, `search` should also trigger completions for tag names, and `random` for `dark`/`light`.

Update the file:

```typescript
import {
    ICliCompletionProvider,
    ICliCompletionContext,
    DefaultThemes,
} from '@qodalis/cli-core';

const THEME_NAME_SUBCOMMANDS = new Set(['preview', 'apply']);
const RANDOM_FILTER_VALUES = ['dark', 'light'];
const SEARCH_TAGS = [
    'popular',
    'retro',
    'fun',
    'pastel',
    'accessibility',
    'built-in',
    'dark',
    'light',
];

export class CliThemeNameCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    private readonly themeNames = Object.keys(DefaultThemes);

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        if (tokenIndex !== 2 || tokens.length < 2) {
            return [];
        }

        const rootCommand = tokens[0].toLowerCase();
        if (rootCommand !== 'theme' && rootCommand !== 'themes') {
            return [];
        }

        const subCommand = tokens[1].toLowerCase();
        const lowerPrefix = token.toLowerCase();

        if (THEME_NAME_SUBCOMMANDS.has(subCommand)) {
            return this.themeNames
                .filter((name) =>
                    name.toLowerCase().startsWith(lowerPrefix),
                )
                .sort();
        }

        if (subCommand === 'random') {
            return RANDOM_FILTER_VALUES.filter((v) =>
                v.startsWith(lowerPrefix),
            );
        }

        if (subCommand === 'search') {
            return SEARCH_TAGS.filter((t) =>
                t.startsWith(lowerPrefix),
            );
        }

        return [];
    }
}
```

**Step 2: Verify build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/cli/src/lib/completion/cli-theme-name-completion-provider.ts
git commit -m "feat(themes): extend tab completion for search, random sub-commands"
```

---

## Task 11: Update `writeDescription` help text

**Files:**
- Modify: `packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts`

**Step 1: Update the `writeDescription` method**

Replace the full method (lines 503-552) with updated help text that includes all new sub-commands:

```typescript
writeDescription?(context: ICliExecutionContext): void {
    const { writer } = context;
    writer.writeln(
        'Customize the terminal appearance with themes and colors',
    );
    writer.writeln();
    writer.writeln('Usage:');
    writer.writeln(
        `  ${writer.wrapInColor('theme list', CliForegroundColor.Cyan)}                     List themes grouped by dark/light`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme apply', CliForegroundColor.Cyan)}                    Select a theme interactively`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme apply <name>', CliForegroundColor.Cyan)}             Apply a theme by name`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme preview <name>', CliForegroundColor.Cyan)}           Preview a theme without applying`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme search <keyword>', CliForegroundColor.Cyan)}         Search by name, tag, or description`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme random [dark|light]', CliForegroundColor.Cyan)}      Apply a random theme`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme current', CliForegroundColor.Cyan)}                  Show active theme with swatches`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme set <key> <value>', CliForegroundColor.Cyan)}        Set a theme variable`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme export', CliForegroundColor.Cyan)}                   Export current theme as JSON`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme import', CliForegroundColor.Cyan)}                   Import a theme from JSON`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme save', CliForegroundColor.Cyan)}                     Save current settings`,
    );
    writer.writeln(
        `  ${writer.wrapInColor('theme reset', CliForegroundColor.Cyan)}                    Reset to default`,
    );
    writer.writeln();
    writer.writeln('Examples:');
    writer.writeln(
        `  theme apply dracula              ${writer.wrapInColor('# Apply the Dracula theme', CliForegroundColor.Green)}`,
    );
    writer.writeln(
        `  theme apply tokyoNight           ${writer.wrapInColor('# Apply Tokyo Night', CliForegroundColor.Green)}`,
    );
    writer.writeln(
        `  theme preview nord               ${writer.wrapInColor('# Preview Nord palette', CliForegroundColor.Green)}`,
    );
    writer.writeln(
        `  theme search retro               ${writer.wrapInColor('# Find retro-style themes', CliForegroundColor.Green)}`,
    );
    writer.writeln(
        `  theme random dark                ${writer.wrapInColor('# Apply a random dark theme', CliForegroundColor.Green)}`,
    );
    writer.writeln(
        `  theme set background #1a1a2e     ${writer.wrapInColor('# Change background color', CliForegroundColor.Green)}`,
    );
    writer.writeln(
        `  theme export                     ${writer.wrapInColor('# Export theme as JSON', CliForegroundColor.Green)}`,
    );
    writer.writeln();
    writer.writeln(
        `Available color keys: ${writer.wrapInColor(this.themeOptions.join(', ') ?? '', CliForegroundColor.Blue)}`,
    );
}
```

**Step 2: Update version to `2.0.0`**

Change `version` on line 68 from `'1.1.0'` to `'2.0.0'`.

**Step 3: Verify build and commit**

```bash
git add packages/cli/src/lib/processors/theme/cli-theme-command-processor.ts
git commit -m "feat(themes): update help text and bump version to 2.0.0"
```

---

## Task 12: Write tests for theme metadata

**Files:**
- Create: `packages/core/src/tests/themes.spec.ts`

**Step 1: Write tests**

```typescript
import { DefaultThemes } from '../lib/themes';
import { DefaultThemeInfos } from '../lib/themes/theme-info';

describe('DefaultThemes', () => {
    it('should have at least 25 themes', () => {
        const names = Object.keys(DefaultThemes);
        expect(names.length).toBeGreaterThanOrEqual(25);
    });

    it('should have complete palettes for all themes', () => {
        const requiredKeys = [
            'background',
            'foreground',
            'black',
            'red',
            'green',
            'yellow',
            'blue',
            'magenta',
            'cyan',
            'white',
            'brightBlack',
            'brightRed',
            'brightGreen',
            'brightYellow',
            'brightBlue',
            'brightMagenta',
            'brightCyan',
            'brightWhite',
        ];

        for (const [name, theme] of Object.entries(DefaultThemes)) {
            for (const key of requiredKeys) {
                expect((theme as any)[key]).toBeTruthy(
                    `Theme "${name}" is missing "${key}"`,
                );
            }
        }
    });

    it('should have yellow as alias for highContrastLight', () => {
        expect(DefaultThemes.yellow).toBe(
            DefaultThemes.highContrastLight,
        );
    });
});

describe('DefaultThemeInfos', () => {
    it('should have info for every theme except yellow alias', () => {
        const themeNames = Object.keys(DefaultThemes).filter(
            (n) => n !== 'yellow',
        );
        for (const name of themeNames) {
            expect(DefaultThemeInfos[name]).toBeTruthy(
                `Missing theme info for "${name}"`,
            );
        }
    });

    it('should have valid categories', () => {
        for (const [name, info] of Object.entries(DefaultThemeInfos)) {
            expect(['dark', 'light']).toContain(info.category);
            expect(info.description.length).toBeGreaterThan(0);
            expect(info.tags.length).toBeGreaterThan(0);
            expect(info.theme).toBeTruthy(
                `Theme info "${name}" has no theme reference`,
            );
        }
    });

    it('should correctly categorize light themes', () => {
        const lightThemes = [
            'solarizedLight',
            'gruvboxLight',
            'highContrastLight',
            'catppuccinLatte',
            'rosePineDawn',
            'everforestLight',
            'githubLight',
        ];
        for (const name of lightThemes) {
            expect(DefaultThemeInfos[name]?.category).toBe(
                'light',
                `${name} should be categorized as light`,
            );
        }
    });
});
```

**Step 2: Run tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test core`
Expected: ALL PASS

After tests: `pkill -f "karma|ChromeHeadless" 2>/dev/null || true`

**Step 3: Commit**

```bash
git add packages/core/src/tests/themes.spec.ts
git commit -m "test(themes): add tests for theme definitions and metadata"
```

---

## Task 13: Write tests for theme completion provider

**Files:**
- Modify: `packages/cli/src/tests/completion.spec.ts`

**Step 1: Add test suite for `CliThemeNameCompletionProvider`**

Add at the end of the file (before the final newline):

```typescript
import { CliThemeNameCompletionProvider } from '../lib/completion/cli-theme-name-completion-provider';

// ---------------------------------------------------------------------------
// CliThemeNameCompletionProvider
// ---------------------------------------------------------------------------
describe('CliThemeNameCompletionProvider', () => {
    let provider: CliThemeNameCompletionProvider;

    beforeEach(() => {
        provider = new CliThemeNameCompletionProvider();
    });

    it('should complete theme names for "theme apply"', () => {
        const result = provider.getCompletions({
            input: 'theme apply d',
            cursor: 13,
            token: 'd',
            tokenStart: 12,
            tokenIndex: 2,
            tokens: ['theme', 'apply', 'd'],
        });
        expect(result).toContain('dracula');
    });

    it('should complete theme names for "theme preview"', () => {
        const result = provider.getCompletions({
            input: 'theme preview n',
            cursor: 15,
            token: 'n',
            tokenStart: 14,
            tokenIndex: 2,
            tokens: ['theme', 'preview', 'n'],
        });
        expect(result).toContain('nord');
    });

    it('should complete dark/light for "theme random"', () => {
        const result = provider.getCompletions({
            input: 'theme random d',
            cursor: 14,
            token: 'd',
            tokenStart: 13,
            tokenIndex: 2,
            tokens: ['theme', 'random', 'd'],
        });
        expect(result).toEqual(['dark']);
    });

    it('should complete tags for "theme search"', () => {
        const result = provider.getCompletions({
            input: 'theme search r',
            cursor: 14,
            token: 'r',
            tokenStart: 13,
            tokenIndex: 2,
            tokens: ['theme', 'search', 'r'],
        });
        expect(result).toContain('retro');
    });

    it('should return empty for non-theme commands', () => {
        const result = provider.getCompletions({
            input: 'echo test d',
            cursor: 11,
            token: 'd',
            tokenStart: 10,
            tokenIndex: 2,
            tokens: ['echo', 'test', 'd'],
        });
        expect(result).toEqual([]);
    });

    it('should include new themes like tokyoNight', () => {
        const result = provider.getCompletions({
            input: 'theme apply tokyo',
            cursor: 17,
            token: 'tokyo',
            tokenStart: 12,
            tokenIndex: 2,
            tokens: ['theme', 'apply', 'tokyo'],
        });
        expect(result).toContain('tokyoNight');
    });
});
```

**Step 2: Run tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test cli`
Expected: ALL PASS

After tests: `pkill -f "karma|ChromeHeadless" 2>/dev/null || true`

**Step 3: Commit**

```bash
git add packages/cli/src/tests/completion.spec.ts
git commit -m "test(themes): add tests for theme name completion provider"
```

---

## Task 14: Final build verification

**Step 1: Full build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build`
Expected: All 31 projects build successfully

**Step 2: Run all tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm test`
Expected: All tests pass

After tests: `pkill -f "karma|ChromeHeadless" 2>/dev/null || true`

**Step 3: Final commit if any fixups needed**

```bash
git add -A
git commit -m "chore(themes): final cleanup after theme system overhaul"
```
