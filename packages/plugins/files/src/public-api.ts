/*
 * Public API Surface of files
 */

export * from './lib/index';

import { ICliModule, ICliCompletionProvider_TOKEN } from '@qodalis/cli-core';
import { API_VERSION } from './lib/version';
import { IFileSystemService_TOKEN } from './lib/interfaces';
import { IndexedDbFileSystemService } from './lib/services';
import { IFileSystemService } from './lib/interfaces';
import { FilePathCompletionProvider } from './lib/completion/file-path-completion-provider';
import { CliLsCommandProcessor } from './lib/processors/cli-ls-command-processor';
import { CliCdCommandProcessor } from './lib/processors/cli-cd-command-processor';
import { CliPwdCommandProcessor } from './lib/processors/cli-pwd-command-processor';
import { CliMkdirCommandProcessor } from './lib/processors/cli-mkdir-command-processor';
import { CliRmdirCommandProcessor } from './lib/processors/cli-rmdir-command-processor';
import { CliTouchCommandProcessor } from './lib/processors/cli-touch-command-processor';
import { CliCatCommandProcessor } from './lib/processors/cli-cat-command-processor';
import { CliEchoCommandProcessor } from './lib/processors/cli-echo-command-processor';
import { CliRmCommandProcessor } from './lib/processors/cli-rm-command-processor';
import { CliCpCommandProcessor } from './lib/processors/cli-cp-command-processor';
import { CliMvCommandProcessor } from './lib/processors/cli-mv-command-processor';
import { CliTreeCommandProcessor } from './lib/processors/cli-tree-command-processor';
import { CliHeadCommandProcessor } from './lib/processors/cli-head-command-processor';
import { CliTailCommandProcessor } from './lib/processors/cli-tail-command-processor';
import { CliWcCommandProcessor } from './lib/processors/cli-wc-command-processor';
import { CliFindCommandProcessor } from './lib/processors/cli-find-command-processor';
import { CliGrepCommandProcessor } from './lib/processors/cli-grep-command-processor';

/**
 * Configuration options for the files module.
 */
export interface CliFilesModuleConfig {
    /**
     * Whether to show the current working directory in the CLI prompt.
     * @default true
     */
    showPathInPrompt?: boolean;
}

interface ICliFilesModule extends ICliModule {
    configure(config: CliFilesModuleConfig): ICliModule;
}

const fsService = new IndexedDbFileSystemService();

export const filesModule: ICliFilesModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-files',
    processors: [
        new CliLsCommandProcessor(),
        new CliCdCommandProcessor(),
        new CliPwdCommandProcessor(),
        new CliMkdirCommandProcessor(),
        new CliRmdirCommandProcessor(),
        new CliTouchCommandProcessor(),
        new CliCatCommandProcessor(),
        new CliEchoCommandProcessor(),
        new CliRmCommandProcessor(),
        new CliCpCommandProcessor(),
        new CliMvCommandProcessor(),
        new CliTreeCommandProcessor(),
        new CliHeadCommandProcessor(),
        new CliTailCommandProcessor(),
        new CliWcCommandProcessor(),
        new CliFindCommandProcessor(),
        new CliGrepCommandProcessor(),
    ],
    services: [
        {
            provide: IFileSystemService_TOKEN,
            useValue: fsService,
        },
        {
            provide: ICliCompletionProvider_TOKEN,
            useValue: new FilePathCompletionProvider(fsService),
            multi: true,
        },
    ],

    configure(config: CliFilesModuleConfig): ICliModule {
        return { ...this, config };
    },

    async onInit(context) {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        await fs.initialize();

        const moduleConfig = (this.config || {}) as CliFilesModuleConfig;
        const showPath = moduleConfig.showPathInPrompt !== false;

        if (showPath) {
            context.promptPathProvider = () => fs.getCurrentDirectory();
        }
    },
};
