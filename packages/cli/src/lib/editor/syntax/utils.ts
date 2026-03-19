import { Token } from './types';

export function truncateAnsi(str: string, maxCols: number): string {
    let visible = 0;
    let i = 0;
    let result = '';
    let hasActiveColor = false;

    while (i < str.length && visible < maxCols) {
        if (str[i] === '\x1b' && i + 1 < str.length && str[i + 1] === '[') {
            let j = i + 2;
            while (j < str.length && !((str.charCodeAt(j) >= 0x40) && (str.charCodeAt(j) <= 0x7E))) {
                j++;
            }
            if (j < str.length) {
                const seq = str.slice(i, j + 1);
                result += seq;
                if (seq === '\x1b[0m') {
                    hasActiveColor = false;
                } else {
                    hasActiveColor = true;
                }
                i = j + 1;
            } else {
                break;
            }
        } else {
            result += str[i];
            visible++;
            i++;
        }
    }

    if (hasActiveColor) {
        result += '\x1b[0m';
    }

    return result;
}

export function parseTokens(raw: string): Token[] {
    if (!raw) return [];
    return raw.split('\n').map(entry => {
        const [s, e, ...rest] = entry.split(',');
        return { start: parseInt(s, 10), end: parseInt(e, 10), tokenType: rest.join(',') };
    });
}
