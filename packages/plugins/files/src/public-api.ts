/*
 * Public API Surface of files
 */

export * from './lib/index';

import { ICliModule, ICliCompletionProvider_TOKEN, ICliFileTransferService_TOKEN, ICliDragDropService, ICliDragDropService_TOKEN, ICliExecutionContext } from '@qodalis/cli-core';
import { Subscription } from 'rxjs';
import { API_VERSION } from './lib/version';
import { IFileSystemService_TOKEN } from './lib/interfaces';
import { IndexedDbFileSystemService, VirtualFsFileTransferService } from './lib/services';
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
import { CliTacCommandProcessor } from './lib/processors/cli-tac-command-processor';
import { CliBasenameCommandProcessor } from './lib/processors/cli-basename-command-processor';
import { CliDirnameCommandProcessor } from './lib/processors/cli-dirname-command-processor';
import { CliSortCommandProcessor } from './lib/processors/cli-sort-command-processor';
import { CliUniqCommandProcessor } from './lib/processors/cli-uniq-command-processor';
import { CliCutCommandProcessor } from './lib/processors/cli-cut-command-processor';
import { CliPasteCommandProcessor } from './lib/processors/cli-paste-command-processor';
import { CliTrCommandProcessor } from './lib/processors/cli-tr-command-processor';
import { CliStatCommandProcessor } from './lib/processors/cli-stat-command-processor';
import { CliChmodCommandProcessor } from './lib/processors/cli-chmod-command-processor';
import { CliChownCommandProcessor } from './lib/processors/cli-chown-command-processor';
import { CliDuCommandProcessor } from './lib/processors/cli-du-command-processor';
import { CliLnCommandProcessor } from './lib/processors/cli-ln-command-processor';
import { CliSedCommandProcessor } from './lib/processors/cli-sed-command-processor';
import { CliAwkCommandProcessor } from './lib/processors/cli-awk-command-processor';
import { CliDiffCommandProcessor } from './lib/processors/cli-diff-command-processor';
import { CliTeeCommandProcessor } from './lib/processors/cli-tee-command-processor';
import { CliXargsCommandProcessor } from './lib/processors/cli-xargs-command-processor';
import { CliShCommandProcessor } from './lib/processors/cli-sh-command-processor';
import { CliUploadCommandProcessor } from './lib/processors/cli-upload-command-processor';

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
        new CliTacCommandProcessor(),
        new CliBasenameCommandProcessor(),
        new CliDirnameCommandProcessor(),
        new CliSortCommandProcessor(),
        new CliUniqCommandProcessor(),
        new CliCutCommandProcessor(),
        new CliPasteCommandProcessor(),
        new CliTrCommandProcessor(),
        new CliStatCommandProcessor(),
        new CliChmodCommandProcessor(),
        new CliChownCommandProcessor(),
        new CliDuCommandProcessor(),
        new CliLnCommandProcessor(),
        new CliSedCommandProcessor(),
        new CliAwkCommandProcessor(),
        new CliDiffCommandProcessor(),
        new CliTeeCommandProcessor(),
        new CliXargsCommandProcessor(),
        new CliShCommandProcessor(),
        new CliUploadCommandProcessor(),
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
        {
            provide: ICliFileTransferService_TOKEN,
            useValue: new VirtualFsFileTransferService(fsService),
        },
    ],

    translations: {
        es: { 'cli.files.description': 'Sistema de archivos virtual en el navegador' },
        fr: { 'cli.files.description': 'Système de fichiers virtuel dans le navigateur' },
        de: { 'cli.files.description': 'Virtuelles Dateisystem im Browser' },
        pt: { 'cli.files.description': 'Sistema de arquivos virtual no navegador' },
        it: { 'cli.files.description': 'File system virtuale nel browser' },
        ja: { 'cli.files.description': 'ブラウザ内仮想ファイルシステム' },
        ko: { 'cli.files.description': '브라우저 내 가상 파일 시스템' },
        zh: { 'cli.files.description': '浏览器内虚拟文件系统' },
        ru: { 'cli.files.description': 'Виртуальная файловая система в браузере' },
        ro: { 'cli.files.description': 'Sistem de fișiere virtual în browser' },
    },

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

        let dragDrop: ICliDragDropService | undefined;
        try {
            dragDrop = context.services.get<ICliDragDropService>(ICliDragDropService_TOKEN);
        } catch {
            // service not registered (e.g. test environment) — skip
        }

        if (dragDrop) {
            (this as any)._dragDropSubscription = dragDrop.onFileDrop.subscribe((files) => {
                files.forEach((file) => {
                    const reader = new FileReader();
                    reader.onload = async () => {
                        const content = reader.result as string;
                        const dest = fs.resolvePath(
                            fs.getCurrentDirectory() + '/' + file.name,
                        );
                        await fs.writeFile(dest, content);
                        await fs.persist();
                        context.writer.writeSuccess(
                            `Uploaded: ${file.name} (${file.size} bytes) → ${dest}`,
                        );
                    };
                    reader.onerror = () => {
                        context.writer.writeError(`Failed to read dropped file: ${file.name}`);
                    };
                    if (file.type && !file.type.startsWith('text/') && file.type !== 'application/json') {
                        context.writer.writeWarning(`${file.name}: may be a binary file — uploading as text (content may be corrupted)`);
                    }
                    reader.readAsText(file);
                });
            });
        }
    },

    async onDestroy(_context: ICliExecutionContext): Promise<void> {
        const sub: Subscription | undefined = (this as any)._dragDropSubscription;
        sub?.unsubscribe();
        (this as any)._dragDropSubscription = undefined;
    },
};
