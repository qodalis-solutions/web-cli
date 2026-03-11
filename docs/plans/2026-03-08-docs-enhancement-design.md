# Docs Enhancement Design

**Date:** 2026-03-08
**Status:** Approved

## Goal

Enhance the Qodalis CLI documentation by (A) updating the existing landing page to reflect the current CLI state and (B) building a multi-page docs site with sidebar navigation for guides, plugin references, and server integration.

## Architecture

Extend the existing Angular docs app (`apps/docs/`) with Angular Router. The landing page stays at `/`, new docs pages live under `/docs` with a sidebar layout component. TypeDoc auto-generated API reference moves from `/docs/` to `/api/`.

## URL Structure

| URL | Content |
|-----|---------|
| `/` | Landing page (updated with all plugins) |
| `/docs` | Docs shell with sidebar layout |
| `/docs/getting-started` | Install + quick start for Angular/React/Vue |
| `/docs/getting-started/configuration` | Configuration options |
| `/docs/core-concepts/command-processors` | ICliCommandProcessor pattern |
| `/docs/core-concepts/execution-context` | ICliExecutionContext API |
| `/docs/core-concepts/theming` | Themes and customization |
| `/docs/core-concepts/input-reader` | Interactive input methods |
| `/docs/plugins/<name>` | Per-plugin page (all 37) |
| `/docs/plugins/create-your-own` | Plugin scaffolding guide |
| `/docs/server-integration` | Overview + per-backend guides |
| `/docs/server-integration/node` | Node.js server setup |
| `/docs/server-integration/python` | Python server setup |
| `/docs/server-integration/dotnet` | .NET server setup |
| `/docs/language-packs` | i18n overview + list of 10 packs |
| `/api/` | TypeDoc auto-generated API reference |

## Landing Page Updates

- Add all 18 missing plugins to the plugin grid (chart, cron, csv, markdown, scp, stopwatch, wget, + 10 language packs)
- Add language packs section
- Fix "50+ commands" claim to match actual count
- Update framework snippets if APIs have changed
- Add navigation links to the new `/docs` pages

## Docs Layout

- Sidebar on left with collapsible sections
- Content area on right
- Mobile: sidebar becomes a hamburger/drawer
- Dark theme matching existing landing page
- Optional "On this page" anchor nav on wider screens

### Sidebar Sections

1. **Getting Started** - install, quick start (Angular/React/Vue), configuration
2. **Core Concepts** - command processors, execution context, theming, input reader
3. **Plugins** - individual page per plugin (all 37), plus "Create Your Own Plugin"
4. **Server Integration** - Node, Python, .NET setup + connecting frontend to backend
5. **Language Packs** - i18n overview, list of 10 available packs
6. **API Reference** - link to TypeDoc at `/api/`

## Plugin Page Template

Each plugin page includes:
- **Header** - name, npm badge, one-line description
- **Install** - npm/pnpm install snippet
- **Commands** - table of all commands with descriptions
- **Examples** - code snippets showing usage
- **Configuration** - options if applicable
- **Live Demo** - embedded `<cli-panel>` with the plugin loaded (for interactive plugins)

## Data Architecture

Create a `data/` folder instead of hard-coding content:
- `plugins.ts` - array of all plugin metadata
- `commands.ts` - built-in command groups
- `navigation.ts` - sidebar structure

Plugin detail pages use route params to load the right plugin data.

## Implementation Phases

1. **Landing page fix** - update plugin list, command counts, add missing modules
2. **Docs shell** - router setup, sidebar layout, Getting Started pages
3. **Plugin pages** - template component + data for all 37 plugins
4. **Remaining sections** - core concepts, server integration, language packs
5. **Deploy** - update CI to move TypeDoc to `/api/`, configure routing fallback
