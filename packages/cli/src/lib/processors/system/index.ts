import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliHelpCommandProcessor } from './cli-help-command-processor';
import { CliVersionCommandProcessor } from './cli-version-command-processor';
import { CliFeedbackCommandProcessor } from './cli-feedback-command-processor';
import { CliHistoryCommandProcessor } from './cli-history-command-processor';
import { CliHotKeysCommandProcessor } from './cli-hot-keys-command-processor';
import { CliPackagesCommandProcessor } from './cli-packages-command-processor';
import { CliDebugCommandProcessor } from './cli-debug-command-processor';
import { CliNanoCommandProcessor } from './cli-nano-command-processor';
import { CliServicesCommandProcessor } from './cli-services-command-processor';

export { CliHelpCommandProcessor } from './cli-help-command-processor';
export { CliVersionCommandProcessor } from './cli-version-command-processor';
export { CliFeedbackCommandProcessor } from './cli-feedback-command-processor';
export { CliHistoryCommandProcessor } from './cli-history-command-processor';
export { CliHotKeysCommandProcessor } from './cli-hot-keys-command-processor';
export { CliPackagesCommandProcessor } from './cli-packages-command-processor';
export { CliDebugCommandProcessor } from './cli-debug-command-processor';
export { CliNanoCommandProcessor } from './cli-nano-command-processor';
export { CliServicesCommandProcessor } from './cli-services-command-processor';

export const systemProcessors: ICliCommandProcessor[] = [
    new CliHelpCommandProcessor(),
    new CliVersionCommandProcessor(),
    new CliFeedbackCommandProcessor(),
    new CliHistoryCommandProcessor(),
    new CliPackagesCommandProcessor(),
    new CliHotKeysCommandProcessor(),
    new CliDebugCommandProcessor(),
    new CliNanoCommandProcessor(),
    new CliServicesCommandProcessor(),
];
