import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { CliChownCommandProcessor } from '../lib/processors/cli-chown-command-processor';
import { createStubWriter, createMockContext, makeCommand } from './helpers';

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/file1.txt', 'hello');
    fs.createDirectory('/home/user/subdir');
    fs.createFile('/home/user/subdir/nested.txt', 'nested');
    return fs;
}

describe('CliChownCommandProcessor', () => {
    let processor: CliChownCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliChownCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "chown"', () => {
        expect(processor.command).toBe('chown');
    });

    it('should set owner and group with user:group syntax', async () => {
        const cmd = makeCommand('chown alice:dev /home/user/file1.txt');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/file1.txt');
        expect(node!.ownership).toEqual({ uid: 'alice', gid: 'dev' });
    });

    it('should set only owner when no colon', async () => {
        // First set some ownership
        fs.chown('/home/user/file1.txt', { uid: 'root', gid: 'admin' });
        const cmd = makeCommand('chown bob /home/user/file1.txt');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/file1.txt');
        expect(node!.ownership!.uid).toBe('bob');
        expect(node!.ownership!.gid).toBe('admin'); // preserved
    });

    it('should set only group with :group syntax', async () => {
        fs.chown('/home/user/file1.txt', { uid: 'root', gid: 'admin' });
        const cmd = makeCommand('chown :staff /home/user/file1.txt');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/file1.txt');
        expect(node!.ownership!.uid).toBe('root'); // preserved
        expect(node!.ownership!.gid).toBe('staff');
    });

    it('should apply recursively with -R', async () => {
        const cmd = makeCommand('chown -R alice:dev /home/user/subdir');
        await processor.processCommand(cmd, ctx);
        const dir = fs.getNode('/home/user/subdir');
        const nested = fs.getNode('/home/user/subdir/nested.txt');
        expect(dir!.ownership).toEqual({ uid: 'alice', gid: 'dev' });
        expect(nested!.ownership).toEqual({ uid: 'alice', gid: 'dev' });
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('chown');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });

    it('should error on nonexistent path', async () => {
        const cmd = makeCommand('chown alice /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });
});
