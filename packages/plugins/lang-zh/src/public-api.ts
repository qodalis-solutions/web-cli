import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { zhTranslations } from './lib/translations';

export { zhTranslations } from './lib/translations';

export const langZhModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-zh',
    version: '1.0.0',
    description: 'Chinese language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.getRequired<ICliTranslationService>(ICliTranslationService_TOKEN);
        translator.addTranslations('zh', zhTranslations);
    },
};
