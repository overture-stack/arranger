// An in-process MCP server for this module's tests, over loopback HTTP like a deployed server. Its tools exist only
// to exercise host-core: names the registry must reduce, each kind of content, and each way a call can end.
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
} from '@modelcontextprotocol/server';
import { z as zod } from 'zod';

/** Long enough that its reduced name needs the hash suffix. */
export const LONG_TOOL_NAME = 'a_tool_whose_name_runs_long_enough_that_its_reduced_name_passes_sixty_four';

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
	instructions?: string;
	/** How long a minted `requestState` stays valid. */
	ttlSeconds?: number;
	/** Answers 500 to every request for this method, by its `Mcp-Method` header. */
	failMethod?: string;
};

/** What the `slow` tool saw. */
export type ProbeRecord = { aborted: boolean; finished: boolean };

/**
 * Starts a test server on `127.0.0.1` and a free port.
 *
 * @param options - Identity, instructions, state lifetime and failures to simulate.
 * @returns The server's URL, what it has recorded, and controls for the test.
 */
export const startTestServer = async (options: TestServerOptions = {}) => {
	/** Each tool run that did its work, by tool name. */
	const executed: string[] = [];
	const probes: ProbeRecord[] = [];
	/** Read by each request's server instance, so a test can change the surface between requests. */
	const state = { extraTools: [] as string[], failMethod: options.failMethod, prompts: true };

	// Built once: the factory runs per request, and a codec built inside it would verify under another key.
	const codec = createRequestStateCodec<RoundState>({ key: randomBytes(32), ttlSeconds: options.ttlSeconds ?? 600 });

	const buildServer = () => {
		const server = new McpServer(
			{ name: options.name ?? 'mcp-host-core-test-server', version: '1.0.0' },
			{
				requestState: { verify: codec.verify },
				...(options.instructions !== undefined && { instructions: options.instructions }),
			},
		);

		server.registerTool(
			'lookup',
			{ description: 'Looks up one item.', inputSchema: zod.object({ id: zod.string() }) },
			async ({ id }) => {
				executed.push('lookup');
				return { content: [{ type: 'text', text: `found ${id}` }] };
			},
		);

		server.registerTool('catalogue.search', { description: 'A dotted name, reduced for the model.' }, async () => {
			executed.push('catalogue.search');
			return { content: [{ type: 'text', text: 'searched' }] };
		});

		server.registerTool(LONG_TOOL_NAME, { description: 'A name that needs the hash suffix.' }, async () => {
			executed.push(LONG_TOOL_NAME);
			return { content: [{ type: 'text', text: 'long' }] };
		});

		server.registerTool(
			'big',
			{ description: 'Returns `size` characters.', inputSchema: zod.object({ size: zod.number() }) },
			async ({ size }) => ({ content: [{ type: 'text', text: 'x'.repeat(size) }] }),
		);

		server.registerTool('picture', { description: 'Text and an image.' }, async () => ({
			content: [
				{ type: 'text', text: 'a chart' },
				{ type: 'image', data: 'AAAA', mimeType: 'image/png' },
			],
		}));

		server.registerTool('embedded', { description: 'An embedded resource.' }, async () => ({
			content: [{ type: 'resource', resource: { uri: 'test://embedded', text: 'inside' } }],
		}));

		server.registerTool(
			'structured',
			{ description: 'Structured content and no text.', outputSchema: fromJsonSchema(OUTPUT_SCHEMA, unchecked) },
			async () => ({ content: [], structuredContent: { count: 3 } }),
		);

		server.registerTool(
			'bad_output',
			{
				description: 'Returns output its schema forbids.',
				outputSchema: fromJsonSchema(OUTPUT_SCHEMA, unchecked),
			},
			async () => ({ content: [], structuredContent: { count: 'not a number' } }),
		);

		server.registerTool('fails', { description: 'A result with isError.' }, async () => ({
			content: [{ type: 'text', text: 'it failed' }],
			isError: true,
		}));

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
			if (acceptedContent(ctx.mcpReq.inputResponses, 'confirm', confirmContent)?.confirm !== true) {
				return { content: [{ type: 'text', text: 'not confirmed' }] };
			}
			executed.push('confirm');
			return { content: [{ type: 'text', text: 'ran' }] };
		});

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

		for (const name of state.extraTools) {
			server.registerTool(name, { description: 'Added during the test.' }, async () => ({
				content: [{ type: 'text', text: name }],
			}));
		}

		if (state.prompts) {
			server.registerPrompt(
				'start',
				{ description: 'Seeds a conversation.', argsSchema: zod.object({ topic: zod.string() }) },
				async ({ topic }) => ({
					messages: [
						{ role: 'user', content: { type: 'text', text: `Tell me about ${topic}` } },
						{ role: 'assistant', content: { type: 'text', text: 'I will look it up.' } },
						{ role: 'user', content: { type: 'text', text: 'Go ahead.' } },
					],
				}),
			);
		}

		return server;
	};

	const handler = createMcpHandler(buildServer, { legacy: 'reject', keepAliveMs: 0 });
	const serve = toNodeHandler(handler);
	const httpServer = createServer((req, res) => {
		if (state.failMethod !== undefined && req.headers['mcp-method'] === state.failMethod) {
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
