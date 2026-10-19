import { parseServerAndPath } from '../lib/processors/scp-utils';

describe('scp parseServerAndPath', () => {
    const context: any = {};

    it('splits server and path like a shell', () => {
        expect(parseServerAndPath('node "/my dir/a.txt"', context)).toEqual(['node', '/my dir/a.txt']);
        expect(parseServerAndPath('node /app', context)).toEqual(['node', '/app']);
    });

    it('takes the path alone when --server is given', () => {
        expect(parseServerAndPath("'/a b'", context, { server: 'node' })).toEqual(['node', '/a b']);
        expect(parseServerAndPath('', context)).toBeNull();
    });
});
