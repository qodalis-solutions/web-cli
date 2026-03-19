import { ISyntaxHighlighter } from '@qodalis/cli-core';

export class SyntaxHighlighterRegistry {
    private highlighters = new Map<string, ISyntaxHighlighter>();
    private extensionMap = new Map<string, string>();

    register(highlighter: ISyntaxHighlighter): void {
        this.highlighters.set(highlighter.id, highlighter);
        for (const ext of highlighter.extensions) {
            this.extensionMap.set(ext, highlighter.id);
        }
    }

    unregister(id: string): void {
        const h = this.highlighters.get(id);
        if (h) {
            for (const ext of h.extensions) {
                this.extensionMap.delete(ext);
            }
            this.highlighters.delete(id);
        }
    }

    getByExtension(ext: string): ISyntaxHighlighter | null {
        const id = this.extensionMap.get(ext);
        return id ? this.highlighters.get(id) ?? null : null;
    }

    getRegisteredLanguages(): string[] {
        return Array.from(this.highlighters.keys());
    }
}
