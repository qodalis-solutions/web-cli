import { IndexedDbFileSystemService } from '../lib/services';
import { FilePathCompletionProvider } from '../lib/completion/file-path-completion-provider';

describe('FilePathCompletionProvider', () => {
    let provider: FilePathCompletionProvider;

    beforeEach(() => {
        const fs = new IndexedDbFileSystemService();
        fs.createDirectory('/home/user');
        fs.setCurrentDirectory('/home/user');
        fs.createFile('/home/user/my notes.txt', 'x');
        fs.createFile('/home/user/main.ts', 'x');
        fs.createDirectory('/home/user/My Docs');
        provider = new FilePathCompletionProvider(fs);
    });

    const complete = (input: string) => {
        const tokens = input.split(' ');
        const token = input.slice(input.indexOf(' ') + 1);
        return provider.getCompletions({
            input,
            cursor: input.length,
            token,
            tokenStart: input.indexOf(' ') + 1,
            tokenIndex: 1,
            tokens: [tokens[0], token],
        });
    };

    it('quotes names with spaces, leaving directories open', () => {
        expect(complete('cat m')).toEqual(['"My Docs/', '"main.ts"', '"my notes.txt"']);
    });

    it('completes inside an open quote', () => {
        expect(complete('cat "my n')).toEqual(['"my notes.txt"']);
        expect(complete("cat 'My D")).toEqual(["'My Docs/"]);
    });

    it('keeps plain names unquoted', () => {
        expect(complete('cat mai')).toEqual(['main.ts']);
    });

    it('covers the other file commands', () => {
        expect(complete('sort mai')).toEqual(['main.ts']);
        expect(complete('du mai')).toEqual(['main.ts']);
    });
});
