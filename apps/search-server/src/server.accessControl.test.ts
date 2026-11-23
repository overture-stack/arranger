import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, suite, test } from 'node:test';

import type { SearchClient } from '@overture-stack/arranger-graphql-router';
import type { BridgeCore, BridgeLogger, BridgeMode, KeyRegistration } from '@overture-stack/usher-bridge--express';

/**
 * The image's startup with access enforcement on, through its seam taking the Bridge and its logger, so a
 * test hands it a recording fake while the environment-reading code builds the real one. In a file of
 * its own because the configuration module reads ENABLE_ACCESS_ENFORCEMENT once, when first imported, and
 * the test runner gives each file its own process.
 */
process.env.ENABLE_ACCESS_ENFORCEMENT = 'true';

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

/** A search's answer counting `total` records exactly, and `values` values when given, every shard answering in time. */
const countedAnswer = (total: number, values?: number) => ({
	body: {
		_shards: { failed: 0 },
		...(values === undefined ? {} : { aggregations: { values: { value: values } } }),
		hits: { hits: [], total: { relation: 'eq', value: total } },
		timed_out: false,
	},
});

/**
 * An engine answering only what startup, its checks of each catalogue's index and the readiness probe
 * ask, its index holding the fields the registrations name, so every catalogue loads with no engine
 * running. Every condition is valid and matches one record, and the one record holding the resource field
 * holds `extraResourceValues` more values in it than one.
 */
const engineUp = ({ extraResourceValues = 0 }: Readonly<{ extraResourceValues?: number }> = {}) =>
	({
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
			validateQuery: async () => ({ body: { valid: true } }),
		},
		search: async ({ body }: { body?: { aggs?: unknown } }) =>
			body?.aggs === undefined ? countedAnswer(1) : countedAnswer(1, 1 + extraResourceValues),
	}) as unknown as SearchClient;

const ENGINE_UP = engineUp();

/**
 * A Bridge in `mode`, recording what it was registered with, how often it resolved and whether it was
 * started and stopped. No call outlives its own promise, so its stop settles at once.
 */
const recordingBridge = (mode: BridgeMode = 'normal') => {
	const state: {
		registered: Readonly<Record<string, KeyRegistration>>[];
		resolved: number;
		started: number;
		stopped: number;
	} = {
		registered: [],
		resolved: 0,
		started: 0,
		stopped: 0,
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
		stop: async () => {
			state.stopped += 1;
		},
	};
	return { core, state };
};

const SILENT_LOGGER: BridgeLogger = { error: () => undefined, info: () => undefined, warn: () => undefined };

/** Catalogue ids no refusal's prose would contain by chance, so a check that one is named cannot pass on wording. */
const NAMED_CATALOGUE = 'catalogue-k7';
const OPEN_CATALOGUE = 'catalogue-k8';
const UNREGISTERED_CATALOGUE = 'missing-catalogue-k9';

const RECORD_REGISTRATION: KeyRegistration = {
	categories: {
		global: { 'global.controlled': { content: { fieldName: 'data_category', value: ['controlled'] }, op: 'in' } },
	},
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

suite('search-server image: startup with access enforcement on', { concurrency: false }, () => {
	let workspace: string;

	before(async () => {
		workspace = await mkdtemp(path.join(os.tmpdir(), 'arranger-usher-image-'));
	});

	after(async () => {
		await rm(workspace, { force: true, recursive: true });
	});

	test("starts, handing the bridge each catalogue's registration exactly as its auth.json holds it, even while every catalogue fails to load", async () => {
		// Given two catalogues, each with a registration beside its base.json, and no engine to load them from
		const configs = await writeCatalogues(path.join(workspace, 'registered'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'auth.json': { auth: RECORD_REGISTRATION } },
			[OPEN_CATALOGUE]: { 'base.json': baseFor(OPEN_CATALOGUE), 'auth.json': { auth: { kind: 'open' } } },
		});
		const bridge = recordingBridge();

		// When the image starts
		const server = await startImage(configs, bridge.core);

		try {
			// Then it listens, having registered both catalogues in one call, each exactly as its file holds
			// it, and having started the Bridge once
			assert.equal(server.listening, true);
			assert.deepEqual(bridge.state.registered, [
				{ [NAMED_CATALOGUE]: RECORD_REGISTRATION, [OPEN_CATALOGUE]: { kind: 'open' } },
			]);
			assert.equal(bridge.state.started, 1);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	test('refuses startup for a catalogue with no auth.json beside its base.json, naming it', async () => {
		// Given one catalogue registered and one with no registration
		const configs = await writeCatalogues(path.join(workspace, 'unregistered'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'auth.json': { auth: RECORD_REGISTRATION } },
			[UNREGISTERED_CATALOGUE]: { 'base.json': baseFor(UNREGISTERED_CATALOGUE) },
		});
		const bridge = recordingBridge();

		// When the image starts, Then it refuses, naming the catalogue and its missing file, before the
		// Bridge is registered with or started
		await assert.rejects(
			() => startImage(configs, bridge.core),
			(error: unknown) =>
				describeRefusal(error).includes(UNREGISTERED_CATALOGUE) && describeRefusal(error).includes('auth.json'),
		);
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
	});

	test('refuses startup for an auth key in any file but auth.json, among several catalogues, naming the file', async () => {
		// Given two registered catalogues, one also carrying an auth key in its base.json
		const configs = await writeCatalogues(path.join(workspace, 'misplaced'), {
			[NAMED_CATALOGUE]: {
				'auth.json': { auth: RECORD_REGISTRATION },
				'base.json': { ...baseFor(NAMED_CATALOGUE), auth: RECORD_REGISTRATION },
			},
			[OPEN_CATALOGUE]: { 'auth.json': { auth: { kind: 'open' } }, 'base.json': baseFor(OPEN_CATALOGUE) },
		});
		const bridge = recordingBridge();

		// When the image starts, and is closed again if it listens
		const outcome = await startImage(configs, bridge.core).then(
			(server) => new Promise<string>((resolve) => server.close(() => resolve('listening'))),
			(error: unknown) => describeRefusal(error),
		);

		// Then it refuses rather than skip the catalogue, naming the file, before the Bridge is registered
		// with or started
		assert.notEqual(outcome, 'listening');
		assert.match(outcome, /"base\.json"/u);
		assert.match(outcome, /auth\.json/u);
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
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
			{
				'base.json': baseFor(NAMED_CATALOGUE),
				'network.json': NETWORK,
				'auth.json': { auth: RECORD_REGISTRATION },
			},
		],
		[
			'inside base.json',
			{ 'base.json': { ...baseFor(NAMED_CATALOGUE), ...NETWORK }, 'auth.json': { auth: RECORD_REGISTRATION } },
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
			// control does not serve yet, before the Bridge is registered with or started
			await assert.rejects(
				() => startImage(configs, bridge.core),
				(error: unknown) =>
					describeRefusal(error).includes(NAMED_CATALOGUE) && /network search/iu.test(describeRefusal(error)),
			);
			assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
		});
	}

	test('refuses startup for a catalogue enabling saved sets, naming it, logged as access_enforcement.startup_refused, before the bridge is registered with or started', async (context) => {
		// Given a registered catalogue enabling saved sets in its base.json
		const errors = context.mock.method(console, 'error', () => undefined);
		const configs = await writeCatalogues(path.join(workspace, 'sets-one'), {
			[NAMED_CATALOGUE]: {
				'auth.json': { auth: RECORD_REGISTRATION },
				'base.json': { ...baseFor(NAMED_CATALOGUE), enableSets: true },
			},
		});
		const bridge = recordingBridge();

		// When the image starts, Then it refuses with the rule for one catalogue, naming it and the way out
		await assert.rejects(
			() => startImage(configs, bridge.core),
			(error: unknown) =>
				describeRefusal(error) ===
				`ENABLE_ACCESS_ENFORCEMENT is true, and saved sets are enabled for catalogue "${NAMED_CATALOGUE}". Access enforcement and saved sets cannot run together yet. To start with access enforcement, set enableSets to false in the catalogue's configuration, or, where it sets no enableSets, set ENABLE_SETS to false.`,
		);
		assert.ok(errors.mock.calls.some(({ arguments: [event] }) => event === 'access_enforcement.startup_refused'));
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
	});

	test('names every catalogue enabling saved sets, in the plural form, before the bridge is registered with or started', async (context) => {
		// Given two registered catalogues enabling saved sets, and one that does not
		context.mock.method(console, 'error', () => undefined);
		const configs = await writeCatalogues(path.join(workspace, 'sets-several'), {
			[NAMED_CATALOGUE]: {
				'auth.json': { auth: RECORD_REGISTRATION },
				'base.json': { ...baseFor(NAMED_CATALOGUE), enableSets: true },
			},
			[OPEN_CATALOGUE]: {
				'auth.json': { auth: { kind: 'open' } },
				'base.json': { ...baseFor(OPEN_CATALOGUE), enableSets: true },
			},
			[UNREGISTERED_CATALOGUE]: {
				'base.json': { ...baseFor(UNREGISTERED_CATALOGUE), enableSets: false },
			},
		});
		const bridge = recordingBridge();

		// When the image starts, Then it refuses with the rule for several catalogues, naming both that enable
		// saved sets, and not the one that does not
		await assert.rejects(
			() => startImage(configs, bridge.core),
			(error: unknown) => {
				const message = describeRefusal(error);
				return (
					message.startsWith(
						'ENABLE_ACCESS_ENFORCEMENT is true, and saved sets are enabled for catalogues "',
					) &&
					message.includes(NAMED_CATALOGUE) &&
					message.includes(OPEN_CATALOGUE) &&
					message.includes("set enableSets to false in each catalogue's configuration") &&
					!message.includes(UNREGISTERED_CATALOGUE)
				);
			},
		);
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
	});

	test('does not refuse startup for catalogues with saved sets off, absent or false, and starts', async () => {
		// Given a registered catalogue with saved sets false, and one with saved sets absent
		const configs = await writeCatalogues(path.join(workspace, 'sets-off'), {
			[NAMED_CATALOGUE]: {
				'auth.json': { auth: RECORD_REGISTRATION },
				'base.json': { ...baseFor(NAMED_CATALOGUE), enableSets: false },
			},
			[OPEN_CATALOGUE]: { 'auth.json': { auth: { kind: 'open' } }, 'base.json': baseFor(OPEN_CATALOGUE) },
		});
		const bridge = recordingBridge();

		// When the image starts, Then it listens, having registered both and started the Bridge once
		const server = await startImage(configs, bridge.core);

		try {
			assert.equal(server.listening, true);
			assert.equal(bridge.state.registered.length, 1);
			assert.equal(bridge.state.started, 1);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	test('refuses startup for a catalogue whose resource field holds several values in some record, naming it, before the bridge is registered with or started', async (context) => {
		// Given a registered catalogue whose index holds a record with more than one value in the resource field
		context.mock.method(console, 'error', () => undefined);
		const configs = await writeCatalogues(path.join(workspace, 'several-values'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'auth.json': { auth: RECORD_REGISTRATION } },
		});
		const bridge = recordingBridge();

		// When the image starts, Then it refuses, naming the catalogue and the field and saying some records hold
		// more than one value there, and the Bridge was neither registered with nor started
		await assert.rejects(
			() => startImage(configs, bridge.core, { engine: engineUp({ extraResourceValues: 1 }) }),
			(error: unknown) =>
				describeRefusal(error).includes(NAMED_CATALOGUE) &&
				describeRefusal(error).includes('study_id') &&
				describeRefusal(error).includes('more than one value'),
		);
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
	});

	test('stops the bridge once when the server closes', async () => {
		// Given an image started over a registered catalogue that loaded
		const configs = await writeCatalogues(path.join(workspace, 'closing'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'auth.json': { auth: RECORD_REGISTRATION } },
		});
		const bridge = recordingBridge();
		const server = await startImage(configs, bridge.core, { engine: ENGINE_UP });

		// When the server closes, Then the Bridge was stopped once
		await new Promise((resolve) => server.close(resolve));
		assert.equal(bridge.state.stopped, 1);
	});

	test('answers its liveness route while the bridge answers unavailable', async () => {
		// Given a registered catalogue, and a Bridge still waiting for its first check, so it answers unavailable
		const configs = await writeCatalogues(path.join(workspace, 'liveness'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'auth.json': { auth: RECORD_REGISTRATION } },
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

			// Then liveness answers 200 without reaching the Bridge, while the catalogue's route meets the
			// Bridge's own 503, so the layer is mounted, and mounted after the health routes
			assert.equal(alive.status, 200);
			assert.equal(resolvedForLiveness, 0);
			assert.equal(searched.status, 503);
			assert.equal(bridge.state.resolved, 1);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	// A denial names its catalogue, which confirms nothing only while every catalogue is listed to everyone. Were
	// listings ever made per principal, a denial of a catalogue hidden from the asker would have to answer as a
	// catalogue that does not exist does, so this fails first.
	test('lists every catalogue to every principal alike, without asking the bridge who asks', async () => {
		// Given two registered catalogues that loaded, and a Bridge that confirms no one
		const configs = await writeCatalogues(path.join(workspace, 'listing'), {
			[NAMED_CATALOGUE]: { 'base.json': baseFor(NAMED_CATALOGUE), 'auth.json': { auth: RECORD_REGISTRATION } },
			[OPEN_CATALOGUE]: { 'base.json': baseFor(OPEN_CATALOGUE), 'auth.json': { auth: RECORD_REGISTRATION } },
		});
		const bridge = recordingBridge();
		const server = await startImage(configs, bridge.core, { engine: ENGINE_UP });
		const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		const routes = ['/introspection', `/introspection/${NAMED_CATALOGUE}`, `/introspection/${OPEN_CATALOGUE}`];
		const read = (headers: Record<string, string>) =>
			Promise.all(
				routes.map(async (route) => {
					const response = await fetch(`${base}${route}`, { headers });
					return { body: await response.json(), status: response.status };
				}),
			);

		try {
			// When the listing and each catalogue's introspection are read anonymously, then with a credential
			const anonymous = await read({});
			const signedIn = await read({ authorization: 'Bearer credential-the-bridge-cannot-confirm' });

			// Then each answers the same whoever asks, the listing names both catalogues, and the Bridge was
			// never asked who was asking
			assert.deepEqual(signedIn, anonymous);
			assert.deepEqual(
				anonymous.map(({ status }) => status),
				[200, 200, 200],
			);
			assert.ok(
				[NAMED_CATALOGUE, OPEN_CATALOGUE].every((catalogueId) =>
					JSON.stringify(anonymous[0]?.body).includes(catalogueId),
				),
				JSON.stringify(anonymous[0]?.body),
			);
			assert.equal(bridge.state.resolved, 0);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	/** Starts the image over one registered catalogue, its Bridge in `mode`, and reads both health routes. */
	const healthOf = async (mode: BridgeMode, engine: SearchClient) => {
		const configs = await writeCatalogues(
			path.join(workspace, `health-${mode}-${engine === ENGINE_UP ? 'loaded' : 'failed'}`),
			{
				[NAMED_CATALOGUE]: {
					'base.json': baseFor(NAMED_CATALOGUE),
					'auth.json': { auth: RECORD_REGISTRATION },
				},
			},
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
		// Given a Bridge before its first check confirms, which answers 503 to every request, beside catalogues
		// that all loaded, When the health routes are asked, Then readiness keeps traffic away and liveness answers
		assert.deepEqual(await healthOf('cold', ENGINE_UP), { alive: 200, ready: 503 });
	});

	for (const mode of ['normal', 'uncertain'] as const) {
		test(`follows the catalogues' status for readiness with the bridge ${mode}, and stays alive`, async () => {
			// Given the Bridge serving, the open tier included through a silence, When the health routes are
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
