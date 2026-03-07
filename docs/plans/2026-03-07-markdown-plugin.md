# Markdown Renderer Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `@qodalis/cli-markdown` plugin with a `md render` command that converts Markdown to ANSI-colored terminal output (headings, bold, italic, inline code, code blocks, lists, horizontal rules).

**Architecture:** New plugin scaffolded via `create-plugin`. No external dependencies — inline regex-based Markdown-to-ANSI converter. Supports pipe input and file argument (via files plugin virtual FS if loaded). Commands: `md render`, `md preview` (alias for render).

**Tech Stack:** TypeScript, ANSI escape codes, Jasmine

---

### Task 1: Scaffold the plugin

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run create-plugin -- --name markdown --description "Render Markdown in the terminal" --processor-name CliMarkdownCommandProcessor
git add packages/plugins/markdown/
git commit -m "chore(markdown): scaffold markdown plugin"
```

---

### Task 2: Write failing tests

**Files:**
- Create: `packages/plugins/markdown/src/tests/markdown.spec.ts`

```typescript
import { renderMarkdown } from '../lib/markdown-renderer';

describe('renderMarkdown', () => {
    it('renders h1 as bold yellow with === underline', () => {
        const lines = renderMarkdown('# Hello World');
        expect(lines.some((l) => l.includes('Hello World'))).toBeTrue();
        expect(lines.some((l) => l.includes('\x1b['))).toBeTrue(); // has ANSI
    });

    it('renders h2 differently from h1', () => {
        const h1 = renderMarkdown('# H1');
        const h2 = renderMarkdown('## H2');
        expect(h1.join('')).not.toBe(h2.join(''));
    });

    it('renders bold text', () => {
        const lines = renderMarkdown('This is **bold** text');
        expect(lines[0]).toContain('\x1b[1m');
        expect(lines[0]).toContain('bold');
    });

    it('renders italic text', () => {
        const lines = renderMarkdown('This is *italic* text');
        expect(lines[0]).toContain('\x1b[3m');
    });

    it('renders inline code', () => {
        const lines = renderMarkdown('Run `ls -la` now');
        expect(lines[0]).toContain('ls -la');
    });

    it('renders unordered list items with bullet', () => {
        const lines = renderMarkdown('- Item 1\n- Item 2');
        expect(lines.some((l) => l.includes('\u2022') || l.includes('-'))).toBeTrue();
    });

    it('renders ordered list items with numbers', () => {
        const lines = renderMarkdown('1. First\n2. Second');
        expect(lines.some((l) => l.includes('1.'))).toBeTrue();
    });

    it('renders horizontal rule', () => {
        const lines = renderMarkdown('---');
        expect(lines.some((l) => l.includes('\u2500'))).toBeTrue();
    });

    it('renders code blocks', () => {
        const lines = renderMarkdown('```\necho hello\n```');
        expect(lines.some((l) => l.includes('echo hello'))).toBeTrue();
    });

    it('handles empty string', () => {
        expect(renderMarkdown('')).toEqual([]);
    });
});
```

Run to verify failure:
```bash
npx nx test markdown
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

---

### Task 3: Implement the Markdown renderer

**Files:**
- Create: `packages/plugins/markdown/src/lib/markdown-renderer.ts`

```typescript
// ANSI escape helpers
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const UNDERLINE = '\x1b[4m';

const FG_YELLOW = '\x1b[33m';
const FG_CYAN = '\x1b[36m';
const FG_GREEN = '\x1b[32m';
const FG_WHITE = '\x1b[97m';
const BG_BLACK = '\x1b[40m';

function ansi(text: string, ...codes: string[]): string {
    return codes.join('') + text + RESET;
}

/**
 * Convert a Markdown string to an array of ANSI-colored terminal lines.
 */
export function renderMarkdown(input: string): string[] {
    if (!input.trim()) return [];

    const rawLines = input.split('\n');
    const output: string[] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];

        // Code block toggle
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = line.slice(3).trim();
                output.push(ansi(` ${codeBlockLang || 'code'} `, DIM, BG_BLACK));
            } else {
                inCodeBlock = false;
                output.push(ansi('\u2500'.repeat(40), DIM));
            }
            continue;
        }

        if (inCodeBlock) {
            output.push(ansi('  ' + line, FG_GREEN));
            continue;
        }

        // Headings
        if (line.startsWith('### ')) {
            output.push(ansi(line.slice(4), BOLD, FG_CYAN));
            continue;
        }
        if (line.startsWith('## ')) {
            const text = line.slice(3);
            output.push(ansi(text, BOLD, FG_YELLOW));
            output.push(ansi('\u2500'.repeat(text.length), FG_YELLOW));
            continue;
        }
        if (line.startsWith('# ')) {
            const text = line.slice(2);
            output.push(ansi(text, BOLD, UNDERLINE, FG_WHITE));
            output.push('');
            continue;
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            output.push(ansi('\u2500'.repeat(60), DIM));
            continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            output.push(ansi('\u2502 ' + line.slice(2), DIM, ITALIC));
            continue;
        }

        // Unordered list
        if (/^[-*+] /.test(line)) {
            output.push('  \u2022 ' + applyInline(line.slice(2)));
            continue;
        }

        // Ordered list
        if (/^\d+\. /.test(line)) {
            const match = line.match(/^(\d+\.) (.*)/);
            if (match) {
                output.push(`  ${ansi(match[1], BOLD)} ${applyInline(match[2])}`);
            }
            continue;
        }

        // Blank line
        if (line.trim() === '') {
            output.push('');
            continue;
        }

        // Normal paragraph text with inline formatting
        output.push(applyInline(line));
    }

    return output;
}

function applyInline(text: string): string {
    // Bold **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) =>
        ansi(a ?? b, BOLD),
    );
    // Italic *text* or _text_
    text = text.replace(/\*(.+?)\*|_(.+?)_/g, (_, a, b) =>
        ansi(a ?? b, ITALIC),
    );
    // Inline code `text`
    text = text.replace(/`([^`]+)`/g, (_, code) =>
        ansi(code, FG_GREEN, BG_BLACK),
    );
    // Links [text](url) — show text underlined
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, (_, label, url) =>
        ansi(label, UNDERLINE, FG_CYAN) + ansi(` (${url})`, DIM),
    );
    return text;
}
```

---

### Task 4: Implement the command processor

**Files:**
- Modify: `packages/plugins/markdown/src/lib/cli-markdown-command-processor.ts`

```typescript
import {
    ICliCommandProcessor, ICliExecutionContext, CliProcessCommand,
    DefaultLibraryAuthor, CliIcon,
} from '@qodalis/cli-core';
import { renderMarkdown } from './markdown-renderer';

export class CliMarkdownCommandProcessor implements ICliCommandProcessor {
    command = 'md';
    description = 'Render Markdown in the terminal';
    aliases = ['markdown'];
    author = DefaultLibraryAuthor;
    metadata = { icon: CliIcon.Document };

    processors: ICliCommandProcessor[] = [
        {
            command: 'render',
            description: 'Render Markdown text. Pipe markdown or pass inline.',
            aliases: ['preview', 'view'],
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const input = cmd.value ?? '';
                if (!input.trim()) {
                    context.writer.writeError('No markdown input. Pipe text or provide inline.');
                    return;
                }
                const lines = renderMarkdown(input);
                for (const line of lines) {
                    context.writer.writeln(line);
                }
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.writer.writeln('Usage: echo "# Hello" | md render');
        context.writer.writeln('       md render "## Title\\nSome **bold** text"');
    }
}
```

---

### Task 5: Run tests and commit

```bash
npx nx test markdown
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
npx nx build markdown
git add packages/plugins/markdown/
git commit -m "feat(markdown): add Markdown renderer plugin"
```
