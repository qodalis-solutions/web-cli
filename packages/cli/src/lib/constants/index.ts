import { CliBranding } from '@qodalis/cli-core';

const CLi_Name_Art_Full = `
   ____            _       _ _        _____ _      _____
  / __ \\          | |     | (_)      / ____| |    |_   _|
 | |  | | ___   __| | __ _| |_ ___  | |    | |      | |
 | |  | |/ _ \\ / _\` |/ _\` | | / __| | |    | |      | |
 | |__| | (_) | (_| | (_| | | \\__ \\ | |____| |____ _| |_
  \\___\\_\\\\___/ \\__,_|\\__,_|_|_|___/  \\_____|______|_____|
`;

const CLi_Name_Art_Compact = `
  ___          _      _ _
 / _ \\ ___  __| |__ _| (_)___
| (_) / _ \\/ _\` / _\` | | (_-<
 \\__\\_\\___/\\__,_\\__,_|_|_/__/  CLI
`;

export const getCliNameArt = (cols: number): string => {
    if (cols >= 60) {
        return CLi_Name_Art_Full;
    }
    if (cols >= 35) {
        return CLi_Name_Art_Compact;
    }
    return '\n  Qodalis CLI\n';
};

/** The branding with every default filled in (see `CliOptions.branding`). */
export interface ResolvedCliBranding {
    /** The product name ('Web CLI' by default). */
    name: string;
    /** True when the host set its own name. */
    custom: boolean;
    /** The panel's icon URL, if the host set one. */
    icon?: string;
    /** The welcome banner's art: Qodalis CLI's, or the host's name. */
    art(cols: number): string;
}

export const DEFAULT_CLI_NAME = 'Web CLI';

/** The CLI's name and icon: the host's `CliOptions.branding`, or Qodalis CLI's. */
export const resolveCliBranding = (
    branding?: CliBranding,
): ResolvedCliBranding => {
    const custom = branding?.name?.trim() || undefined;
    const name = custom ?? DEFAULT_CLI_NAME;
    const icon = branding?.icon?.trim() || undefined;
    return {
        name,
        custom: !!custom,
        icon,
        art: (cols) => (custom ? `\n  ${custom}\n` : getCliNameArt(cols)),
    };
};

export const hotkeysInfo = [
    {
        key: 'Ctrl + C',
        description: 'Cancel command or copy selection',
    },
    {
        key: 'Ctrl + V',
        description: 'Paste from clipboard',
    },
    {
        key: 'Ctrl + L',
        description: 'Clear the terminal screen',
    },
    {
        key: 'Escape',
        description: 'Cancel and start a new line',
    },
    {
        key: '↑ / ↓',
        description: 'Navigate command history (each user has their own)',
    },
    {
        key: 'Tab',
        description: 'Autocomplete command',
    },
    {
        key: 'Ctrl + A / Home',
        description: 'Move to the start of the line',
    },
    {
        key: 'Ctrl + E / End',
        description: 'Move to the end of the line',
    },
    {
        key: 'Ctrl + U',
        description: 'Cut from the start of the line to the cursor',
    },
    {
        key: 'Ctrl + K',
        description: 'Cut from the cursor to the end of the line',
    },
    {
        key: 'Ctrl + W',
        description: 'Cut the previous word (also Alt + Backspace)',
    },
    {
        key: 'Ctrl + Y',
        description: 'Paste the last cut text',
    },
    {
        key: 'Ctrl + D / Del',
        description: 'Delete the character under the cursor',
    },
];
