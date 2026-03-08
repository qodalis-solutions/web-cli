import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { itTranslations } from './lib/translations';

export { itTranslations } from './lib/translations';

export const langItModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-it',
    version: '1.0.0',
    description: 'Italian language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.get<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('it', itTranslations);
    },
};
