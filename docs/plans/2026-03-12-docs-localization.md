# Docs App Localization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add runtime i18n to the docs app using `@ngx-translate/core`, supporting 11 languages (en, es, de, fr, it, ja, ko, pt, ro, ru, zh) — the same languages as the CLI language packs.

**Architecture:** Install `@ngx-translate/core` + `@ngx-translate/http-loader`. JSON translation files under `assets/i18n/`. Language switcher in nav bar with browser auto-detection + localStorage persistence. Templates use `translate` pipe for all UI text; code blocks remain untranslated.

**Tech Stack:** Angular 16, @ngx-translate/core, @ngx-translate/http-loader

---

### Task 1: Install ngx-translate dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run (from `web-cli/`):
```bash
pnpm add @ngx-translate/core@^15.0.0 @ngx-translate/http-loader@^8.0.0
```

Expected: packages added to `dependencies` in root `package.json`

**Step 2: Verify installation**

Run: `ls node_modules/@ngx-translate/core node_modules/@ngx-translate/http-loader`
Expected: both directories exist

---

### Task 2: Create language metadata and TranslateModule setup

**Files:**
- Create: `apps/docs/src/app/data/languages.ts`
- Modify: `apps/docs/src/app/app.module.ts`

**Step 1: Create language metadata**

Create `apps/docs/src/app/data/languages.ts`:

```typescript
export interface Language {
    code: string;
    name: string;
    nativeName: string;
}

export const LANGUAGES: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

export const DEFAULT_LANG = 'en';
export const LANG_STORAGE_KEY = 'docs-locale';
```

**Step 2: Configure TranslateModule in AppModule**

Modify `apps/docs/src/app/app.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AppComponent } from './app.component';
import { CliModule } from '@qodalis/angular-cli';
import { AppRoutingModule } from './app-routing.module';

export function HttpLoaderFactory(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        CliModule,
        AppRoutingModule,
        TranslateModule.forRoot({
            defaultLanguage: 'en',
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient],
            },
        }),
    ],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {}
```

---

### Task 3: Export TranslateModule from SharedModule

**Files:**
- Modify: `apps/docs/src/app/shared/shared.module.ts`

**Step 1: Update SharedModule**

```typescript
import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CopyCodeDirective } from './copy-code.directive';

@NgModule({
    declarations: [CopyCodeDirective],
    imports: [TranslateModule],
    exports: [CopyCodeDirective, TranslateModule],
})
export class SharedModule {}
```

---

### Task 4: Create English translation file (source of truth)

**Files:**
- Create: `apps/docs/src/assets/i18n/en.json`

**Step 1: Create English translation file**

Extract all translatable strings from templates into flat dot-notation keys. Code blocks, code labels, framework names, and technical identifiers stay untranslated. Create `apps/docs/src/assets/i18n/en.json` with all keys.

Key structure:
- `nav.*` — navigation bar
- `footer.*` — footer
- `home.*` — home page (hero, features, commands, plugins, CTA sections)
- `sidebar.*` — sidebar navigation labels
- `docs.getting-started.*` — getting started page
- `docs.built-in-commands.*` — built-in commands page
- `docs.configuration.*` — configuration page
- `docs.core-concepts.*` — core concepts (command-processors, execution-context, theming, input-reader, tabs-and-panes)
- `docs.create-plugin.*` — create plugin page
- `docs.plugin-detail.*` — plugin detail page
- `docs.language-packs.*` — language packs page
- `docs.server-integration.*` — server integration page
- `docs.server-detail.*` — server detail pages (node, python, dotnet)

---

### Task 5: Add language switcher to nav bar and initialize translation service

**Files:**
- Modify: `apps/docs/src/app/app.component.ts`
- Modify: `apps/docs/src/app/app.component.html`
- Modify: `apps/docs/src/app/app.component.sass`

**Step 1: Update AppComponent to initialize TranslateService**

Add language initialization with browser detection + localStorage persistence, and a language switcher dropdown to the nav bar. The dropdown shows the current language's nativeName and lists all 11 languages.

**Step 2: Update nav template**

Add a language switcher dropdown between the nav links. Use `translate` pipe for nav link text (`nav.docs`, `nav.npm`, `nav.github`) and footer text.

**Step 3: Style the language switcher**

Add SASS for a compact dropdown: current language button with a chevron, dropdown panel that opens on click, each option showing nativeName.

---

### Task 6: Convert Home page template to use translate pipe

**Files:**
- Modify: `apps/docs/src/app/pages/home/home.module.ts` — import SharedModule (which exports TranslateModule)
- Modify: `apps/docs/src/app/pages/home/home.component.html` — replace hardcoded strings with `{{ 'key' | translate }}` or `[translate]="'key'"`
- Modify: `apps/docs/src/app/pages/home/home.component.ts` — move translatable data strings to use translation keys

Replace all prose text with translate pipe calls. Keep code blocks, framework names, and command examples untranslated.

For data-driven content (features array, advancedFeatures array), use translation keys as values and resolve them in the template with the translate pipe.

---

### Task 7: Convert Sidebar navigation to use translate pipe

**Files:**
- Modify: `apps/docs/src/app/pages/docs/docs.module.ts` — import SharedModule
- Modify: `apps/docs/src/app/pages/docs/components/sidebar/sidebar.component.html` — use translate pipe for labels
- Modify: `apps/docs/src/app/data/navigation.ts` — change labels to translation keys

Change `NavItem.label` values from display strings to i18n keys (e.g., `'sidebar.getting-started'`). In the sidebar template, pipe labels through `translate`.

---

### Task 8: Convert docs page templates to use translate pipe

**Files:**
- Modify: Each docs page module to import SharedModule
- Modify: Each docs page template (getting-started, built-in-commands, configuration, core-concepts, create-plugin, plugin-detail, language-packs, server-integration, server-detail)

For each page:
1. Import `SharedModule` (which re-exports `TranslateModule`) in the page module
2. Replace hardcoded prose text with `{{ 'docs.page-name.key' | translate }}`
3. Keep code blocks, code labels, and technical content untranslated
4. For tables with translatable headers, use translate pipe on `<th>` content
5. For data-driven table rows (like commands list, themes list), keep technical values untranslated but translate column headers

---

### Task 9: Create translation files for all 10 non-English languages

**Files:**
- Create: `apps/docs/src/assets/i18n/es.json`
- Create: `apps/docs/src/assets/i18n/de.json`
- Create: `apps/docs/src/assets/i18n/fr.json`
- Create: `apps/docs/src/assets/i18n/it.json`
- Create: `apps/docs/src/assets/i18n/ja.json`
- Create: `apps/docs/src/assets/i18n/ko.json`
- Create: `apps/docs/src/assets/i18n/pt.json`
- Create: `apps/docs/src/assets/i18n/ro.json`
- Create: `apps/docs/src/assets/i18n/ru.json`
- Create: `apps/docs/src/assets/i18n/zh.json`

Each file must have the same keys as `en.json` with properly translated values. Code identifiers, command names, CSS property names, and technical terms should NOT be translated.

---

### Task 10: Build verification and cleanup

**Step 1: Build the docs app**

Run (from `web-cli/`):
```bash
pnpm run build:core && pnpm run build:cli && pnpm run build:angular-cli && npx nx build docs
```

Expected: Build succeeds with no errors

**Step 2: Verify translation files are in build output**

Run: `ls dist/docs/assets/i18n/`
Expected: All 11 JSON files present

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(docs): add i18n localization with 11 languages

- Install @ngx-translate/core and @ngx-translate/http-loader
- Add language switcher dropdown in nav bar
- Browser language auto-detection with localStorage persistence
- Convert all docs page templates to use translate pipe
- Create translation files for en, es, de, fr, it, ja, ko, pt, ro, ru, zh
- Same language set as CLI language packs"
```
