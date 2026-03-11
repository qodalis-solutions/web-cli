import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { deTranslations } from './lib/translations';

export { deTranslations } from './lib/translations';

export const langDeModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-de',
    version: '1.0.0',
    description: 'German language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.get<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('de', deTranslations);
    },
};
