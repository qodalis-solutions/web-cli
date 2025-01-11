import { DefaultThemes } from '@qodalis/cli-core';
import { ITheme } from '@xterm/xterm';

export type ThemeState = {
    selectedTheme?: string;
    customOptions?: ITheme;
};

export const themes = {
    ...DefaultThemes,
};
