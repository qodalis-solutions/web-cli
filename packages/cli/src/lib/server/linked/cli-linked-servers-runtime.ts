import {
    ICliExecutionContext,
    ICliKeyValueStore,
    ICliKeyValueStore_TOKEN,
    ICliSecretStore,
    ICliSecretStore_TOKEN,
} from '@qodalis/cli-core';
import { CliServerManager } from '../cli-server-manager';
import {
    CliLinkedServers,
    linkedServerConfig,
    userServersAllow,
    userServersEnabled,
} from './cli-linked-servers';
import { CliWebCryptoSecretStore } from './cli-web-crypto-secret-store';

/** One Web Crypto store per key-value store, so parallel first saves create one key, not two. */
const webCryptoStores = new WeakMap<ICliKeyValueStore, CliWebCryptoSecretStore>();

/** The secret store: the host's ({@link ICliSecretStore_TOKEN}) or the Web Crypto one. */
export function secretStoreOf(context: Pick<ICliExecutionContext, 'services'>): ICliSecretStore {
    const provided = context.services.get<ICliSecretStore>(ICliSecretStore_TOKEN);
    if (provided) return provided;
    const kv = context.services.getRequired<ICliKeyValueStore>(ICliKeyValueStore_TOKEN);
    let store = webCryptoStores.get(kv);
    if (!store) {
        store = new CliWebCryptoSecretStore(kv);
        webCryptoStores.set(kv, store);
    }
    return store;
}

/** The linked servers of this terminal. */
export function linkedServersOf(context: Pick<ICliExecutionContext, 'services'>): CliLinkedServers {
    const kv = context.services.getRequired<ICliKeyValueStore>(ICliKeyValueStore_TOKEN);
    return new CliLinkedServers(kv, secretStoreOf(context));
}

/** Message for a linked server that rejects its token. */
export function rejectedTokenMessage(name: string): string {
    return `Server '${name}' rejected its token. Link it again with server add ${name}, or set a new token with server edit ${name} --token.`;
}

/**
 * Connects the servers linked with `server add` (boot, after the host's
 * servers). Host servers win a name clash; servers the host options no longer
 * allow are skipped.
 */
export async function restoreLinkedServers(
    context: Pick<ICliExecutionContext, 'services' | 'options'>,
    manager: CliServerManager,
    warn: (message: string) => void,
): Promise<void> {
    if (!userServersEnabled(context.options)) return;
    const linked = linkedServersOf(context);
    let servers;
    try {
        servers = await linked.list();
    } catch {
        return;
    }
    for (const server of servers) {
        if (manager.connections.has(server.name)) {
            warn(`Linked server '${server.name}' is not connected: the app has a server with the same name.`);
            continue;
        }
        if (!userServersAllow(context.options, server.url)) {
            warn(`Linked server '${server.name}' (${server.url}) is not allowed by this app.`);
            continue;
        }
        const token = await linked.token(server.name).catch(() => undefined);
        const connection = await manager.addServer(linkedServerConfig(server, token), { linked: true });
        if (token && connection.needsSignIn) warn(rejectedTokenMessage(server.name));
    }
}
