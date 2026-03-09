/*
 * Public API Surface of string
 */

export * from './lib/processors/cli-password-generator-command-processor';

export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliPasswordGeneratorCommandProcessor } from './lib/processors/cli-password-generator-command-processor';
import { API_VERSION } from './lib/version';

export const passwordGeneratorModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-password-generator',
    processors: [new CliPasswordGeneratorCommandProcessor()],
    translations: {
        es: { 'cli.generate-password.description': 'Generar una contraseña segura' },
        fr: { 'cli.generate-password.description': 'Générer un mot de passe sécurisé' },
        de: { 'cli.generate-password.description': 'Ein sicheres Passwort generieren' },
        pt: { 'cli.generate-password.description': 'Gerar uma senha segura' },
        it: { 'cli.generate-password.description': 'Generare una password sicura' },
        ja: { 'cli.generate-password.description': '安全なパスワードを生成' },
        ko: { 'cli.generate-password.description': '안전한 비밀번호 생성' },
        zh: { 'cli.generate-password.description': '生成安全密码' },
        ru: { 'cli.generate-password.description': 'Сгенерировать надёжный пароль' },
        ro: { 'cli.generate-password.description': 'Generează o parolă sigură' },
    },
};
