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

/** @deprecated Use getCliNameArt(cols) instead */
export const CLi_Name_Art = CLi_Name_Art_Full;

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
