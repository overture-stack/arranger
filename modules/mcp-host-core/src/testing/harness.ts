// The host tests' harness: a scripted provider, the options for one test server, and the events a run emits.
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

import { type HostEvent } from '../events.js';
import { McpHost } from '../host.js';
import { type ConversationItem, type FunctionCallOutput, isFunctionCallOutput } from '../messages.js';
import { type McpHostOptions } from '../options.js';
import { reduceToolName } from '../registry.js';

import { type ScriptStep, ScriptedProvider } from './scriptedProvider.js';
import { startTestServer, type TestServer, type TestServerOptions } from './server.js';

export const name = (tool: string) => reduceToolName('test', tool);

export type Harness = {
	provider: ScriptedProvider;
	events: HostEvent[];
	options: McpHostOptions;
	/** Adds a listener, called after the event is recorded. */
	on: (listener: (event: HostEvent, host: McpHost) => void) => void;
	of: <T extends HostEvent['type']>(type: T) => Extract<HostEvent, { type: T }>[];
	create: () => Promise<McpHost>;
};

export const createHarness = (
	server: TestServer,
	steps: ScriptStep[],
	overrides: Partial<McpHostOptions> = {},
	providerOptions: ConstructorParameters<typeof ScriptedProvider>[1] = {},
): Harness => {
	const provider = new ScriptedProvider(steps, providerOptions);
	const events: HostEvent[] = [];
	const listeners: ((event: HostEvent, host: McpHost) => void)[] = [];
	let host: McpHost | undefined;
	const options: McpHostOptions = {
		servers: [{ key: 'test', trusted: true, connection: { url: server.url } }],
		provider,
		model: { model: 'scripted', temperature: 0, topP: 1, maxOutputTokens: 100 },
		approvalPolicy: () => 'allow',
		confirmations: {},
		limits: { turns: 10, toolCalls: 10, wallClockMs: 30_000 },
		retries: { emptyReply: true, outputLimit: true },
		contextWindow: { tokens: 1_000_000, policy: 'shorten' },
		clientInfo: { name: 'mcp-host-core-test', version: '0.0.0' },
		onEvent: (event) => {
			events.push(event);
			for (const listener of listeners) {
				if (host) {
					listener(event, host);
				}
			}
		},
		...overrides,
	};
	return {
		provider,
		events,
		options,
		on: (listener) => listeners.push(listener),
		of: (type) => events.filter((event) => event.type === type) as never,
		create: async () => {
			host = await McpHost.create(options);
			return host;
		},
	};
};

/** Each tool message, in order. */
export const outputs = (items: readonly ConversationItem[]): FunctionCallOutput[] => items.filter(isFunctionCallOutput);

export const until = async (check: () => boolean, timeoutMs = 3_000) => {
	const deadline = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() > deadline) {
			assert.fail('condition not met in time');
		}
		await sleep(10);
	}
};

export const withServer = async (options: TestServerOptions, body: (server: TestServer) => Promise<void>) => {
	const server = await startTestServer(options);
	try {
		await body(server);
	} finally {
		await server.close();
	}
};

/** Runs one host against `server`, closed however the test ends. */
export const withHost = async (harness: Harness, body: (host: McpHost) => Promise<void>) => {
	const host = await harness.create();
	try {
		await body(host);
	} finally {
		await host.close();
	}
};
