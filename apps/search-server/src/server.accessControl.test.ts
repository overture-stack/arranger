import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, suite, test } from 'node:test';

import type { SearchClient } from '@overture-stack/arranger-graphql-router';
import type { BridgeCore, BridgeLogger, BridgeMode, KeyRegistration } from '@overture-stack/usher-express-bridge';

/**
 * The image's startup with access control on, through its seam taking the bridge and its logger, so a
 * test hands it a recording fake while the environment-reading code builds the real one. In a file of
 * its own because the configuration module reads ENABLE_ACCESS_CONTROL once, when first imported, and
 * the test runner gives each file its own process.
 */
process.env.ENABLE_ACCESS_CONTROL = 'true';

const { default: arrangerServer } = await import('./server.js');

/**
 * An engine that refuses every call, as one that is down does, so every catalogue fails to load. The
 * image starts all the same, which lets these rows run with no engine.
 */
const refusing: ProxyHandler<() => unknown> = {
	apply: () => Promise.reject(new Error('connect ECONNREFUSED')),
	get: (_target, property) => (property === 'then' ? undefined : new Proxy(() => undefined, refusing)),
};
const ENGINE_DOWN = new Proxy(() => undefined, refusing) as unknown as SearchClient;

/**
 * An engine answering only what startup and the readiness probe ask, its index holding the fields the
 * registrations name, so every catalogue loads with no engine running.
 */
const ENGINE_UP = {
	cat: { aliases: async () => ({ body: [] }) },
	indices: {
		create: async () => ({ body: { acknowledged: true } }),
		exists: async () => ({ body: true, statusCode: 200 }),
		getMapping: async ({ index }: { index: string }) => ({
			body: {
				[index]: {
					mappings: {
						properties: {
							data_category: { type: 'keyword' },
							name: { type: 'keyword' },
							study_id: { type: 'keyword' },
						},
					},
				},
			},
		}),
	},
} as unknown as SearchClient;

/** A bridge in `mode`, recording what it was registered with, how often it resolved and whether it was started. */
const recordingBridge = (mode: BridgeMode = 'normal') => {
	const state: { registered: Readonly<Record<string, KeyRegistration>>[]; resolved: number; started: number } = {
		registered: [],
		resolved: 0,
		started: 0,
	};
	const core: BridgeCore = {
		applyNotice: () => undefined,
		mode: () => mode,
		refreshAnonymous: async () => true,
		register: (registrations) => {
			state.registered.push(structuredClone(registrations));
		},
		report: () => undefined,
		reset: () => undefined,
		resolve: async () => {
			state.resolved += 1;
			return { kind: 'unavailable' };
		},
		start: async () => {
			state.started += 1;
		},
		stop: () => undefined,
	};
	return { core, state };
};

const SILENT_LOGGER: BridgeLogger = { error: () => undefined, info: () => undefined, warn: () => undefined };

/** Catalogue ids no refusal's prose would contain by chance, so a check that one is named cannot pass on wording. */
const NAMED_CATALOGUE = 'catalogue-k7';
const OPEN_CATALOGUE = 'catalogue-k8';
const UNREGISTERED_CATALOGUE = 'missing-catalogue-k9';

const RECORD_REGISTRATION: KeyRegistration = {
	categoryFieldName: 'data_category',
	categoryValues: { 'global.controlled': 'controlled' },
	kind: 'record',
	resourceFieldName: 'study_id',
	resources: ['HEART_STUDY', 'LUNG_COHORT'],
};

const baseFor = (catalogueId: string) => ({
	catalogId: catalogueId,
	documentType: 'record',
	esIndex: `testing-usher-image-${catalogueId}`,
});

/** Writes each catalogue's files into a directory of its own under `root`, as the image reads them. */
const writeCatalogues = async (
	root: string,
	catalogues: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): Promise<string> => {
	await Promise.all(
		Object.entries(catalogues).map(async ([catalogueId, files]) => {
			await mkdir(path.join(root, catalogueId), { recursive: true });
			await Promise.all(
				Object.entries(files).map(([fileName, content]) =>
					writeFile(path.join(root, catalogueId, fileName), JSON.stringify(content)),
				),
			);
		}),
	);
	return root;
};

const startImage = (
	catalogueConfigsPath: string,
	bridge: BridgeCore,
	{
		engine = ENGINE_DOWN,
		...configs
	}: Readonly<{ engine?: SearchClient; pingPath?: string; readyPath?: string }> = {},
): Promise<Server> =>
	arrangerServer({
		catalogueConfigsPath,
		esClient: engine,
		serverPort: 0,
		usher: { bridge, logger: SILENT_LOGGER },
		...configs,
	});

/** Health paths of the test's own, so the rows read the configured routes rather than defaults. */
const LIVENESS_PATH = '/liveness-k7';
const READINESS_PATH = '/readiness-k7';

/** What a refusal says, so a test can ask whether it names something. */
const describeRefusal = (error: unknown): string => (error instanceof Error ? error.message : String(error));

suite('search-server image: startup with access control on', { concurrency: false }, () => {
	let workspace: string;

	before(async () => {
		workspace = await mkdtemp(path.join(os.tmpdir(), 'arranger-usher-image-'));
	});

	after(async () => {
		await rm(workspace, { force: true, recursive: true });
	});

	test("starts, handing the bridge each catalogue's usher.json exactly, even while every catalogue fails to load", async () => {
		// Given two catalogues, each with a registration beside its base.json, and no engine to load them from
		const configs = await writeCatalogues(path.join(workspace, 'registered'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'usher.json': RECORD_REGISTRATION },
			[OPEN_CATALOGUE]: { 'base.json': baseFor(OPEN_CATALOGUE), 'usher.json': { kind: 'open' } },
		});
		const bridge = recordingBridge();

		// When the image starts
		const server = await startImage(configs, bridge.core);

		try {
			// Then it listens, having registered both catalogues in one call, each exactly as its file holds
			// it, and having started the bridge once
			assert.equal(server.listening, true);
			assert.deepEqual(bridge.state.registered, [
				{ [NAMED_CATALOGUE]: RECORD_REGISTRATION, [OPEN_CATALOGUE]: { kind: 'open' } },
			]);
			assert.equal(bridge.state.started, 1);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	test('refuses startup for a catalogue with no usher.json beside its base.json, naming it', async () => {
		// Given one catalogue registered and one with no registration
		const configs = await writeCatalogues(path.join(workspace, 'unregistered'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'usher.json': RECORD_REGISTRATION },
			[UNREGISTERED_CATALOGUE]: { 'base.json': baseFor(UNREGISTERED_CATALOGUE) },
		});
		const bridge = recordingBridge();

		// When the image starts, Then it refuses, naming the catalogue and its missing file, before the
		// bridge is registered with or started
		await assert.rejects(
			() => startImage(configs, bridge.core),
			(error: unknown) =>
				describeRefusal(error).includes(UNREGISTERED_CATALOGUE) &&
				describeRefusal(error).includes('usher.json'),
		);
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0 });
	});

	const NETWORK = {
		network: {
			remoteNodes: [
				{ displayName: 'a remote', documentType: 'record', graphqlUrl: 'http://127.0.0.1:9/graphql' },
			],
		},
	};

	for (const [placement, files] of [
		[
			'in a file of its own',
			{ 'base.json': baseFor(NAMED_CATALOGUE), 'network.json': NETWORK, 'usher.json': RECORD_REGISTRATION },
		],
		[
			'inside base.json',
			{ 'base.json': { ...baseFor(NAMED_CATALOGUE), ...NETWORK }, 'usher.json': RECORD_REGISTRATION },
		],
	] as const) {
		test(`refuses startup for a catalogue configuring network search ${placement}, naming it`, async () => {
			// Given a registered catalogue that also configures a remote node, wherever among its files, since
			// the image reads a catalogue's configuration merged from all of them
			const configs = await writeCatalogues(path.join(workspace, `network-${placement.replaceAll(' ', '-')}`), {
				[NAMED_CATALOGUE]: files,
			});
			const bridge = recordingBridge();

			// When the image starts, Then it refuses, naming the catalogue and network search, which access
			// control does not serve yet, before the bridge is registered with or started
			await assert.rejects(
				() => startImage(configs, bridge.core),
				(error: unknown) =>
					describeRefusal(error).includes(NAMED_CATALOGUE) && /network search/iu.test(describeRefusal(error)),
			);
			assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0 });
		});
	}

	test('answers its liveness route while the bridge answers unavailable', async () => {
		// Given a registered catalogue, and a bridge still waiting for its first check, so it answers unavailable
		const configs = await writeCatalogues(path.join(workspace, 'liveness'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'usher.json': RECORD_REGISTRATION },
		});
		const bridge = recordingBridge();
		const server = await startImage(configs, bridge.core, { pingPath: LIVENESS_PATH });
		const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

		try {
			// When the liveness route and a catalogue's route are asked
			const alive = await fetch(`${base}${LIVENESS_PATH}`);
			const resolvedForLiveness = bridge.state.resolved;
			const searched = await fetch(`${base}/${NAMED_CATALOGUE}/graphql`, {
				body: JSON.stringify({ query: '{ __typename }' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST',
			});

			// Then liveness answers 200 without reaching the bridge, while the catalogue's route meets the
			// bridge's own 503, so the layer is mounted, and mounted after the health routes
			assert.equal(alive.status, 200);
			assert.equal(resolvedForLiveness, 0);
			assert.equal(searched.status, 503);
			assert.equal(bridge.state.resolved, 1);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	/** Starts the image over one registered catalogue, its bridge in `mode`, and reads both health routes. */
	const healthOf = async (mode: BridgeMode, engine: SearchClient) => {
		const configs = await writeCatalogues(
			path.join(workspace, `health-${mode}-${engine === ENGINE_UP ? 'loaded' : 'failed'}`),
			{ [NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'usher.json': RECORD_REGISTRATION } },
		);
		const server = await startImage(configs, recordingBridge(mode).core, {
			engine,
			pingPath: LIVENESS_PATH,
			readyPath: READINESS_PATH,
		});
		const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

		try {
			const [alive, ready] = await Promise.all([
				fetch(`${base}${LIVENESS_PATH}`),
				fetch(`${base}${READINESS_PATH}`),
			]);
			return { alive: alive.status, ready: ready.status };
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	};

	test('reports not ready while the bridge is cold, even with every catalogue loaded, and stays alive', async () => {
		// Given a bridge before its first check confirms, which answers 503 to every request, beside catalogues
		// that all loaded, When the health routes are asked, Then readiness keeps traffic away and liveness answers
		assert.deepEqual(await healthOf('cold', ENGINE_UP), { alive: 200, ready: 503 });
	});

	for (const mode of ['normal', 'uncertain'] as const) {
		test(`follows the catalogues' status for readiness with the bridge ${mode}, and stays alive`, async () => {
			// Given the bridge serving, the open tier included through a silence, When the health routes are
			// asked with every catalogue loaded and with every catalogue failed, Then readiness follows the
			// catalogues, as without access control, and liveness answers either way
			const [loaded, failed] = await Promise.all([healthOf(mode, ENGINE_UP), healthOf(mode, ENGINE_DOWN)]);
			assert.deepEqual(
				{ failed, loaded },
				{ failed: { alive: 200, ready: 503 }, loaded: { alive: 200, ready: 200 } },
			);
		});
	}
});
