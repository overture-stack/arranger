import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';
import { format } from 'node:util';

import type { SqonNode } from '@overture-stack/sqon';

import type { SearchClient } from '#searchClient/index.js';

import type { IndexProbe } from './indexProbe.js';
import arrangerRouter from './router.js';

type EngineRequest = Record<string, unknown>;
type EngineAnswer = (request: EngineRequest) => Promise<{ body: Record<string, unknown> }>;

const ES_INDEX = 'donor_index';
const CATALOGUE_CONFIGS = { documentType: 'donor', esIndex: ES_INDEX, nestingPrefix: 'data' };
const INDEX_MAPPING = {
	data: {
		properties: {
			donor_id: { type: 'keyword' },
			samples: { properties: { sample_type: { type: 'keyword' } }, type: 'nested' },
			study: { type: 'keyword' },
		},
	},
};

const NESTED_CONDITION = {
	content: [{ content: { fieldName: 'samples.sample_type', value: ['blood'] }, op: 'in' }],
	op: 'and',
} satisfies SqonNode;
const COMPILED_NESTED_CONDITION = {
	bool: {
		must: [
			{
				nested: {
					path: 'data.samples',
					query: { bool: { must: [{ terms: { boost: 0, 'data.samples.sample_type': ['blood'] } }] } },
				},
			},
		],
	},
};
const UNCOMPILABLE_CONDITION = { content: { fieldName: 'study', value: ['A'] }, op: 'near' } as unknown as SqonNode;

/** The search counting the records holding several values at `fieldPath`, named only in the script's parameters. */
const severalValuesSearch = (fieldPath: string) => ({
	body: {
		query: {
			script: {
				script: {
					lang: 'painless',
					params: { fieldName: fieldPath },
					source: 'doc[params.fieldName].size() > 1',
				},
			},
		},
		track_total_hits: true,
	},
	index: ES_INDEX,
	size: 0,
});

/** A search response counting `total` records, with `failedShards` of its two shards failing. */
const countResponse = ({ failedShards = 0, total }: { failedShards?: number; total: number }) => ({
	body: {
		_shards: { failed: failedShards, successful: 2 - failedShards, total: 2 },
		hits: { hits: [], total: { relation: 'eq', value: total } },
		timed_out: false,
		took: 1,
	},
});

/** A search engine holding INDEX_MAPPING, answering searches and query validations as told and recording each. */
const createSearchEngine = ({
	search = async () => countResponse({ total: 3 }),
	validateQuery = async () => ({ body: { valid: true } }),
}: { search?: EngineAnswer; validateQuery?: EngineAnswer } = {}) => {
	const searches: EngineRequest[] = [];
	const validations: EngineRequest[] = [];
	const client = {
		cat: { aliases: async () => ({ body: [] }) },
		indices: {
			getMapping: async ({ index }: { index: string }) => ({
				body: { [index]: { mappings: { properties: INDEX_MAPPING } } },
			}),
			validateQuery: async (request: EngineRequest) => {
				validations.push(request);
				return validateQuery(request);
			},
		},
		search: async (request: EngineRequest) => {
			searches.push(request);
			return search(request);
		},
	} as unknown as SearchClient;

	return { client, searches, validations };
};

const CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const;

/** Runs `work` with console output captured instead of printed. */
const withConsoleCaptured = async <Result>(work: () => Promise<Result>): Promise<Result> => {
	const mocks = CONSOLE_METHODS.map((method) => mock.method(console, method, () => undefined));

	try {
		return await work();
	} finally {
		mocks.forEach((mocked) => mocked.mock.restore());
	}
};

/** Builds a router over `engine`, returning the probe its onIndexMapping hook was handed. */
const probeOf = async (engine: ReturnType<typeof createSearchEngine>): Promise<IndexProbe> => {
	const probes: IndexProbe[] = [];

	await withConsoleCaptured(() =>
		arrangerRouter({
			configs: CATALOGUE_CONFIGS,
			esClient: engine.client,
			onIndexMapping: (mappingFromIndex, indexProbe) => {
				probes.push(indexProbe);
			},
		}),
	);

	const [probe] = probes;
	assert.ok(probe, 'The onIndexMapping hook was handed no probe');

	return probe;
};

const messageChainOf = (error: unknown): string =>
	error instanceof Error ? [error.message, messageChainOf(error.cause)].filter(Boolean).join(' <- ') : '';

/** Asserts `promise` rejects, with `engineMessage` somewhere in its chain of causes. */
const assertRejectsCarrying = async (promise: Promise<unknown>, engineMessage: string): Promise<void> => {
	await assert.rejects(promise, (error: unknown) => {
		assert.match(messageChainOf(error), new RegExp(engineMessage));
		return true;
	});
};

suite("arrangerRouter's onIndexMapping hook receives a probe of the catalogue's index", () => {
	test('hands the hook a probe beside the mapping, still usable after the router resolves', async () => {
		// Given a hook keeping both arguments it is handed
		const engine = createSearchEngine();
		const received: { mappingFromIndex: Record<string, unknown>; indexProbe: IndexProbe }[] = [];

		await withConsoleCaptured(() =>
			arrangerRouter({
				configs: CATALOGUE_CONFIGS,
				esClient: engine.client,
				onIndexMapping: (mappingFromIndex, indexProbe) => {
					received.push({ indexProbe, mappingFromIndex });
				},
			}),
		);

		// Then it saw the unwrapped mapping and a probe once
		const [first, ...others] = received;
		assert.ok(first);
		assert.deepEqual(others, []);
		assert.deepEqual(first.mappingFromIndex, INDEX_MAPPING.data.properties);

		// And once the router has resolved, the probe still asks the engine
		assert.equal(await first.indexProbe.countMatching(NESTED_CONDITION), 3);
	});

	test('builds the router for a hook that takes only the mapping', async () => {
		// Given a hook declaring the mapping as its one parameter
		const received: Record<string, unknown>[] = [];
		const takesOnlyTheMapping = (mappingFromIndex: Record<string, unknown>): void => {
			received.push(mappingFromIndex);
		};

		// When the router is built with it
		const router = await withConsoleCaptured(() =>
			arrangerRouter({
				configs: CATALOGUE_CONFIGS,
				esClient: createSearchEngine().client,
				onIndexMapping: takesOnlyTheMapping,
			}),
		);

		// Then the router resolved, and the hook saw the mapping
		assert.equal(typeof router, 'function');
		assert.deepEqual(received, [INDEX_MAPPING.data.properties]);
	});
});

suite('IndexProbe.validate', () => {
	test("asks the engine to validate, on every shard, the condition compiled with the catalogue's nested fields and nesting prefix", async () => {
		// Given a probe of a catalogue whose records nest samples beneath a "data" envelope
		const engine = createSearchEngine();
		const probe = await probeOf(engine);

		// When a condition on a nested field is validated
		const validation = await probe.validate(NESTED_CONDITION);

		// Then the engine was asked, across all its shards, about the query the router would send for it,
		// since a shard holding none of a field's values may accept a bound it never parses
		assert.deepEqual(engine.validations, [
			{ all_shards: true, body: { query: COMPILED_NESTED_CONDITION }, explain: true, index: ES_INDEX },
		]);
		assert.deepEqual(validation, { valid: true });
	});

	test("resolves as not valid, with the engine's explanation, when the engine refuses the query", async () => {
		// Given an engine refusing the query, explaining why
		const explanation = 'failed to parse date field [someday] with format [yyyy-MM-dd]';
		const probe = await probeOf(
			createSearchEngine({
				validateQuery: async () => ({
					body: { explanations: [{ error: explanation, index: ES_INDEX, valid: false }], valid: false },
				}),
			}),
		);

		// When a condition is validated, Then it is not valid, for the engine's reason
		assert.deepEqual(await probe.validate(NESTED_CONDITION), { explanation, valid: false });
	});

	test("resolves as not valid, with the compiler's message, for a condition the compiler refuses", async () => {
		// Given a probe, and a condition naming an operator SQON does not define
		const engine = createSearchEngine();
		const probe = await probeOf(engine);

		// When it is validated
		const validation = await probe.validate(UNCOMPILABLE_CONDITION);

		// Then it is not valid, for the compiler's reason, and the engine was never asked
		assert.deepEqual(validation, {
			explanation: 'Each filter node must name an operator SQON defines, such as and, or, not, in or gte.',
			valid: false,
		});
		assert.deepEqual(engine.validations, []);
	});

	test('rejects when the engine fails to answer', async () => {
		// Given an engine that cannot be reached
		const probe = await probeOf(
			createSearchEngine({
				validateQuery: async () => {
					throw new Error('connect ECONNREFUSED');
				},
			}),
		);

		// Then validating a condition rejects, carrying the engine's failure
		await assertRejectsCarrying(probe.validate(NESTED_CONDITION), 'connect ECONNREFUSED');
	});
});

suite('IndexProbe.countMatching', () => {
	test("counts the records matching the condition compiled with the catalogue's nested fields and nesting prefix", async () => {
		// Given an engine counting 3 records for any query
		const engine = createSearchEngine();
		const probe = await probeOf(engine);

		// When the records matching a condition on a nested field are counted
		const count = await probe.countMatching(NESTED_CONDITION);

		// Then the engine counted the query the router would send for it, every match tracked
		assert.equal(count, 3);
		assert.deepEqual(engine.searches, [
			{ body: { query: COMPILED_NESTED_CONDITION, track_total_hits: true }, index: ES_INDEX, size: 0 },
		]);
	});

	test('rejects a condition the compiler refuses, sending the engine nothing', async () => {
		// Given a probe, and a condition naming an operator SQON does not define
		const engine = createSearchEngine();
		const probe = await probeOf(engine);

		// Then counting its records rejects, for the compiler's reason, before any search
		await assertRejectsCarrying(probe.countMatching(UNCOMPILABLE_CONDITION), 'must name an operator SQON defines');
		assert.deepEqual(engine.searches, []);
	});

	test('rejects when the engine fails the search', async () => {
		// Given an engine refusing the search
		const probe = await probeOf(
			createSearchEngine({
				search: async () => {
					throw new Error('search_phase_execution_exception');
				},
			}),
		);

		// Then counting rejects, carrying the engine's failure
		await assertRejectsCarrying(probe.countMatching(NESTED_CONDITION), 'search_phase_execution_exception');
	});

	test('rejects a count that some shards failed to contribute to', async () => {
		// Given an engine whose count is missing a failed shard's records
		const probe = await probeOf(
			createSearchEngine({ search: async () => countResponse({ failedShards: 1, total: 1 }) }),
		);

		// Then counting rejects rather than resolving to the partial count
		await assert.rejects(probe.countMatching(NESTED_CONDITION));
	});
});

suite('IndexProbe.countRecordsHoldingSeveralValues', () => {
	test("counts with a script over the field's doc values, passing the prefixed field path as a parameter", async () => {
		// Given an engine counting 2 records for any query
		const engine = createSearchEngine({ search: async () => countResponse({ total: 2 }) });
		const probe = await probeOf(engine);

		// When the records holding several values in "study" are counted
		const count = await probe.countRecordsHoldingSeveralValues('study');

		// Then the engine ran the script over "data.study", named only in the script's parameters
		assert.equal(count, 2);
		assert.deepEqual(engine.searches, [severalValuesSearch('data.study')]);
	});

	test('keeps a field name holding script syntax out of the script source', async () => {
		// Given a field name that would change the script if it were written into it
		const engine = createSearchEngine();
		const probe = await probeOf(engine);
		const fieldName = "study'].size() > 0 || doc['study";

		// When the records holding several values in it are counted
		await probe.countRecordsHoldingSeveralValues(fieldName);

		// Then the script source is unchanged, and the field name travels only as a parameter
		assert.deepEqual(engine.searches, [severalValuesSearch(`data.${fieldName}`)]);
	});

	test('rejects when the engine refuses the script', async () => {
		// Given an engine refusing the script on every shard, as it does with inline scripts disabled
		const probe = await probeOf(
			createSearchEngine({
				search: async () => {
					throw new Error('cannot execute [inline] scripts');
				},
			}),
		);

		// Then counting rejects, carrying the engine's refusal
		await assertRejectsCarrying(
			probe.countRecordsHoldingSeveralValues('study'),
			'cannot execute \\[inline\\] scripts',
		);
	});

	test('never reads a script refused on some shards as a count of 0', async () => {
		// Given an engine whose script failed on the shard holding records, the other answering with none
		const probe = await probeOf(
			createSearchEngine({ search: async () => countResponse({ failedShards: 1, total: 0 }) }),
		);

		// Then counting rejects rather than resolving to 0
		await assert.rejects(probe.countRecordsHoldingSeveralValues('study'));
	});

	test('rejects a field inside a nested field, whose values the record itself never holds, asking the engine nothing', async () => {
		// Given a probe of a catalogue whose samples are nested objects
		const engine = createSearchEngine({ search: async () => countResponse({ total: 0 }) });
		const probe = await probeOf(engine);

		// Then counting the records holding several sample types rejects, before any search
		await assertRejectsCarrying(
			probe.countRecordsHoldingSeveralValues('samples.sample_type'),
			'nested field "samples"',
		);
		assert.deepEqual(engine.searches, []);
	});
});
