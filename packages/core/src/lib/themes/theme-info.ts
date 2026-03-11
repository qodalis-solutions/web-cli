import type { ITheme } from '@xterm/xterm';

export type CliThemeCategory = 'dark' | 'light';

export interface CliThemeInfo {
    theme: ITheme;
    category: CliThemeCategory;
    tags: string[];
    description: string;
}
