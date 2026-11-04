// A conversation's connections: one `McpClient` per configured server, and re-reading their surfaces.
import {
	type ElicitResult,
	type InputQuestion,
	McpClient,
	ReconnectRequiredError,
} from '@overture-stack/arranger-mcp-client';

import { type McpHostOptions, type ServerConfig } from './options.js';
import { type SurfaceServer } from './registry.js';
import { errorMessage } from './utils.js';

/** A connected server, with the flags host-core reads from its configuration. */
export type Connected = {
	config: ServerConfig;
	trusted: boolean;
	containsOnlyOpenData: boolean;
	client: McpClient;
	/** Set when the server reports a change of tools, until its surface is re-read. */
	stale: boolean;
};

/** Bridges a server's question to the consumer. */
export type QuestionResolver = (server: string, question: InputQuestion) => Promise<ElicitResult>;

/** A surface that could not be re-read, by server. */
export type RefreshError = { key: string; message: string };

/** The connections of one conversation, by server key. */
export class Connections {
	readonly #servers = new Map<string, Connected>();
	readonly #options: Pick<McpHostOptions, 'confirmations' | 'onServerError' | 'clientInfo'>;
	readonly #resolve: QuestionResolver;

	/**
	 * @param options - The host's options, for confirmations, the server error handler and the client's name.
	 * @param resolve - Answers a server's question; used only when the consumer answers confirmations.
	 */
	constructor(options: McpHostOptions, resolve: QuestionResolver) {
		this.#options = options;
		this.#resolve = resolve;
	}

	/** Every connected server, in the order each first connected. */
	all(): Connected[] {
		return [...this.#servers.values()];
	}

	/** Every connected server's key, in the order each first connected. */
	keys(): string[] {
		return [...this.#servers.keys()];
	}

	/** The connected server with this key, if there is one. */
	get(key: string): Connected | undefined {
		return this.#servers.get(key);
	}

	/**
	 * Connects to one server, replacing any earlier connection under its key.
	 *
	 * @remarks
	 * Declares `elicitation` only when the consumer answers confirmations, listens for tool changes only when the
	 * server's configuration asks for it, and shields the connection from a server error handler that throws.
	 *
	 * @param config - The server's configuration.
	 * @param signal - Aborts connecting.
	 * @throws Whatever `McpClient.connect` throws.
	 */
	async connect(config: ServerConfig, signal?: AbortSignal): Promise<void> {
		const { key } = config;
		const { confirmations, onServerError, clientInfo } = this.#options;
		const client = await McpClient.connect(
			{
				...config.connection,
				clientInfo,
				...(confirmations !== false && {
					inputResolver: (question: InputQuestion) => this.#resolve(key, question),
				}),
				...(config.changeNotifications && {
					changeNotifications: {
						onChange: () => {
							const server = this.#servers.get(key);
							if (server) {
								server.stale = true;
							}
						},
					},
				}),
				...(onServerError && {
					onError: (error: Error) => {
						try {
							onServerError(key, error);
						} catch {
							// The consumer's handler failing must not break the connection.
						}
					},
				}),
			},
			signal,
		);
		this.#servers.set(key, {
			config,
			trusted: config.trusted === true,
			containsOnlyOpenData: config.containsOnlyOpenData === true,
			client,
			stale: false,
		});
	}

	/** Closes every server's connection, whether or not each close succeeds. */
	async close(): Promise<void> {
		await Promise.allSettled(this.all().map(({ client }) => client.close()));
	}

	/**
	 * Re-reads every server's surface, in parallel. A server that requires a reconnect gets one attempt.
	 *
	 * @param signal - Aborts the reads.
	 * @returns A message for each server whose surface could not be read, empty when every read succeeded.
	 */
	async refreshAll(signal: AbortSignal): Promise<string[]> {
		const failures = await Promise.all(
			this.all().map(async (server): Promise<string | undefined> => {
				server.stale = false;
				try {
					await server.client.refreshSurface(signal);
					return undefined;
				} catch (error) {
					if (!(error instanceof ReconnectRequiredError)) {
						return `${server.config.key}: ${errorMessage(error)}`;
					}
				}
				try {
					await server.client.close();
					await this.connect(server.config, signal);
					return undefined;
				} catch (error) {
					return `${server.config.key}: reconnecting failed: ${errorMessage(error)}`;
				}
			}),
		);
		return failures.filter((failure) => failure !== undefined);
	}

	/**
	 * Re-reads the surfaces of servers that reported a change, one at a time. A server whose read fails keeps its
	 * previous tools.
	 *
	 * @param signal - Aborts the reads.
	 * @returns The servers re-read and any read errors, or `undefined` when no server reported a change.
	 */
	async refreshStale(signal: AbortSignal): Promise<{ refreshed: Connected[]; errors: RefreshError[] } | undefined> {
		const refreshed = this.all().filter(({ stale }) => stale);
		if (refreshed.length === 0) {
			return undefined;
		}
		const errors: RefreshError[] = [];
		for (const server of refreshed) {
			server.stale = false;
			try {
				await server.client.refreshSurface(signal);
			} catch (error) {
				errors.push({ key: server.config.key, message: errorMessage(error) });
			}
		}
		return { refreshed, errors };
	}

	/** Each server's key, trust and latest surface snapshot, for the registry and the model surface. */
	surfaceServers(): SurfaceServer[] {
		return this.all().map(({ config, trusted, client }) => ({
			key: config.key,
			trusted,
			snapshot: client.surface.snapshot,
		}));
	}
}
