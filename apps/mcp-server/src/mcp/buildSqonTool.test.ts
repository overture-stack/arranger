import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type McpServer } from '@modelcontextprotocol/server';
import { getSqonFieldOperatorDetails } from '@overture-stack/sqon';
import type { z as zod } from 'zod';

import { ArrangerRequestError, type ArrangerClient } from '#arranger/client.js';
import { BUILD_SQON_OPERATORS, describeOperators, registerBuildSqonTool } from '#mcp/buildSqonTool.js';
import { createConfirmationCodec } from '#mcp/requestState.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

/** Fixed HMAC key so the confirmation codec is deterministic and does not warn about a per-process one. */
const TEST_SIGNING_KEY = 'arranger-mcp-test-request-state-signing-key';

const config: ArrangerMcpConfig = {
	arrangerBaseUrl: 'https://arranger.test',
	catalogues: ['participants', 'files'],
	requestTimeoutMs: 10_000,
	mcp: {
		host: '0.0.0.0',
		port: 3100,
		path: '/mcp',
		allowedHosts: ['arranger-mcp'],
		allowedOrigins: [],
		requestStateSecret: TEST_SIGNING_KEY,
		maxBodyBytes: 102_400,
	},
};

const requestStateCodec = createConfirmationCodec(config);

const introspection = {
	catalogId: 'participants',
	documentType: 'participant',
	generatedAt: '2026-01-01T00:00:00.000Z',
	meta: { authFiltered: false },
	operators: {
		keyword: ['in', 'not-in', 'some-not-in', 'all', 'filter'],
		long: ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between'],
		date: ['gt', 'gte', 'lt', 'lte', 'between'],
	},
	fields: {
		study: { displayName: 'Study', isArray: false, type: 'keyword' },
		'donor.sex': { displayName: 'Biological Sex', isArray: false, type: 'keyword' },
		'donor.age_at_diagnosis': { displayName: 'Age at Diagnosis', isArray: false, type: 'long', unit: 'years' },
		'donor.enrolled_on': { displayName: 'Enrolment Date', isArray: false, type: 'date' },
		biomarkers: { displayName: 'Biomarkers', isArray: true, type: 'keyword' },
		'donor.legacy_tag': { displayName: 'Legacy Tag', isArray: null, type: 'keyword' },
	},
};

type ToolResult = {
	content: { type: string; text: string }[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

type CapturedTool = {
	name: string;
	config: {
		description: string;
		// A `ZodObject` rather than a raw shape: SDK v2 deprecates the raw-shape overloads of
		// `registerTool`, so the tool passes a wrapped schema and this parses with it directly.
		inputSchema: zod.ZodObject<Record<string, zod.ZodType>>;
		outputSchema: zod.ZodType;
		title: string;
	};
	handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

/**
 * A stub client exposing only `getCatalogueIntrospection`: the sole Arranger call `build_sqon`
 * makes. The rest throw so an unexpected request fails loudly rather than returning undefined.
 */
const stubClient = (getCatalogueIntrospection: (catalogueId: string) => Promise<unknown>): ArrangerClient => {
	const unused = (name: string) => (): never => {
		throw new Error(`build_sqon should not call ${name}`);
	};
	return {
		getCatalogueIntrospection,
		getServerIntrospection: unused('getServerIntrospection'),
		getSqonIntrospection: unused('getSqonIntrospection'),
		executeQuery: unused('executeQuery'),
	} as unknown as ArrangerClient;
};

const healthyClient = stubClient(() => Promise.resolve(introspection));

const captureTool = (client: ArrangerClient): CapturedTool => {
	const registered: CapturedTool[] = [];
	const server = {
		registerTool: (name: string, toolConfig: unknown, handler: unknown) => {
			registered.push({ name, config: toolConfig, handler } as unknown as CapturedTool);
		},
	};

	registerBuildSqonTool(server as unknown as McpServer, { client, config, requestStateCodec });

	const tool = registered[0];
	if (!tool) {
		throw new Error('registerBuildSqonTool registered no tool');
	}
	return tool;
};

/** Parses input through the registered input schema, exactly as the SDK does, then runs the handler. */
const invoke = async (client: ArrangerClient, input: Record<string, unknown>): Promise<ToolResult> => {
	const tool = captureTool(client);
	return tool.handler(tool.config.inputSchema.parse(input) as Record<string, unknown>);
};

const buildSqon = async (input: Record<string, unknown>, client: ArrangerClient = healthyClient) => {
	const result = await invoke(client, input);
	if (result.isError === true) {
		throw new Error(`expected a built SQON, got an error result: ${result.content[0]?.text}`);
	}
	if (!result.structuredContent) {
		throw new Error('expected structuredContent on a successful result');
	}
	return { result, output: result.structuredContent };
};

const expectError = async (input: Record<string, unknown>, client: ArrangerClient = healthyClient): Promise<string> => {
	const result = await invoke(client, input);
	assert.equal(result.isError, true, 'expected an error result');
	return result.content[0]?.text ?? '';
};

const inClause = (fieldName: string, value: unknown) => ({ fieldName, operator: 'in', value });

suite('BUILD_SQON_OPERATORS', () => {
	test('offers every operator modules/sqon implements except the text operator it cannot build', () => {
		assert.deepEqual(
			[...BUILD_SQON_OPERATORS],
			['in', 'not-in', 'some-not-in', 'gt', 'gte', 'lt', 'lte', 'between', 'all', 'wildcard'],
		);
	});

	// `fuzzy` has no implementation in modules/sqon, and addFilterClause's text branch ignores
	// `operator` and builds a wildcard clause regardless, so offering it would silently run a
	// different query than the one asked for.
	test('excludes the text operator that has no implementation', () => {
		assert.ok(!BUILD_SQON_OPERATORS.includes('fuzzy' as never));
	});

	test('excludes every operator alias', () => {
		for (const alias of ['=', '==', '>=', '<=', '>', '<', '!=', 'filter']) {
			assert.ok(!BUILD_SQON_OPERATORS.includes(alias as never), `${alias} should not be offered`);
		}
	});

	test('names only operators the SQON module actually implements', () => {
		const known = new Set(getSqonFieldOperatorDetails().map(({ op }) => op));
		for (const operator of BUILD_SQON_OPERATORS) {
			assert.ok(known.has(operator), `${operator} has no operator detail in @overture-stack/sqon`);
		}
	});
});

suite('describeOperators', () => {
	test('describes each requested operator on its own line, under one lead sentence', () => {
		const lines = describeOperators(['gt', 'lt']).split('\n');
		assert.equal(lines.length, 3);
		assert.ok(lines[0].startsWith('The comparison this clause applies.'));
		assert.ok(lines[1].startsWith('- "gt": '));
		assert.ok(lines[2].startsWith('- "lt": '));
	});

	test('describes an operator exactly once', () => {
		const description = describeOperators(BUILD_SQON_OPERATORS);
		for (const operator of BUILD_SQON_OPERATORS) {
			const occurrences = description.split(`- "${operator}": `).length - 1;
			assert.equal(occurrences, 1, `${operator} should be described once`);
		}
	});

	test('says nothing about operators that were not requested', () => {
		const description = describeOperators(['in', 'not-in']);
		assert.ok(!description.includes('"wildcard"'));
		assert.ok(!description.includes('"between"'));
	});

	// modules/sqon reports these operators as applying to every field type, but a catalogue
	// withholds them from some types, and `validateClauses` enforces the catalogue. Claiming "any
	// field type" here would advertise a clause the tool then rejects, so the description says
	// nothing about field types and lets the `clauses` array description name the catalogue instead.
	test('claims no field types for an operator modules/sqon does not restrict', () => {
		for (const operator of ['in', 'wildcard', 'all', 'some-not-in']) {
			const description = describeOperators([operator]);
			assert.ok(!description.includes('any field type'), `${operator} should not claim any field type`);
			assert.ok(!description.includes('applies to'), `${operator} should not name field types at all`);
			assert.ok(description.includes('value is'), `${operator} should still name its value type`);
		}
	});

	test('names the field types for an operator modules/sqon does restrict', () => {
		for (const operator of ['gt', 'between']) {
			const description = describeOperators([operator]);
			assert.ok(description.includes('applies to '), `${operator} should name its field types`);
			assert.ok(description.includes('date'), `${operator} should list date among them`);
		}
	});

	test('names the applicable field types for a type-restricted operator', () => {
		const description = describeOperators(['between']);
		assert.ok(!description.includes('any field type'));
		assert.ok(description.includes('value is'));
	});

	test('returns just the lead sentence when no operator matches', () => {
		assert.equal(describeOperators(['not-an-operator']).split('\n').length, 1);
	});
});

suite('build_sqon registration', () => {
	test('registers under the name execute_query and the server instructions point at', () => {
		assert.equal(captureTool(healthyClient).name, 'build_sqon');
	});

	test('tells the caller to read field metadata first and to hand the result to execute_query', () => {
		const { description } = captureTool(healthyClient).config;
		assert.ok(description.includes('get_catalogue_fields'));
		assert.ok(description.includes('execute_query'));
	});

	test('documents the empty SQON shortcut so an unfiltered query skips this tool', () => {
		assert.ok(captureTool(healthyClient).config.description.includes('{"op":"and","content":[]}'));
	});
});

suite('build_sqon input schema', () => {
	const schema = captureTool(healthyClient).config.inputSchema;
	const parse = (input: Record<string, unknown>) => schema.safeParse(input);
	const oneClause = (clause: Record<string, unknown>) => ({
		catalogueId: 'participants',
		combination: 'and',
		clauses: [clause],
	});

	test('accepts a scalar value for an in-like operator', () => {
		assert.equal(parse(oneClause(inClause('study', 'A'))).success, true);
	});

	test('accepts an array of values for an in-like operator', () => {
		assert.equal(parse(oneClause(inClause('study', ['A', 'B']))).success, true);
	});

	test('rejects an empty value array, which would filter on nothing', () => {
		assert.equal(parse(oneClause(inClause('study', []))).success, false);
	});

	test('accepts a number or a date string as a range bound', () => {
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'gte', value: 40 })).success, true);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'gte', value: '2020-01-01' })).success, true);
	});

	test('rejects an operator alias, which would silently drop the clause when folded', () => {
		assert.equal(parse(oneClause({ fieldName: 'a', operator: '>=', value: 40 })).success, false);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: '=', value: 'A' })).success, false);
	});

	test('accepts a wildcard clause naming its fields with fieldNames', () => {
		assert.equal(parse(oneClause({ fieldNames: ['a', 'b'], operator: 'wildcard', value: '*A*' })).success, true);
		assert.equal(parse(oneClause({ fieldNames: ['a'], operator: 'wildcard', value: '*A*' })).success, true);
	});

	// The union discriminates on `operator`, so each branch carries only the field property its own
	// operator takes. That enforces the fieldName/fieldNames split structurally, with no refinement.
	test('rejects a wildcard clause that names its field with the singular fieldName', () => {
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'wildcard', value: '*A*' })).success, false);
	});

	test('rejects a scalar clause that names its fields with the plural fieldNames', () => {
		assert.equal(parse(oneClause({ fieldNames: ['a'], operator: 'in', value: 'A' })).success, false);
	});

	test('rejects an empty fieldNames array, and an empty name within it', () => {
		assert.equal(parse(oneClause({ fieldNames: [], operator: 'wildcard', value: '*A*' })).success, false);
		assert.equal(parse(oneClause({ fieldNames: [''], operator: 'wildcard', value: '*A*' })).success, false);
	});

	test('rejects a non-string or empty wildcard value', () => {
		assert.equal(parse(oneClause({ fieldNames: ['a'], operator: 'wildcard', value: 40 })).success, false);
		assert.equal(parse(oneClause({ fieldNames: ['a'], operator: 'wildcard', value: '' })).success, false);
	});

	test('rejects "fuzzy", which has no implementation to build', () => {
		assert.equal(parse(oneClause({ fieldNames: ['a'], operator: 'fuzzy', value: 'jon' })).success, false);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'fuzzy', value: 'jon' })).success, false);
	});

	test('requires an array value for "all", which cannot take a bare scalar', () => {
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'all', value: ['A', 'B'] })).success, true);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'all', value: 'A' })).success, false);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'all', value: [] })).success, false);
	});

	test('accepts "some-not-in" on the in-like branch', () => {
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'some-not-in', value: ['A'] })).success, true);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'some-not-in', value: 'A' })).success, true);
	});

	test('requires exactly two bounds for "between"', () => {
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'between', value: [40, 60] })).success, true);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'between', value: [40] })).success, false);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'between', value: [40, 60, 80] })).success, false);
	});

	test('accepts an optional negate flag', () => {
		assert.equal(parse(oneClause({ ...inClause('study', 'A'), negate: true })).success, true);
	});

	test('rejects a batch with no clauses', () => {
		assert.equal(parse({ catalogueId: 'participants', combination: 'and', clauses: [] }).success, false);
	});

	test('rejects an empty catalogueId or fieldName', () => {
		assert.equal(parse({ catalogueId: '', combination: 'and', clauses: [inClause('a', 'A')] }).success, false);
		assert.equal(parse(oneClause(inClause('', 'A'))).success, false);
	});

	test('rejects a combination other than and/or', () => {
		assert.equal(
			parse({ catalogueId: 'participants', combination: 'xor', clauses: [inClause('a', 'A')] }).success,
			false,
		);
	});

	test('reports every invalid clause in a batch, not just the first', () => {
		const result = parse({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('a', 'A'), { fieldName: 'b', operator: 'between', value: [1] }, inClause('c', [])],
		});
		assert.equal(result.success, false);
		const failedIndexes = new Set(!result.success ? result.error.issues.map((issue) => issue.path[1]) : []);
		assert.deepEqual([...failedIndexes].sort(), [1, 2]);
	});
});

suite('build_sqon catalogue resolution', () => {
	test('rejects a catalogue that is not in the configured allowlist, without calling Arranger', async () => {
		const client = stubClient(() => {
			throw new Error('the allowlist must be checked before any request');
		});
		const message = await expectError(
			{ catalogueId: 'secret', combination: 'and', clauses: [inClause('a', 'A')] },
			client,
		);
		assert.ok(message.includes('is not configured on this server'));
		assert.ok(message.includes('participants, files'));
		assert.ok(message.includes('list_catalogues'));
	});

	test('distinguishes a catalogue Arranger does not have from one this server does not allow', async () => {
		const client = stubClient(() =>
			Promise.reject(
				new ArrangerRequestError({
					message: 'not found',
					url: 'https://arranger.test/introspection/files',
					status: 404,
				}),
			),
		);
		const message = await expectError(
			{ catalogueId: 'files', combination: 'and', clauses: [inClause('a', 'A')] },
			client,
		);
		assert.ok(message.includes('the Arranger server does not have it'));
		assert.ok(message.includes('list_catalogues'));
	});

	test('reports a failed catalogue as unavailable, relaying what Arranger said', async () => {
		const client = stubClient(() =>
			Promise.resolve({
				catalogueId: 'participants',
				documentType: '',
				status: 'failed',
				error: { code: 'index_not_found', message: 'Index "participants" does not exist.' },
			}),
		);
		const message = await expectError(
			{ catalogueId: 'participants', combination: 'and', clauses: [inClause('study', 'A')] },
			client,
		);
		assert.ok(message.includes('is not currently available'));
		assert.ok(message.includes('index_not_found'));
		assert.ok(message.includes('Index "participants" does not exist.'));
		assert.ok(message.includes('Rewriting the query will not help'));
	});

	test('reports a failed catalogue that carries no error detail', async () => {
		const client = stubClient(() =>
			Promise.resolve({ catalogueId: 'participants', documentType: '', status: 'failed' }),
		);
		const message = await expectError(
			{ catalogueId: 'participants', combination: 'and', clauses: [inClause('study', 'A')] },
			client,
		);
		assert.ok(message.includes('is not currently available'));
		assert.ok(message.includes('Arranger reports') === false);
	});

	test('surfaces a non-404 Arranger failure rather than misreporting it as a missing catalogue', async () => {
		const client = stubClient(() =>
			Promise.reject(
				new ArrangerRequestError({
					message: 'Request to https://arranger.test/introspection/participants timed out after 10000ms.',
					url: 'https://arranger.test/introspection/participants',
					isTimeout: true,
				}),
			),
		);
		const message = await expectError(
			{ catalogueId: 'participants', combination: 'and', clauses: [inClause('study', 'A')] },
			client,
		);
		assert.ok(message.startsWith('Unexpected error while building the sqon:'));
		assert.ok(message.includes('timed out'));
		assert.ok(!message.includes('does not have it'));
	});

	test('does not crash on an introspection payload it cannot parse', async () => {
		const client = stubClient(() => Promise.resolve({ catalogId: 'participants' }));
		const message = await expectError(
			{ catalogueId: 'participants', combination: 'and', clauses: [inClause('study', 'A')] },
			client,
		);
		assert.ok(message.startsWith('Unexpected error while building the sqon:'));
	});
});

suite('build_sqon SQON building', () => {
	test('wraps a single clause in an "and" group, which every query type accepts', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('donor.sex', 'Male')],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } }],
		});
	});

	test('folds several "and" clauses into one flat group', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				inClause('donor.sex', ['Male']),
				{ fieldName: 'donor.age_at_diagnosis', operator: 'gte', value: 40 },
				inClause('study', ['A', 'B']),
			],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
				{ op: 'gte', content: { fieldName: 'donor.age_at_diagnosis', value: 40 } },
				{ op: 'in', content: { fieldName: 'study', value: ['A', 'B'] } },
			],
		});
	});

	test('folds several "or" clauses into one flat group', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'or',
			clauses: [inClause('donor.sex', ['Male']), inClause('study', ['A'])],
		});
		assert.deepEqual(output.sqon, {
			op: 'or',
			content: [
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
				{ op: 'in', content: { fieldName: 'study', value: ['A'] } },
			],
		});
	});

	test('leaves a negated clause under its own "not", which is already a group root', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 70, negate: true }],
		});
		assert.deepEqual(output.sqon, {
			op: 'not',
			content: [{ op: 'gt', content: { fieldName: 'donor.age_at_diagnosis', value: 70 } }],
		});
	});

	test('negates only the clause it was asked to, not the whole batch', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				inClause('donor.sex', ['Male']),
				{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 70, negate: true },
			],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
				{ op: 'not', content: [{ op: 'gt', content: { fieldName: 'donor.age_at_diagnosis', value: 70 } }] },
			],
		});
	});

	test('wraps a scalar in-like value in an array', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', 'A')],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'in', content: { fieldName: 'study', value: ['A'] } }],
		});
	});

	test('keeps "between" bounds as a two-element range', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.age_at_diagnosis', operator: 'between', value: [40, 60] }],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'between', content: { fieldName: 'donor.age_at_diagnosis', value: [40, 60] } }],
		});
	});

	test('keeps a quoted range bound on a date field', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.enrolled_on', operator: 'gte', value: '2020-01-01' }],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'gte', content: { fieldName: 'donor.enrolled_on', value: '2020-01-01' } }],
		});
	});
});

suite('build_sqon existingSqon', () => {
	const wrappedRoot = {
		op: 'and',
		content: [{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } }],
	};

	test('adds a clause to a SQON returned by an earlier call, and the root stays wrapped', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A'])],
			existingSqon: wrappedRoot,
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
				{ op: 'in', content: { fieldName: 'study', value: ['A'] } },
			],
		});
	});

	test('widens an earlier "in" clause on the same field instead of ANDing an unsatisfiable second one', async () => {
		// "also include study B": reduceSqon deliberately no longer merges same-field "in" under
		// "and" (doing so would silently turn an intersection into a union), so build_sqon has to
		// widen the existing clause itself rather than relying on normalization to do it.
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', 'B')],
			existingSqon: { op: 'in', content: { fieldName: 'study', value: ['A'] } },
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'in', content: { fieldName: 'study', value: ['A', 'B'] } }],
		});
		assert.equal(output.filterCount, 1);
	});

	test('preserves an existing multi-clause "and" as one branch when combining with "or"', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'or',
			clauses: [inClause('study', ['A'])],
			existingSqon: {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
					{ op: 'gte', content: { fieldName: 'donor.age_at_diagnosis', value: 40 } },
				],
			},
		});
		assert.deepEqual(output.sqon, {
			op: 'or',
			content: [
				{
					op: 'and',
					content: [
						{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
						{ op: 'gte', content: { fieldName: 'donor.age_at_diagnosis', value: 40 } },
					],
				},
				{ op: 'in', content: { fieldName: 'study', value: ['A'] } },
			],
		});
	});

	test('treats an empty root SQON as no filter at all', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A'])],
			existingSqon: { op: 'and', content: [] },
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'in', content: { fieldName: 'study', value: ['A'] } }],
		});
		assert.equal(output.clauseCount, 1);
	});

	// The alias is normalized before the catalogue check, not just before the fold: an existing SQON
	// spelling `gte` as `>=` must not be reported as an operator this catalogue does not accept.
	test('normalizes an operator alias in an existing SQON rather than rejecting it', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A'])],
			existingSqon: { op: '>=', content: { fieldName: 'donor.age_at_diagnosis', value: 40 } },
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'gte', content: { fieldName: 'donor.age_at_diagnosis', value: 40 } },
				{ op: 'in', content: { fieldName: 'study', value: ['A'] } },
			],
		});
	});

	test('rejects an existing SQON that is not a SQON, naming the offending path', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A'])],
			existingSqon: { op: 'in', value: ['A'] },
		});
		assert.ok(message.includes('existingSqon is not a valid SQON'));
		assert.ok(message.includes('- at '));
	});

	test('rejects an existing SQON built against a different catalogue, and says to rebuild', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A'])],
			existingSqon: { op: 'in', content: { fieldName: 'file.size', value: ['A'] } },
		});
		assert.ok(message.startsWith('No SQON was built.'));
		assert.ok(message.includes('existingSqon references unknown field "file.size"'));
		assert.ok(message.includes('rebuild the query for "participants"'));
	});

	test('rejects an existing SQON whose operator does not fit the field it names in this catalogue', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A'])],
			existingSqon: { op: 'gt', content: { fieldName: 'donor.sex', value: 40 } },
		});
		assert.ok(message.includes('existingSqon operator "gt" is not valid for field "donor.sex"'));
	});

	// The regression this batching exists for: before it, validateClauses returned first and the
	// existingSqon mismatch only surfaced on a second call, after the clauses had been fixed.
	test('reports an unusable existingSqon and an invalid clause in the same response', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.sex', operator: 'gt', value: 40 }],
			existingSqon: { op: 'in', content: { fieldName: 'file.size', value: ['A'] } },
		});
		assert.ok(message.includes('existingSqon references unknown field "file.size"'));
		assert.ok(message.includes('clauses[0]: '));
		assert.ok(message.includes('rebuild the query for "participants"'));
	});

	test('reports a structurally invalid existingSqon alongside an invalid clause, not instead of it', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('not.a.field', ['A'])],
			existingSqon: { op: 'in', value: ['A'] },
		});
		assert.ok(message.includes('existingSqon is not a valid SQON'));
		assert.ok(message.includes('clauses[0]: unknown field "not.a.field"'));
		// The rebuild advice speaks to a SQON built for another catalogue. A value that is not a SQON
		// at all already carries its own remedy, so pointing at catalogues would be misdirection.
		assert.ok(!message.includes('rebuild the query'));
	});

	test('lists existingSqon before the clauses, since a base query from another catalogue has to go first', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.sex', operator: 'gt', value: 40 }],
			existingSqon: { op: 'in', content: { fieldName: 'file.size', value: ['A'] } },
		});
		assert.ok(message.indexOf('existingSqon references') < message.indexOf('clauses[0]: '));
	});

	test('does not offer the rebuild advice when only the clauses are at fault', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.sex', operator: 'gt', value: 40 }],
			existingSqon: wrappedRoot,
		});
		assert.ok(message.includes('clauses[0]: '));
		assert.ok(!message.includes('rebuild the query'));
	});
});

suite('build_sqon text search', () => {
	const wildcard = (fieldNames: string[], value: string) => ({ fieldNames, operator: 'wildcard', value });

	test('builds a wildcard clause carrying every field it searches', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['study', 'donor.sex'], '*A*')],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'wildcard', content: { fieldNames: ['study', 'donor.sex'], value: '*A*' } }],
		});
	});

	test('negates a wildcard clause, which is how "does not contain" is expressed', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ ...wildcard(['study'], '*A*'), negate: true }],
		});
		assert.deepEqual(output.sqon, {
			op: 'not',
			content: [{ op: 'wildcard', content: { fieldNames: ['study'], value: '*A*' } }],
		});
	});

	test('folds a wildcard clause alongside scalar clauses in one group', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('donor.sex', ['Male']), wildcard(['study'], '*A*')],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
				{ op: 'wildcard', content: { fieldNames: ['study'], value: '*A*' } },
			],
		});
	});

	// reduceSqon has no merge rule for wildcard, so two text searches on the same fields stay
	// separate rather than being collapsed the way two `in` clauses would be.
	test('keeps two wildcard clauses on the same fields separate', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['study'], '*A*'), wildcard(['study'], '*B*')],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'wildcard', content: { fieldNames: ['study'], value: '*A*' } },
				{ op: 'wildcard', content: { fieldNames: ['study'], value: '*B*' } },
			],
		});
	});

	test('summarizes a wildcard clause with display names joined by "or"', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['study', 'donor.sex'], '*A*')],
		});
		assert.equal(output.summary, 'Study or Biological Sex matches "*A*"');
	});

	test('rejects a wildcard on a field type the catalogue withholds it from', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['donor.age_at_diagnosis'], '*4*')],
		});
		assert.ok(message.includes('operator "wildcard" is not valid for field "donor.age_at_diagnosis"'));
		assert.ok(message.includes('(type "long")'));
	});

	test('reports every invalid field in one wildcard clause, as one clause error', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['study', 'not.a.field', 'donor.age_at_diagnosis'], '*A*')],
		});
		assert.ok(message.includes('unknown field "not.a.field"'));
		assert.ok(message.includes('operator "wildcard" is not valid for field "donor.age_at_diagnosis"'));
		assert.equal(message.split('clauses[').length - 1, 1, 'one clause should report one error');
	});

	test('notes that a wildcard value without "*" matches the whole field, not a substring', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['study'], 'A')],
		});
		const notes = output.notes as string[];
		assert.ok(notes.some((note) => note.includes('contain no "*"')));
	});

	test('adds no such note when the value carries a wildcard character', async () => {
		const withStar = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['study'], '*A*')],
		});
		assert.equal(withStar.output.notes, undefined);

		const withQuestionMark = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [wildcard(['study'], 'A?')],
		});
		assert.equal(withQuestionMark.output.notes, undefined);
	});

	test('accepts a wildcard clause inside existingSqon and extends it', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			existingSqon: { op: 'wildcard', content: { fieldNames: ['study'], value: '*A*' } },
			clauses: [inClause('donor.sex', ['Male'])],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'wildcard', content: { fieldNames: ['study'], value: '*A*' } },
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
			],
		});
	});
});

suite('build_sqon set-membership operators', () => {
	test('builds an "all" clause requiring every value', async () => {
		// `study` is declared single-valued (`isArray: false`), so `all` with more than one value
		// would trip the cardinality gate below: use a field confirmed multi-valued instead.
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'biomarkers', operator: 'all', value: ['A', 'B'] }],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'all', content: { fieldName: 'biomarkers', value: ['A', 'B'] } }],
		});
		assert.equal(output.summary, 'Biomarkers includes all of "A" or "B"');
	});

	test('builds a "some-not-in" clause', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'study', operator: 'some-not-in', value: ['A'] }],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'some-not-in', content: { fieldName: 'study', value: ['A'] } }],
		});
	});

	test('rejects negate on "some-not-in", which is already negative', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'study', operator: 'some-not-in', value: ['A'], negate: true }],
		});
		assert.ok(message.includes('double negative'));
	});

	test('rejects "all" and "some-not-in" on a field type the catalogue withholds them from', async () => {
		for (const operator of ['all', 'some-not-in']) {
			const message = await expectError({
				catalogueId: 'participants',
				combination: 'and',
				clauses: [{ fieldName: 'donor.age_at_diagnosis', operator, value: [40] }],
			});
			assert.ok(
				message.includes(`operator "${operator}" is not valid for field "donor.age_at_diagnosis"`),
				`${operator} should be rejected on a long field`,
			);
		}
	});
});

suite('build_sqon field cardinality gate', () => {
	test('refuses to guess when two "in" clauses collide on a genuinely multi-valued field', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'biomarkers', operator: 'in', value: ['BRCA1'] },
				{ fieldName: 'biomarkers', operator: 'in', value: ['BRCA2'] },
			],
		});
		assert.ok(message.includes('Field "biomarkers" can hold more than one value'));
		assert.ok(message.includes('matches either'));
		assert.ok(message.includes('matches both'));
		assert.ok(message.includes('"all" operator'));
	});

	test("refuses to guess when the field's cardinality was never declared", async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'donor.legacy_tag', operator: 'in', value: ['A'] },
				{ fieldName: 'donor.legacy_tag', operator: 'in', value: ['B'] },
			],
		});
		assert.ok(message.includes('Field "donor.legacy_tag"\'s cardinality is not declared'));
		// An undeclared field is not a confirmed multi-valued one: "all" could be just as
		// unsatisfiable as "in", so the message must not recommend it outright the way the
		// isArray: true case does.
		assert.ok(!message.includes('use the "all" operator'));
		assert.ok(message.includes('confirm with the data owner'));
	});

	test('refuses the same collision when it arrives via existingSqon instead of one call', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'biomarkers', operator: 'in', value: ['BRCA2'] }],
			existingSqon: { op: 'in', content: { fieldName: 'biomarkers', value: ['BRCA1'] } },
		});
		assert.ok(message.includes('Field "biomarkers" can hold more than one value'));
	});

	// existingSqon is reduced (via SqonBuilder.from().toValue()) before the gate scans it, not just
	// normalized. A single-item nested group unwraps to a bare leaf on reduction, the same shape
	// addFilterClause folds against later; scanning the raw, pre-reduction shape would miss this
	// collision entirely, since the gate's top-level scan sees a group, not a leaf, at that point.
	test('refuses a collision hiding inside a nested single-item group in existingSqon', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'biomarkers', operator: 'in', value: ['BRCA2'] }],
			existingSqon: {
				op: 'and',
				content: [
					{ op: 'and', content: [{ op: 'in', content: { fieldName: 'biomarkers', value: ['BRCA1'] } }] },
				],
			},
		});
		assert.ok(message.includes('Field "biomarkers" can hold more than one value'));
	});

	test('reports one collision per field, not once per extra colliding clause', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'biomarkers', operator: 'in', value: ['BRCA1'] },
				{ fieldName: 'biomarkers', operator: 'in', value: ['BRCA2'] },
				{ fieldName: 'biomarkers', operator: 'in', value: ['BRCA3'] },
			],
		});
		assert.equal(message.split('Field "biomarkers" can hold more than one value').length - 1, 1);
	});

	test('still merges freely on a field declared single-valued', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'study', operator: 'in', value: ['A'] },
				{ fieldName: 'study', operator: 'in', value: ['B'] },
			],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'in', content: { fieldName: 'study', value: ['A', 'B'] } }],
		});
	});

	test('refuses an "all" clause with more than one value on a field declared single-valued', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'study', operator: 'all', value: ['A', 'B'] }],
		});
		assert.ok(message.includes('Field "study" is declared single-valued'));
		assert.ok(message.includes('can never match'));
	});

	test('refuses an "all" clause with more than one value when cardinality is undeclared', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.legacy_tag', operator: 'all', value: ['A', 'B'] }],
		});
		assert.ok(message.includes('Field "donor.legacy_tag"\'s cardinality is not declared'));
		assert.ok(message.includes('will never match on a single-valued field'));
	});

	test('allows an "all" clause with more than one value on a field confirmed multi-valued', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'biomarkers', operator: 'all', value: ['BRCA1', 'BRCA2'] }],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'all', content: { fieldName: 'biomarkers', value: ['BRCA1', 'BRCA2'] } }],
		});
	});

	test('exempts a single-value "all" clause regardless of cardinality', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'study', operator: 'all', value: ['A'] }],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'all', content: { fieldName: 'study', value: ['A'] } }],
		});
	});

	// reduceSqon merges same-field "all" under "and", so the check has to be on the combined total.
	test('refuses two single-value "all" clauses on the same field that would fold into a multi-value one', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'study', operator: 'all', value: ['A'] },
				{ fieldName: 'study', operator: 'all', value: ['B'] },
			],
		});
		assert.ok(message.includes('Field "study" is declared single-valued'));
	});

	test('refuses a single-value "all" clause that would fold against an existing "all" leaf on the same field', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'study', operator: 'all', value: ['B'] }],
			existingSqon: { op: 'all', content: { fieldName: 'study', value: ['A'] } },
		});
		assert.ok(message.includes('Field "study" is declared single-valued'));
	});

	// Two single-value clauses repeating the same value fold to one distinct value (deduplicated),
	// not two: still satisfiable regardless of cardinality, so this must not be flagged.
	test('does not flag two single-value "all" clauses naming the same value', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'study', operator: 'all', value: ['A'] },
				{ fieldName: 'study', operator: 'all', value: ['A'] },
			],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'all', content: { fieldName: 'study', value: ['A'] } }],
		});
	});

	test('does not flag a negated single-value "all" clause colliding with an unnegated one, matching the fold', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'study', operator: 'all', value: ['A'] },
				{ fieldName: 'study', operator: 'all', value: ['B'], negate: true },
			],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'all', content: { fieldName: 'study', value: ['A'] } },
				{ op: 'not', content: [{ op: 'all', content: { fieldName: 'study', value: ['B'] } }] },
			],
		});
	});
});

suite('build_sqon asterisk in a term-matched value', () => {
	test('rejects an asterisk in an in-like value and points at the wildcard operator', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['*TP53*'])],
		});
		assert.ok(message.includes('contains "*"'));
		assert.ok(message.includes('regular expression'));
		assert.ok(message.includes('"wildcard"'));
	});

	test('checks every value, not only the first', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A', 'B*'])],
		});
		assert.ok(message.includes('value "B*"'));
	});

	test('applies to every term-matched operator', async () => {
		for (const operator of ['in', 'not-in', 'some-not-in', 'all']) {
			const message = await expectError({
				catalogueId: 'participants',
				combination: 'and',
				clauses: [{ fieldName: 'study', operator, value: ['*A*'] }],
			});
			assert.ok(message.includes('contains "*"'), `${operator} should reject an asterisked value`);
		}
	});

	// A set reference and a missing-field sentinel are the other two magic in-like values, and
	// neither contains an asterisk, so neither is caught by this check.
	test('leaves set references and the missing-field sentinel alone', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['set_id:abc', '__missing__'])],
		});
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'in', content: { fieldName: 'study', value: ['set_id:abc', '__missing__'] } }],
		});
	});

	test('leaves an asterisk in a wildcard value alone, which is where it belongs', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldNames: ['study'], operator: 'wildcard', value: '*TP53*' }],
		});
		assert.equal(output.filterCount, 1);
	});
});

suite('build_sqon clause validation', () => {
	test('builds nothing when a clause is invalid, and asks for the whole batch back', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [{ fieldName: 'donor.sex', operator: 'gt', value: 40 }],
		});
		assert.ok(message.startsWith('No SQON was built.'));
		assert.ok(message.includes('resubmit the whole batch'));
	});

	test('lists every invalid clause in one response so the batch can be fixed in one pass', async () => {
		const message = await expectError({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				inClause('not.a.field', ['A']),
				inClause('donor.sex', ['Male']),
				{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: '40' },
			],
		});
		assert.ok(message.includes('clauses[0]: unknown field "not.a.field"'));
		assert.ok(message.includes('clauses[2]: '));
		assert.ok(!message.includes('clauses[1]: '));
	});
});

suite('build_sqon response', () => {
	test('returns structured content matching the declared output schema', async () => {
		const tool = captureTool(healthyClient);
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('donor.sex', ['Male'])],
		});
		assert.doesNotThrow(() => tool.config.outputSchema.parse(output));
	});

	test('repeats the structured content as text, for clients that ignore structured output', async () => {
		const { result, output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('donor.sex', ['Male'])],
		});
		assert.equal(result.content[0].type, 'text');
		assert.deepEqual(JSON.parse(result.content[0].text), output);
	});

	test('marks a success result as not an error', async () => {
		const { result } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('donor.sex', ['Male'])],
		});
		assert.equal(result.isError, undefined);
	});

	test('returns no structured content on an error, so output validation is skipped', async () => {
		const result = await invoke(healthyClient, {
			catalogueId: 'unknown-catalogue',
			combination: 'and',
			clauses: [inClause('donor.sex', ['Male'])],
		});
		assert.equal(result.isError, true);
		assert.equal(result.structuredContent, undefined);
	});

	test('summarizes the SQON in plain English, using catalogue display names', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				inClause('donor.sex', ['Male']),
				{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 70, negate: true },
			],
		});
		assert.equal(output.summary, 'Biological Sex is "Male" AND NOT (Age at Diagnosis is greater than 70)');
	});

	test('counts the clauses submitted, including those already in the existing SQON', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A'])],
			existingSqon: {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
					{ op: 'gte', content: { fieldName: 'donor.age_at_diagnosis', value: 40 } },
				],
			},
		});
		assert.equal(output.clauseCount, 3);
		assert.equal(output.filterCount, 3);
	});

	test('adds no note when nothing was merged', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('donor.sex', ['Male']), inClause('study', ['A'])],
		});
		assert.equal(output.clauseCount, 2);
		assert.equal(output.filterCount, 2);
		assert.ok(!('notes' in output));
	});

	test('reports the merge when two bounds on the same field collapse into one', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [
				{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 50 },
				{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 70 },
			],
		});
		assert.equal(output.clauseCount, 2);
		assert.equal(output.filterCount, 1);
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [{ op: 'gt', content: { fieldName: 'donor.age_at_diagnosis', value: 70 } }],
		});
		assert.ok(Array.isArray(output.notes) && output.notes[0].includes('2 filter clauses reduced to 1'));
		assert.equal(output.summary, 'Age at Diagnosis is greater than 70');
	});

	// clauseCount has to count what was submitted, not what survived the reduction, or the
	// "reduced to" note goes silent on exactly the case it exists to explain.
	test('counts clauses submitted inside an existingSqon that reduces on its own', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('donor.sex', ['Male'])],
			existingSqon: {
				op: 'or',
				content: [
					{ op: 'in', content: { fieldName: 'study', value: ['A'] } },
					{ op: 'in', content: { fieldName: 'study', value: ['B'] } },
				],
			},
		});
		assert.equal(output.clauseCount, 3);
		assert.equal(output.filterCount, 2);
		assert.deepEqual(output.sqon, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'study', value: ['A', 'B'] } },
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Male'] } },
			],
		});
		assert.ok(Array.isArray(output.notes) && output.notes[0].includes('3 filter clauses reduced to 2'));
	});

	test('summarizes two "in" clauses on one field as the single any-of filter they merge into', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'and',
			clauses: [inClause('study', ['A']), inClause('study', ['B'])],
		});
		assert.equal(output.filterCount, 1);
		assert.equal(output.summary, 'Study is "A" or "B"');
		assert.ok(Array.isArray(output.notes));
	});

	test('keeps separate exclusions on one field separate under "or"', async () => {
		const { output } = await buildSqon({
			catalogueId: 'participants',
			combination: 'or',
			clauses: [
				{ fieldName: 'study', operator: 'not-in', value: ['X'] },
				{ fieldName: 'study', operator: 'not-in', value: ['Y'] },
			],
		});
		assert.equal(output.filterCount, 2);
		assert.ok(!('notes' in output));
	});
});
