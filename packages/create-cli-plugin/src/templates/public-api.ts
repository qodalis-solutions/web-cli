import { TemplateVars } from './types';

export function publicApiTemplate(vars: TemplateVars): string {
    return `/*
 * Public API Surface of ${vars.name}
 */

export * from './lib/processors/${vars.processorFileName}';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { Cli${vars.processorName}CommandProcessor } from './lib/processors/${vars.processorFileName}';
import { API_VERSION } from './lib/version';

export const ${vars.name}Module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-${vars.name}',
    processors: [new Cli${vars.processorName}CommandProcessor()],
};
`;
}
