import { ICliUmdModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib';

if (typeof window !== 'undefined') {
    const module: ICliUmdModule = {
        processors: [new CliGuidCommandProcessor()],
    };

    (window as any).guid = module;
} else {
    console.log('window is undefined');
}
