import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { getSqonFieldOperatorDetails } from '@overture-stack/sqon';
import { z as zod } from 'zod';

import { ArrangerRequestError, type ArrangerClient } from '#arranger/client.js';
import { BUILD_SQON_OPERATORS, describeOperators, registerBuildSqonTool } from '#mcp/buildSqonTool.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

const config: ArrangerMcpConfig = {
	arrangerBaseUrl: 'https://arranger.test',
	catalogues: ['participants', 'files'],
	requestTimeoutMs: 10_000,
	mcp: { host: '0.0.0.0', port: 3100, path: '/mcp' },
};

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
		study: { displayName: 'Study', type: 'keyword' },
		'donor.sex': { displayName: 'Biological Sex', type: 'keyword' },
		'donor.age_at_diagnosis': { displayName: 'Age at Diagnosis', type: 'long', unit: 'years' },
		'donor.enrolled_on': { displayName: 'Enrolment Date', type: 'date' },
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
		inputSchema: zod.ZodRawShape;
		outputSchema: zod.ZodTypeAny;
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

	registerBuildSqonTool(server as unknown as McpServer, { client, config });

	const tool = registered[0];
	if (!tool) {
		throw new Error('registerBuildSqonTool registered no tool');
	}
	return tool;
};

/** Parses input through the registered input schema, exactly as the SDK does, then runs the handler. */
const invoke = async (client: ArrangerClient, input: Record<string, unknown>): Promise<ToolResult> => {
	const tool = captureTool(client);
	return tool.handler(zod.object(tool.config.inputSchema).parse(input) as Record<string, unknown>);
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
	test('offers only the single-field scalar operators v1 supports', () => {
		assert.deepEqual([...BUILD_SQON_OPERATORS], ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between']);
	});

	test('excludes the operators v1 deliberately withholds', () => {
		for (const withheld of ['all', 'some-not-in', 'wildcard']) {
			assert.ok(!BUILD_SQON_OPERATORS.includes(withheld as never), `${withheld} should not be offered`);
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

	test('renders an operator applicable to every field type in plain English', () => {
		assert.ok(describeOperators(['in']).includes('applies to any field type'));
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
	const schema = zod.object(captureTool(healthyClient).config.inputSchema);
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

	test('rejects the text operators, which v1 does not support', () => {
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'wildcard', value: '*A*' })).success, false);
		assert.equal(parse(oneClause({ fieldName: 'a', operator: 'fuzzy', value: '*A*' })).success, false);
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
		assert.ok(message.includes('valid individually, but the resulting SQON is not'));
		assert.ok(message.includes('SQON references unknown field "file.size"'));
		assert.ok(message.includes('rebuild the query for "participants"'));
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
