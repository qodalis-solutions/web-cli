/*
 * Public API Surface of browser-storage
 */

export * from './lib/index';

import { ICliModule } from '@qodalis/cli-core';
import { CliCookiesCommandProcessor } from './lib/processors/cli-cookies-command-processor';
import { CliLocalStorageCommandProcessor } from './lib/processors/cli-local-storage-command-processor';
import { API_VERSION } from './lib/version';

export const browserStorageModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-browser-storage',
    processors: [
        new CliCookiesCommandProcessor(),
        new CliLocalStorageCommandProcessor(),
    ],
    translations: {
        es: {
            'cli.cookies.description': 'Gestionar cookies del navegador',
            'cli.local-storage.description': 'Gestionar el almacenamiento local del navegador',
        },
        fr: {
            'cli.cookies.description': 'Gérer les cookies du navigateur',
            'cli.local-storage.description': 'Gérer le stockage local du navigateur',
        },
        de: {
            'cli.cookies.description': 'Browser-Cookies verwalten',
            'cli.local-storage.description': 'Lokalen Browserspeicher verwalten',
        },
        pt: {
            'cli.cookies.description': 'Gerenciar cookies do navegador',
            'cli.local-storage.description': 'Gerenciar o armazenamento local do navegador',
        },
        it: {
            'cli.cookies.description': 'Gestire i cookie del browser',
            'cli.local-storage.description': 'Gestire la memoria locale del browser',
        },
        ja: {
            'cli.cookies.description': 'ブラウザのCookieを管理',
            'cli.local-storage.description': 'ブラウザのローカルストレージを管理',
        },
        ko: {
            'cli.cookies.description': '브라우저 쿠키 관리',
            'cli.local-storage.description': '브라우저 로컬 스토리지 관리',
        },
        zh: {
            'cli.cookies.description': '管理浏览器 Cookie',
            'cli.local-storage.description': '管理浏览器本地存储',
        },
        ru: {
            'cli.cookies.description': 'Управление cookies браузера',
            'cli.local-storage.description': 'Управление локальным хранилищем браузера',
        },
        ro: {
            'cli.cookies.description': 'Gestionare cookie-uri ale browserului',
            'cli.local-storage.description': 'Gestionare stocare locală a browserului',
        },
    },
};
