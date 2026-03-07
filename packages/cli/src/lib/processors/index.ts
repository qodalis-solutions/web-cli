import { CliAliasCommandProcessor } from './cli-alias-command-processor';
import { CliCaptureCommandProcessor } from './cli-capture-command-processor';
import { CliBase64CommandProcessor } from './cli-base64-command-processor';
import { CliCalCommandProcessor } from './cli-cal-command-processor';
import { CliClearCommandProcessor } from './cli-clear-command-processor';
import { CliClipboardCommandProcessor } from './cli-clipboard-command-processor';
import { CliColorCommandProcessor } from './cli-color-command-processor';
import { CliConvertCommandProcessor } from './cli-convert-command-processor';
import { CliEchoCommandProcessor } from './cli-echo-command-processor';
import { CliEvalCommandProcessor } from './cli-eval-command-processor';
import { CliHashCommandProcessor } from './cli-hash-command-processor';
import { CliHexCommandProcessor } from './cli-hex-command-processor';
import { CliJsonCommandProcessor } from './cli-json-command-processor';
import { CliJwtCommandProcessor } from './cli-jwt-command-processor';
import { CliLoremCommandProcessor } from './cli-lorem-command-processor';
import { CliOpenCommandProcessor } from './cli-open-command-processor';
import { CliRandomCommandProcessor } from './cli-random-command-processor';
import { CliScreenCommandProcessor } from './cli-screen-command-processor';
import { CliSeqCommandProcessor } from './cli-seq-command-processor';
import { CliSleepCommandProcessor } from './cli-sleep-command-processor';
import { CliTimeCommandProcessor } from './cli-time-command-processor';
import { CliTimestampCommandProcessor } from './cli-timestamp-command-processor';
import { CliUnAliasCommandProcessor } from './cli-unalias-command-processor';
import { CliUnameCommandProcessor } from './cli-uname-command-processor';
import { CliUptimeCommandProcessor } from './cli-uptime-command-processor';
import { CliUrlCommandProcessor } from './cli-url-command-processor';
import { CliYesCommandProcessor } from './cli-yes-command-processor';
import { CliConfigureCommandProcessor } from './configure/cli-configure-command-processor';

export * from './cli-echo-command-processor';
export * from './cli-clear-command-processor';
export * from './cli-alias-command-processor';
export * from './cli-unalias-command-processor';
export * from './cli-sleep-command-processor';
export * from './cli-time-command-processor';
export * from './cli-base64-command-processor';
export * from './cli-json-command-processor';
export * from './cli-url-command-processor';
export * from './cli-hash-command-processor';
export * from './cli-random-command-processor';
export * from './cli-uptime-command-processor';
export * from './cli-open-command-processor';
export * from './cli-lorem-command-processor';
export * from './cli-timestamp-command-processor';
export * from './cli-color-command-processor';
export * from './cli-jwt-command-processor';
export * from './cli-cal-command-processor';
export * from './cli-seq-command-processor';
export * from './cli-screen-command-processor';
export * from './cli-hex-command-processor';
export * from './cli-clipboard-command-processor';
export * from './cli-convert-command-processor';
export * from './cli-yes-command-processor';
export * from './cli-eval-command-processor';
export * from './cli-uname-command-processor';
export * from './cli-capture-command-processor';
export * from './cli-snippet-command-processor';

export * from './system';
export * from './theme/cli-theme-command-processor';
export * from './theme/types';
export * from './configure/cli-configure-command-processor';
export * from './configure/types';
export * from './cli-ping-command-processor';
export * from './cli-env-command-processor';
export * from './cli-font-size-command-processor';

import { ICliCommandProcessor } from '@qodalis/cli-core';
import { systemProcessors } from './system';
import { CliThemeCommandProcessor } from './theme/cli-theme-command-processor';
import { CliPingCommandProcessor } from './cli-ping-command-processor';
import {
    CliExportCommandProcessor,
    CliUnsetCommandProcessor,
    CliEnvCommandProcessor,
} from './cli-env-command-processor';
import { CliFontSizeCommandProcessor } from './cli-font-size-command-processor';
import { CliSnippetCommandProcessor } from './cli-snippet-command-processor';

export const miscProcessors = [
    new CliClearCommandProcessor(),
    new CliEchoCommandProcessor(),
    new CliEvalCommandProcessor(),
    new CliAliasCommandProcessor(),
    new CliUnAliasCommandProcessor(),
    new CliSleepCommandProcessor(),
    new CliUnameCommandProcessor(),
    new CliTimeCommandProcessor(),
    new CliBase64CommandProcessor(),
    new CliJsonCommandProcessor(),
    new CliUrlCommandProcessor(),
    new CliHashCommandProcessor(),
    new CliRandomCommandProcessor(),
    new CliUptimeCommandProcessor(),
    new CliOpenCommandProcessor(),
    new CliLoremCommandProcessor(),
    new CliTimestampCommandProcessor(),
    new CliColorCommandProcessor(),
    new CliJwtCommandProcessor(),
    new CliCalCommandProcessor(),
    new CliSeqCommandProcessor(),
    new CliScreenCommandProcessor(),
    new CliHexCommandProcessor(),
    new CliClipboardCommandProcessor(),
    new CliConvertCommandProcessor(),
    new CliYesCommandProcessor(),
];

export const builtinProcessors: ICliCommandProcessor[] = [
    ...miscProcessors,
    ...systemProcessors,
    new CliThemeCommandProcessor(),
    new CliConfigureCommandProcessor(),
    new CliPingCommandProcessor(),
    new CliExportCommandProcessor(),
    new CliUnsetCommandProcessor(),
    new CliEnvCommandProcessor(),
    new CliFontSizeCommandProcessor(),
    new CliCaptureCommandProcessor(),
    new CliSnippetCommandProcessor(),
];
