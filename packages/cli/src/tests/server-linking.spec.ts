import { ICliKeyValueStore, ICliKeyValueStore_TOKEN, ICliSecretStore, ICliSecretStore_TOKEN } from '@qodalis/cli-core';
import { CliTestHarness } from '../lib/testing/cli-test-harness';
import { CliServerCommandProcessor } from '../lib/server/cli-server-command-processor';
import { CliServerManager, CliServerManager_TOKEN } from '../lib/server/cli-server-manager';
import { CliCommandProcessorRegistry } from '../lib/registry/cli-command-processor-registry';
import {
    CliLinkedServers,
    checkServerUrl,
    isPrivateHost,
    maskToken,
    normalizeServerUrl,
    redactSecrets,
    suggestServerName,
    userServersAllow,
} from '../lib/server/linked/cli-linked-servers';
import { CliWebCryptoSecretStore } from '../lib/server/linked/cli-web-crypto-secret-store';
import {
    createTokenWithPassword,
    pollLink,
    probeServer,
    requestLink,
} from '../lib/server/linked/cli-server-link-client';
import { parseAddArgs } from '../lib/server/linked/cli-server-link-processors';
import { restoreLinkedServers } from '../lib/server/linked/cli-linked-servers-runtime';
import { CliCommandHistory } from '../lib/services/cli-command-history';

function memoryKv(): ICliKeyValueStore & { data: Map<string, unknown> } {
    const data = new Map<string, unknown>();
    return {
        data,
        get: async (key: string) => data.get(key) as any,
        set: async (key: string, value: unknown) => void data.set(key, value),
        remove: async (key: string) => void data.delete(key),
        clear: async () => data.clear(),
    } as any;
}

function memorySecrets(): ICliSecretStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
        data,
        isAvailable: () => true,
        get: async (k) => data.get(k),
        set: async (k, v) => void data.set(k, v),
        delete: async (k) => void data.delete(k),
        clear: async () => data.clear(),
    };
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeConnection(name: string, url: string, connected = true): any {
    return {
        connected,
        needsSignIn: false,
        config: { name, url },
        apiVersion: 1,
        capabilities: connected ? { shell: false, version: '1.0.0-beta.25' } : null,
        commands: connected ? [{ command: 'echo' }, { command: 'status' }] : [],
        connect: async () => undefined,
        disconnect: () => undefined,
        stopHealthCheck: () => undefined,
        startHealthCheck: () => undefined,
    };
}

describe('linked servers: helpers', () => {
    it('normalises URLs, adding https', () => {
        expect(normalizeServerUrl('cli.example.com')).toBe('https://cli.example.com');
        expect(normalizeServerUrl('http://localhost:8047/')).toBe('http://localhost:8047');
        expect(normalizeServerUrl('https://x.io/base//')).toBe('https://x.io/base');
        expect(normalizeServerUrl('ftp://x.io')).toBeNull();
        expect(normalizeServerUrl('https://user:pw@x.io')).toBeNull();
        expect(normalizeServerUrl('')).toBeNull();
    });

    it('tells private hosts', () => {
        for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.106', '::1', '[::1]', 'nas.local']) {
            expect(isPrivateHost(host)).withContext(host).toBeTrue();
        }
        expect(isPrivateHost('fd12:3456::1')).toBeTrue();
        expect(isPrivateHost('[fe80::1]')).toBeTrue();
        // Host names that merely start like an IPv6 private prefix are public
        for (const host of ['example.com', '8.8.8.8', '172.32.0.1', '192.169.0.1', 'fdic.gov', 'fcbarcelona.com', 'fe80.example.com']) {
            expect(isPrivateHost(host)).withContext(host).toBeFalse();
        }
    });

    it('accepts https anywhere and http only to private hosts', () => {
        expect(checkServerUrl('cli.example.com')).toEqual({ url: 'https://cli.example.com', insecure: false, mixedContent: false });
        expect(checkServerUrl('http://192.168.1.20:8047', 'https:')).toEqual({
            url: 'http://192.168.1.20:8047',
            insecure: true,
            mixedContent: true,
        });
        expect(checkServerUrl('http://example.com')).toContain('Only https');
        expect(checkServerUrl('nope://')).toContain('Not a valid');
    });

    it('applies the host policy (userServers)', () => {
        expect(userServersAllow(undefined, 'https://a.io')).toBeTrue();
        expect(userServersAllow({ userServers: false }, 'https://a.io')).toBeFalse();
        const policy = { userServers: { allowedOrigins: ['https://*.example.com', 'http://localhost:8047'] } };
        expect(userServersAllow(policy, 'https://cli.example.com/api')).toBeTrue();
        expect(userServersAllow(policy, 'http://localhost:8047')).toBeTrue();
        expect(userServersAllow(policy, 'https://example.org')).toBeFalse();
        expect(userServersAllow(policy, 'https://a.b.example.com.evil.io')).toBeFalse();
    });

    it('suggests free names', () => {
        expect(suggestServerName('https://api.example.com', () => false)).toBe('api');
        expect(suggestServerName('http://localhost:8047', () => false)).toBe('localhost-8047');
        expect(suggestServerName('http://192.168.1.20:8047', () => false)).toBe('192-168-1-20-8047');
        expect(suggestServerName('https://api.example.com', (n) => n === 'api')).toBe('api-2');
    });

    it('redacts tokens and passwords from history lines', () => {
        expect(redactSecrets('server add home https://x.io --token qcli_pat_abc')).toBe('server add home https://x.io --token ***');
        expect(redactSecrets('server edit home --token=qcli_pat_abc --url https://y.io')).toBe('server edit home --token=*** --url https://y.io');
        expect(redactSecrets('login --password "my secret"')).toBe('login --password ***');
        expect(redactSecrets('echo token')).toBe('echo token');
        expect(redactSecrets('server add home https://x.io --token --default')).toBe('server add home https://x.io --token --default');
        expect(maskToken('qcli_pat_123456789')).toBe('••••6789');
    });

    it('reads [name] [url] positionals', () => {
        expect(parseAddArgs('home https://x.io')).toEqual({ name: 'home', url: 'https://x.io' });
        expect(parseAddArgs('x.io')).toEqual({ url: 'x.io' });
        expect(parseAddArgs('localhost:8047')).toEqual({ url: 'localhost:8047' });
        expect(parseAddArgs('home')).toEqual({ name: 'home' });
        expect(parseAddArgs('')).toEqual({});
    });

    it('keeps --token values out of the command history', async () => {
        const kv = memoryKv();
        const history = new CliCommandHistory(kv);
        await history.initialize();
        await history.addCommand('server add home https://x.io --token qcli_pat_secret');
        expect(history.getHistory()).toEqual(['server add home https://x.io --token ***']);
        expect(JSON.stringify([...kv.data.values()])).not.toContain('qcli_pat_secret');
    });
});

describe('linked servers: Web Crypto secret store', () => {
    it('encrypts secrets, reads them back and clears them', async () => {
        const kv = memoryKv();
        const store = new CliWebCryptoSecretStore(kv);
        expect(store.isAvailable()).toBeTrue();
        await store.set('server-token:home', 'qcli_pat_secret-value');
        expect(await store.get('server-token:home')).toBe('qcli_pat_secret-value');

        const raw = kv.data.get('qcli-secret:server-token:home') as { iv: Uint8Array; data: Uint8Array };
        expect(raw.iv.length).toBe(12);
        expect(new TextDecoder().decode(raw.data)).not.toContain('qcli_pat');
        const key = kv.data.get('qcli-secret-key') as CryptoKey;
        expect(key.extractable).toBeFalse();
        expect(key.algorithm.name).toBe('AES-GCM');

        // A second secret uses the same key and its own IV
        await store.set('server-token:work', 'qcli_pat_other');
        const other = kv.data.get('qcli-secret:server-token:work') as { iv: Uint8Array };
        expect(Array.from(other.iv)).not.toEqual(Array.from(raw.iv));

        await store.delete('server-token:work');
        expect(await store.get('server-token:work')).toBeUndefined();

        await store.clear();
        expect(await store.get('server-token:home')).toBeUndefined();
        expect(kv.data.size).toBe(0);
    });

    it('a secret encrypted with a lost key is gone, not garbage', async () => {
        const kv = memoryKv();
        const store = new CliWebCryptoSecretStore(kv);
        await store.set('a', 'value');
        kv.data.delete('qcli-secret-key');
        await new CliWebCryptoSecretStore(kv).set('b', 'other');
        expect(await new CliWebCryptoSecretStore(kv).get('a')).toBeUndefined();
    });

    it('refuses to save without Web Crypto', async () => {
        const store = new CliWebCryptoSecretStore(memoryKv(), null);
        expect(store.isAvailable()).toBeFalse();
        await expectAsync(store.set('a', 'b')).toBeRejectedWithError(/Web Crypto/);
        expect(await store.get('a')).toBeUndefined();
    });
});

describe('linked servers: storage', () => {
    it('keeps servers in the key-value store and tokens in the secret store', async () => {
        const kv = memoryKv();
        const secrets = memorySecrets();
        const linked = new CliLinkedServers(kv, secrets);
        await linked.save({ name: 'home', url: 'https://h.io', addedAt: 1 }, 'qcli_pat_1');
        await linked.save({ name: 'work', url: 'https://w.io', addedAt: 2 }, undefined);
        expect((await linked.list()).map((s) => s.name)).toEqual(['home', 'work']);
        expect(JSON.stringify([...kv.data.values()])).not.toContain('qcli_pat_1');
        expect(await linked.token('HOME')).toBe('qcli_pat_1');
        expect(await linked.remove('home')).toBeTrue();
        expect(await linked.token('home')).toBeUndefined();
        expect(await linked.remove('nope')).toBeFalse();
        await linked.clear();
        expect(await linked.list()).toEqual([]);
    });
});

describe('linked servers: link client', () => {
    it('probes a Qodalis CLI server and refuses anything else', async () => {
        const fetchFn = async (url: string) => {
            if (url.endsWith('/api/qcli/versions')) return json({ supportedVersions: [1], preferredVersion: 1 });
            if (url.endsWith('/capabilities')) return json({ shell: true, os: 'linux', version: '1.0.0-beta.25' });
            return json({ error: 'unauthorized' }, 401);
        };
        const probe = await probeServer(fetchFn, 'https://cli.example.com');
        expect(probe).toEqual(jasmine.objectContaining({ version: '1.0.0-beta.25', needsSignIn: true }));
        await expectAsync(probeServer(async () => new Response('<html>', { status: 200 }), 'https://x.io')).toBeRejectedWithError(/not a Qodalis CLI server/);
        await expectAsync(probeServer(async () => { throw new TypeError('Failed to fetch'); }, 'https://x.io')).toBeRejectedWithError(/Cannot reach/);
    });

    it('requests a link and resolves the approval page against the server URL', async () => {
        let body: any;
        const request = await requestLink(async (_url, init) => {
            body = JSON.parse(String(init?.body));
            return json({ linkId: 'L1', userCode: 'ABCD-2345', verificationUrl: '/qcli/admin/link?code=ABCD-2345', expiresIn: 600, interval: 2 }, 201);
        }, 'https://cli.example.com', 'Qodalis CLI on Linux');
        expect(body).toEqual({ client: 'Qodalis CLI on Linux' });
        expect(request!.verificationUrl).toBe('https://cli.example.com/qcli/admin/link?code=ABCD-2345');
        expect(await requestLink(async () => json({}, 404), 'https://x.io', 'c')).toBeNull();
    });

    it('refuses approval pages that are not http(s) and drops terminal escapes from the code', async () => {
        const answer = (verificationUrl: string) => async () =>
            json({ linkId: 'L1', userCode: 'AB\u001b]8;;x\u0007CD', verificationUrl, expiresIn: 600, interval: 2 }, 201);
        await expectAsync(requestLink(answer('javascript:alert(1)'), 'https://x.io', 'c')).toBeRejectedWithError(/invalid approval page/);
        await expectAsync(requestLink(answer('data:text/html,hi'), 'https://x.io', 'c')).toBeRejectedWithError(/invalid approval page/);
        const request = await requestLink(answer('https://approve.example.com/link'), 'https://x.io', 'c');
        expect(request!.verificationUrl).toBe('https://approve.example.com/link');
        expect(request!.userCode).toBe('AB]8;;xCD');
    });

    it('reads the poll answers', async () => {
        expect(await pollLink(async () => json({ status: 'pending' }), 'https://x.io', 'L')).toEqual({ status: 'pending' });
        expect(await pollLink(async () => json({ status: 'denied' }), 'https://x.io', 'L')).toEqual({ status: 'denied' });
        expect(await pollLink(async () => json({ status: 'expired' }, 404), 'https://x.io', 'L')).toEqual({ status: 'expired' });
        expect(await pollLink(async () => json({ status: 'approved', token: 'qcli_pat_x', userName: 'ann' }), 'https://x.io', 'L')).toEqual({
            status: 'approved',
            token: 'qcli_pat_x',
            userName: 'ann',
        });
    });

    it('signs in, creates a token (numbered when the name is taken) and ends the session', async () => {
        const calls: string[] = [];
        let tokens = 0;
        const token = await createTokenWithPassword(async (url, init) => {
            calls.push(`${init?.method ?? 'GET'} ${url.replace('https://x.io', '')}`);
            if (url.endsWith('/sessions')) return json({ token: 'session' }, 201);
            if (url.endsWith('/tokens')) {
                tokens++;
                return tokens === 1 ? json({ error: 'exists' }, 409) : json({ token: 'qcli_pat_new' }, 201);
            }
            return new Response(null, { status: 204 });
        }, 'https://x.io', 'ann', 'pw', 'Qodalis CLI on Linux');
        expect(token).toBe('qcli_pat_new');
        expect(calls).toEqual([
            'POST /api/v1/qcli/sessions',
            'POST /api/v1/qcli/tokens',
            'POST /api/v1/qcli/tokens',
            'DELETE /api/v1/qcli/sessions/current',
        ]);
        await expectAsync(
            createTokenWithPassword(async () => json({ error: 'invalid credentials' }, 401), 'https://x.io', 'a', 'b', 'c'),
        ).toBeRejectedWithError('invalid credentials');
    });
});

describe('server add / edit / remove / forget-all', () => {
    let harness: CliTestHarness;
    let manager: CliServerManager;
    let secrets: ReturnType<typeof memorySecrets>;
    let added: any[];

    beforeEach(() => {
        harness = new CliTestHarness();
        manager = new CliServerManager(new CliCommandProcessorRegistry());
        manager.connections.set('node', fakeConnection('node', 'http://localhost/node'));
        added = [];
        spyOn(manager, 'addServer').and.callFake(async (config: any, options: any) => {
            added.push({ config, options });
            const connection = fakeConnection(config.name, config.url);
            manager.connections.set(config.name, connection);
            if (options?.linked) (manager as any)._linked.add(config.name);
            return connection;
        });
        secrets = memorySecrets();
        harness.registerService(CliServerManager_TOKEN, manager);
        harness.registerService(ICliSecretStore_TOKEN, secrets);
        harness.registerProcessor(new CliServerCommandProcessor());
        spyOn(window, 'fetch').and.callFake(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/api/qcli/versions')) return json({ supportedVersions: [1] });
            if (url.endsWith('/capabilities')) return json({ shell: false, os: 'linux', version: '1.0.0-beta.25' });
            if (url.endsWith('/commands')) return json({ error: 'unauthorized' }, 401);
            return json({}, 404);
        });
    });

    it('links a server with --token, keeps the token encrypted apart and marks it in the list', async () => {
        const result = await harness.execute('server add home https://cli.example.com --token qcli_pat_abcd1234');
        expect(result.stderr).toEqual([]);
        expect(result.output).toContain('Qodalis CLI server 1.0.0-beta.25');
        expect(result.output).toContain('Linked home: 2 commands.');
        expect(added[0].config.url).toBe('https://cli.example.com');
        expect(added[0].config.headers()).toEqual({ Authorization: 'Bearer qcli_pat_abcd1234' });
        expect(added[0].options).toEqual({ linked: true });
        expect(secrets.data.get('server-token:home')).toBe('qcli_pat_abcd1234');

        const list = await harness.execute('server list');
        expect(list.tables[0].headers[7]).toBe('Source');
        const rows = list.tables[0].rows;
        expect(rows.find((r) => r[0] === 'node')![7]).toBe('app');
        expect(rows.find((r) => r[0] === 'home')![7]).toBe('linked ••••1234');
        expect(list.output).not.toContain('qcli_pat_abcd1234');
    });

    it('asks for everything that is missing: URL, method, token and name', async () => {
        harness.setReaderResponses('cli.example.com', 'token', 'qcli_pat_typed', '');
        const result = await harness.execute('server add');
        expect(result.stderr).toEqual([]);
        expect(result.output).toContain('Linked cli: 2 commands.');
        expect(secrets.data.get('server-token:cli')).toBe('qcli_pat_typed');
    });

    it('asks for the token, hidden, when --token has no value', async () => {
        harness.setReaderResponses('qcli_pat_hidden9');
        const result = await harness.execute('server add home https://cli.example.com --token');
        expect(result.stderr).toEqual([]);
        expect(result.output).toContain('Linked home: 2 commands.');
        expect(secrets.data.get('server-token:home')).toBe('qcli_pat_hidden9');
    });

    it('keeps the default server when a linked server is edited or replaced', async () => {
        await harness.execute('server add home https://cli.example.com --token qcli_pat_a');
        manager.setDefaultServer('home');
        await harness.execute('server edit home --url https://cli2.example.com');
        expect(manager.defaultServer).toBe('home');
        harness.setReaderResponses(true);
        await harness.execute('server add HOME https://cli3.example.com --token qcli_pat_b');
        expect(manager.defaultServer).toBe('HOME');
        expect([...manager.connections.keys()].filter((n) => n.toLowerCase() === 'home')).toEqual(['HOME']);
    });

    it('removes a linked server that an app server of the same name shadows', async () => {
        const kv = (harness as any).services.getRequired(ICliKeyValueStore_TOKEN) as ICliKeyValueStore;
        await new CliLinkedServers(kv, secrets).save({ name: 'node', url: 'https://n.io', addedAt: 1 }, 'qcli_pat_n');
        const result = await harness.execute('server remove node');
        expect(result.output).toContain('Unlinked node');
        expect(manager.connections.has('node')).toBeTrue();
        expect(secrets.data.has('server-token:node')).toBeFalse();
    });

    it('Ctrl+C while waiting for the approval says when the request expires', async () => {
        // Ctrl+C reaches the command as onAbort -> its signal
        let host: any;
        const createContext = (harness as any).createContext.bind(harness);
        spyOn(harness as any, 'createContext').and.callFake((writer: any) => (host = createContext(writer)));
        spyOn(window, 'open').and.returnValue(null);
        (window.fetch as jasmine.Spy).and.callFake(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/api/qcli/versions')) return json({ supportedVersions: [1] });
            if (url.endsWith('/link')) {
                host.onAbort.next();
                return json({ linkId: 'L1', userCode: 'ABCD-2345', verificationUrl: '/qcli/admin/link?code=ABCD-2345', expiresIn: 600, interval: 2 }, 201);
            }
            return json({}, 404);
        });
        harness.setReaderResponses('browser');
        const result = await harness.execute('server add https://cli.example.com');
        expect(result.output).toContain('Cancelled. The request expires on the server in 10 min.');
        expect(added).toEqual([]);
    });

    it('forget-all with nothing linked says so instead of asking', async () => {
        const result = await harness.execute('server forget-all');
        expect(result.output).toContain('No linked servers');
    });

    it('refuses http to public hosts, and app servers cannot be replaced, edited or removed', async () => {
        expect((await harness.execute('server add x http://example.com --token t')).stderr.join()).toContain('Only https');
        expect((await harness.execute('server add node https://n.io --token t')).stderr.join()).toContain('configured by the app');
        expect((await harness.execute('server edit node --url https://n.io')).stderr.join()).toContain('configured by the app');
        expect((await harness.execute('server remove node')).stderr.join()).toContain('configured by the app');
        expect(manager.connections.has('node')).toBeTrue();
    });

    it('does not link a server the app already configures, under any name', async () => {
        const result = await harness.execute('server add mine http://LOCALHOST/node/ --token t');
        expect(result.stderr.join()).toContain("http://localhost/node is already configured by the app as 'node'.");
        expect(added).toEqual([]);
    });

    it('says a server is already linked, and links it again only when asked, replacing the old entry', async () => {
        await harness.execute('server add home https://cli.example.com --token qcli_pat_one');

        harness.setReaderResponses(false);
        const declined = await harness.execute('server add other https://CLI.example.com/ --token qcli_pat_two');
        expect(declined.output + declined.stderr.join()).toContain("https://cli.example.com is already linked as 'home'.");
        expect(manager.connections.has('other')).toBeFalse();
        expect(secrets.data.get('server-token:home')).toBe('qcli_pat_one');

        harness.setReaderResponses(true);
        const renamed = await harness.execute('server add other https://cli.example.com --token qcli_pat_two');
        expect(renamed.output).toContain('Linked other');
        expect(manager.connections.has('home')).toBeFalse();
        expect(secrets.data.has('server-token:home')).toBeFalse();
        expect(secrets.data.get('server-token:other')).toBe('qcli_pat_two');
    });

    it('links the same server again under its name when no name is given', async () => {
        await harness.execute('server add home https://cli.example.com --token qcli_pat_one');
        harness.setReaderResponses(true);
        const again = await harness.execute('server add https://cli.example.com --token qcli_pat_new');
        expect(again.output).toContain('Linked home');
        expect(secrets.data.get('server-token:home')).toBe('qcli_pat_new');
        expect([...manager.connections.keys()].filter((n) => n !== 'node')).toEqual(['home']);
    });

    it('asks before linking a private http server', async () => {
        harness.setReaderResponses(false);
        const result = await harness.execute('server add lan http://192.168.1.20:8047 --token t');
        expect(result.output + result.stderr.join('\n')).toContain('not encrypted');
        expect(added).toEqual([]);
    });

    it('edits the token and removes the server with its token', async () => {
        await harness.execute('server add home https://cli.example.com --token qcli_pat_old1');
        const edit = await harness.execute('server edit home --token qcli_pat_new2');
        expect(edit.output).toContain('Updated home');
        expect(secrets.data.get('server-token:home')).toBe('qcli_pat_new2');
        expect(added[added.length - 1].config.headers()).toEqual({ Authorization: 'Bearer qcli_pat_new2' });

        const removed = await harness.execute('server remove home');
        expect(removed.output).toContain('Unlinked home');
        expect(manager.connections.has('home')).toBeFalse();
        expect(secrets.data.has('server-token:home')).toBeFalse();
        expect((await harness.execute('server remove home')).stderr.join()).toContain("No linked server 'home'");
    });

    it('forget-all unlinks every linked server, leaving the app servers', async () => {
        await harness.execute('server add a https://a.example.com --token t1');
        await harness.execute('server add b https://b.example.com --token t2');
        harness.setReaderResponses(true);
        const result = await harness.execute('server forget-all');
        expect(result.output).toContain('Every linked server and saved token is gone.');
        expect([...manager.connections.keys()]).toEqual(['node']);
        expect(secrets.data.size).toBe(0);
    });

    it('restores linked servers at boot, after the app servers', async () => {
        await harness.execute('server add home https://cli.example.com --token qcli_pat_x');
        await harness.execute('server add node2 https://n2.example.com --token qcli_pat_y');
        const services = (harness as any).services;
        const fresh = new CliServerManager(new CliCommandProcessorRegistry());
        fresh.connections.set('node2', fakeConnection('node2', 'http://app/node2'));
        const connected: string[] = [];
        spyOn(fresh, 'addServer').and.callFake(async (config: any) => {
            connected.push(`${config.name} ${config.headers?.().Authorization}`);
            return fakeConnection(config.name, config.url);
        });
        const warnings: string[] = [];
        await restoreLinkedServers({ services, options: undefined } as any, fresh, (m) => warnings.push(m));
        expect(connected).toEqual(['home Bearer qcli_pat_x']);
        expect(warnings[0]).toContain("Linked server 'node2' is not connected");

        connected.length = 0;
        await restoreLinkedServers({ services, options: { userServers: false } } as any, fresh, () => undefined);
        expect(connected).toEqual([]);
    });
});
