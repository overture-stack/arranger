import { Client, StreamableHTTPClientTransport, type ClientOptions } from '@modelcontextprotocol/client';

/**
 * Pins every test client to the protocol revision this server serves.
 *
 * `@modelcontextprotocol/client` defaults to `mode: 'legacy'`, so a client built without this
 * connects with the 2025-era `initialize` handshake. The server is `legacy: 'reject'`, so that
 * connection is refused outright, and this suite would be asserting nothing about the era we ship.
 *
 * Pinned rather than `'auto'` on purpose: `'auto'` falls back to the legacy handshake when the probe
 * is inconclusive, which is exactly the silent downgrade these tests exist to catch.
 */
export const MODERN_PROTOCOL_REVISION = '2026-07-28';

const versionNegotiation = { mode: { pin: MODERN_PROTOCOL_REVISION } } as const;

/**
 * Adds the modern-era pin to a client's options.
 *
 * For a client that has to be configured before it connects (registering a request handler, for
 * instance), which {@link connectMcpClient} does not leave room for.
 */
export const withModernNegotiation = (options: Omit<ClientOptions, 'versionNegotiation'> = {}): ClientOptions => ({
	...options,
	versionNegotiation,
});

/**
 * Connects an MCP client to the server over Streamable HTTP, pinned to the modern protocol era.
 *
 * @param serverUrl - The MCP endpoint to connect to.
 * @param name - Client name reported to the server, so a failure names the client that caused it.
 * @param options - Extra client options, e.g. the capabilities a test needs to advertise.
 */
export const connectMcpClient = async (
	serverUrl: string,
	name: string,
	options: Omit<ClientOptions, 'versionNegotiation'> = {},
): Promise<Client> => {
	const client = new Client({ name, version: '0.0.0-test' }, { ...options, versionNegotiation });
	await client.connect(new StreamableHTTPClientTransport(new URL(serverUrl)));
	return client;
};
