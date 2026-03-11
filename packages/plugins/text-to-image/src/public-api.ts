/*
 * Public API Surface of text-to-image
 */

export * from './lib/processors/cli-text-to-image-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliTextToImageCommandProcessor } from './lib/processors/cli-text-to-image-command-processor';
import { API_VERSION } from './lib/version';

export const textToImageModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-text-to-image',
    processors: [new CliTextToImageCommandProcessor()],
    translations: {
        es: { 'cli.text-to-image.description': 'Convertir texto a imagen' },
        fr: { 'cli.text-to-image.description': 'Convertir du texte en image' },
        de: { 'cli.text-to-image.description': 'Text in Bild umwandeln' },
        pt: { 'cli.text-to-image.description': 'Converter texto em imagem' },
        it: { 'cli.text-to-image.description': 'Convertire testo in immagine' },
        ja: { 'cli.text-to-image.description': 'テキストを画像に変換' },
        ko: { 'cli.text-to-image.description': '텍스트를 이미지로 변환' },
        zh: { 'cli.text-to-image.description': '将文本转换为图片' },
        ru: { 'cli.text-to-image.description': 'Преобразование текста в изображение' },
        ro: { 'cli.text-to-image.description': 'Convertire text în imagine' },
    },
};
