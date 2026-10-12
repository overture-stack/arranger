import {
	type AuthProvider,
	type CallToolResult,
	Client,
	type ClientOptions,
	type GetPromptResult,
	type ListChangedHandlers,
	type ReadResourceResult,
	type RequestOptions,
	StreamableHTTPClientTransport,
	type StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/client';

import { DEFAULT_MAX_ROUNDS, runConfirmationLoop } from './confirmationLoop.js';
import { type CallOutcome } from './outcomes.js';
import { checkToolOutput, compileOutputValidators, type OutputValidators } from './outputValidation.js';
import { hashSurface, type SurfaceSnapshot, toSurfaceSnapshot } from './surface.js';
import { type CallOptions, type InputResolver } from './types.js';

/** The only protocol revision this client speaks. */
export const PROTOCOL_REVISION = '2026-07-28';

/** A list that can report changes. */
export type SurfaceChangeKind = 'tools' | 'prompts' | 'resources';

/** A change notification from the server. */
export type SurfaceChange = {
	kind: SurfaceChangeKind;
	/** Set when the SDK failed to process the notification. */
	error?: string;
};

/** Configuration for {@link McpClient.connect}. */
export type McpClientOptions = {
	/** The server's Streamable HTTP endpoint. */
	url: string | URL;
	/** This host's name and version, sent to the server. */
	clientInfo: { name: string; version: string };
	/**
	 * Static headers, or an SDK `AuthProvider`, which supplies a token per request and retries once on a 401.
	 *
	 * @remarks
	 * Refused over plain HTTP to anything but a loopback address, unless `allowInsecureHttp` is set.
	 */
	auth?: { headers: Record<string, string> } | { provider: AuthProvider };
	/** Allows `auth` over plain HTTP to a non-loopback address, which exposes the credential on the network. */
	allowInsecureHttp?: boolean;
	/** Answers the server's questions. Without one, the client does not declare `elicitation`, so servers ask nothing. */
	inputResolver?: InputResolver;
	/**
	 * Reports list changes, over a `subscriptions/listen` stream held open for the client's life.
	 *
	 * @remarks
	 * Off unless set. The change is not read: call {@link McpClient.refreshSurface} for that.
	 */
	changeNotifications?: { onChange: (change: SurfaceChange) => void };
	/**
	 * Receives errors the SDK raises outside any call, such as a change-notification stream that failed to open.
	 *
	 * @remarks
	 * Without it, those errors are dropped. Anything it throws is ignored.
	 */
	onError?: (error: Error) => void;
	/**
	 * Timeout per request leg. Waiting on the resolver, between legs, is not timed.
	 *
	 * @defaultValue The SDK's, 60 000 ms
	 */
	requestTimeoutMs?: number;
	/**
	 * Retries allowed after the original request.
	 *
	 * @defaultValue {@link DEFAULT_MAX_ROUNDS}
	 */
	maxRounds?: number;
};

/** A surface snapshot and its hash, with the server's identity kept beside them, out of the hash. */
export type SurfaceRecord = {
	snapshot: SurfaceSnapshot;
	hash: string;
	server?: { name: string; version: string };
	/** When the snapshot was taken, as ISO 8601. */
	takenAt: string;
};

const isLoopback = (url: URL) =>
	url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(\.\d{1,3}){3}$/.test(url.hostname);

/**
 * Refuses to send a credential over plain HTTP to a host other than this machine.
 *
 * @param url - The server's endpoint.
 * @param options - The client's credential, and whether plain HTTP is allowed anyway.
 * @throws `Error` when `auth` is set, `url` is plain HTTP to a non-loopback host, and `allowInsecureHttp` is not set.
 */
export const assertCredentialTransport = (
	url: URL,
	{ auth, allowInsecureHttp }: Pick<McpClientOptions, 'auth' | 'allowInsecureHttp'>,
): void => {
	if (auth && url.protocol === 'http:' && !isLoopback(url) && !allowInsecureHttp) {
		throw new Error(
			`Refusing to send credentials over plain HTTP to ${url.host}; use https, a loopback address, or set allowInsecureHttp`,
		);
	}
};

const transportOptions = (auth: McpClientOptions['auth']): StreamableHTTPClientTransportOptions => {
	if (!auth) {
		return {};
	}
	return 'provider' in auth ? { authProvider: auth.provider } : { requestInit: { headers: auth.headers } };
};

const listChangedHandlers = (onChange: (change: SurfaceChange) => void): ListChangedHandlers => {
	const handler = (kind: SurfaceChangeKind) => ({
		autoRefresh: false,
		onChanged: (error: Error | null) => onChange({ kind, ...(error && { error: error.message }) }),
	});
	return { tools: handler('tools'), prompts: handler('prompts'), resources: handler('resources') };
};

/**
 * One connection to one MCP server, for one user.
 *
 * @remarks
 * Tool calls, prompts and resource reads never throw: each resolves with a {@link CallOutcome}. Run one call at a
 * time.
 */
export class McpClient {
	readonly #client: Client;
	readonly #options: McpClientOptions;
	#surface: SurfaceRecord;
	#validators: OutputValidators;

	private constructor(client: Client, options: McpClientOptions, surface: SurfaceRecord) {
		this.#client = client;
		this.#options = options;
		this.#surface = surface;
		this.#validators = compileOutputValidators(surface.snapshot.tools);
	}

	/**
	 * Connects, and takes a surface snapshot.
	 *
	 * @param options - The server, credentials and resolver.
	 * @param signal - Aborts connecting.
	 * @returns A connected client.
	 * @throws `Error` when `auth` would be sent over plain HTTP (see {@link McpClientOptions.auth}), and whatever the
	 * SDK throws when connecting or reading the surface fails.
	 */
	static async connect(options: McpClientOptions, signal?: AbortSignal): Promise<McpClient> {
		const url = new URL(options.url);
		assertCredentialTransport(url, options);

		const clientOptions: ClientOptions = {
			versionNegotiation: { mode: { pin: PROTOCOL_REVISION } },
			inputRequired: { autoFulfill: false },
			capabilities: options.inputResolver ? { elicitation: { form: {} } } : {},
			...(options.changeNotifications && {
				listChanged: listChangedHandlers(options.changeNotifications.onChange),
			}),
		};
		const client = new Client(options.clientInfo, clientOptions);
		const { onError } = options;
		if (onError) {
			client.onerror = (error) => {
				// The SDK calls this from inside its own promise handlers, so a throw would become an unhandled rejection.
				try {
					onError(error);
				} catch {
					// The host's handler failing must not break the connection.
				}
			};
		}
		const transport = new StreamableHTTPClientTransport(url, transportOptions(options.auth));

		const requestOptions = McpClient.#requestOptions(options, signal);
		await client.connect(transport, requestOptions);
		try {
			return new McpClient(client, options, await McpClient.#readSurface(client, requestOptions));
		} catch (error) {
			await client.close();
			throw error;
		}
	}

	static #requestOptions(options: McpClientOptions, signal?: AbortSignal): RequestOptions {
		return {
			...(signal && { signal }),
			...(options.requestTimeoutMs !== undefined && { timeout: options.requestTimeoutMs }),
		};
	}

	/**
	 * Reads the surface. `server/discover` is never cached, and the lists are read with `'refresh'`, so a redeploy
	 * is always seen.
	 */
	static async #readSurface(client: Client, requestOptions: RequestOptions): Promise<SurfaceRecord> {
		const discover = await client.discover(requestOptions);
		const { capabilities } = discover;
		const listOptions = { ...requestOptions, cacheMode: 'refresh' as const };
		const [tools, resources, resourceTemplates, prompts] = await Promise.all([
			capabilities.tools ? client.listTools(undefined, listOptions) : undefined,
			capabilities.resources ? client.listResources(undefined, listOptions) : undefined,
			capabilities.resources ? client.listResourceTemplates(undefined, listOptions) : undefined,
			capabilities.prompts ? client.listPrompts(undefined, listOptions) : undefined,
		]);
		const snapshot = toSurfaceSnapshot({ discover, tools, resources, resourceTemplates, prompts });
		const server = client.getServerVersion();

		return {
			snapshot,
			hash: hashSurface(snapshot),
			...(server && { server: { name: server.name, version: server.version } }),
			takenAt: new Date().toISOString(),
		};
	}

	/** The latest snapshot, from connecting or from {@link McpClient.refreshSurface}. */
	get surface(): SurfaceRecord {
		return this.#surface;
	}

	/**
	 * Re-reads the surface, as at the start of each run, bypassing the SDK's response cache.
	 *
	 * @param signal - Aborts the re-read.
	 * @returns The new snapshot, which also becomes {@link McpClient.surface}.
	 * @throws Whatever the SDK throws when a read fails.
	 */
	async refreshSurface(signal?: AbortSignal): Promise<SurfaceRecord> {
		const surface = await McpClient.#readSurface(this.#client, McpClient.#requestOptions(this.#options, signal));
		this.#validators = compileOutputValidators(surface.snapshot.tools);
		this.#surface = surface;
		return surface;
	}

	/**
	 * Calls a tool, answering any server questions through the resolver.
	 *
	 * @param callId - The host's id for the call, used in each question's id.
	 * @param name - The tool's name.
	 * @param args - The tool's arguments.
	 * @param options - Cancellation, and an observer for each round.
	 * @returns How the call ended. A result is checked against the tool's `outputSchema` in the latest snapshot.
	 */
	async callTool(
		callId: string,
		name: string,
		args: Record<string, unknown> = {},
		options: CallOptions = {},
	): Promise<CallOutcome<CallToolResult>> {
		const outcome = await this.#call<CallToolResult>(callId, 'tools/call', { name, arguments: args }, options);
		if (outcome.outcome !== 'result') {
			return outcome;
		}
		const invalid = checkToolOutput(this.#validators, name, outcome.result);
		return invalid ? { ...outcome, outcome: 'output_invalid', message: invalid } : outcome;
	}

	/**
	 * Gets a prompt, answering any server questions through the resolver.
	 *
	 * @param callId - The host's id for the request, used in each question's id.
	 * @param name - The prompt's name.
	 * @param args - The prompt's arguments.
	 * @param options - Cancellation, and an observer for each round.
	 * @returns How the request ended.
	 */
	getPrompt(
		callId: string,
		name: string,
		args: Record<string, string> = {},
		options: CallOptions = {},
	): Promise<CallOutcome<GetPromptResult>> {
		return this.#call<GetPromptResult>(callId, 'prompts/get', { name, arguments: args }, options);
	}

	/**
	 * Reads a resource, answering any server questions through the resolver.
	 *
	 * @param callId - The host's id for the request, used in each question's id.
	 * @param uri - The resource's URI.
	 * @param options - Cancellation, and an observer for each round.
	 * @returns How the request ended.
	 */
	readResource(callId: string, uri: string, options: CallOptions = {}): Promise<CallOutcome<ReadResourceResult>> {
		return this.#call<ReadResourceResult>(callId, 'resources/read', { uri }, options);
	}

	/** Closes the connection, including any change-notification stream. */
	close(): Promise<void> {
		return this.#client.close();
	}

	#call<T>(
		callId: string,
		method: 'tools/call' | 'prompts/get' | 'resources/read',
		params: Record<string, unknown>,
		{ signal, onRound }: CallOptions,
	): Promise<CallOutcome<T>> {
		const requestOptions = {
			...McpClient.#requestOptions(this.#options, signal),
			allowInputRequired: true,
		};
		return runConfirmationLoop<T>({
			callId,
			params,
			send: (legParams) => this.#client.request({ method, params: legParams }, requestOptions),
			maxRounds: this.#options.maxRounds ?? DEFAULT_MAX_ROUNDS,
			...(this.#options.inputResolver && { resolver: this.#options.inputResolver }),
			...(signal && { signal }),
			...(onRound && { onRound }),
		});
	}
}
