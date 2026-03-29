import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { frTranslations } from './lib/translations';

export { frTranslations } from './lib/translations';

export const langFrModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-fr',
    version: '1.0.0',
    description: 'French language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.getRequired<ICliTranslationService>(
            ICliTranslationService_TOKEN,
        );
        translator.addTranslations('fr', frTranslations);
    },
};
