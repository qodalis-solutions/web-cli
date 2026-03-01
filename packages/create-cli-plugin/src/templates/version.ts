import { TemplateVars } from './types';

export function versionTemplate(vars: TemplateVars): string {
    return `// Automatically generated during build
export const LIBRARY_VERSION = '${vars.version}';
export const API_VERSION = 2;
`;
}
