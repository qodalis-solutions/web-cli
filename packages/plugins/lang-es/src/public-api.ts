import { ICliModule, ICliTranslationService, ICliTranslationService_TOKEN, API_VERSION } from '@qodalis/cli-core';
import { esTranslations } from './lib/translations';

export { esTranslations } from './lib/translations';

export const langEsModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-lang-es',
    version: '1.0.0',
    description: 'Spanish language pack for Qodalis CLI',
    async onInit(context) {
        const translator = context.services.getRequired<ICliTranslationService>(
            ICliTranslationService_TOKEN,
        );
        translator.addTranslations('es', esTranslations);
    },
};
