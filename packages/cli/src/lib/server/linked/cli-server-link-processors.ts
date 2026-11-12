import {
    CliForegroundColor,
    CliProcessCommand,
    CliServerConfig,
    ICliCommandChildProcessor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    splitShellWords,
} from '@qodalis/cli-core';
import { writeExamples, writeUsage, writeWrapped } from '../../processors/system/packages/package-help';
import { CliServerManager } from '../cli-server-manager';
import { serverManagerOf } from '../cli-server-command-helpers';
import {
    CliLinkedServers,
    SERVER_NAME_PATTERN,
    checkServerUrl,
    linkedServerConfig,
    maskToken,
    normalizeServerUrl,
    suggestServerName,
    userServersAllow,
    userServersEnabled,
} from './cli-linked-servers';
import { linkedServersOf, rejectedTokenMessage, secretStoreOf } from './cli-linked-servers-runtime';
import {
    CliFetch,
    CliServerProbe,
    createTokenWithPassword,
    deviceName,
    pollLink,
    probeServer,
    requestLink,
} from './cli-server-link-client';

/** Saved across reloads by the `server` command (the default server). */
interface ServerState {
    defaultServer?: string | null;
}

const fetchOf = (context: ICliExecutionContext): CliFetch => (url, init) => context.http.fetch(url, init);

/** Waits `ms`, or less when the command is cancelled. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
        }, { once: true });
    });
}

function linkingDisabled(context: ICliExecutionContext): boolean {
    if (userServersEnabled(context.options)) return false;
    context.writer.writeError(
        context.translator.t('cli.server.link.disabled', 'This app does not allow linking servers from the terminal.'),
    );
    return true;
}

/** `server add` positionals: `[name] [url]`; a single word is the URL when it looks like one. */
export function parseAddArgs(value: string | undefined): { name?: string; url?: string } {
    const words = splitShellWords(value ?? '');
    if (words.length >= 2) return { name: words[0], url: words[1] };
    if (words.length === 1) {
        return /[.:/]/.test(words[0]) ? { url: words[0] } : { name: words[0] };
    }
    return {};
}

type LinkMethod = 'browser' | 'token' | 'password' | 'none';

/**
 * Connects a linked server, replacing a linked connection of the same name
 * (any case); it stays the default server when it was.
 */
/** Same server: the same normalized URL, ignoring case; an app server's relative URL ('' or '/api') is on the page's origin. */
function sameServerUrl(a: string, b: string): boolean {
    const key = (url: string) => normalizeServerUrl(absoluteUrl(url))?.toLowerCase();
    const left = key(a);
    return !!left && left === key(b);
}

function absoluteUrl(url: string): string {
    const origin = (globalThis as { location?: Location }).location?.origin;
    if (!origin || /^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim())) return url;
    try {
        return new URL(url.trim() || '/', origin).href;
    } catch {
        return url;
    }
}

/** The server already at `url`: one the user linked, or one the app configures (`byApp`). */
async function serverAt(
    manager: CliServerManager,
    linked: CliLinkedServers,
    url: string,
): Promise<{ name: string; byApp: boolean } | undefined> {
    for (const [name, connection] of manager.connections) {
        if (!manager.isLinked(name) && sameServerUrl(connection.config.url, url)) return { name, byApp: true };
    }
    const saved = (await linked.list()).find((server) => sameServerUrl(server.url, url));
    return saved ? { name: saved.name, byApp: false } : undefined;
}

async function replaceConnection(manager: CliServerManager, config: CliServerConfig) {
    const current = [...manager.connections.keys()].find((n) => n.toLowerCase() === config.name.toLowerCase());
    const wasDefault = !!current && manager.defaultServer === current;
    if (current) manager.removeServer(current);
    const connection = await manager.addServer(config, { linked: true });
    if (wasDefault) manager.setDefaultServer(config.name);
    return connection;
}

// ── add ─────────────────────────────────────────────────────────────

export class ServerAddProcessor implements ICliCommandChildProcessor {
    command = 'add';
    aliases = ['link'];
    description = 'Link a server to this terminal (kept across reloads)';
    acceptsRawInput = true;
    valueRequired = false;
    parent?: ICliCommandProcessor;
    parameters: ICliCommandParameterDescriptor[] = [
        { name: 'token', description: 'API token (qcli_pat_…) to link with (asked for, hidden, when given without a value)', required: false, type: 'string' },
        { name: 'default', description: 'Make it the default server', required: false, type: 'boolean' },
        { name: 'no-browser', description: 'Link with a token or a password, without the browser', required: false, type: 'boolean' },
    ];

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const t = context.translator;
        const { writer, reader } = context;
        const manager = serverManagerOf(context);
        if (!manager || linkingDisabled(context)) return;
        const linked = linkedServersOf(context);
        const args = parseAddArgs(command.value);

        // 1. URL
        const rawUrl = args.url ?? (await reader.readLine(t.t('cli.server.link.url_prompt', 'Server URL: '), { placeholder: 'https://my-server.example.com' }));
        if (!rawUrl) return;
        const pageProtocol = (globalThis as { location?: Location }).location?.protocol;
        const checked = checkServerUrl(rawUrl, pageProtocol);
        if (typeof checked === 'string') {
            writer.writeError(checked);
            return;
        }
        const url = checked.url;
        if (!userServersAllow(context.options, url)) {
            writer.writeError(t.t('cli.server.link.origin_not_allowed', 'This app does not allow linking {url}.', { url }));
            return;
        }
        if (checked.mixedContent) {
            writer.writeWarning(t.t('cli.server.link.mixed_content', 'This page is served over https: the browser may block requests to an http server.'));
        }

        // The same server under another name would only be a second copy: say so, and link it again only if asked
        const same = await serverAt(manager, linked, url);
        if (same?.byApp) {
            writer.writeError(t.t('cli.server.link.same_as_app_server', "{url} is already configured by the app as '{name}'.", { url, name: same.name }));
            return;
        }
        if (same) {
            writer.writeWarning(t.t('cli.server.link.already_linked', "{url} is already linked as '{name}'.", { url, name: same.name }));
            const again = await reader.readConfirm(t.t('cli.server.link.link_again', "Link it again? It replaces '{name}' (a new token)", { name: same.name }), false);
            if (!again) return;
        }
        const replacing = same?.name;

        // 2. Is it a Qodalis CLI server?
        let probe: CliServerProbe;
        context.spinner?.show(t.t('cli.server.link.checking', 'Checking {url}…', { url }));
        try {
            probe = await probeServer(fetchOf(context), url);
        } catch (e) {
            writer.writeError((e as Error).message);
            return;
        } finally {
            context.spinner?.hide();
        }
        writeProbe(context, url, probe);
        // Asked once the server answered: no question about a URL that is not a server
        if (checked.insecure) {
            writer.writeWarning(t.t('cli.server.link.http_warning', '{url} is not encrypted (http): its token travels in clear text on the network.', { url }));
            const go = await reader.readConfirm(t.t('cli.server.link.http_confirm', 'Link it anyway?'), false);
            if (!go) return;
        }

        // 3. Name (a linked server of that name is replaced after a confirmation; linking the same server again keeps its name)
        let name = args.name ?? replacing;
        if (name && name !== replacing) {
            if (!(await this.nameAvailable(context, manager, linked, name))) return;
        }

        // 4. How to link
        // `--token` without a value: asked for (hidden), so it stays out of the history
        const tokenFlag = command.args?.['token'];
        const tokenArg = typeof tokenFlag === 'string' && tokenFlag.trim() ? tokenFlag.trim() : undefined;
        const method: LinkMethod | null = tokenFlag !== undefined && tokenFlag !== false
            ? 'token'
            : await this.chooseMethod(context, probe, !!command.args?.['no-browser']);
        if (!method) return;
        if (method !== 'none' && !(await secretStoreOf(context).isAvailable())) {
            writer.writeError(t.t('cli.server.link.no_secret_store', 'Tokens cannot be kept safely on this page (no Web Crypto: serve it over https). The server was not linked.'));
            return;
        }

        let token: string | undefined;
        let userName: string | undefined;
        if (method === 'browser') {
            const result = await this.linkInBrowser(context, url);
            if (!result) return;
            token = result.token;
            userName = result.userName;
        } else if (method === 'token') {
            token = tokenArg ?? (await reader.readPassword(t.t('cli.server.link.token_prompt', 'API token: ')))?.trim();
            if (!token) return;
        } else if (method === 'password') {
            const username = await reader.readLine(t.t('cli.server.link.username_prompt', 'Username: '));
            if (!username) return;
            const password = await reader.readPassword(t.t('cli.server.link.password_prompt', 'Password: '));
            if (!password) return;
            try {
                token = await createTokenWithPassword(fetchOf(context), url, username.trim(), password, deviceName());
                userName = username.trim();
            } catch (e) {
                writer.writeError((e as Error).message);
                return;
            }
        }

        // 5. Name, when not given
        if (!name) {
            const suggested = suggestServerName(url, (n) => manager.connections.has(n));
            const answer = await reader.readLine(t.t('cli.server.link.name_prompt', 'Name for this server: '), {
                default: suggested,
                placeholder: suggested,
                validate: (value) =>
                    !value || SERVER_NAME_PATTERN.test(value.trim())
                        ? null
                        : t.t('cli.server.link.invalid_name', 'Letters, digits, - and _ (at most 32), starting with a letter or digit'),
            });
            if (answer === null) return;
            name = answer.trim() || suggested;
            if (!(await this.nameAvailable(context, manager, linked, name))) return;
        }

        // 6. Save, connect (replacing a linked server of that name), report
        const server = { name, url, addedAt: Date.now() };
        const previous = (await linked.get(name))?.name;
        if (previous && previous !== name) await linked.remove(previous);
        if (replacing && replacing.toLowerCase() !== name.toLowerCase()) {
            // Linked again under a new name: the old entry and its token go
            await linked.remove(replacing);
            if (manager.isLinked(replacing)) manager.removeServer(replacing);
        }
        await linked.save(server, token);
        const connection = await replaceConnection(manager, linkedServerConfig(server, token));
        if (connection.connected) {
            writer.writeSuccess(
                t.t('cli.server.link.linked', 'Linked {name}: {count} commands{user}.', {
                    name,
                    count: connection.commands.length,
                    user: userName ? t.t('cli.server.link.as_user', ' as {user}', { user: userName }) : '',
                }),
            );
        } else if (token && connection.needsSignIn) {
            writer.writeWarning(rejectedTokenMessage(name));
        } else if (connection.needsSignIn) {
            writer.writeWarning(t.t('cli.server.link.needs_sign_in', 'Linked {name}, but its commands need a sign-in: link it with a token or through the browser.', { name }));
        } else {
            writer.writeWarning(t.t('cli.server.link.unreachable', 'Linked {name}, but it is unreachable now: its commands load when it is back.', { name }));
        }
        if (command.args?.['default']) {
            manager.setDefaultServer(name);
            context.state.updateState({ defaultServer: name } as ServerState);
            writer.writeln(t.t('cli.server.link.now_default', '  {name} is the default server.', { name }));
        }
    }

    private async nameAvailable(
        context: ICliExecutionContext,
        manager: CliServerManager,
        linked: CliLinkedServers,
        name: string,
    ): Promise<boolean> {
        const t = context.translator;
        if (!SERVER_NAME_PATTERN.test(name)) {
            context.writer.writeError(t.t('cli.server.link.invalid_name', 'Letters, digits, - and _ (at most 32), starting with a letter or digit'));
            return false;
        }
        const existing = [...manager.connections.keys()].find((n) => n.toLowerCase() === name.toLowerCase());
        if (existing && !manager.isLinked(existing)) {
            context.writer.writeError(t.t('cli.server.link.host_server', "'{name}' is configured by the app and cannot be replaced.", { name: existing }));
            return false;
        }
        if (existing || (await linked.get(name))) {
            const replace = await context.reader.readConfirm(
                t.t('cli.server.link.replace_confirm', "A linked server '{name}' exists. Replace it?", { name }),
                false,
            );
            return !!replace;
        }
        return true;
    }

    private async chooseMethod(
        context: ICliExecutionContext,
        probe: CliServerProbe,
        noBrowser: boolean,
    ): Promise<LinkMethod | null> {
        const t = context.translator;
        const options = [
            ...(noBrowser ? [] : [{ label: t.t('cli.server.link.method_browser', 'Open the server in the browser and approve (recommended)'), value: 'browser' }]),
            { label: t.t('cli.server.link.method_token', 'Paste an API token'), value: 'token' },
            { label: t.t('cli.server.link.method_password', 'Sign in with user and password'), value: 'password' },
            ...(probe.needsSignIn ? [] : [{ label: t.t('cli.server.link.method_none', 'No sign-in (open server)'), value: 'none' }]),
        ];
        const choice = await context.reader.readSelect(t.t('cli.server.link.method_prompt', 'How do you want to link it?'), options);
        return (choice as LinkMethod | null) ?? null;
    }

    /** The device flow: a link request, the page to approve it, then polling until a decision. */
    private async linkInBrowser(
        context: ICliExecutionContext,
        url: string,
    ): Promise<{ token: string; userName?: string } | null> {
        const t = context.translator;
        const { writer } = context;
        const fetchFn = fetchOf(context);
        let request;
        try {
            request = await requestLink(fetchFn, url, deviceName());
        } catch (e) {
            writer.writeError((e as Error).message);
            return null;
        }
        if (!request) {
            writer.writeError(t.t('cli.server.link.no_browser_link', 'This server cannot link through the browser (it needs the users plugin, 1.0.0-beta.25 or later). Use server add --no-browser.'));
            return null;
        }
        writer.writeln();
        writer.writeln(t.t('cli.server.link.open_page', '  Open this page, sign in and approve:'));
        writer.write('  ');
        writer.writeLink(request.verificationUrl, request.verificationUrl);
        writer.writeln();
        writer.writeln(
            t.t('cli.server.link.compare_code', '  Check that it shows the code {code}', {
                code: writer.wrapInColor(request.userCode, CliForegroundColor.Yellow),
            }),
        );
        writer.writeln();
        try {
            (globalThis as { open?: (url: string, target?: string) => unknown }).open?.(request.verificationUrl, '_blank');
        } catch {
            // Pop-up blocked: the link is printed
        }

        const deadline = Date.now() + request.expiresIn * 1000;
        // Ctrl+C: nothing tells the server, so the request stays open until it expires
        const cancelled = () => {
            context.spinner?.hide();
            const minutes = Math.max(1, Math.ceil((deadline - Date.now()) / 60000));
            writer.writeInfo(
                t.t('cli.server.link.cancelled', 'Cancelled. The request expires on the server in {minutes} min.', { minutes }),
            );
            return null;
        };
        context.spinner?.show(t.t('cli.server.link.waiting', 'Waiting for the approval… (Ctrl+C to cancel)'));
        try {
            while (Date.now() < deadline) {
                if (context.signal?.aborted) return cancelled();
                await sleep(request.interval * 1000, context.signal);
                if (context.signal?.aborted) return cancelled();
                let poll;
                try {
                    poll = await pollLink(fetchFn, url, request.linkId);
                } catch {
                    continue; // a network hiccup: poll again
                }
                if (poll.status === 'approved') return { token: poll.token, userName: poll.userName };
                if (poll.status === 'denied') {
                    context.spinner?.hide();
                    writer.writeError(t.t('cli.server.link.denied', 'The link request was denied.'));
                    return null;
                }
                if (poll.status === 'expired') break;
            }
        } finally {
            context.spinner?.hide();
        }
        writer.writeError(t.t('cli.server.link.expired', 'The link request expired. Run server add again.'));
        return null;
    }

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.server.add.help.description', 'Links a Node, .NET or Python server to this terminal: its commands are available at once and after every reload. Asks for what is missing: the URL, how to sign in (approve in the browser, paste an API token, or a user and password) and a name. Tokens are kept encrypted and never shown again; only https servers can be linked (http for localhost and private addresses).'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['server add', t.t('cli.server.add.help.interactive', 'Asks for everything')],
            ['server add <url>', t.t('cli.server.add.help.url', 'Link this server')],
            ['server add <name> <url> --token [token]', t.t('cli.server.add.help.token', 'Link with an API token (scripts)')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['server add https://cli.example.com', t.t('cli.server.add.help.example_browser', 'Approve in the browser')],
            ['server add home http://192.168.1.20:8047 --no-browser', t.t('cli.server.add.help.example_lan', 'A server on the local network')],
        ]);
    }
}

/** "✔ Qodalis CLI server 1.0.0-beta.25 (linux) · shell · streaming" */
function writeProbe(context: ICliExecutionContext, url: string, probe: CliServerProbe): void {
    const { writer } = context;
    const caps = probe.capabilities;
    const details = [caps?.os, caps?.shell ? 'shell' : null, caps?.streaming ? 'streaming' : null, probe.needsSignIn ? 'sign-in required' : null]
        .filter(Boolean)
        .join(' · ');
    writer.writeSuccess(
        `${context.translator.t('cli.server.link.found', 'Qodalis CLI server')} ${probe.version ?? ''} ${writer.wrapInColor(url, CliForegroundColor.Cyan)}${details ? ` (${details})` : ''}`.replace(/\s+/g, ' '),
    );
}

// ── remove ──────────────────────────────────────────────────────────

export class ServerRemoveProcessor implements ICliCommandChildProcessor {
    command = 'remove';
    aliases = ['rm', 'unlink'];
    description = 'Unlink a server linked with server add (its token is deleted)';
    acceptsRawInput = true;
    valueRequired = true;
    parent?: ICliCommandProcessor;

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const t = context.translator;
        const manager = serverManagerOf(context);
        if (!manager) return;
        const name = splitShellWords(command.value ?? '')[0] ?? '';
        const linked = linkedServersOf(context);
        const connected = [...manager.connections.keys()].find((n) => n.toLowerCase() === name.toLowerCase());
        const saved = await linked.get(name);
        if (connected && !manager.isLinked(connected) && !saved) {
            context.writer.writeError(t.t('cli.server.link.cannot_remove_host', "'{name}' is configured by the app and cannot be removed.", { name: connected }));
            return;
        }
        if (!saved && !connected) {
            context.writer.writeError(t.t('cli.server.link.unknown_linked', "No linked server '{name}'. See server list.", { name }));
            return;
        }
        await linked.remove(saved?.name ?? name);
        // A linked server shadowed by an app server of the same name was never connected
        const linkedConnection = connected && manager.isLinked(connected) ? connected : undefined;
        if (linkedConnection) manager.removeServer(linkedConnection);
        const removedName = saved?.name ?? linkedConnection ?? name;
        if (linkedConnection && context.state.getState<ServerState>().defaultServer === linkedConnection) {
            context.state.updateState({ defaultServer: null } as ServerState);
        }
        context.writer.writeSuccess(t.t('cli.server.link.removed', 'Unlinked {name}; its token is deleted from this device.', { name: removedName }));
        context.writer.writeln(t.t('cli.server.link.revoke_hint', '  The token stays valid on the server until it expires: revoke it there with token revoke.'));
    }
}

// ── edit ────────────────────────────────────────────────────────────

export class ServerEditProcessor implements ICliCommandChildProcessor {
    command = 'edit';
    description = 'Change the URL or the token of a linked server';
    acceptsRawInput = true;
    valueRequired = true;
    parent?: ICliCommandProcessor;
    parameters: ICliCommandParameterDescriptor[] = [
        { name: 'url', description: 'New URL', required: false, type: 'string' },
        { name: 'token', description: 'New API token (asked for, hidden, when given without a value)', required: false, type: 'string' },
    ];

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const t = context.translator;
        const { writer } = context;
        const manager = serverManagerOf(context);
        if (!manager || linkingDisabled(context)) return;
        const name = splitShellWords(command.value ?? '')[0] ?? '';
        const connected = [...manager.connections.keys()].find((n) => n.toLowerCase() === name.toLowerCase());
        if (connected && !manager.isLinked(connected)) {
            writer.writeError(t.t('cli.server.link.cannot_edit_host', "'{name}' is configured by the app and cannot be edited.", { name: connected }));
            return;
        }
        const linked = linkedServersOf(context);
        const saved = await linked.get(name);
        if (!saved) {
            writer.writeError(t.t('cli.server.link.unknown_linked', "No linked server '{name}'. See server list.", { name }));
            return;
        }
        const urlArg = command.args?.['url'];
        const tokenArg = command.args?.['token'];
        if (urlArg === undefined && tokenArg === undefined) {
            writer.writeError(t.t('cli.server.link.edit_nothing', 'Give --url <url> and/or --token.'));
            return;
        }
        let url = saved.url;
        if (typeof urlArg === 'string') {
            const checked = checkServerUrl(urlArg, (globalThis as { location?: Location }).location?.protocol);
            if (typeof checked === 'string') {
                writer.writeError(checked);
                return;
            }
            if (!userServersAllow(context.options, checked.url)) {
                writer.writeError(t.t('cli.server.link.origin_not_allowed', 'This app does not allow linking {url}.', { url: checked.url }));
                return;
            }
            if (checked.insecure) {
                writer.writeWarning(t.t('cli.server.link.http_warning', '{url} is not encrypted (http): its token travels in clear text on the network.', { url: checked.url }));
                if (!(await context.reader.readConfirm(t.t('cli.server.link.http_confirm', 'Link it anyway?'), false))) return;
            }
            if (checked.mixedContent) {
                writer.writeWarning(t.t('cli.server.link.mixed_content', 'This page is served over https: the browser may block requests to an http server.'));
            }
            url = checked.url;
        }
        let token = await linked.token(saved.name);
        if (tokenArg !== undefined) {
            token = typeof tokenArg === 'string' && tokenArg.trim() ? tokenArg.trim() : (await context.reader.readPassword(t.t('cli.server.link.token_prompt', 'API token: ')))?.trim();
            if (!token) return;
        }
        const updated = { ...saved, url };
        await linked.save(updated, token);
        const connection = await replaceConnection(manager, linkedServerConfig(updated, token));
        if (connection.connected) {
            writer.writeSuccess(t.t('cli.server.link.updated', 'Updated {name}: {count} commands.', { name: saved.name, count: connection.commands.length }));
        } else if (token && connection.needsSignIn) {
            writer.writeWarning(rejectedTokenMessage(saved.name));
        } else {
            writer.writeWarning(t.t('cli.server.link.updated_unreachable', 'Updated {name}, but it is unreachable now.', { name: saved.name }));
        }
    }
}

// ── forget-all ──────────────────────────────────────────────────────

export class ServerForgetAllProcessor implements ICliCommandChildProcessor {
    command = 'forget-all';
    description = 'Unlink every linked server and delete every saved token';
    parent?: ICliCommandProcessor;

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const t = context.translator;
        const manager = serverManagerOf(context);
        if (!manager) return;
        const linked = linkedServersOf(context);
        const servers = await linked.list();
        if (servers.length === 0) {
            context.writer.writeInfo(t.t('cli.server.link.none_linked', 'No linked servers. Link one with server add.'));
            return;
        }
        const ok = await context.reader.readConfirm(
            t.t('cli.server.link.forget_all_confirm', 'Unlink every linked server ({count}) and delete their saved tokens?', { count: servers.length }),
            false,
        );
        if (!ok) return;
        await linked.clear();
        for (const name of [...manager.connections.keys()]) {
            if (manager.isLinked(name)) manager.removeServer(name);
        }
        const saved = context.state.getState<ServerState>().defaultServer;
        if (saved && !manager.connections.has(saved)) context.state.updateState({ defaultServer: null } as ServerState);
        context.writer.writeSuccess(t.t('cli.server.link.forgot_all', 'Every linked server and saved token is gone.'));
    }
}

/** `token ••••abcd` for `server list`: linked servers with a token. */
export async function linkedTokenLabels(context: ICliExecutionContext, manager: CliServerManager): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const names = [...manager.connections.keys()].filter((n) => manager.isLinked(n));
    if (names.length === 0) return labels;
    const linked = linkedServersOf(context);
    for (const name of names) {
        const token = await linked.token(name).catch(() => undefined);
        if (token) labels.set(name, maskToken(token));
    }
    return labels;
}
