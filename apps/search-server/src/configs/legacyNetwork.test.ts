import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { suite, test } from 'node:test';

import { readLegacyNetworkEnv, resolveLegacyNetwork } from './legacyNetwork.js';

const NODE_A = { displayName: 'Node A', documentType: 'file', graphqlUrl: 'https://a.example/graphql' };
const NODE_B = { displayName: 'Node B', documentType: 'file', graphqlUrl: 'https://b.example/graphql' };

const resolve = (catalogue: Record<string, unknown>, legacy: { enabled: boolean; list: unknown[] }) =>
	resolveLegacyNetwork({ catalogue, catalogueId: 'files', legacy });

suite('resolveLegacyNetwork: a network list, the 3.0 shape', () => {
	test('becomes remoteNodes, holding every listed node, where ENABLE_NETWORK_AGGREGATION is true', () => {
		// Given a 3.0 catalogue listing two remote nodes, and the 3.0 flag on
		const { catalogue, notices } = resolve(
			{ documentType: 'file', network: [NODE_A, NODE_B] },
			{ enabled: true, list: [] },
		);

		// Then network search gets both nodes, never an empty list, and one notice says the shape is deprecated
		assert.deepEqual(catalogue.network, { remoteNodes: [NODE_A, NODE_B] });
		assert.equal(notices.length, 1);
		assert.match(notices[0]?.message ?? '', /the 3\.0 shape, which is deprecated/);
		assert.match(notices[0]?.message ?? '', /#network-config-shape$/);
		assert.doesNotMatch(notices[0]?.message ?? '', /removed|until|future/);
	});

	test('has no effect where ENABLE_NETWORK_AGGREGATION is not true, as in 3.0, and says so', () => {
		const { catalogue, notices } = resolve(
			{ documentType: 'file', network: [NODE_A] },
			{ enabled: false, list: [] },
		);

		assert.equal('network' in catalogue, false);
		assert.equal(notices.length, 1);
		assert.match(
			notices[0]?.message ?? '',
			/has no effect, as in 3\.0, since ENABLE_NETWORK_AGGREGATION is not true/,
		);
	});

	test("takes NETWORK_AGGREGATIONS's list where no file sets one, as 3.0 read it from the environment", () => {
		const { catalogue } = resolve({ documentType: 'file' }, { enabled: true, list: [NODE_A] });

		assert.deepEqual(catalogue.network, { remoteNodes: [NODE_A] });
	});

	test("lays a file's list over the environment's index by index, as 3.0 merged them", () => {
		const { catalogue } = resolve(
			{ network: [{ displayName: 'From the file' }] },
			{ enabled: true, list: [NODE_A, NODE_B] },
		);

		assert.deepEqual(catalogue.network, { remoteNodes: [{ ...NODE_A, displayName: 'From the file' }, NODE_B] });
	});

	test('drops an empty list, so network search is never built with no node, and says so where the flag is on', () => {
		const { catalogue, notices } = resolve({ documentType: 'file', network: [] }, { enabled: true, list: [] });

		assert.equal('network' in catalogue, false);
		assert.equal(notices.length, 1);
		assert.match(
			notices[0]?.message ?? '',
			/^ENABLE_NETWORK_AGGREGATION is true, but catalogue "files" lists no remote node, so it is served without network search\./,
		);
	});

	test('says a catalogue listing no node is served without network search where the flag is on, which 3.0 refused to start', () => {
		// Given the 3.0 flag on, and a catalogue with no network configuration at all
		const { catalogue, notices } = resolve({ documentType: 'file' }, { enabled: true, list: [] });

		// Then it is served as it is, and the loosened refusal is named rather than silent
		assert.deepEqual(catalogue, { documentType: 'file' });
		assert.equal(notices.length, 1);
		assert.match(notices[0]?.message ?? '', /catalogue "files" lists no remote node/);
	});
});

suite('resolveLegacyNetwork: a 3.1 network configuration', () => {
	test('is kept as it is, with no notice', () => {
		const network = { remoteNodes: [NODE_A] };

		const { catalogue, notices } = resolve({ network }, { enabled: false, list: [] });

		assert.equal(catalogue.network, network);
		assert.deepEqual(notices, []);
	});

	test("is kept over NETWORK_AGGREGATIONS's list, which a notice says is not read for it", () => {
		const network = { remoteNodes: [NODE_A] };

		const { catalogue, notices } = resolve({ network }, { enabled: true, list: [NODE_B] });

		assert.equal(catalogue.network, network);
		assert.match(notices[0]?.message ?? '', /NETWORK_AGGREGATIONS is not read/);
	});

	test('leaves a catalogue with no network configuration, and no list, as it is', () => {
		const { catalogue, notices } = resolve({ documentType: 'file' }, { enabled: false, list: [] });

		assert.deepEqual(catalogue, { documentType: 'file' });
		assert.deepEqual(notices, []);
	});
});

suite('readLegacyNetworkEnv', () => {
	test('reads ENABLE_NETWORK_AGGREGATION as 3.0 did, as true only for the text true, in any case', () => {
		assert.equal(readLegacyNetworkEnv({ ENABLE_NETWORK_AGGREGATION: 'TRUE' }).legacy.enabled, true);
		assert.equal(readLegacyNetworkEnv({ ENABLE_NETWORK_AGGREGATION: 'yes' }).legacy.enabled, false);
		assert.equal(readLegacyNetworkEnv({ ENABLE_NETWORK_AGGREGATION: '1' }).legacy.enabled, false);
	});

	test('reads NETWORK_AGGREGATIONS as 3.0 did, as a JSON list, and as no nodes where it holds none', () => {
		assert.deepEqual(readLegacyNetworkEnv({ NETWORK_AGGREGATIONS: JSON.stringify([NODE_A]) }).legacy.list, [
			NODE_A,
		]);
		assert.deepEqual(readLegacyNetworkEnv({ NETWORK_AGGREGATIONS: '{"remoteNodes":[]}' }).legacy.list, []);
		assert.deepEqual(readLegacyNetworkEnv({ NETWORK_AGGREGATIONS: 'not a list' }).legacy.list, []);
	});

	test('reads neither as set where neither is, with no notice', () => {
		assert.deepEqual(readLegacyNetworkEnv({}), { legacy: { enabled: false, list: [] }, notices: [] });
	});

	test('warns that a true ENABLE_NETWORK_AGGREGATION is deprecated, saying what turns network search on instead', () => {
		const { notices } = readLegacyNetworkEnv({ ENABLE_NETWORK_AGGREGATION: 'true' });

		assert.equal(notices.length, 1);
		assert.match(notices[0]?.message ?? '', /^ENABLE_NETWORK_AGGREGATION is deprecated: .*"remoteNodes"/);
		assert.match(notices[0]?.message ?? '', /#network-config-shape$/);
		assert.doesNotMatch(notices[0]?.message ?? '', /removed|until|future/);
	});

	test('warns that any other ENABLE_NETWORK_AGGREGATION has no effect, as in 3.0', () => {
		const { notices } = readLegacyNetworkEnv({ ENABLE_NETWORK_AGGREGATION: 'false' });

		assert.match(notices[0]?.message ?? '', /^ENABLE_NETWORK_AGGREGATION has no effect, as in 3\.0/);
	});

	test('warns that NETWORK_AGGREGATIONS is deprecated where the flag is on, never repeating its value', () => {
		const { notices } = readLegacyNetworkEnv({
			ENABLE_NETWORK_AGGREGATION: 'true',
			NETWORK_AGGREGATIONS: JSON.stringify([NODE_A]),
		});

		assert.equal(notices.length, 2);
		assert.match(notices[1]?.message ?? '', /^NETWORK_AGGREGATIONS is deprecated: .*"remoteNodes"/);
		assert.ok(notices.every(({ message }) => !message.includes(NODE_A.graphqlUrl)));
	});

	test('warns that NETWORK_AGGREGATIONS has no effect where the flag is not on, as in 3.0', () => {
		const { notices } = readLegacyNetworkEnv({ NETWORK_AGGREGATIONS: JSON.stringify([NODE_A]) });

		assert.match(
			notices[0]?.message ?? '',
			/^NETWORK_AGGREGATIONS has no effect, as in 3\.0, since ENABLE_NETWORK_AGGREGATION is not true/,
		);
	});

	test('warns that a NETWORK_AGGREGATIONS holding no list has no effect, as in 3.0', () => {
		const { notices } = readLegacyNetworkEnv({
			ENABLE_NETWORK_AGGREGATION: 'true',
			NETWORK_AGGREGATIONS: 'not a list',
		});

		assert.match(
			notices[1]?.message ?? '',
			/^NETWORK_AGGREGATIONS has no effect, as in 3\.0, which read its value as no remote nodes/,
		);
	});
});

suite('a 3.0 deployment configuring network search', () => {
	const CHILD_TIMEOUT_MS = 30_000;
	const RESULT_MARKER = '@@legacy-network-result@@';
	const configsIndexUrl = new URL('./index.ts', import.meta.url).href;
	const tsxLoaderUrl = import.meta.resolve('tsx');

	/** Loads every catalogue in a fresh process, since the environment is read once, when the configuration module is first imported. */
	const CHILD_SOURCE = String.raw`
const { catalogueConfigsPath, configsIndexUrl, resultMarker } = JSON.parse(process.argv.at(-1));
const { default: loadAllConfigs } = await import(configsIndexUrl);
const { catalogs } = await loadAllConfigs({ catalogueConfigsPath, currentDirectory: '' });
process.stdout.write(resultMarker + JSON.stringify(Object.values(catalogs)) + '\n', () => process.exit(0));
`;

	const loadCatalogues = (
		environment: Record<string, string>,
		files: Record<string, unknown>,
	): Promise<{ catalogues: { network?: unknown }[]; errorOutput: string }> => {
		const catalogueConfigsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'arranger-legacy-network-test-'));
		Object.entries(files).forEach(([name, contents]) =>
			fs.writeFileSync(path.join(catalogueConfigsPath, name), JSON.stringify(contents), 'utf8'),
		);

		return new Promise((resolve, reject) => {
			const child = spawn(
				process.execPath,
				[
					'--import',
					tsxLoaderUrl,
					'--input-type=module',
					'--eval',
					CHILD_SOURCE,
					JSON.stringify({ catalogueConfigsPath, configsIndexUrl, resultMarker: RESULT_MARKER }),
				],
				{ cwd: os.tmpdir(), env: { PATH: process.env.PATH ?? '', ...environment } },
			);

			const outputChunks: string[] = [];
			const errorChunks: string[] = [];
			child.stdout.setEncoding('utf8').on('data', (chunk: string) => outputChunks.push(chunk));
			child.stderr.setEncoding('utf8').on('data', (chunk: string) => errorChunks.push(chunk));

			const killTimer = setTimeout(() => child.kill('SIGKILL'), CHILD_TIMEOUT_MS);
			child.on('close', () => {
				clearTimeout(killTimer);
				fs.rmSync(catalogueConfigsPath, { force: true, recursive: true });
				const errorOutput = errorChunks.join('');
				const resultLine = outputChunks
					.join('')
					.split('\n')
					.find((line) => line.startsWith(RESULT_MARKER));

				if (resultLine) {
					resolve({ catalogues: JSON.parse(resultLine.slice(RESULT_MARKER.length)), errorOutput });
				} else {
					reject(new Error(`the configuration reported no result\n${errorOutput}`));
				}
			});
		});
	};

	test('keeps network search over every listed node, never an empty remoteNodes, where ENABLE_NETWORK_AGGREGATION is true', async () => {
		// Given a 3.0 deployment: the flag on, and network.json listing two nodes in the 3.0 shape
		const { catalogues, errorOutput } = await loadCatalogues(
			{ ENABLE_NETWORK_AGGREGATION: 'true' },
			{ 'base.json': { documentType: 'file' }, 'network.json': { network: [NODE_A, NODE_B] } },
		);

		// Then its one catalogue lists both nodes under remoteNodes, and both deprecations are warned about
		assert.equal(catalogues.length, 1);
		assert.deepEqual(catalogues[0]?.network, { remoteNodes: [NODE_A, NODE_B] });
		assert.match(errorOutput, /ENABLE_NETWORK_AGGREGATION is deprecated/);
		assert.match(errorOutput, /in the 3\.0 shape, which is deprecated/);
	});

	test("keeps network search over NETWORK_AGGREGATIONS's nodes, where no file lists any", async () => {
		const { catalogues } = await loadCatalogues(
			{ ENABLE_NETWORK_AGGREGATION: 'true', NETWORK_AGGREGATIONS: JSON.stringify([NODE_A]) },
			{ 'base.json': { documentType: 'file' } },
		);

		assert.deepEqual(catalogues[0]?.network, { remoteNodes: [NODE_A] });
	});

	test('leaves network search off where ENABLE_NETWORK_AGGREGATION is not set, as in 3.0', async () => {
		const { catalogues, errorOutput } = await loadCatalogues(
			{},
			{ 'base.json': { documentType: 'file' }, 'network.json': { network: [NODE_A] } },
		);

		assert.equal(catalogues[0]?.network, undefined);
		assert.match(errorOutput, /has no effect, as in 3\.0, since ENABLE_NETWORK_AGGREGATION is not true/);
	});
});
