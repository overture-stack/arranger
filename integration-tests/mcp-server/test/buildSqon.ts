import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/sdk/client';

export type BuildSqonEnv = {
	getClient: () => Client;
};

/** The structured output shape declared by the build_sqon tool. */
type BuildSqonStructured = {
	sqon: Record<string, unknown>;
	summary: string;
	clauseCount: number;
	filterCount: number;
	notes?: string[];
};

/** The subset of execute_query's structured output these tests read back. */
type ExecuteQueryStructured = {
	total?: number;
	hits?: Record<string, unknown>[];
	aggregations?: Record<string, { bucket_count?: number; buckets?: { key: string; doc_count: number }[] }>;
};

const callBuildSqon = (mcpClient: Client, args: Record<string, unknown>) =>
	mcpClient.callTool({ name: 'build_sqon', arguments: args });

const getStructured = (result: Awaited<ReturnType<Client['callTool']>>): BuildSqonStructured => {
	// Not `notEqual(result.isError, true)`: under node:assert/strict that is notStrictEqual, which
	// lets a truthy-but-not-`true` isError through. Negating covers every truthy value.
	assert.ok(!result.isError, `tool call returned isError: ${JSON.stringify(result)}`);
	const structured = result.structuredContent as BuildSqonStructured | undefined;
	assert.ok(structured, 'expected build_sqon to return structuredContent');
	return structured;
};

const getErrorText = (result: Awaited<ReturnType<Client['callTool']>>): string => {
	assert.equal(result.isError, true, `expected tool call to return isError, got: ${JSON.stringify(result)}`);
	const [first] = result.content as { type: string; text?: string }[];
	assert.ok(first, 'expected at least one content entry in error result');
	assert.equal(first.type, 'text');
	return first.text as string;
};

// Dataset reference (test/assets/catalogue_a.data.json):
//   a-001 age 34 Alive | a-002 age 51 Deceased | a-003 age 62 Alive | a-004 age 8 Unknown | a-005 age 45 Deceased
export default ({ getClient }: BuildSqonEnv) => {
	test('1.builds a single-clause SQON wrapped in a combination root', async () => {
		const result = await callBuildSqon(getClient(), {
			catalogueId: 'catalogue-a',
			combination: 'and',
			clauses: [{ fieldName: 'vital_status', operator: 'in', value: 'Deceased' }],
		});
		const structured = getStructured(result);

		// The root is wrapped even for one clause: Arranger's aggregations resolver crashes on a
		// SQON whose root is a leaf filter clause (see tech-debt), so the tool never emits one.
		assert.deepEqual(structured.sqon, {
			op: 'and',
			content: [{ op: 'in', content: { fieldName: 'vital_status', value: ['Deceased'] } }],
		});
		assert.equal(structured.clauseCount, 1);
		assert.equal(structured.filterCount, 1);

		// The text content mirrors the structured content.
		const [first] = result.content as { type: string; text?: string }[];
		assert.equal(first?.type, 'text');
		assert.deepEqual(JSON.parse(first?.text ?? ''), structured);
	});

	test('2.folds a three-clause batch into one flat "and" group', async () => {
		const structured = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [
					{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] },
					{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 40 },
					{ fieldName: 'analysis_id', operator: 'not-in', value: ['a-001'] },
				],
			}),
		);

		assert.deepEqual(structured.sqon, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'vital_status', value: ['Alive'] } },
				{ op: 'gt', content: { fieldName: 'age_at_diagnosis', value: 40 } },
				{ op: 'not-in', content: { fieldName: 'analysis_id', value: ['a-001'] } },
			],
		});
		assert.equal(structured.clauseCount, 3);
		assert.equal(structured.filterCount, 3);
	});

	test('3.folds an "or" batch into one flat group', async () => {
		const structured = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'or',
				clauses: [
					{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] },
					{ fieldName: 'age_at_diagnosis', operator: 'lt', value: 10 },
				],
			}),
		);

		assert.deepEqual(structured.sqon, {
			op: 'or',
			content: [
				{ op: 'in', content: { fieldName: 'vital_status', value: ['Alive'] } },
				{ op: 'lt', content: { fieldName: 'age_at_diagnosis', value: 10 } },
			],
		});
	});

	test('4.negates a range clause, since there is no "not-gt" operator', async () => {
		const structured = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 40, negate: true }],
			}),
		);

		assert.deepEqual(structured.sqon, {
			op: 'not',
			content: [{ op: 'gt', content: { fieldName: 'age_at_diagnosis', value: 40 } }],
		});
	});

	test("5.summarizes the SQON in plain English using the catalogue's display names", async () => {
		const structured = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [
					{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] },
					{ fieldName: 'age_at_diagnosis', operator: 'gte', value: 40 },
				],
			}),
		);

		// Display names, not raw field names: the summary is read back to the researcher.
		assert.equal(structured.summary, 'Vital Status is "Alive" AND Age at Diagnosis is at least 40');
	});

	test('6.extends a SQON returned by an earlier call', async () => {
		const first = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] }],
			}),
		);

		const second = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 40 }],
				existingSqon: first.sqon,
			}),
		);

		assert.deepEqual(second.sqon, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'vital_status', value: ['Alive'] } },
				{ op: 'gt', content: { fieldName: 'age_at_diagnosis', value: 40 } },
			],
		});
		assert.equal(second.clauseCount, 2);
		assert.equal(second.filterCount, 2);
	});

	test('7.reports when equivalent clauses were merged, rather than silently returning fewer', async () => {
		const structured = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [
					{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 20 },
					{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 40 },
				],
			}),
		);

		assert.equal(structured.clauseCount, 2);
		assert.equal(structured.filterCount, 1);
		assert.ok(structured.notes?.[0]?.includes('2 filter clauses reduced to 1'), 'expected a merge note');
		assert.equal(structured.summary, 'Age at Diagnosis is greater than 40');
	});

	test('8.rejects a catalogue outside the configured allowlist without reaching Arranger', async () => {
		const text = getErrorText(
			await callBuildSqon(getClient(), {
				catalogueId: 'this-catalogue-does-not-exist',
				combination: 'and',
				clauses: [{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] }],
			}),
		);

		assert.match(text, /not configured on this server/);
		assert.match(text, /catalogue-a/);
		assert.match(text, /catalogue-b/);
		assert.match(text, /list_catalogues/);
	});

	test('9.reports every invalid clause in the batch, not just the first', async () => {
		const text = getErrorText(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [
					{ fieldName: 'not_a_field', operator: 'in', value: ['x'] },
					{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] },
					{ fieldName: 'age_at_diagnosis', operator: 'gt', value: '40' },
				],
			}),
		);

		assert.match(text, /No SQON was built/);
		assert.match(text, /clauses\[0\]: Unknown field "not_a_field"/);
		assert.match(text, /clauses\[2\]: /);
		assert.ok(!text.includes('clauses[1]: '), 'expected the valid clause not to be reported');
	});

	test('10.rejects an operator the field type does not accept', async () => {
		const text = getErrorText(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'vital_status', operator: 'gt', value: 40 }],
			}),
		);

		assert.match(text, /operator "gt" is not valid for field "vital_status"/);
	});

	test("11.rejects an existing SQON built against another catalogue's fields", async () => {
		const text = getErrorText(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-b',
				combination: 'and',
				clauses: [{ fieldName: 'sample_id', operator: 'in', value: ['b-001'] }],
				existingSqon: {
					op: 'and',
					content: [{ op: 'in', content: { fieldName: 'vital_status', value: ['Alive'] } }],
				},
			}),
		);

		assert.match(text, /unknown field "vital_status"/);
		assert.match(text, /rebuild the query for "catalogue-b"/);
	});

	test('12.rejects an existingSqon that is not a SQON', async () => {
		const text = getErrorText(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] }],
				existingSqon: { op: 'in', value: ['Alive'] },
			}),
		);

		assert.match(text, /existingSqon is not a valid SQON/);
	});

	test('13.rejects an operator alias before the handler runs, naming the accepted operators', async () => {
		// `>=` never reaches the fold, where `addFilterClause` would silently return no clause at
		// all. The SDK raises this as an McpError(InvalidParams) inside the request handler, but the
		// caller sees it as an ordinary isError tool result, so a model can self-correct from it.
		const text = getErrorText(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'age_at_diagnosis', operator: '>=', value: 40 }],
			}),
		);

		assert.match(text, /Invalid arguments for tool build_sqon/);
		assert.match(text, /clauses/);
		assert.match(text, /'gte'/, 'expected the error to name the canonical operator the alias maps to');
	});

	test('14.rejects the text operators, which this version of the tool does not build', async () => {
		const text = getErrorText(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'vital_status', operator: 'wildcard', value: 'ali*' }],
			}),
		);

		assert.match(text, /Invalid arguments for tool build_sqon/);
	});

	test('15.rejects a batch with no clauses', async () => {
		const text = getErrorText(
			await callBuildSqon(getClient(), { catalogueId: 'catalogue-a', combination: 'and', clauses: [] }),
		);

		assert.match(text, /Invalid arguments for tool build_sqon/);
	});

	test('16.a built SQON runs unchanged through execute_query as a hits query', async () => {
		const built = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [
					{ fieldName: 'vital_status', operator: 'in', value: ['Alive'] },
					{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 40 },
				],
			}),
		);

		const result = await getClient().callTool({
			name: 'execute_query',
			arguments: { catalogueId: 'catalogue-a', sqon: built.sqon, fields: ['analysis_id'] },
		});
		assert.ok(!result.isError, `execute_query rejected a built SQON: ${JSON.stringify(result)}`);
		const structured = result.structuredContent as ExecuteQueryStructured;

		assert.equal(structured.total, 1);
		assert.deepEqual(
			(structured.hits ?? []).map((hit) => hit.analysis_id),
			['a-003'],
		);
	});

	test('17.a single-clause built SQON runs through execute_query as an aggregations query', async () => {
		// The case the root wrap exists for: `buildAggregations` throws on a leaf root, so a
		// one-clause SQON would work for hits and fail here if the tool ever stopped wrapping.
		const built = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 40 }],
			}),
		);

		const result = await getClient().callTool({
			name: 'execute_query',
			arguments: {
				catalogueId: 'catalogue-a',
				sqon: built.sqon,
				queryType: 'aggregations',
				aggregationFields: ['vital_status'],
			},
		});
		assert.ok(!result.isError, `execute_query rejected a built SQON: ${JSON.stringify(result)}`);
		const structured = result.structuredContent as ExecuteQueryStructured;

		const vitalStatus = structured.aggregations?.vital_status;
		assert.ok(vitalStatus?.buckets, 'expected buckets for vital_status');
		const docCountsByKey = Object.fromEntries(vitalStatus.buckets.map((bucket) => [bucket.key, bucket.doc_count]));
		assert.deepEqual(docCountsByKey, { Alive: 1, Deceased: 2 });
	});

	test('18.a negated built SQON runs through execute_query and excludes the matching documents', async () => {
		const built = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-a',
				combination: 'and',
				clauses: [{ fieldName: 'age_at_diagnosis', operator: 'gt', value: 40, negate: true }],
			}),
		);

		const result = await getClient().callTool({
			name: 'execute_query',
			arguments: { catalogueId: 'catalogue-a', sqon: built.sqon, fields: ['analysis_id'] },
		});
		assert.ok(!result.isError, `execute_query rejected a built SQON: ${JSON.stringify(result)}`);
		const structured = result.structuredContent as ExecuteQueryStructured;

		// Ages are 34, 51, 62, 8, 45: everything at or below 40 survives the negation.
		assert.equal(structured.total, 2);
		assert.deepEqual((structured.hits ?? []).map((hit) => hit.analysis_id).sort(), ['a-001', 'a-004']);
	});

	test('19.a built SQON runs against the catalogue it was built for in multi-catalogue mode', async () => {
		const built = getStructured(
			await callBuildSqon(getClient(), {
				catalogueId: 'catalogue-b',
				combination: 'and',
				clauses: [{ fieldName: 'sample_id', operator: 'in', value: ['b-001'] }],
			}),
		);

		const result = await getClient().callTool({
			name: 'execute_query',
			arguments: { catalogueId: 'catalogue-b', sqon: built.sqon, fields: ['sample_id'] },
		});
		assert.ok(!result.isError, `execute_query rejected a built SQON: ${JSON.stringify(result)}`);
		const structured = result.structuredContent as ExecuteQueryStructured;

		assert.equal(structured.total, 1);
		assert.deepEqual(
			(structured.hits ?? []).map((hit) => hit.sample_id),
			['b-001'],
		);
	});
};
