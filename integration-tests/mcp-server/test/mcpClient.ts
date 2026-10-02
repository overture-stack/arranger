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
 * Connects an MCP client to the server over Streamable HTTP, pinned to the modern protocol era.
 *
 * @param serverUrl - The MCP endpoint to connect to.
 * @param name - Client name reported to the server, so a failure names the client that caused it.
 * @param options - Extra client options, e.g. the capabilities a test needs to advertise.
 * @param beforeConnect - Runs against the constructed client before it connects. Anything the client
 * has to be able to answer from its first exchange, a request handler in particular, belongs here
 * rather than on the returned client.
 * @returns The connected client.
 */
export const connectMcpClient = async (
	serverUrl: string,
	name: string,
	options: Omit<ClientOptions, 'versionNegotiation'> = {},
	beforeConnect?: (client: Client) => void,
): Promise<Client> => {
	const client = new Client({ name, version: '0.0.0-test' }, { ...options, versionNegotiation });
	beforeConnect?.(client);
	await client.connect(new StreamableHTTPClientTransport(new URL(serverUrl)));
	return client;
};

/**
 * Connects a client that behaves like a host supporting confirm-before-execute, and always approves.
 *
 * `execute_query` refuses a client that does not declare `elicitation`, so the shared suite client
 * has to declare it or every query test would be answered with that refusal. Auto-fulfilment is on
 * by default, so the client answers the embedded request and retries the call itself, which is why
 * `callTool` resolves with the final result rather than the intermediate `input_required`.
 *
 * @param serverUrl - The MCP endpoint to connect to.
 * @param name - Client name reported to the server, so a failure names the client that caused it.
 * @returns The connected client, approving every confirmation it is asked for.
 */
export const connectApprovingClient = (serverUrl: string, name: string): Promise<Client> =>
	connectMcpClient(serverUrl, name, { capabilities: { elicitation: {} } }, (client) => {
		client.setRequestHandler('elicitation/create', async () => ({
			action: 'accept',
			content: { confirm: true },
		}));
	});
