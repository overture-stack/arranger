import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, suite, test } from 'node:test';

import type { SearchClient } from '@overture-stack/arranger-graphql-router';
import type { BridgeCore, BridgeLogger, BridgeMode, KeyRegistration } from '@overture-stack/usher-bridge--express';

/**
 * The image's startup with access enforcement on and ENABLE_SETS on, so the flag reaches every catalogue that
 * does not set enableSets itself. In a file of its own because the configuration module reads the environment
 * once, when first imported, and the test runner gives each file its own process. The helpers below are copied
 * from server.accessControl.test.ts, whose own are file-local.
 */
process.env.ENABLE_ACCESS_ENFORCEMENT = 'true';
process.env.ENABLE_SETS = 'true';

const { default: arrangerServer } = await import('./server.js');

/** An engine that refuses every call, so every catalogue fails to load and the image starts with no engine. */
const refusing: ProxyHandler<() => unknown> = {
	apply: () => Promise.reject(new Error('connect ECONNREFUSED')),
	get: (_target, property) => (property === 'then' ? undefined : new Proxy(() => undefined, refusing)),
};
const ENGINE_DOWN = new Proxy(() => undefined, refusing) as unknown as SearchClient;

/** A Bridge recording what it was registered with, how often it was started and stopped. */
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

const startImage = (catalogueConfigsPath: string, bridge: BridgeCore): Promise<Server> =>
	arrangerServer({
		catalogueConfigsPath,
		esClient: ENGINE_DOWN,
		serverPort: 0,
		usher: { bridge, logger: SILENT_LOGGER },
	});

/** What a refusal says, so a test can compare it whole. */
const describeRefusal = (error: unknown): string => (error instanceof Error ? error.message : String(error));

suite('search-server image: saved sets from ENABLE_SETS under access enforcement', { concurrency: false }, () => {
	let workspace: string;

	before(async () => {
		workspace = await mkdtemp(path.join(os.tmpdir(), 'arranger-env-sets-'));
	});

	after(async () => {
		await rm(workspace, { force: true, recursive: true });
	});

	test('refuses startup for a catalogue setting no enableSets while ENABLE_SETS is true, naming it, logged as access_enforcement.startup_refused, before the bridge is registered with or started', async (context) => {
		// Given a registered catalogue whose configuration sets no enableSets, and ENABLE_SETS true
		const errors = context.mock.method(console, 'error', () => undefined);
		const configs = await writeCatalogues(path.join(workspace, 'env-sets-on'), {
			[NAMED_CATALOGUE]: {
				'auth.json': { auth: RECORD_REGISTRATION },
				'base.json': baseFor(NAMED_CATALOGUE),
			},
		});
		const bridge = recordingBridge();

		// When the image starts, Then it refuses with the singular rule, naming that catalogue and both ways out
		await assert.rejects(
			() => startImage(configs, bridge.core),
			(error: unknown) =>
				describeRefusal(error) ===
				`ENABLE_ACCESS_ENFORCEMENT is true, and saved sets are enabled for catalogue "${NAMED_CATALOGUE}". Access enforcement and saved sets cannot run together yet. To start with access enforcement, set enableSets to false in the catalogue's configuration, or, where it sets no enableSets, set ENABLE_SETS to false.`,
		);
		assert.ok(errors.mock.calls.some(({ arguments: [event] }) => event === 'access_enforcement.startup_refused'));
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
	});

	test('names only the catalogue inheriting ENABLE_SETS, not one whose own enableSets is false, under ENABLE_SETS true', async (context) => {
		// Given two registered catalogues: one setting enableSets false itself, one inheriting ENABLE_SETS
		const errors = context.mock.method(console, 'error', () => undefined);
		const configs = await writeCatalogues(path.join(workspace, 'override-and-inherit'), {
			[NAMED_CATALOGUE]: {
				'auth.json': { auth: RECORD_REGISTRATION },
				'base.json': baseFor(NAMED_CATALOGUE),
			},
			[OPEN_CATALOGUE]: {
				'auth.json': { auth: { kind: 'open' } },
				'base.json': { ...baseFor(OPEN_CATALOGUE), enableSets: false },
			},
		});
		const bridge = recordingBridge();

		// When the image starts, Then it refuses naming only the inheriting catalogue, not the one that overrides it
		const outcome = await startImage(configs, bridge.core).then(
			(server) => new Promise<string>((resolve) => server.close(() => resolve('listening'))),
			(error: unknown) => describeRefusal(error),
		);
		assert.equal(
			outcome,
			`ENABLE_ACCESS_ENFORCEMENT is true, and saved sets are enabled for catalogue "${NAMED_CATALOGUE}". Access enforcement and saved sets cannot run together yet. To start with access enforcement, set enableSets to false in the catalogue's configuration, or, where it sets no enableSets, set ENABLE_SETS to false.`,
		);
		assert.ok(errors.mock.calls.some(({ arguments: [event] }) => event === 'access_enforcement.startup_refused'));
		assert.deepEqual(bridge.state, { registered: [], resolved: 0, started: 0, stopped: 0 });
	});

	test('starts a catalogue whose own enableSets is false, even while ENABLE_SETS is true', async () => {
		// Given a single registered catalogue setting enableSets false itself, under ENABLE_SETS true
		const configs = await writeCatalogues(path.join(workspace, 'override-only'), {
			[OPEN_CATALOGUE]: {
				'auth.json': { auth: { kind: 'open' } },
				'base.json': { ...baseFor(OPEN_CATALOGUE), enableSets: false },
			},
		});
		const bridge = recordingBridge();

		// When the image starts, Then it listens, having registered the catalogue and started the Bridge once
		const server = await startImage(configs, bridge.core);

		try {
			assert.equal(server.listening, true);
			assert.equal(bridge.state.registered.length, 1);
			assert.equal(bridge.state.started, 1);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
