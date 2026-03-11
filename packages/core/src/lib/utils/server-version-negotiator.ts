/**
 * Describes the version information returned by a CLI server's discovery endpoint.
 */
export interface ServerVersionInfo {
    supportedVersions: number[];
    preferredVersion: number;
    serverVersion: string;
}

/**
 * Negotiates the API version between a frontend CLI client and a backend server.
 *
 * Flow:
 * 1. Client calls `discover(baseUrl)` which hits `GET /api/cli/versions`
 * 2. Server returns supported versions
 * 3. Client picks the highest mutually supported version
 * 4. All subsequent calls use `/api/v{n}/cli/*`
 */
export class ServerVersionNegotiator {
    private static readonly CLIENT_SUPPORTED_VERSIONS = [2];

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
    ): Promise<{ apiVersion: number; basePath: string } | null> {
        try {
            const response = await fetch(`${baseUrl}/api/cli/versions`);
            if (!response.ok) return null;

            const info: ServerVersionInfo = await response.json();
            const version = this.negotiate(info);

            if (version === null) return null;

            return {
                apiVersion: version,
                basePath: `${baseUrl}/api/v${version}/cli`,
            };
        } catch {
            return null;
        }
    }
}
