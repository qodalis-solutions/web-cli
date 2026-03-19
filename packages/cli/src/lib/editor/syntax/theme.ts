import { ISyntaxTheme } from '@qodalis/cli-core';

export const defaultSyntaxTheme: ISyntaxTheme = {
    name: 'default',
    colors: {
        keyword:     '\x1b[93m',
        string:      '\x1b[32m',
        number:      '\x1b[36m',
        comment:     '\x1b[90m',
        tag:         '\x1b[91m',
        attribute:   '\x1b[33m',
        value:       '\x1b[36m',
        punctuation: '\x1b[97m',
        heading:     '\x1b[1;93m',
        link:        '\x1b[4;36m',
        bold:        '\x1b[1m',
        italic:      '\x1b[3m',
        code:        '\x1b[90;47m',
    },
};
