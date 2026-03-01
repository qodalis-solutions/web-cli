import { TemplateVars } from './types';

export function versionTemplate(vars: TemplateVars): string {
    const majorVersion = vars.version.split('.')[0];
    return `// Automatically generated during build
export const LIBRARY_VERSION = '${vars.version}';
export const API_VERSION = ${majorVersion};
`;
}
