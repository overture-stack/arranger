import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { register } from 'node:module';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, suite, test } from 'node:test';
import { MessageChannel } from 'node:worker_threads';

import type { SearchClient } from '@overture-stack/arranger-graphql-router';

/**
 * The image with access enforcement off, as a deployment that has not turned it on runs it. In a file of
 * its own because the configuration module reads ENABLE_ACCESS_ENFORCEMENT once, when first imported, and
 * the test runner gives each file its own process, so the module hook registered here sees every module the
 * image resolves.
 */
delete process.env.ENABLE_ACCESS_ENFORCEMENT;

/** Where a module the hook reports lives: in one of the two Usher packages, or in the Usher adapter. */
const USHER_MODULE = /\/(?:node_modules\/@overture-stack\/usher-(?:bridge--express|types)|modules\/usher-adapter)\//u;

/** The start of a specifier the hook answers itself, once it has reported every resolution before it. */
const SENTINEL_PREFIX = 'usher-resolutions-reported-';

/**
 * A module hook, run on the loader's own thread ahead of the test runner's, posting the URL of every module
 * resolved to `USHER_MODULE`, and answering a sentinel specifier with an empty module.
 */
const USHER_RESOLUTION_HOOK = [
	'let port;',
	'export const initialize = (data) => { port = data.port; };',
	'export const resolve = async (specifier, context, nextResolve) => {',
	`	if (specifier.startsWith(${JSON.stringify(SENTINEL_PREFIX)})) {`,
	'		port.postMessage({ sentinel: specifier });',
	"		return { shortCircuit: true, url: 'data:text/javascript,' };",
	'	}',
	'	const resolved = await nextResolve(specifier, context);',
	`	if (${USHER_MODULE}.test(resolved.url)) port.postMessage({ url: resolved.url });`,
	'	return resolved;',
	'};',
].join('\n');

const { port1: reports, port2: hookPort } = new MessageChannel();
const usherModulesResolved: string[] = [];
const sentinelsAwaited = new Map<string, () => void>();

reports.on('message', (message: Readonly<{ sentinel?: string; url?: string }>) => {
	if (message.url !== undefined) {
		usherModulesResolved.push(message.url);
	}
	if (message.sentinel !== undefined) {
		sentinelsAwaited.get(message.sentinel)?.();
	}
});

register(`data:text/javascript,${encodeURIComponent(USHER_RESOLUTION_HOOK)}`, {
	data: { port: hookPort },
	transferList: [hookPort],
});

const { default: arrangerServer } = await import('./server.js');

/**
 * Every Usher module the process has resolved, read once the hook has reported each resolution made before
 * this call, since its reports arrive in order and the sentinel's comes after them.
 */
const usherModulesResolvedSoFar = async (label: string): Promise<readonly string[]> => {
	const sentinel = `${SENTINEL_PREFIX}${label}`;
	const reported = new Promise<void>((resolve) => sentinelsAwaited.set(sentinel, resolve));
	await import(sentinel);
	await reported;
	return [...usherModulesResolved];
};

/** A search's answer counting `total` records exactly, every shard answering in time. */
const countedAnswer = (total: number) => ({
	body: {
		_shards: { failed: 0 },
		hits: { hits: [], total: { relation: 'eq', value: total } },
		timed_out: false,
	},
});

/**
 * An engine answering only what startup, its health check and a count of the catalogue's records ask, its
 * index holding one record.
 */
const ENGINE_UP = {
	cat: { aliases: async () => ({ body: [] }) },
	indices: {
		exists: async () => ({ body: true, statusCode: 200 }),
		getMapping: async ({ index }: { index: string }) => ({
			body: {
				[index]: { mappings: { properties: { name: { type: 'keyword' }, study_id: { type: 'keyword' } } } },
			},
		}),
	},
	search: async () => countedAnswer(1),
} as unknown as SearchClient;

const CATALOGUE = 'catalogue-k7';

suite('search-server image: access enforcement off', { concurrency: false }, () => {
	let workspace: string;

	before(async () => {
		workspace = await mkdtemp(path.join(os.tmpdir(), 'arranger-enforcement-off-'));
	});

	after(async () => {
		reports.close();
		await rm(workspace, { force: true, recursive: true });
	});

	test('starts and serves a catalogue with no auth.json, resolving neither Usher package nor the Usher adapter', async () => {
		// Given a catalogue with only its base.json, and no access enforcement configured
		await mkdir(path.join(workspace, CATALOGUE), { recursive: true });
		await writeFile(
			path.join(workspace, CATALOGUE, 'base.json'),
			JSON.stringify({ catalogId: CATALOGUE, documentType: 'record', esIndex: `testing-${CATALOGUE}` }),
		);

		// When the image starts, and its catalogue listing and a count of the catalogue's records are read
		const server: Server = await arrangerServer({
			catalogueConfigsPath: workspace,
			esClient: ENGINE_UP,
			serverPort: 0,
		});
		const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

		try {
			const listing = await fetch(`${base}/introspection`);
			const count = await fetch(`${base}/graphql`, {
				body: JSON.stringify({ query: '{ record { hits { total } } }' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST',
			});

			// Then both are answered, the count as the engine gives it, and the process resolved no module
			// of either Usher package or of the adapter
			assert.equal(listing.status, 200);
			assert.equal(count.status, 200);
			assert.deepEqual(await count.json(), { data: { record: { hits: { total: 1 } } } });
			assert.deepEqual(await usherModulesResolvedSoFar('after-serving'), []);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	test('starts, unrefused, a catalogue enabling saved sets, since the refusal for saved sets is only for access enforcement', async () => {
		// Given a catalogue enabling saved sets, with no access enforcement configured
		const sets = path.join(workspace, 'sets');
		await mkdir(path.join(sets, CATALOGUE), { recursive: true });
		await writeFile(
			path.join(sets, CATALOGUE, 'base.json'),
			JSON.stringify({
				catalogId: CATALOGUE,
				documentType: 'record',
				enableSets: true,
				esIndex: `testing-${CATALOGUE}`,
			}),
		);

		// When the image starts, Then it listens, and the process resolved no module of either Usher package
		const server: Server = await arrangerServer({
			catalogueConfigsPath: sets,
			esClient: ENGINE_UP,
			serverPort: 0,
		});

		try {
			assert.equal(server.listening, true);
			assert.deepEqual(await usherModulesResolvedSoFar('sets-enabled'), []);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	test('reports the Usher adapter, and the Usher package it loads, once they are resolved', async () => {
		// Given the hook the previous row relies on to report every Usher module resolved

		// When the adapter is imported, as the image does with access enforcement on
		await import('@overture-stack/arranger-usher-adapter');

		// Then the hook has reported the adapter and the Usher package it loads at runtime, so the previous
		// row's empty report is not the hook missing them
		const resolved = await usherModulesResolvedSoFar('after-importing-the-adapter');
		assert.ok(
			resolved.some((url) => url.includes('/modules/usher-adapter/')),
			JSON.stringify(resolved),
		);
		assert.ok(
			resolved.some((url) => url.includes('/node_modules/@overture-stack/usher-types/')),
			JSON.stringify(resolved),
		);
	});
});
