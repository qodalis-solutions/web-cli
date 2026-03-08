import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { koTranslations } from './lib/translations';

export { koTranslations } from './lib/translations';

export const langKoModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-ko',
    version: '1.0.0',
    description: 'Korean language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.get<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('ko', koTranslations);
    },
};
