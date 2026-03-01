import {
    bootCliModule,
    ICliModule,
    ICliCompletionProvider_TOKEN,
} from '@qodalis/cli-core';
import { API_VERSION } from './lib/version';
import { IFileSystemService_TOKEN } from './lib/interfaces';
import { IFileSystemService } from './lib/interfaces';
import { IndexedDbFileSystemService } from './lib/services';
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

const fsService = new IndexedDbFileSystemService();

const module: ICliModule = {
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
    async onInit(context) {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        await fs.initialize();
        context.promptPathProvider = () => fs.getCurrentDirectory();
    },
};

bootCliModule(module);
