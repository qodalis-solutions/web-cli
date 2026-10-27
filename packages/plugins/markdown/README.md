# @qodalis/cli-markdown

Render Markdown with colors and formatting in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-markdown.svg)](https://www.npmjs.com/package/@qodalis/cli-markdown)
[![license](https://img.shields.io/npm/l/@qodalis/cli-markdown.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-markdown
```

Or install it at runtime in a running terminal:

```bash
pkg add markdown
```

## Usage

Register `markdownModule` with your terminal.

```typescript
import { markdownModule } from '@qodalis/cli-markdown';

// Angular (template)
// <cli [modules]="[markdownModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(markdownModule)];

// React
<Cli modules={[markdownModule]} />

// Vue
<Cli :modules="[markdownModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(markdownModule);
```

## Commands

`md` (alias `markdown`). There are no sub-commands or flags: the text after `md` is the Markdown to render.

| Usage | Description |
|---|---|
| `md <markdown>` | Render inline text, quoted or not; `\n` starts a new line, `\t` inserts a tab |
| `md render <markdown>` | Same; `render`, `preview` and `view` are optional verbs (quote the text to render one of these words literally) |
| `<command> \| md` | Render piped output. Arrays become one line per item, objects a JSON code block |

Supported syntax: headings (`#`, `##`, `###`), bold, italic, inline code, fenced code blocks, links, bullet lists (`-`, `*`, `+`), numbered lists, block quotes and horizontal rules.

```bash
md "## Title"
md "# Title\n- one\n- two"
md render "**bold** and *italic*"
markdown view "See [the docs](https://cli.qodalis.com)"
echo "# Hello" | md
cat README.md | md
```

The `cat` example needs the files plugin (`@qodalis/cli-files`).

## Documentation

https://cli.qodalis.com/docs/plugins/markdown

## License

MIT
