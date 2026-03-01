import { TemplateVars } from './types';

export function moduleTemplate(vars: TemplateVars): string {
    return `import { ICliModule } from '@qodalis/cli-core';
import { Cli${vars.processorName}CommandProcessor } from './processors/${vars.processorFileName}';
import { API_VERSION } from './version';

export const ${vars.name}Module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-${vars.name}',
    processors: [new Cli${vars.processorName}CommandProcessor()],
};
`;
}
