import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { jaTranslations } from './lib/translations';

export { jaTranslations } from './lib/translations';

export const langJaModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-ja',
    version: '1.0.0',
    description: 'Japanese language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.get<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('ja', jaTranslations);
    },
};
