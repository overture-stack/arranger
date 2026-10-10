/**
 * An in-process `apps/mcp-server`, assembled as `startServer` assembles it, with Arranger stubbed out.
 *
 * Follows `startTestServer` in `apps/mcp-server/src/server.test.ts`, with two differences the spikes
 * need: no request-state secret, so each instance signs with its own per-process key (what a restart
 * without `MCP_REQUEST_STATE_SECRET` does), and an extra `slow_probe` tool that records whether its
 * handler sees the client abort.
 */
import { type AddressInfo } from 'node:net';

import { type ArrangerClient } from '../../../../apps/mcp-server/src/arranger/client.ts';
import { startMcpHttpServer } from '../../../../apps/mcp-server/src/http/server.ts';
import { createConfirmationCodec } from '../../../../apps/mcp-server/src/mcp/requestState.ts';
import { createMcpServer } from '../../../../apps/mcp-server/src/server.ts';
import { type ArrangerMcpConfig } from '../../../../apps/mcp-server/src/utils/config.ts';

const baseConfig: ArrangerMcpConfig = {
	arrangerBaseUrl: 'https://arranger.test',
	catalogues: ['participants'],
	requestTimeoutMs: 10_000,
	mcp: {
		host: '127.0.0.1',
		port: 0,
		path: '/mcp',
		allowedHosts: ['127.0.0.1'],
		allowedOrigins: [],
		requestStateSecret: undefined,
		maxBodyBytes: 102_400,
	},
};

const serverIntrospection = {
	catalogCount: 1,
	catalogs: {
		participants: {
			documentType: 'participant',
			paths: { fields: '/fields', graphql: '/graphql', introspection: '/introspection/participants' },
		},
	},
	mode: 'single',
	sqonSchemaPath: '/introspection/sqon',
};

const catalogueIntrospection = {
	catalogId: 'participants',
	documentType: 'participant',
	generatedAt: '2026-01-01T00:00:00.000Z',
	meta: { authFiltered: false },
	operators: { keyword: ['in', 'not-in', 'some-not-in', 'all', 'filter'] },
	fields: { study: { displayName: 'Study', isArray: false, type: 'keyword' } },
};

export const executeQueryArguments = {
	catalogueId: 'participants',
	sqon: { op: 'and', content: [] },
	fields: ['study'],
};

export type ProbeRecord = { started: number; aborted: boolean; abortedAfterMs?: number; finished: boolean };

/** What the stubbed Arranger answers with. The default is the single-catalogue stub above. */
export type ArrangerFixture = {
	server: { catalogs: Record<string, unknown> };
	catalogues: Record<string, unknown>;
	sqon?: unknown;
};

const defaultFixture: ArrangerFixture = {
	server: serverIntrospection,
	catalogues: { participants: catalogueIntrospection },
};

export const startTestServer = async (fixture: ArrangerFixture = defaultFixture) => {
	const config: ArrangerMcpConfig = { ...baseConfig, catalogues: Object.keys(fixture.server.catalogs) };
	const executed: string[] = [];
	const probes: ProbeRecord[] = [];
	const client = {
		getServerIntrospection: () => Promise.resolve(fixture.server),
		getSqonIntrospection: () => Promise.resolve(fixture.sqon),
		getCatalogueIntrospection: (catalogueId: string) => {
			const found = fixture.catalogues[catalogueId];
			return found
				? Promise.resolve(found)
				: Promise.reject(new Error(`No catalogue "${catalogueId}" in the stub`));
		},
		executeQuery: (_endpoint: string, request: { query: string; rootFieldName: string }) => {
			executed.push(request.query);
			return Promise.resolve({ data: { [request.rootFieldName]: { hits: { total: 1, edges: [] } } } });
		},
	} as unknown as ArrangerClient;

	const requestStateCodec = createConfirmationCodec(config);
	const { httpServer, close } = await startMcpHttpServer(config, () => {
		const server = createMcpServer({ config, client, requestStateCodec });
		server.registerTool(
			'slow_probe',
			{ description: 'Spike only: waits 3 s or until aborted, and records which.' },
			async (ctx) => {
				const record: ProbeRecord = { started: Date.now(), aborted: false, finished: false };
				probes.push(record);
				await new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, 3_000);
					ctx.mcpReq.signal.addEventListener('abort', () => {
						record.aborted = true;
						record.abortedAfterMs = Date.now() - record.started;
						clearTimeout(timer);
						resolve();
					});
				});
				record.finished = true;
				return { content: [{ type: 'text', text: record.aborted ? 'aborted' : 'finished' }] };
			},
		);
		return server;
	});
	const { port } = httpServer.address() as AddressInfo;

	return { url: `http://127.0.0.1:${port}${config.mcp.path}`, executed, probes, close };
};
