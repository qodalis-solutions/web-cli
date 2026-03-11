import { TemplateVars } from './types';

export function cliEntrypointTemplate(vars: TemplateVars): string {
    return `import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { Cli${vars.processorName}CommandProcessor } from './lib/processors/${vars.processorFileName}';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-${vars.name}',
    processors: [new Cli${vars.processorName}CommandProcessor()],
};

bootCliModule(module);
`;
}
