import { CliHeadersProvider, resolveHeaders } from '../models/server';
import { API_VERSION } from '../version';

/**
 * Describes the version information returned by a CLI server's discovery endpoint.
 */
export interface ServerVersionInfo {
    supportedVersions: number[];
    preferredVersion: number;
    serverVersion: string;
}

/** Endpoint path for server version discovery */
const VERSIONS_ENDPOINT = '/api/qcli/versions';

/**
 * Negotiates the API version between a frontend CLI client and a backend server.
 *
 * Flow:
 * 1. Client calls `discover(baseUrl)` which hits `GET ${VERSIONS_ENDPOINT}`
 * 2. Server returns supported versions
 * 3. Client picks the highest mutually supported version
 * 4. All subsequent calls use `/api/v{n}/qcli/*`
 */
export class ServerVersionNegotiator {
    private static readonly CLIENT_SUPPORTED_VERSIONS = [API_VERSION];

    /**
     * Given a server's version info, pick the highest mutually compatible version.
     * Returns null if no compatible version exists.
     */
    static negotiate(serverInfo: ServerVersionInfo): number | null {
        const common = this.CLIENT_SUPPORTED_VERSIONS.filter((v) =>
            serverInfo.supportedVersions.includes(v),
        );
        return common.length > 0 ? Math.max(...common) : null;
    }

    /**
     * Discover the server's supported versions and negotiate the best match.
     * Returns the negotiated API version and the base path for all subsequent calls,
     * or null if the server is unreachable or incompatible.
     */
    static async discover(
        baseUrl: string,
        headers?: CliHeadersProvider,
    ): Promise<{ apiVersion: number; basePath: string } | null> {
        try {
            const resolved = resolveHeaders(headers);
            const response = await fetch(`${baseUrl}${VERSIONS_ENDPOINT}`, {
                headers: Object.keys(resolved).length > 0 ? resolved : undefined,
            });
            if (!response.ok) return null;

            const info: ServerVersionInfo = await response.json();
            const version = this.negotiate(info);

            if (version === null) return null;

            return {
                apiVersion: version,
                basePath: `${baseUrl}/api/v${version}/qcli`,
            };
        } catch {
            return null;
        }
    }
}
