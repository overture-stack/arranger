import assert from 'node:assert';
import { test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { ElicitRequestSchema, type ElicitRequest, type ElicitResult } from '@modelcontextprotocol/sdk/types';

export type ExecuteQueryEnv = {
	getClient: () => Client;
	getServerUrl: () => string;
};

const EMPTY_ROOT_SQON = { op: 'and', content: [] };

type AggregationBucket = { key: string; doc_count: number };
type AggregationValue = {
	bucket_count?: number;
	buckets?: AggregationBucket[];
	stats?: { min: number; max: number; avg: number; sum: number; count: number };
};

/** The structured output shape declared by the execute-query tool. */
type ExecuteQueryStructured = {
	catalogueId: string;
	documentType: string;
	queryType: string;
	executed: boolean;
	endpoint: string;
	total?: number;
	hits?: Record<string, unknown>[];
	aggregations?: Record<string, AggregationValue>;
	message?: string;
};

const callExecuteQuery = (mcpClient: Client, args: Record<string, unknown>) =>
	mcpClient.callTool({ name: 'execute-query', arguments: args });

const getStructured = (result: Awaited<ReturnType<Client['callTool']>>): ExecuteQueryStructured => {
	assert.notEqual(result.isError, true, `tool call returned isError: ${JSON.stringify(result)}`);
	const structured = result.structuredContent as ExecuteQueryStructured | undefined;
	assert.ok(structured, 'expected execute-query to return structuredContent');
	return structured;
};

const getErrorText = (result: Awaited<ReturnType<Client['callTool']>>): string => {
	assert.equal(result.isError, true, `expected tool call to return isError, got: ${JSON.stringify(result)}`);
	const [first] = result.content as { type: string; text?: string }[];
	assert.ok(first, 'expected at least one content entry in error result');
	assert.equal(first.type, 'text');
	return first.text as string;
};

/**
 * Connects a second MCP client that advertises the elicitation capability, so the
 * execute-query tool's user-confirmation path runs (the shared suite client does not
 * advertise elicitation, so every other test takes the skip-confirmation path).
 */
const connectElicitingClient = async (
	serverUrl: string,
	handleElicit: (request: ElicitRequest) => ElicitResult,
): Promise<Client> => {
	const elicitingClient = new Client(
		{ name: 'arranger-mcp-server-integration-tests-eliciting', version: '0.0.0-test' },
		{ capabilities: { elicitation: {} } },
	);
	elicitingClient.setRequestHandler(ElicitRequestSchema, async (request) => handleElicit(request));
	await elicitingClient.connect(new StreamableHTTPClientTransport(new URL(serverUrl)));
	return elicitingClient;
};

// Dataset reference (test/assets/catalogue_a.data.json):
//   a-001 age 34 Alive | a-002 age 51 Deceased | a-003 age 62 Alive | a-004 age 8 Unknown | a-005 age 45 Deceased
export default ({ getClient, getServerUrl }: ExecuteQueryEnv) => {
	test('1.hits query with the empty root SQON returns every document, compacted to flat objects', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: EMPTY_ROOT_SQON,
			fields: ['analysis_id', 'age_at_diagnosis', 'vital_status'],
		});
		const structured = getStructured(result);

		assert.equal(structured.catalogueId, 'catalogue-a');
		assert.equal(structured.documentType, 'modelA');
		assert.equal(structured.queryType, 'hits');
		assert.equal(structured.executed, true);
		assert.equal(structured.endpoint, '/catalogue-a/graphql');
		assert.equal(structured.total, 5);
		assert.equal(structured.hits?.length, 5);

		for (const hit of structured.hits ?? []) {
			// No GraphQL edges/node nesting: each hit is the flat document itself.
			assert.deepEqual(Object.keys(hit).sort(), ['age_at_diagnosis', 'analysis_id', 'vital_status']);
		}

		// The text content mirrors the structured content.
		const [first] = result.content as { type: string; text?: string }[];
		assert.equal(first?.type, 'text');
		assert.deepEqual(JSON.parse(first?.text ?? ''), structured);
	});

	test("2.hits query with an 'in' filter clause returns only matching documents", async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: { op: 'in', content: { fieldName: 'vital_status', value: ['Deceased'] } },
			fields: ['analysis_id'],
		});
		const structured = getStructured(result);

		assert.equal(structured.total, 2);
		const ids = (structured.hits ?? []).map((hit) => hit.analysis_id).sort();
		assert.deepEqual(ids, ['a-002', 'a-005']);
	});

	test('3.hits query with a combination SQON applies all filter clauses', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: {
				op: 'and',
				content: [
					{ op: 'in', content: { fieldName: 'vital_status', value: ['Alive'] } },
					{ op: 'gt', content: { fieldName: 'age_at_diagnosis', value: 40 } },
				],
			},
			fields: ['analysis_id'],
		});
		const structured = getStructured(result);

		assert.equal(structured.total, 1);
		assert.deepEqual(
			(structured.hits ?? []).map((hit) => hit.analysis_id),
			['a-003'],
		);
	});

	test('4.omitting fields returns a count-only result without hits', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: EMPTY_ROOT_SQON,
		});
		const structured = getStructured(result);

		assert.equal(structured.total, 5);
		assert.ok(!('hits' in structured), 'expected no hits key on a count-only result');
		assert.ok(!('aggregations' in structured), 'expected no aggregations key on a hits query');
	});

	test('5.sort, first, and offset paginate the hits in order', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: EMPTY_ROOT_SQON,
			fields: ['analysis_id', 'age_at_diagnosis'],
			sort: [{ fieldName: 'age_at_diagnosis', order: 'asc' }],
			first: 2,
			offset: 1,
		});
		const structured = getStructured(result);

		// Ages ascending are 8, 34, 45, 51, 62: offset 1, first 2 selects 34 and 45.
		assert.equal(structured.total, 5);
		assert.deepEqual(
			(structured.hits ?? []).map((hit) => hit.analysis_id),
			['a-001', 'a-005'],
		);
	});

	test('6.aggregations query returns buckets for keyword fields and stats for numeric fields', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: EMPTY_ROOT_SQON,
			queryType: 'aggregations',
			aggregationFields: ['vital_status', 'age_at_diagnosis'],
		});
		const structured = getStructured(result);

		assert.equal(structured.queryType, 'aggregations');
		assert.ok(!('total' in structured), 'expected no total on an aggregations-only result');
		assert.ok(!('hits' in structured), 'expected no hits on an aggregations-only result');

		const vitalStatus = structured.aggregations?.vital_status;
		assert.ok(vitalStatus?.buckets, 'expected buckets for vital_status');
		assert.equal(vitalStatus.bucket_count, 3);
		const docCountsByKey = Object.fromEntries(vitalStatus.buckets.map((bucket) => [bucket.key, bucket.doc_count]));
		assert.deepEqual(docCountsByKey, { Alive: 2, Deceased: 2, Unknown: 1 });

		const ageStats = structured.aggregations?.age_at_diagnosis?.stats;
		assert.ok(ageStats, 'expected stats for age_at_diagnosis');
		assert.deepEqual(ageStats, { min: 8, max: 62, avg: 40, sum: 200, count: 5 });
	});

	test("7.queryType 'both' returns hits and aggregations narrowed by the same SQON", async () => {
		// The filter is wrapped in a combination root: Arranger's aggregations resolver
		// crashes on a SQON whose root is a leaf filter clause (see tech-debt).
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: { op: 'and', content: [{ op: 'gt', content: { fieldName: 'age_at_diagnosis', value: 40 } }] },
			queryType: 'both',
			fields: ['analysis_id'],
			aggregationFields: ['vital_status'],
		});
		const structured = getStructured(result);

		assert.equal(structured.queryType, 'both');
		assert.equal(structured.total, 3);
		assert.equal(structured.hits?.length, 3);

		const vitalStatus = structured.aggregations?.vital_status;
		assert.ok(vitalStatus?.buckets, 'expected buckets for vital_status');
		const docCountsByKey = Object.fromEntries(vitalStatus.buckets.map((bucket) => [bucket.key, bucket.doc_count]));
		assert.deepEqual(docCountsByKey, { Alive: 1, Deceased: 2 });
	});

	test('8.executes against the requested catalogue in multi-catalogue mode', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-b',
			sqon: EMPTY_ROOT_SQON,
			fields: ['sample_id'],
		});
		const structured = getStructured(result);

		assert.equal(structured.catalogueId, 'catalogue-b');
		assert.equal(structured.documentType, 'modelB');
		assert.equal(structured.endpoint, '/catalogue-b/graphql');
		assert.equal(structured.total, 2);
		const ids = (structured.hits ?? []).map((hit) => hit.sample_id).sort();
		assert.deepEqual(ids, ['b-001', 'b-002']);
	});

	test('9.unknown catalogue returns an error listing the available catalogues', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'this-catalogue-does-not-exist',
			sqon: EMPTY_ROOT_SQON,
		});
		const text = getErrorText(result);

		assert.match(text, /not configured/);
		assert.match(text, /catalogue-a/);
		assert.match(text, /catalogue-b/);
	});

	test("10.SQON referencing another catalogue's field fails validation for this catalogue", async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-b',
			sqon: { op: 'in', content: { fieldName: 'vital_status', value: ['Alive'] } },
			fields: ['sample_id'],
		});
		const text = getErrorText(result);

		assert.match(text, /unknown field "vital_status"/);
		assert.match(text, /get-catalogue-fields/);
	});

	test('11.SQON operator invalid for the field type fails validation', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: { op: 'gt', content: { fieldName: 'vital_status', value: 40 } },
			fields: ['analysis_id'],
		});
		const text = getErrorText(result);

		assert.match(text, /"gt" is not valid for field "vital_status"/);
	});

	test('12.missing SQON returns an error pointing at the empty root SQON', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			fields: ['analysis_id'],
		});
		const text = getErrorText(result);

		assert.match(text, /A SQON is required/);
	});

	test("13.queryType 'aggregations' without aggregationFields returns an error", async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: EMPTY_ROOT_SQON,
			queryType: 'aggregations',
		});
		const text = getErrorText(result);

		assert.match(text, /requires at least one entry in aggregationFields/);
	});

	test('14.declining the elicitation confirmation skips execution', async () => {
		const elicitMessages: string[] = [];
		const elicitingClient = await connectElicitingClient(getServerUrl(), (request) => {
			elicitMessages.push(request.params.message);
			return { action: 'decline' };
		});

		try {
			const result = await callExecuteQuery(elicitingClient, {
				catalogueId: 'catalogue-a',
				sqon: EMPTY_ROOT_SQON,
				fields: ['analysis_id'],
			});
			const structured = getStructured(result);

			assert.equal(elicitMessages.length, 1, 'expected exactly one elicitation request');
			assert.match(elicitMessages[0], /catalogue-a/);
			assert.match(elicitMessages[0], /ArrangerMcpExecuteQuery/);

			assert.equal(structured.executed, false);
			assert.ok(!('total' in structured), 'expected no query results when execution was declined');
			assert.match(structured.message ?? '', /declined/);
		} finally {
			await elicitingClient.close();
		}
	});

	test('15.accepting the elicitation confirmation executes the query', async () => {
		const elicitingClient = await connectElicitingClient(getServerUrl(), () => ({
			action: 'accept',
			content: { confirm: true },
		}));

		try {
			const result = await callExecuteQuery(elicitingClient, {
				catalogueId: 'catalogue-a',
				sqon: EMPTY_ROOT_SQON,
				fields: ['analysis_id'],
			});
			const structured = getStructured(result);

			assert.equal(structured.executed, true);
			assert.equal(structured.total, 5);
		} finally {
			await elicitingClient.close();
		}
	});

	test('16.hits query with a canonical wildcard clause matches case-insensitively', async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: { op: 'wildcard', content: { fieldNames: ['vital_status'], value: 'ali*' } },
			fields: ['analysis_id'],
		});
		const structured = getStructured(result);

		assert.equal(structured.total, 2);
		const ids = (structured.hits ?? []).map((hit) => hit.analysis_id).sort();
		assert.deepEqual(ids, ['a-001', 'a-003']);
	});

	test("17.hits query with the legacy 'filter' alias behaves as a wildcard clause", async () => {
		const result = await callExecuteQuery(getClient(), {
			catalogueId: 'catalogue-a',
			sqon: { op: 'filter', content: { fieldNames: ['vital_status'], value: 'ali*' } },
			fields: ['analysis_id'],
		});
		const structured = getStructured(result);

		assert.equal(structured.total, 2);
		const ids = (structured.hits ?? []).map((hit) => hit.analysis_id).sort();
		assert.deepEqual(ids, ['a-001', 'a-003']);
	});
};
