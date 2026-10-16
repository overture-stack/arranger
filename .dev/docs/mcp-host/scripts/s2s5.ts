/**
 * Spikes S2, S2b and S5 against in-process `apps/mcp-server` instances with Arranger stubbed out.
 *
 * Run from the repository root:
 *   LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/s2s5.ts
 *
 * Writes `results/s2s5.json` and `results/tools.json` (the `tools/list` result as a client receives it).
 */
import { writeFile } from 'node:fs/promises';

import {
	Client,
	type CallToolResult,
	type InputRequiredResult,
	isInputRequiredResult,
	StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

import { executeQueryArguments, startTestServer } from './testServer.ts';

const RESULTS = new URL('../results/', import.meta.url);
const APPROVED = { confirm: { action: 'accept', content: { confirm: true } } };

/** A client as `mcp-client` would configure it: pinned, manual input, form elicitation declared. */
const connect = async (url: string, options: { autoFulfill: boolean }) => {
	const client = new Client(
		{ name: 'phase0-spike', version: '0.0.0' },
		{
			versionNegotiation: { mode: { pin: '2026-07-28' } },
			capabilities: { elicitation: { form: {} } },
			inputRequired: { autoFulfill: options.autoFulfill },
		},
	);
	await client.connect(new StreamableHTTPClientTransport(new URL(url)));
	return client;
};

/** Every own property of a thrown value, so the record shows exactly what a caller can branch on. */
const describeError = (error: unknown) => {
	if (!(error instanceof Error)) {
		return { thrown: error };
	}
	const own = Object.fromEntries(
		Object.getOwnPropertyNames(error)
			.filter((key) => key !== 'stack')
			.map((key) => [key, (error as unknown as Record<string, unknown>)[key]]),
	);
	return { class: error.constructor.name, ...own };
};

const attempt = async (run: () => Promise<unknown>) => {
	try {
		return { outcome: 'returned', value: await run() };
	} catch (error) {
		return { outcome: 'threw', error: describeError(error) };
	}
};

const callExecuteQuery = (client: Client, extra: Record<string, unknown> = {}) =>
	client.request(
		{ method: 'tools/call', params: { name: 'execute_query', arguments: executeQueryArguments, ...extra } },
		{ allowInputRequired: true },
	) as Promise<CallToolResult | InputRequiredResult>;

const results: Record<string, unknown> = {};
const serverA = await startTestServer();
const serverB = await startTestServer();

try {
	// S2.1: callTool after listTools has cached execute_query's outputSchema.
	{
		const client = await connect(serverA.url, { autoFulfill: false });
		const tools = await client.listTools();
		// The served surface only: the spike's own probe tool is not part of it.
		const served = { ...tools, tools: tools.tools.filter((tool) => tool.name !== 'slow_probe') };
		await writeFile(new URL('tools.json', RESULTS), JSON.stringify(served, null, '\t') + '\n');
		results['s2.1 callTool, tools/list cached'] = await attempt(() =>
			client.callTool({ name: 'execute_query', arguments: executeQueryArguments }, { allowInputRequired: true }),
		);
		await client.close();
	}

	// S2.2: callTool with no tools/list call first, so no outputSchema is cached.
	{
		const client = await connect(serverA.url, { autoFulfill: false });
		results['s2.2 callTool, nothing cached'] = await attempt(() =>
			client.callTool({ name: 'execute_query', arguments: executeQueryArguments }, { allowInputRequired: true }),
		);
		await client.close();
	}

	// S2.3: callTool with autoFulfill off and no allowInputRequired.
	{
		const client = await connect(serverA.url, { autoFulfill: false });
		results['s2.3 callTool, autoFulfill off, no allowInputRequired'] = await attempt(() =>
			client.callTool({ name: 'execute_query', arguments: executeQueryArguments }),
		);
		await client.close();
	}

	// S2.4: the manual round trip through request(), with tools/list cached as it will be in mcp-client.
	{
		const before = serverA.executed.length;
		const client = await connect(serverA.url, { autoFulfill: false });
		await client.listTools();
		const asked = await callExecuteQuery(client);
		const askedSummary = isInputRequiredResult(asked)
			? {
					resultType: asked.resultType,
					inputRequestKeys: Object.keys(asked.inputRequests ?? {}),
					confirm: asked.inputRequests?.confirm,
					requestStateLength: asked.requestState?.length,
				}
			: { unexpected: asked };
		const answered = isInputRequiredResult(asked)
			? await attempt(() =>
					callExecuteQuery(client, { inputResponses: APPROVED, requestState: asked.requestState }),
				)
			: undefined;
		results['s2.4 request() round trip'] = {
			asked: askedSummary,
			answered,
			executions: serverA.executed.length - before,
		};
		await client.close();
	}

	// S5: question from instance A, answer sent to instance B (a different per-process key, as after a
	// restart without MCP_REQUEST_STATE_SECRET).
	{
		const beforeA = serverA.executed.length;
		const beforeB = serverB.executed.length;
		const clientA = await connect(serverA.url, { autoFulfill: false });
		const clientB = await connect(serverB.url, { autoFulfill: false });
		const asked = await callExecuteQuery(clientA);
		results['s5 refused state after restart'] = {
			answered: isInputRequiredResult(asked)
				? await attempt(() =>
						callExecuteQuery(clientB, { inputResponses: APPROVED, requestState: asked.requestState }),
					)
				: { unexpected: asked },
			executions: serverA.executed.length - beforeA + (serverB.executed.length - beforeB),
		};
		await clientA.close();
		await clientB.close();
	}

	// S2b: abort an in-flight request. Does the error identify cancellation, and does the handler see it?
	{
		const client = await connect(serverA.url, { autoFulfill: false });
		const controller = new AbortController();
		const started = Date.now();
		setTimeout(() => controller.abort(new Error('spike abort')), 500);
		const call = await attempt(() =>
			client.request(
				{ method: 'tools/call', params: { name: 'slow_probe', arguments: {} } },
				{ signal: controller.signal },
			),
		);
		const rejectedAfterMs = Date.now() - started;
		await new Promise((resolve) => setTimeout(resolve, 3_500));
		results['s2b abort in flight'] = {
			call,
			rejectedAfterMs,
			signalAborted: controller.signal.aborted,
			probe: serverA.probes.at(-1),
		};

		// The same error class on a real timeout, to see whether the two can be told apart.
		results['s2b timeout for comparison'] = await attempt(() =>
			client.request({ method: 'tools/call', params: { name: 'slow_probe', arguments: {} } }, { timeout: 500 }),
		);
		await new Promise((resolve) => setTimeout(resolve, 3_500));
		results['s2b timeout probe'] = serverA.probes.at(-1);
		await client.close();
	}
} finally {
	await serverA.close();
	await serverB.close();
}

await writeFile(new URL('s2s5.json', RESULTS), JSON.stringify(results, null, '\t') + '\n');
console.log(JSON.stringify(results, null, 2));
