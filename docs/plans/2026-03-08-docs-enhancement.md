# Docs Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the landing page to reflect all current plugins/commands, then build a multi-page docs site with sidebar navigation under `/docs` routes, and move TypeDoc API reference to `/api/`.

**Architecture:** Extend the existing Angular docs app with Angular Router. Landing page stays at `/`. New docs pages live under `/docs` with a sidebar layout shell component. Plugin pages are data-driven using route params. TypeDoc output moves to `/api/`.

**Tech Stack:** Angular 16, Angular Router, SASS, TypeDoc, Nx

---

### Task 1: Add Angular Router to docs app

**Files:**
- Modify: `apps/docs/src/app/app.module.ts`
- Create: `apps/docs/src/app/app-routing.module.ts`
- Modify: `apps/docs/src/app/app.component.html` (add `<router-outlet>`)
- Modify: `apps/docs/src/app/app.component.ts`

**Step 1: Create routing module**

Create `apps/docs/src/app/app-routing.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
    {
        path: '',
        loadChildren: () =>
            import('./pages/home/home.module').then((m) => m.HomeModule),
    },
    {
        path: 'docs',
        loadChildren: () =>
            import('./pages/docs/docs.module').then((m) => m.DocsModule),
    },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
})
export class AppRoutingModule {}
```

**Step 2: Update app.module.ts to import routing**

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { CliModule } from '@qodalis/angular-cli';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
    declarations: [AppComponent],
    imports: [BrowserModule, BrowserAnimationsModule, CliModule, AppRoutingModule],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {}
```

**Step 3: Update app.component.html — keep only shared nav/footer + router-outlet**

Replace the entire `app.component.html` body (between nav and footer) with `<router-outlet></router-outlet>`. The nav and footer stay in `app.component.html`. The `<cli-panel>` at the bottom also stays.

**Step 4: Build and verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx build docs`
Expected: Build succeeds (may have warnings about missing lazy modules — that's fine, we create them next)

**Step 5: Commit**

```bash
git add apps/docs/src/app/app-routing.module.ts apps/docs/src/app/app.module.ts apps/docs/src/app/app.component.html apps/docs/src/app/app.component.ts
git commit -m "feat(docs): add Angular Router with lazy-loaded routes"
```

---

### Task 2: Extract landing page into HomeModule

**Files:**
- Create: `apps/docs/src/app/pages/home/home.module.ts`
- Create: `apps/docs/src/app/pages/home/home.component.ts`
- Create: `apps/docs/src/app/pages/home/home.component.html`
- Create: `apps/docs/src/app/pages/home/home.component.sass`

**Step 1: Create home module and component**

Move all the current landing page content (hero, features, commands, terminal, plugins, CTA sections) from `app.component.html` into `home.component.html`. Move all the data arrays (features, plugins, builtInGroups, etc.) and methods from `app.component.ts` into `home.component.ts`.

`home.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CliModule } from '@qodalis/angular-cli';
import { HomeComponent } from './home.component';

@NgModule({
    declarations: [HomeComponent],
    imports: [
        CommonModule,
        CliModule,
        RouterModule.forChild([{ path: '', component: HomeComponent }]),
    ],
})
export class HomeModule {}
```

`home.component.ts` — copy all interfaces (Feature, PluginInfo, CommandGroup, AdvancedFeature, Framework), all data arrays, all methods, and all imports from `app.component.ts`. The `app.component.ts` should then only have the nav/footer logic (minimal).

**Step 2: Update app.component.ts to be minimal shell**

`app.component.ts` should only contain:
- The `modules` array and `options` (for the `<cli-panel>` in footer)
- All plugin module imports stay here since `<cli-panel>` uses them

**Step 3: Build and verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx build docs`
Expected: Build succeeds, landing page renders as before

**Step 4: Commit**

```bash
git add apps/docs/src/app/pages/home/
git add apps/docs/src/app/app.component.ts apps/docs/src/app/app.component.html
git commit -m "refactor(docs): extract landing page into lazy-loaded HomeModule"
```

---

### Task 3: Create shared data layer for plugins

**Files:**
- Create: `apps/docs/src/app/data/plugins.ts`
- Create: `apps/docs/src/app/data/commands.ts`
- Create: `apps/docs/src/app/data/navigation.ts`

**Step 1: Create plugins data file**

`apps/docs/src/app/data/plugins.ts` — define all 37 plugins with metadata:

```typescript
export interface PluginData {
    id: string;           // URL slug: 'guid', 'regex', '2048', 'lang-es', etc.
    name: string;         // Display name: 'GUID', 'Regex', '2048'
    npmPackage: string;   // '@qodalis/cli-guid'
    command: string;      // Primary command(s): 'guid generate'
    description: string;  // Short description
    category: 'utility' | 'game' | 'language-pack';
    moduleExport: string; // 'guidModule' (for code snippets)
    moduleImport: string; // '@qodalis/cli-guid' (for code snippets)
}

export const PLUGINS: PluginData[] = [
    // ── Utilities ──
    {
        id: 'guid',
        name: 'GUID',
        npmPackage: '@qodalis/cli-guid',
        command: 'guid generate',
        description: 'Generate and validate UUIDs',
        category: 'utility',
        moduleExport: 'guidModule',
        moduleImport: '@qodalis/cli-guid',
    },
    {
        id: 'regex',
        name: 'Regex',
        npmPackage: '@qodalis/cli-regex',
        command: 'regex test',
        description: 'Test and debug regular expressions',
        category: 'utility',
        moduleExport: 'regexModule',
        moduleImport: '@qodalis/cli-regex',
    },
    {
        id: 'qr',
        name: 'QR Code',
        npmPackage: '@qodalis/cli-qr',
        command: 'qr generate',
        description: 'Generate QR codes from text',
        category: 'utility',
        moduleExport: 'qrModule',
        moduleImport: '@qodalis/cli-qr',
    },
    {
        id: 'speed-test',
        name: 'Speed Test',
        npmPackage: '@qodalis/cli-speed-test',
        command: 'speed-test',
        description: 'Measure network performance',
        category: 'utility',
        moduleExport: 'speedTestModule',
        moduleImport: '@qodalis/cli-speed-test',
    },
    {
        id: 'curl',
        name: 'cURL',
        npmPackage: '@qodalis/cli-curl',
        command: 'curl',
        description: 'Make HTTP requests from the terminal',
        category: 'utility',
        moduleExport: 'curlModule',
        moduleImport: '@qodalis/cli-curl',
    },
    {
        id: 'password-generator',
        name: 'Password Generator',
        npmPackage: '@qodalis/cli-password-generator',
        command: 'password generate',
        description: 'Generate secure passwords',
        category: 'utility',
        moduleExport: 'passwordGeneratorModule',
        moduleImport: '@qodalis/cli-password-generator',
    },
    {
        id: 'string',
        name: 'String',
        npmPackage: '@qodalis/cli-string',
        command: 'string',
        description: 'Encode, decode, and transform text',
        category: 'utility',
        moduleExport: 'stringModule',
        moduleImport: '@qodalis/cli-string',
    },
    {
        id: 'todo',
        name: 'Todo',
        npmPackage: '@qodalis/cli-todo',
        command: 'todo',
        description: 'Manage tasks from the command line',
        category: 'utility',
        moduleExport: 'todoModule',
        moduleImport: '@qodalis/cli-todo',
    },
    {
        id: 'browser-storage',
        name: 'Browser Storage',
        npmPackage: '@qodalis/cli-browser-storage',
        command: 'cookies, localStorage',
        description: 'Inspect browser local/session storage and cookies',
        category: 'utility',
        moduleExport: 'browserStorageModule',
        moduleImport: '@qodalis/cli-browser-storage',
    },
    {
        id: 'text-to-image',
        name: 'Text to Image',
        npmPackage: '@qodalis/cli-text-to-image',
        command: 'text-to-image',
        description: 'Render text as images',
        category: 'utility',
        moduleExport: 'textToImageModule',
        moduleImport: '@qodalis/cli-text-to-image',
    },
    {
        id: 'files',
        name: 'Files',
        npmPackage: '@qodalis/cli-files',
        command: 'ls, cat, nano, mkdir, touch, rm',
        description: 'Virtual filesystem with 20+ commands and a built-in editor',
        category: 'utility',
        moduleExport: 'filesModule',
        moduleImport: '@qodalis/cli-files',
    },
    {
        id: 'yesno',
        name: 'Yes/No',
        npmPackage: '@qodalis/cli-yesno',
        command: 'yesno',
        description: 'Interactive yes/no prompts',
        category: 'utility',
        moduleExport: 'yesnoModule',
        moduleImport: '@qodalis/cli-yesno',
    },
    {
        id: 'server-logs',
        name: 'Server Logs',
        npmPackage: '@qodalis/cli-server-logs',
        command: 'logs',
        description: 'Stream and filter server logs',
        category: 'utility',
        moduleExport: 'serverLogsModule',
        moduleImport: '@qodalis/cli-server-logs',
    },
    {
        id: 'users',
        name: 'Users',
        npmPackage: '@qodalis/cli-users',
        command: 'whoami, adduser, passwd, login',
        description: 'Linux-style user management with groups and permissions',
        category: 'utility',
        moduleExport: 'usersModule',
        moduleImport: '@qodalis/cli-users',
    },
    {
        id: 'chart',
        name: 'Chart',
        npmPackage: '@qodalis/cli-chart',
        command: 'chart',
        description: 'Render ASCII and SVG charts in the terminal',
        category: 'utility',
        moduleExport: 'chartModule',
        moduleImport: '@qodalis/cli-chart',
    },
    {
        id: 'cron',
        name: 'Cron',
        npmPackage: '@qodalis/cli-cron',
        command: 'cron',
        description: 'Schedule recurring tasks',
        category: 'utility',
        moduleExport: 'cronModule',
        moduleImport: '@qodalis/cli-cron',
    },
    {
        id: 'csv',
        name: 'CSV',
        npmPackage: '@qodalis/cli-csv',
        command: 'csv',
        description: 'Parse and display CSV data',
        category: 'utility',
        moduleExport: 'csvModule',
        moduleImport: '@qodalis/cli-csv',
    },
    {
        id: 'markdown',
        name: 'Markdown',
        npmPackage: '@qodalis/cli-markdown',
        command: 'md',
        description: 'Render markdown content in the terminal',
        category: 'utility',
        moduleExport: 'markdownModule',
        moduleImport: '@qodalis/cli-markdown',
    },
    {
        id: 'scp',
        name: 'SCP',
        npmPackage: '@qodalis/cli-scp',
        command: 'scp',
        description: 'Secure copy with transfer service integration',
        category: 'utility',
        moduleExport: 'scpModule',
        moduleImport: '@qodalis/cli-scp',
    },
    {
        id: 'stopwatch',
        name: 'Stopwatch',
        npmPackage: '@qodalis/cli-stopwatch',
        command: 'stopwatch',
        description: 'Timer and stopwatch utility',
        category: 'utility',
        moduleExport: 'stopwatchModule',
        moduleImport: '@qodalis/cli-stopwatch',
    },
    {
        id: 'wget',
        name: 'Wget',
        npmPackage: '@qodalis/cli-wget',
        command: 'wget',
        description: 'Download files from URLs',
        category: 'utility',
        moduleExport: 'wgetModule',
        moduleImport: '@qodalis/cli-wget',
    },
    // ── Games ──
    {
        id: 'snake',
        name: 'Snake',
        npmPackage: '@qodalis/cli-snake',
        command: 'snake',
        description: 'Play the classic Snake game',
        category: 'game',
        moduleExport: 'snakeModule',
        moduleImport: '@qodalis/cli-snake',
    },
    {
        id: 'tetris',
        name: 'Tetris',
        npmPackage: '@qodalis/cli-tetris',
        command: 'tetris',
        description: 'Play Tetris in the terminal',
        category: 'game',
        moduleExport: 'tetrisModule',
        moduleImport: '@qodalis/cli-tetris',
    },
    {
        id: '2048',
        name: '2048',
        npmPackage: '@qodalis/cli-2048',
        command: '2048',
        description: 'Play the 2048 sliding-tile puzzle',
        category: 'game',
        moduleExport: 'game2048Module',
        moduleImport: '@qodalis/cli-2048',
    },
    {
        id: 'minesweeper',
        name: 'Minesweeper',
        npmPackage: '@qodalis/cli-minesweeper',
        command: 'minesweeper',
        description: 'Play Minesweeper with 3 difficulty levels',
        category: 'game',
        moduleExport: 'minesweeperModule',
        moduleImport: '@qodalis/cli-minesweeper',
    },
    {
        id: 'wordle',
        name: 'Wordle',
        npmPackage: '@qodalis/cli-wordle',
        command: 'wordle',
        description: 'Play the word-guessing game Wordle',
        category: 'game',
        moduleExport: 'wordleModule',
        moduleImport: '@qodalis/cli-wordle',
    },
    {
        id: 'sudoku',
        name: 'Sudoku',
        npmPackage: '@qodalis/cli-sudoku',
        command: 'sudoku',
        description: 'Play Sudoku with 3 difficulty levels',
        category: 'game',
        moduleExport: 'sudokuModule',
        moduleImport: '@qodalis/cli-sudoku',
    },
    // ── Language Packs ──
    {
        id: 'lang-es',
        name: 'Spanish',
        npmPackage: '@qodalis/cli-lang-es',
        command: '',
        description: 'Spanish language pack',
        category: 'language-pack',
        moduleExport: 'langEsModule',
        moduleImport: '@qodalis/cli-lang-es',
    },
    {
        id: 'lang-de',
        name: 'German',
        npmPackage: '@qodalis/cli-lang-de',
        command: '',
        description: 'German language pack',
        category: 'language-pack',
        moduleExport: 'langDeModule',
        moduleImport: '@qodalis/cli-lang-de',
    },
    {
        id: 'lang-fr',
        name: 'French',
        npmPackage: '@qodalis/cli-lang-fr',
        command: '',
        description: 'French language pack',
        category: 'language-pack',
        moduleExport: 'langFrModule',
        moduleImport: '@qodalis/cli-lang-fr',
    },
    {
        id: 'lang-it',
        name: 'Italian',
        npmPackage: '@qodalis/cli-lang-it',
        command: '',
        description: 'Italian language pack',
        category: 'language-pack',
        moduleExport: 'langItModule',
        moduleImport: '@qodalis/cli-lang-it',
    },
    {
        id: 'lang-ja',
        name: 'Japanese',
        npmPackage: '@qodalis/cli-lang-ja',
        command: '',
        description: 'Japanese language pack',
        category: 'language-pack',
        moduleExport: 'langJaModule',
        moduleImport: '@qodalis/cli-lang-ja',
    },
    {
        id: 'lang-ko',
        name: 'Korean',
        npmPackage: '@qodalis/cli-lang-ko',
        command: '',
        description: 'Korean language pack',
        category: 'language-pack',
        moduleExport: 'langKoModule',
        moduleImport: '@qodalis/cli-lang-ko',
    },
    {
        id: 'lang-pt',
        name: 'Portuguese',
        npmPackage: '@qodalis/cli-lang-pt',
        command: '',
        description: 'Portuguese language pack',
        category: 'language-pack',
        moduleExport: 'langPtModule',
        moduleImport: '@qodalis/cli-lang-pt',
    },
    {
        id: 'lang-ro',
        name: 'Romanian',
        npmPackage: '@qodalis/cli-lang-ro',
        command: '',
        description: 'Romanian language pack',
        category: 'language-pack',
        moduleExport: 'langRoModule',
        moduleImport: '@qodalis/cli-lang-ro',
    },
    {
        id: 'lang-ru',
        name: 'Russian',
        npmPackage: '@qodalis/cli-lang-ru',
        command: '',
        description: 'Russian language pack',
        category: 'language-pack',
        moduleExport: 'langRuModule',
        moduleImport: '@qodalis/cli-lang-ru',
    },
    {
        id: 'lang-zh',
        name: 'Chinese',
        npmPackage: '@qodalis/cli-lang-zh',
        command: '',
        description: 'Chinese language pack',
        category: 'language-pack',
        moduleExport: 'langZhModule',
        moduleImport: '@qodalis/cli-lang-zh',
    },
];

export const UTILITY_PLUGINS = PLUGINS.filter((p) => p.category === 'utility');
export const GAME_PLUGINS = PLUGINS.filter((p) => p.category === 'game');
export const LANGUAGE_PACKS = PLUGINS.filter((p) => p.category === 'language-pack');
```

**Step 2: Create commands data file**

`apps/docs/src/app/data/commands.ts`:

```typescript
export interface CommandGroup {
    label: string;
    commands: string[];
}

export const BUILT_IN_GROUPS: CommandGroup[] = [
    {
        label: 'Dev Tools',
        commands: ['curl', 'json', 'regex test', 'base64', 'speed-test', 'hash', 'jwt', 'hex', 'url'],
    },
    {
        label: 'Utilities',
        commands: ['guid generate', 'password generate', 'qr generate', 'string', 'text-to-image', 'random', 'lorem', 'timestamp', 'convert', 'cal', 'seq'],
    },
    {
        label: 'System',
        commands: ['help', 'version', 'clear', 'history', 'echo', 'date', 'uname', 'uptime', 'time', 'sleep', 'alias', 'yes', 'screen'],
    },
    {
        label: 'Editors & Files',
        commands: ['nano', 'ls', 'cat', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'tree', 'head', 'tail', 'wc', 'find', 'grep', 'chmod', 'cd', 'pwd'],
    },
    {
        label: 'Packages',
        commands: ['pkg add', 'pkg list', 'pkg remove'],
    },
    {
        label: 'Configuration',
        commands: ['config set', 'config get', 'config list', 'config delete'],
    },
    {
        label: 'Users',
        commands: ['whoami', 'adduser', 'passwd', 'login', 'logout', 'su', 'who', 'id'],
    },
];

export const TOTAL_COMMAND_COUNT = BUILT_IN_GROUPS.reduce((sum, g) => sum + g.commands.length, 0);
```

**Step 3: Create navigation data file**

`apps/docs/src/app/data/navigation.ts`:

```typescript
import { UTILITY_PLUGINS, GAME_PLUGINS, LANGUAGE_PACKS } from './plugins';

export interface NavItem {
    label: string;
    path: string;
    children?: NavItem[];
    external?: boolean;
}

export const DOCS_NAV: NavItem[] = [
    {
        label: 'Getting Started',
        path: '/docs/getting-started',
        children: [
            { label: 'Installation', path: '/docs/getting-started' },
            { label: 'Configuration', path: '/docs/getting-started/configuration' },
        ],
    },
    {
        label: 'Core Concepts',
        path: '/docs/core-concepts',
        children: [
            { label: 'Command Processors', path: '/docs/core-concepts/command-processors' },
            { label: 'Execution Context', path: '/docs/core-concepts/execution-context' },
            { label: 'Theming', path: '/docs/core-concepts/theming' },
            { label: 'Input Reader', path: '/docs/core-concepts/input-reader' },
        ],
    },
    {
        label: 'Plugins',
        path: '/docs/plugins',
        children: [
            ...UTILITY_PLUGINS.map((p) => ({
                label: p.name,
                path: `/docs/plugins/${p.id}`,
            })),
            ...GAME_PLUGINS.map((p) => ({
                label: p.name,
                path: `/docs/plugins/${p.id}`,
            })),
            { label: 'Create Your Own', path: '/docs/plugins/create-your-own' },
        ],
    },
    {
        label: 'Server Integration',
        path: '/docs/server-integration',
        children: [
            { label: 'Overview', path: '/docs/server-integration' },
            { label: 'Node.js', path: '/docs/server-integration/node' },
            { label: 'Python', path: '/docs/server-integration/python' },
            { label: '.NET', path: '/docs/server-integration/dotnet' },
        ],
    },
    {
        label: 'Language Packs',
        path: '/docs/language-packs',
        children: LANGUAGE_PACKS.map((p) => ({
            label: p.name,
            path: `/docs/plugins/${p.id}`,
        })),
    },
    {
        label: 'API Reference',
        path: '/api/',
        external: true,
    },
];
```

**Step 4: Update home.component.ts to use shared data**

Replace the hard-coded `plugins` and `builtInGroups` arrays with imports from the data files.

**Step 5: Build and verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx build docs`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/docs/src/app/data/
git add apps/docs/src/app/pages/home/home.component.ts
git commit -m "feat(docs): add shared data layer for plugins, commands, and navigation"
```

---

### Task 4: Update landing page content

**Files:**
- Modify: `apps/docs/src/app/pages/home/home.component.ts`
- Modify: `apps/docs/src/app/pages/home/home.component.html`
- Modify: `apps/docs/src/app/app.component.ts` (add missing module imports)

**Step 1: Add missing plugin module imports to app.component.ts**

Add these imports and include them in the `modules` array:

```typescript
import { chartModule } from '@qodalis/cli-chart';
import { cronModule } from '@qodalis/cli-cron';
import { csvModule } from '@qodalis/cli-csv';
import { markdownModule } from '@qodalis/cli-markdown';
import { scpModule } from '@qodalis/cli-scp';
import { stopwatchModule } from '@qodalis/cli-stopwatch';
import { wgetModule } from '@qodalis/cli-wget';
```

**Step 2: Update plugins section heading**

In `home.component.html`, change:
- `"13 Official Plugins"` -> use `plugins.length` dynamically: `"{{ plugins.length }} Official Plugins"`

**Step 3: Update command count**

Change `"50+ Built-in Commands"` to use `TOTAL_COMMAND_COUNT` from data file: `"{{ totalCommandCount }}+ Built-in Commands"`

**Step 4: Add Games and Language Packs subsections to plugins area**

In the plugins section of `home.component.html`, split the grid into categories: Utilities, Games, Language Packs — each with its own sub-heading.

**Step 5: Update nav links to point to internal /docs route**

Change `href="https://cli.qodalis.com/docs/"` to `routerLink="/docs"` in the nav and CTA sections.

**Step 6: Update feature card "Plugin Ecosystem" description**

Change `"13 official plugins"` to match the actual count.

**Step 7: Build and verify**

Run: `cd /home/nicolas/work/cli-workspace/web-cli && pnpm exec nx build docs`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/docs/src/app/pages/home/ apps/docs/src/app/app.component.ts
git commit -m "feat(docs): update landing page with all 37 plugins and accurate command counts"
```

---

### Task 5: Create docs shell layout with sidebar

**Files:**
- Create: `apps/docs/src/app/pages/docs/docs.module.ts`
- Create: `apps/docs/src/app/pages/docs/docs.component.ts`
- Create: `apps/docs/src/app/pages/docs/docs.component.html`
- Create: `apps/docs/src/app/pages/docs/docs.component.sass`
- Create: `apps/docs/src/app/pages/docs/components/sidebar/sidebar.component.ts`
- Create: `apps/docs/src/app/pages/docs/components/sidebar/sidebar.component.html`
- Create: `apps/docs/src/app/pages/docs/components/sidebar/sidebar.component.sass`

**Step 1: Create the sidebar component**

The sidebar component takes `DOCS_NAV` data and renders collapsible sections. Each section has a label and children. Active route is highlighted. On mobile, sidebar is hidden behind a hamburger button.

`sidebar.component.ts`:
```typescript
import { Component, EventEmitter, Output } from '@angular/core';
import { DOCS_NAV, NavItem } from '../../../../data/navigation';

@Component({
    selector: 'docs-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.sass'],
})
export class SidebarComponent {
    @Output() linkClicked = new EventEmitter<void>();
    nav = DOCS_NAV;
    expandedSections: Set<string> = new Set(['Getting Started', 'Core Concepts', 'Plugins']);

    toggleSection(label: string): void {
        if (this.expandedSections.has(label)) {
            this.expandedSections.delete(label);
        } else {
            this.expandedSections.add(label);
        }
    }

    isExpanded(label: string): boolean {
        return this.expandedSections.has(label);
    }
}
```

`sidebar.component.html`:
```html
<nav class="sidebar-nav">
    <div class="sidebar-section" *ngFor="let section of nav">
        <ng-container *ngIf="!section.external; else externalLink">
            <button
                class="sidebar-section-header"
                (click)="toggleSection(section.label)"
                [class.expanded]="isExpanded(section.label)"
            >
                <span>{{ section.label }}</span>
                <span class="chevron">&#9656;</span>
            </button>
            <div class="sidebar-children" *ngIf="isExpanded(section.label) && section.children">
                <a
                    *ngFor="let child of section.children"
                    class="sidebar-link"
                    [routerLink]="child.path"
                    routerLinkActive="active"
                    [routerLinkActiveOptions]="{ exact: true }"
                    (click)="linkClicked.emit()"
                >{{ child.label }}</a>
            </div>
        </ng-container>
        <ng-template #externalLink>
            <a class="sidebar-section-header external" [href]="section.path" target="_blank" rel="noopener">
                <span>{{ section.label }}</span>
                <span class="arrow">&nearr;</span>
            </a>
        </ng-template>
    </div>
</nav>
```

Style the sidebar with the existing design tokens ($bg-surface, $border, $accent, etc.). Width: 260px. Sticky position. Scrollable.

**Step 2: Create the docs shell component**

`docs.component.html`:
```html
<div class="docs-layout">
    <button class="sidebar-toggle" (click)="sidebarOpen = !sidebarOpen">
        &#9776;
    </button>
    <aside class="docs-sidebar" [class.open]="sidebarOpen">
        <docs-sidebar (linkClicked)="sidebarOpen = false"></docs-sidebar>
    </aside>
    <main class="docs-content">
        <router-outlet></router-outlet>
    </main>
</div>
```

`docs.component.ts`:
```typescript
import { Component } from '@angular/core';

@Component({
    selector: 'docs-shell',
    templateUrl: './docs.component.html',
    styleUrls: ['./docs.component.sass'],
})
export class DocsComponent {
    sidebarOpen = false;
}
```

Style: flexbox layout, sidebar 260px fixed on desktop, drawer overlay on mobile (<768px).

**Step 3: Create docs.module.ts with child routes**

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { DocsComponent } from './docs.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

const routes: Routes = [
    {
        path: '',
        component: DocsComponent,
        children: [
            {
                path: '',
                redirectTo: 'getting-started',
                pathMatch: 'full',
            },
            {
                path: 'getting-started',
                loadChildren: () =>
                    import('./pages/getting-started/getting-started.module').then(
                        (m) => m.GettingStartedModule,
                    ),
            },
            {
                path: 'getting-started/configuration',
                loadChildren: () =>
                    import('./pages/configuration/configuration.module').then(
                        (m) => m.ConfigurationModule,
                    ),
            },
            {
                path: 'core-concepts/:topic',
                loadChildren: () =>
                    import('./pages/core-concepts/core-concepts.module').then(
                        (m) => m.CoreConceptsModule,
                    ),
            },
            {
                path: 'plugins/create-your-own',
                loadChildren: () =>
                    import('./pages/create-plugin/create-plugin.module').then(
                        (m) => m.CreatePluginModule,
                    ),
            },
            {
                path: 'plugins/:pluginId',
                loadChildren: () =>
                    import('./pages/plugin-detail/plugin-detail.module').then(
                        (m) => m.PluginDetailModule,
                    ),
            },
            {
                path: 'server-integration',
                loadChildren: () =>
                    import('./pages/server-integration/server-integration.module').then(
                        (m) => m.ServerIntegrationModule,
                    ),
            },
            {
                path: 'server-integration/:server',
                loadChildren: () =>
                    import('./pages/server-detail/server-detail.module').then(
                        (m) => m.ServerDetailModule,
                    ),
            },
            {
                path: 'language-packs',
                loadChildren: () =>
                    import('./pages/language-packs/language-packs.module').then(
                        (m) => m.LanguagePacksModule,
                    ),
            },
        ],
    },
];

@NgModule({
    declarations: [DocsComponent, SidebarComponent],
    imports: [CommonModule, RouterModule.forChild(routes)],
})
export class DocsModule {}
```

**Step 4: Build and verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx build docs`
Expected: Build succeeds (child modules not created yet — may warn, that's fine)

**Step 5: Commit**

```bash
git add apps/docs/src/app/pages/docs/
git commit -m "feat(docs): add docs shell layout with sidebar navigation"
```

---

### Task 6: Create Getting Started page

**Files:**
- Create: `apps/docs/src/app/pages/docs/pages/getting-started/getting-started.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/getting-started/getting-started.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/getting-started/getting-started.component.html`
- Create: `apps/docs/src/app/pages/docs/pages/getting-started/getting-started.component.sass`

**Step 1: Create getting-started component**

Content covers:
1. **Installation** — npm/pnpm install commands for all 3 frameworks
2. **Quick Start: Angular** — import CliModule, add `<cli>` or `<cli-panel>` to template, add styles to angular.json
3. **Quick Start: React** — import Cli/CliPanel, wrap in CliConfigProvider
4. **Quick Start: Vue** — import Cli/CliPanel, wrap in CliConfigProvider
5. **Adding Plugins** — show how to import a plugin module and pass to modules prop
6. **Next Steps** — links to Core Concepts, Plugins, Server Integration

Use the same code block styling from the landing page (`.code-block`, `.code-label` classes — extract them into shared styles or docs styles).

**Step 2: Create module with route**

```typescript
@NgModule({
    declarations: [GettingStartedComponent],
    imports: [
        CommonModule,
        RouterModule.forChild([{ path: '', component: GettingStartedComponent }]),
    ],
})
export class GettingStartedModule {}
```

**Step 3: Build and verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx build docs`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/docs/src/app/pages/docs/pages/getting-started/
git commit -m "feat(docs): add Getting Started page with Angular/React/Vue guides"
```

---

### Task 7: Create Configuration page

**Files:**
- Create: `apps/docs/src/app/pages/docs/pages/configuration/configuration.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/configuration/configuration.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/configuration/configuration.component.html`
- Create: `apps/docs/src/app/pages/docs/pages/configuration/configuration.component.sass`

**Step 1: Create configuration component**

Content covers:
1. **CliOptions interface** — all available options (logLevel, welcomeMessage, theme, etc.)
2. **Angular configuration** — `[options]` input binding, styles.sass import in angular.json
3. **React configuration** — CliConfigProvider props
4. **Vue configuration** — CliConfigProvider props
5. **Runtime config** — `config set/get/list/delete` commands

**Step 2: Create module, build, verify, commit**

Same pattern as Task 6.

---

### Task 8: Create Plugin Detail page (data-driven)

**Files:**
- Create: `apps/docs/src/app/pages/docs/pages/plugin-detail/plugin-detail.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/plugin-detail/plugin-detail.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/plugin-detail/plugin-detail.component.html`
- Create: `apps/docs/src/app/pages/docs/pages/plugin-detail/plugin-detail.component.sass`

**Step 1: Create plugin-detail component**

This is a data-driven page that reads `:pluginId` from the route params and looks up the plugin in the `PLUGINS` array.

`plugin-detail.component.ts`:
```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PLUGINS, PluginData } from '../../../../data/plugins';

@Component({
    selector: 'plugin-detail',
    templateUrl: './plugin-detail.component.html',
    styleUrls: ['./plugin-detail.component.sass'],
})
export class PluginDetailComponent implements OnInit {
    plugin: PluginData | undefined;

    constructor(private route: ActivatedRoute) {}

    ngOnInit(): void {
        this.route.params.subscribe((params) => {
            this.plugin = PLUGINS.find((p) => p.id === params['pluginId']);
        });
    }

    get installCommand(): string {
        return `npm install ${this.plugin?.npmPackage}`;
    }

    get usageSnippet(): string {
        return `import { ${this.plugin?.moduleExport} } from '${this.plugin?.moduleImport}';

// Angular
<cli [modules]="[${this.plugin?.moduleExport}]" />

// React
<Cli modules={[${this.plugin?.moduleExport}]} />

// Vue
<Cli :modules="[${this.plugin?.moduleExport}]" />`;
    }

    get runtimeInstall(): string {
        return `pkg add ${this.plugin?.npmPackage}`;
    }
}
```

`plugin-detail.component.html`:
```html
<div class="plugin-page" *ngIf="plugin">
    <header class="plugin-header">
        <h1>{{ plugin.name }}</h1>
        <code class="npm-badge">{{ plugin.npmPackage }}</code>
        <p class="plugin-description">{{ plugin.description }}</p>
    </header>

    <section class="plugin-section">
        <h2>Installation</h2>
        <div class="code-block">
            <span class="code-label">npm</span>
            <pre><code>{{ installCommand }}</code></pre>
        </div>
        <div class="code-block">
            <span class="code-label">Runtime (no rebuild)</span>
            <pre><code>{{ runtimeInstall }}</code></pre>
        </div>
    </section>

    <section class="plugin-section" *ngIf="plugin.command">
        <h2>Commands</h2>
        <div class="command-list">
            <code class="command-badge" *ngFor="let cmd of plugin.command.split(', ')">{{ cmd }}</code>
        </div>
    </section>

    <section class="plugin-section">
        <h2>Usage</h2>
        <div class="code-block">
            <span class="code-label">Setup</span>
            <pre><code>{{ usageSnippet }}</code></pre>
        </div>
    </section>
</div>

<div class="not-found" *ngIf="!plugin">
    <h2>Plugin not found</h2>
    <p>The plugin you're looking for doesn't exist.</p>
</div>
```

**Step 2: Create module, build, verify, commit**

Same pattern as Task 6.

---

### Task 9: Create Core Concepts pages

**Files:**
- Create: `apps/docs/src/app/pages/docs/pages/core-concepts/core-concepts.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/core-concepts/core-concepts.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/core-concepts/core-concepts.component.html`
- Create: `apps/docs/src/app/pages/docs/pages/core-concepts/core-concepts.component.sass`

**Step 1: Create core-concepts component**

This is a route-param-driven page that reads `:topic` and renders the appropriate content. Topics:
- `command-processors` — explain `ICliCommandProcessor` interface, `command`, `description`, `parameters`, `processors` (sub-commands), `extendsProcessor`, `processCommand()`, example implementation
- `execution-context` — explain `ICliExecutionContext` API: terminal writer, spinner, progress bar, state store, clipboard, abort signals, full-screen mode
- `theming` — CSS custom properties, built-in themes, how to create custom themes
- `input-reader` — `readLine`, `readPassword`, `readConfirm`, `readSelect`, `readSelectInline`, `readMultiSelect`, `readNumber`

If `:topic` is not provided, redirect to `command-processors`.

**Step 2: Create module, build, verify, commit**

---

### Task 10: Create Server Integration pages

**Files:**
- Create: `apps/docs/src/app/pages/docs/pages/server-integration/server-integration.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/server-integration/server-integration.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/server-integration/server-integration.component.html`
- Create: `apps/docs/src/app/pages/docs/pages/server-detail/server-detail.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/server-detail/server-detail.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/server-detail/server-detail.component.html`

**Step 1: Create overview page**

Content:
- What server integration provides (remote command execution, PTY shell, event streaming)
- Common API surface table (all 3 servers share the same endpoints)
- Architecture diagram (text-based): Frontend CLI <-> REST/WebSocket <-> Backend Server
- Links to individual server pages

**Step 2: Create server-detail page (route-param driven)**

Reads `:server` param (`node`, `python`, `dotnet`). Shows:
- Installation & setup
- Running the server
- Docker usage
- Creating custom command processors (code examples in the server's language)
- Connecting the frontend

**Step 3: Create modules, build, verify, commit**

---

### Task 11: Create Language Packs page

**Files:**
- Create: `apps/docs/src/app/pages/docs/pages/language-packs/language-packs.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/language-packs/language-packs.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/language-packs/language-packs.component.html`

**Step 1: Create language-packs component**

Content:
- Overview of i18n system
- Table of all 10 available language packs with install commands
- How to add a language pack (import module, add to modules array)
- How to create a new language pack (translation keys reference)

**Step 2: Create module, build, verify, commit**

---

### Task 12: Create "Create Your Own Plugin" page

**Files:**
- Create: `apps/docs/src/app/pages/docs/pages/create-plugin/create-plugin.module.ts`
- Create: `apps/docs/src/app/pages/docs/pages/create-plugin/create-plugin.component.ts`
- Create: `apps/docs/src/app/pages/docs/pages/create-plugin/create-plugin.component.html`

**Step 1: Create create-plugin component**

Content (expanded version of landing page section):
1. Scaffold with `npx @qodalis/create-cli-plugin`
2. Plugin structure explained (files generated)
3. Implementing the processor (`ICliCommandProcessor`)
4. Adding sub-commands, parameters, configuration options
5. Using the execution context (terminal writer, input reader, spinner, etc.)
6. Building (tsup produces CJS, ESM, IIFE)
7. Testing
8. Publishing to npm
9. Runtime installation via `pkg add`

**Step 2: Create module, build, verify, commit**

---

### Task 13: Update TypeDoc config and CI deployment

**Files:**
- Modify: `typedoc.json` (add all missing plugins to entry points)
- Modify: `.github/workflows/deploy-docs.yml` (TypeDoc output to `/api/` instead of `/docs/`)

**Step 1: Update typedoc.json entry points**

Add all missing plugin entry points:
```json
{
    "entryPoints": [
        "packages/core/src/public-api.ts",
        "packages/cli/src/public-api.ts",
        "packages/plugins/guid/src/public-api.ts",
        "packages/plugins/browser-storage/src/public-api.ts",
        "packages/plugins/regex/src/public-api.ts",
        "packages/plugins/server-logs/src/public-api.ts",
        "packages/plugins/string/src/public-api.ts",
        "packages/plugins/todo/src/public-api.ts",
        "packages/plugins/speed-test/src/public-api.ts",
        "packages/plugins/curl/src/public-api.ts",
        "packages/plugins/password-generator/src/public-api.ts",
        "packages/plugins/qr/src/public-api.ts",
        "packages/plugins/yesno/src/public-api.ts",
        "packages/plugins/files/src/public-api.ts",
        "packages/plugins/users/src/public-api.ts",
        "packages/plugins/text-to-image/src/public-api.ts",
        "packages/plugins/chart/src/public-api.ts",
        "packages/plugins/cron/src/public-api.ts",
        "packages/plugins/csv/src/public-api.ts",
        "packages/plugins/markdown/src/public-api.ts",
        "packages/plugins/scp/src/public-api.ts",
        "packages/plugins/stopwatch/src/public-api.ts",
        "packages/plugins/wget/src/public-api.ts",
        "packages/plugins/snake/src/public-api.ts",
        "packages/plugins/tetris/src/public-api.ts",
        "packages/plugins/2048/src/public-api.ts",
        "packages/plugins/minesweeper/src/public-api.ts",
        "packages/plugins/wordle/src/public-api.ts",
        "packages/plugins/sudoku/src/public-api.ts"
    ],
    "name": "Qodalis CLI",
    "out": "docs"
}
```

**Step 2: Update deploy-docs.yml**

Change:
```yaml
- name: Assemble deployment directory
  run: |
    mkdir -p deploy/api
    cp -r dist/docs/* deploy/
    cp -r typedoc-output/* deploy/api/
    cp deploy/index.html deploy/404.html
    cp assets/github/CNAME deploy/CNAME
    touch deploy/.nojekyll
```

The `404.html` fallback handles Angular routing on GitHub Pages.

**Step 3: Commit**

```bash
git add typedoc.json .github/workflows/deploy-docs.yml
git commit -m "feat(docs): expand TypeDoc coverage to all plugins and move API docs to /api/"
```

---

### Task 14: Add shared docs styles

**Files:**
- Modify: `apps/docs/src/styles.sass` (add docs layout styles)

**Step 1: Add docs-specific styles**

Add to the end of `styles.sass`:

```sass
// ─── Docs Layout ───
.docs-layout
  display: flex
  min-height: calc(100vh - 56px)
  margin-top: 56px

.docs-sidebar
  width: 260px
  flex-shrink: 0
  border-right: 1px solid $border
  background: $bg-surface
  position: sticky
  top: 56px
  height: calc(100vh - 56px)
  overflow-y: auto

  @media (max-width: 768px)
    position: fixed
    top: 56px
    left: -280px
    z-index: 99
    transition: left 0.2s ease
    box-shadow: none

    &.open
      left: 0
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4)

.docs-content
  flex: 1
  min-width: 0
  padding: 40px 48px
  max-width: 860px

  @media (max-width: 768px)
    padding: 24px 16px

  h1
    font-size: 1.75rem
    font-weight: 700
    letter-spacing: -0.02em
    margin: 0 0 8px
    color: #fff

  h2
    font-size: 1.25rem
    font-weight: 600
    margin: 40px 0 16px
    color: #fff

  h3
    font-size: 1rem
    font-weight: 600
    margin: 28px 0 12px
    color: #fff

  p
    font-size: 0.9rem
    line-height: 1.7
    color: $text-secondary
    margin: 0 0 16px

  table
    width: 100%
    border-collapse: collapse
    margin: 16px 0 24px
    font-size: 0.82rem

    th
      text-align: left
      font-weight: 600
      color: $text
      padding: 10px 12px
      border-bottom: 2px solid $border-light

    td
      padding: 10px 12px
      border-bottom: 1px solid $border
      color: $text-secondary

    code
      font-family: $mono
      font-size: 0.78rem
      color: $accent
      background: rgba(129, 140, 248, 0.1)
      padding: 2px 6px
      border-radius: 3px

.sidebar-toggle
  display: none
  position: fixed
  top: 64px
  left: 8px
  z-index: 100
  background: $bg-card
  border: 1px solid $border
  color: $text
  font-size: 1.2rem
  width: 36px
  height: 36px
  border-radius: 6px
  cursor: pointer

  @media (max-width: 768px)
    display: flex
    align-items: center
    justify-content: center

// ─── Sidebar Nav ───
.sidebar-nav
  padding: 16px 0

.sidebar-section
  margin-bottom: 4px

.sidebar-section-header
  appearance: none
  background: transparent
  border: none
  width: 100%
  display: flex
  align-items: center
  justify-content: space-between
  padding: 8px 20px
  font-family: inherit
  font-size: 0.82rem
  font-weight: 600
  color: $text
  cursor: pointer
  text-decoration: none
  transition: background-color 0.15s

  &:hover
    background: rgba(255, 255, 255, 0.04)

  &.external
    color: $text-secondary

  .chevron
    font-size: 0.65rem
    transition: transform 0.2s
    color: $text-secondary

  &.expanded .chevron
    transform: rotate(90deg)

.sidebar-children
  display: flex
  flex-direction: column

.sidebar-link
  font-size: 0.8rem
  color: $text-secondary
  text-decoration: none
  padding: 6px 20px 6px 32px
  transition: color 0.15s, background-color 0.15s

  &:hover
    color: $text
    background: rgba(255, 255, 255, 0.04)

  &.active
    color: $accent
    background: rgba(129, 140, 248, 0.08)
    border-right: 2px solid $accent
```

**Step 2: Build and verify**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx build docs`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/docs/src/styles.sass
git commit -m "feat(docs): add shared docs layout and sidebar styles"
```

---

### Task 15: Final build verification and cleanup

**Step 1: Full build**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx build docs --configuration production`
Expected: PASS with no errors

**Step 2: Serve and manual check**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm exec nx serve docs`

Verify:
- `/` — landing page renders with all 37 plugins, accurate command counts
- `/docs` — redirects to `/docs/getting-started`
- `/docs/getting-started` — renders with sidebar
- `/docs/plugins/guid` — renders plugin detail page
- Sidebar navigation works, mobile hamburger works
- `<cli-panel>` still works at bottom of landing page

Kill the dev server after verification.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(docs): final adjustments from build verification"
```
