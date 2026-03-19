import { ICliWasmAccelerator } from './types';

/**
 * Pure-JS implementation of ICliWasmAccelerator.
 * Used as the fallback when the WASM module is not available.
 */
export class JsFallbackAccelerator implements ICliWasmAccelerator {
    textSearch(
        text: string,
        needle: string,
        startRow: number,
        startCol: number,
        caseSensitive: boolean,
        wrap: boolean,
    ): [number, number] {
        if (!needle) return [-1, -1];

        const lines = text.split('\n');
        const search = caseSensitive ? needle : needle.toLowerCase();

        // Search from current position to end
        for (let row = startRow; row < lines.length; row++) {
            const line = caseSensitive
                ? lines[row]
                : lines[row].toLowerCase();
            const col = row === startRow ? startCol + 1 : 0;
            const idx = line.indexOf(search, col);
            if (idx !== -1) {
                return [row, idx];
            }
        }

        if (!wrap) return [-1, -1];

        // Wrap around from the beginning
        for (let row = 0; row <= startRow; row++) {
            const line = caseSensitive
                ? lines[row]
                : lines[row].toLowerCase();
            const endCol =
                row === startRow ? startCol : line.length;
            const idx = line.indexOf(search);
            if (idx !== -1 && idx < endCol) {
                return [row, idx];
            }
        }

        return [-1, -1];
    }

    textReplaceAll(
        text: string,
        needle: string,
        replacement: string,
        caseSensitive: boolean,
    ): { count: number; text: string } {
        if (!needle) return { count: 0, text };

        const lines = text.split('\n');
        let count = 0;

        for (let row = 0; row < lines.length; row++) {
            let line = lines[row];
            let newLine = '';
            let searchFrom = 0;

            while (searchFrom <= line.length) {
                const haystack = caseSensitive ? line : line.toLowerCase();
                const search = caseSensitive ? needle : needle.toLowerCase();
                const idx = haystack.indexOf(search, searchFrom);
                if (idx === -1) {
                    newLine += line.slice(searchFrom);
                    break;
                }
                newLine += line.slice(searchFrom, idx) + replacement;
                searchFrom = idx + needle.length;
                count++;
            }

            if (lines[row] !== newLine) {
                lines[row] = newLine;
            }
        }

        return { count, text: lines.join('\n') };
    }

    prefixMatch(candidates: string[], prefix: string): string[] {
        const lowerPrefix = prefix.toLowerCase();
        const matches: string[] = [];

        for (const candidate of candidates) {
            if (candidate.toLowerCase().startsWith(lowerPrefix)) {
                matches.push(candidate);
            }
        }

        return matches.sort();
    }

    private ruleSets = new Map<string, Array<{ pattern: RegExp; tokenType: string; captureGroup: number }>>();

    registerRuleSet(ruleSetId: string, rules: string): void {
        const parsed: Array<{ pattern: RegExp; tokenType: string; captureGroup: number }> = [];
        for (const line of rules.split('\n')) {
            if (!line) continue;
            const parts = line.split('\t');
            if (parts.length < 2) continue;
            try {
                parsed.push({
                    pattern: new RegExp(parts[0]),
                    tokenType: parts[1],
                    captureGroup: parts[2] ? parseInt(parts[2], 10) : 0,
                });
            } catch {
                // skip invalid regex
            }
        }
        this.ruleSets.set(ruleSetId, parsed);
    }

    tokenizeLine(line: string, ruleSetId: string): string {
        const rules = this.ruleSets.get(ruleSetId);
        if (!rules || !line) return '';

        const tokens: string[] = [];
        let pos = 0;

        while (pos < line.length) {
            let matched = false;

            for (const rule of rules) {
                rule.pattern.lastIndex = 0;
                const sliced = line.slice(pos);
                const m = rule.pattern.exec(sliced);
                if (m) {
                    let start: number;
                    let end: number;
                    if (rule.captureGroup > 0 && m[rule.captureGroup] !== undefined) {
                        const groupText = m[rule.captureGroup];
                        const groupOffset = m[0].indexOf(groupText);
                        start = pos + m.index + groupOffset;
                        end = start + groupText.length;
                    } else {
                        start = pos + m.index;
                        end = pos + m.index + m[0].length;
                    }

                    if (pos + m.index + m[0].length > pos) {
                        tokens.push(`${start},${end},${rule.tokenType}`);
                        pos = pos + m.index + m[0].length;
                        matched = true;
                        break;
                    }
                }
            }

            if (!matched) {
                pos++;
            }
        }

        return tokens.join('\n');
    }

    commonPrefix(strings: string[]): string {
        if (strings.length === 0) return '';
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (!strings[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
                if (prefix === '') return '';
            }
        }
        return prefix;
    }
}
