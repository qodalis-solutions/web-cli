import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { roTranslations } from './lib/translations';

export { roTranslations } from './lib/translations';

export const langRoModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-ro',
    version: '1.0.0',
    description: 'Romanian language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.get<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('ro', roTranslations);
    },
};
