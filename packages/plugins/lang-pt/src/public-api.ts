import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { ptTranslations } from './lib/translations';

export { ptTranslations } from './lib/translations';

export const langPtModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-pt',
    version: '1.0.0',
    description: 'Portuguese language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.getRequired<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('pt', ptTranslations);
    },
};
