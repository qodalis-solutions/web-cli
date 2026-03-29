import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { ruTranslations } from './lib/translations';

export { ruTranslations } from './lib/translations';

export const langRuModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-ru',
    version: '1.0.0',
    description: 'Russian language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.getRequired<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('ru', ruTranslations);
    },
};
