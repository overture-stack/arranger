// An in-process MCP server for this module's tests, over loopback HTTP like a deployed server.
// Its tools exist only to exercise the client.
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { type AddressInfo } from 'node:net';

import { toNodeHandler } from '@modelcontextprotocol/node';
import {
	acceptedContent,
	createMcpHandler,
	createRequestStateCodec,
	fromJsonSchema,
	inputRequired,
	inputResponse,
	type jsonSchemaValidator,
	McpServer,
	ResourceTemplate,
} from '@modelcontextprotocol/server';
import { z as zod } from 'zod';

const CONFIRM_SCHEMA = {
	type: 'object' as const,
	properties: { confirm: { type: 'boolean' as const, title: 'Go ahead?' } },
	required: ['confirm'],
};

const confirmContent = zod.object({ confirm: zod.boolean() });

const OUTPUT_SCHEMA = {
	type: 'object',
	properties: { count: { type: 'number' } },
	required: ['count'],
} as const;

/** Declares an output schema but checks nothing, so a tool can send output that fails it. */
const unchecked: jsonSchemaValidator = {
	getValidator: (() => (input: unknown) => ({
		valid: true,
		data: input,
		errorMessage: undefined,
	})) as jsonSchemaValidator['getValidator'],
};

type RoundState = { step: number };

/** Configuration for {@link startTestServer}. */
export type TestServerOptions = {
	name?: string;
	version?: string;
	instructions?: string;
	/** How long a minted `requestState` stays valid. */
	ttlSeconds?: number;
	/** Sent as `ttlMs` on list and discover results, so a client may cache them. */
	listTtlMs?: number;
	/** Answers 401 to any request without `Authorization: Bearer <requireToken>`. */
	requireToken?: string;
	/** Answers 500 to every request for this method, by its `Mcp-Method` header. */
	failMethod?: string;
	/** Open change-notification streams allowed; 0 refuses every one. */
	maxSubscriptions?: number;
};

/** What the `slow` tool saw. */
export type ProbeRecord = { aborted: boolean; finished: boolean };

/** One HTTP request the server received, including any it refused, by its `Mcp-Method` header. */
export type RecordedRequest = { method: string | null; headers: Record<string, string> };

/**
 * Starts a test server on `127.0.0.1` and a free port.
 *
 * @param options - Identity, state lifetime, cache hints and failures to simulate.
 * @returns The server's URL, what it has recorded, and controls for the test.
 */
export const startTestServer = async (options: TestServerOptions = {}) => {
	/** Each tool run that did its work, by tool name. */
	const executed: string[] = [];
	const probes: ProbeRecord[] = [];
	const requests: RecordedRequest[] = [];
	/** Read by each request's server instance, so a test can change the surface, or the server's version, between requests, as a redeploy would. */
	const state = { extraTools: [] as string[], version: undefined as string | undefined, prompts: true };

	// Built once: the factory runs per request, and a codec built inside it would verify under another key.
	const codec = createRequestStateCodec<RoundState>({ key: randomBytes(32), ttlSeconds: options.ttlSeconds ?? 600 });

	const buildServer = () => {
		const cacheHint =
			options.listTtlMs === undefined ? undefined : { ttlMs: options.listTtlMs, cacheScope: 'private' as const };
		const server = new McpServer(
			{ name: options.name ?? 'mcp-client-test-server', version: state.version ?? options.version ?? '1.0.0' },
			{
				requestState: { verify: codec.verify },
				...(options.instructions !== undefined && { instructions: options.instructions }),
				...(cacheHint && {
					cacheHints: { 'tools/list': cacheHint, 'prompts/list': cacheHint, 'server/discover': cacheHint },
				}),
			},
		);

		server.registerTool('confirm', { description: 'Asks for confirmation, then runs.' }, async (ctx) => {
			const answer = inputResponse(ctx.mcpReq.inputResponses, 'confirm');
			if (answer.kind === 'missing') {
				return inputRequired({
					inputRequests: {
						confirm: inputRequired.elicit({ message: 'Run it?', requestedSchema: CONFIRM_SCHEMA }),
					},
					requestState: await codec.mint({ step: 1 }),
				});
			}
			if (ctx.mcpReq.requestState<RoundState>()?.step !== 1) {
				return { content: [{ type: 'text', text: 'missing state' }], isError: true };
			}
			if (acceptedContent(ctx.mcpReq.inputResponses, 'confirm', confirmContent)?.confirm !== true) {
				return { content: [{ type: 'text', text: 'declined' }] };
			}
			executed.push('confirm');
			return { content: [{ type: 'text', text: 'ran' }] };
		});

		server.registerTool(
			'state_only',
			{ description: 'Two rounds with no questions, then a result.' },
			async (ctx) => {
				const step = ctx.mcpReq.requestState<RoundState>()?.step ?? 0;
				if (step < 2) {
					return inputRequired({ requestState: await codec.mint({ step: step + 1 }) });
				}
				executed.push('state_only');
				return { content: [{ type: 'text', text: `after ${step} rounds` }] };
			},
		);

		server.registerTool('always_asks', { description: 'Asks again however it is answered.' }, async (ctx) =>
			inputRequired({
				inputRequests: {
					again: inputRequired.elicit({ message: 'Once more?', requestedSchema: CONFIRM_SCHEMA }),
				},
				requestState: await codec.mint({ step: (ctx.mcpReq.requestState<RoundState>()?.step ?? 0) + 1 }),
			}),
		);

		server.registerTool(
			'asks_sampling',
			{ description: 'Asks for something the client never declares.' },
			async () =>
				inputRequired({
					inputRequests: {
						sample: inputRequired.createMessage({
							messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }],
							maxTokens: 10,
						}),
					},
				}),
		);

		server.registerTool('slow', { description: 'Waits 3 s or until aborted, and records which.' }, async (ctx) => {
			const record: ProbeRecord = { aborted: false, finished: false };
			probes.push(record);
			await new Promise<void>((resolve) => {
				const timer = setTimeout(resolve, 3_000);
				ctx.mcpReq.signal.addEventListener('abort', () => {
					record.aborted = true;
					clearTimeout(timer);
					resolve();
				});
			});
			record.finished = true;
			return { content: [{ type: 'text', text: record.aborted ? 'aborted' : 'finished' }] };
		});

		server.registerTool(
			'bad_output',
			{
				description: 'Returns output its schema forbids.',
				outputSchema: fromJsonSchema(OUTPUT_SCHEMA, unchecked),
			},
			async () => ({ content: [], structuredContent: { count: 'not a number' } }),
		);

		server.registerTool(
			'error_without_output',
			{
				description: 'An error result, with no structured content.',
				outputSchema: fromJsonSchema(OUTPUT_SCHEMA, unchecked),
			},
			async () => ({ content: [{ type: 'text', text: 'failed' }], isError: true }),
		);

		for (const name of state.extraTools) {
			server.registerTool(name, { description: 'Added during the test.' }, async () => ({ content: [] }));
		}

		server.registerResource(
			'confirm_resource',
			'test://confirm',
			{ description: 'Asks for confirmation before it is read.' },
			async (uri, ctx) => {
				if (acceptedContent(ctx.mcpReq.inputResponses, 'confirm', confirmContent)?.confirm !== true) {
					return inputRequired({
						inputRequests: {
							confirm: inputRequired.elicit({ message: 'Read it?', requestedSchema: CONFIRM_SCHEMA }),
						},
						requestState: await codec.mint({ step: 1 }),
					});
				}
				return { contents: [{ uri: uri.href, text: 'confirmed contents' }] };
			},
		);

		server.registerResource(
			'item',
			new ResourceTemplate('test://items/{id}', { list: undefined }),
			{ description: 'One item, by id.' },
			async (uri, { id }) => ({ contents: [{ uri: uri.href, text: `item ${String(id)}` }] }),
		);

		if (state.prompts) {
			server.registerPrompt(
				'confirm_prompt',
				{
					description: 'Asks for confirmation before returning its messages.',
					argsSchema: zod.object({ topic: zod.string() }),
				},
				async ({ topic }, ctx) => {
					const confirmed = acceptedContent(ctx.mcpReq.inputResponses, 'confirm', confirmContent);
					if (!confirmed) {
						return inputRequired({
							inputRequests: {
								confirm: inputRequired.elicit({
									message: `Start on ${topic}?`,
									requestedSchema: CONFIRM_SCHEMA,
								}),
							},
							requestState: await codec.mint({ step: 1 }),
						});
					}
					return { messages: [{ role: 'user', content: { type: 'text', text: `About ${topic}` } }] };
				},
			);
		}

		return server;
	};

	const handler = createMcpHandler(buildServer, {
		legacy: 'reject',
		keepAliveMs: 0,
		...(options.maxSubscriptions !== undefined && { maxSubscriptions: options.maxSubscriptions }),
	});
	const serve = toNodeHandler(handler);
	const httpServer = createServer((req, res) => {
		const method = req.headers['mcp-method'];
		requests.push({
			method: typeof method === 'string' ? method : null,
			headers: Object.fromEntries(
				Object.entries(req.headers).map(([name, value]) => [name, String(value)] as const),
			),
		});
		if (options.requireToken !== undefined && req.headers.authorization !== `Bearer ${options.requireToken}`) {
			res.writeHead(401).end();
			return;
		}
		if (options.failMethod !== undefined && method === options.failMethod) {
			res.writeHead(500).end();
			return;
		}
		void serve(req, res);
	});
	await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
	const { port } = httpServer.address() as AddressInfo;
	let closing: Promise<void> | undefined;

	return {
		url: `http://127.0.0.1:${port}/mcp`,
		executed,
		probes,
		requests,
		state,
		notify: handler.notify,
		/** Stops the server. Safe to call more than once. */
		close: () => {
			closing ??= (async () => {
				await handler.close();
				httpServer.closeAllConnections();
				await new Promise<void>((resolve, reject) =>
					httpServer.close((error) => (error ? reject(error) : resolve())),
				);
			})();
			return closing;
		},
	};
};

export type TestServer = Awaited<ReturnType<typeof startTestServer>>;
