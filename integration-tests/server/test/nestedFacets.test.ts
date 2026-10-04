import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';

import arrangerRouter, { buildSearchClient } from '../../../modules/graphql-router/src/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esPass = process.env.ES_PASS;
const esUser = process.env.ES_USER;

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: esHost,
	...(esPass && esUser && { password: esPass, username: esUser }),
});

type Sqon = Record<string, unknown>;

const DOCUMENT_TYPE = 'record';
const FIELDS = {
	donors: {
		properties: {
			donor_id: { type: 'keyword' },
			sex: { type: 'keyword' },
			specimens: { properties: { tissue: { type: 'keyword' } }, type: 'nested' },
		},
		type: 'nested',
	},
	name: { type: 'keyword' },
};

const donor = (donor_id: string, sex: string, ...tissues: string[]) => ({
	donor_id,
	sex,
	specimens: tissues.map((tissue) => ({ tissue })),
});

/** f5 holds a donor whose specimens are all Solid beside one with a Blood specimen, so the two levels give different answers. */
const RECORDS = [
	{ donors: [donor('D1', 'female', 'Solid')], name: 'f1' },
	{ donors: [donor('D2', 'male', 'Blood')], name: 'f2' },
	{ donors: [donor('D1', 'female', 'Blood', 'Solid'), donor('D3', 'male', 'Blood')], name: 'f3' },
	{ donors: [donor('D4', 'female', 'Solid')], name: 'f4' },
	{ donors: [donor('D5', 'male', 'Solid'), donor('D6', 'female', 'Blood')], name: 'f5' },
];

/** One index stores the records at the top level, the other under a prefix the router is told to strip. */
const LAYOUTS = [
	{
		description: 'an index with no nesting prefix',
		document: (record: object) => record,
		esIndex: 'testing-nested-facets',
		mappings: { mappings: { properties: FIELDS } },
		nestingPrefix: undefined,
	},
	{
		description: 'an index whose documents sit under a nesting prefix',
		document: (record: object) => ({ data: record }),
		esIndex: 'testing-nested-facets-prefixed',
		mappings: { mappings: { properties: { data: { properties: FIELDS } } } },
		nestingPrefix: 'data',
	},
];

const clause = (op: string, fieldName: string, value: string[]): Sqon => ({
	content: [{ content: { fieldName, value }, op }],
	op: 'and',
});

const FACETS = ['donors__donor_id', 'donors__specimens__tissue'];

/** The records a filter matches, and each facet's buckets as `key:count`, failing on any GraphQL error. */
const answerTo = async (url: string, filters: Sqon, filterThemselves: boolean) => {
	const selection = FACETS.map((facet) => `${facet} { buckets { key doc_count } }`).join(' ');
	const { data } = await axios.post(url, {
		query: `query ($filters: JSON, $themselves: Boolean) { ${DOCUMENT_TYPE} { hits(first: 100, filters: $filters) { edges { node { name } } } aggregations(filters: $filters, aggregations_filter_themselves: $themselves) { ${selection} } } }`,
		variables: { filters, themselves: filterThemselves },
	});

	assert.equal(data.errors, undefined, JSON.stringify(data.errors));

	const { aggregations, hits } = data.data[DOCUMENT_TYPE];
	const bucketsOf = (facet: string) =>
		aggregations[facet].buckets
			.map(({ doc_count, key }: { doc_count: number; key: string }) => `${key}:${doc_count}`)
			.sort();

	return {
		donors: bucketsOf('donors__donor_id'),
		hits: hits.edges.map(({ node }: { node: { name: string } }) => node.name).sort(),
		tissues: bucketsOf('donors__specimens__tissue'),
	};
};

/** The answers a case checks, by name; a case leaves out a facet its filter says nothing about. */
type Expected = Partial<Awaited<ReturnType<typeof answerTo>>>;

/**
 * Each case: a filter, and what hits and the facets answer to it. A donor facet counts, per donor, the
 * records holding that donor where the donor itself meets every clause on its own level or below.
 */
const CASES: [string, Sqon, (filterThemselves: boolean) => Expected][] = [
	[
		'an in on the specimens counts the donors holding a matching specimen',
		clause('in', 'donors.specimens.tissue', ['Solid']),
		() => ({ donors: ['D1:2', 'D4:1', 'D5:1'], hits: ['f1', 'f3', 'f4', 'f5'] }),
	],
	[
		'a not-in on the specimens counts the donors holding a specimen outside the list',
		clause('not-in', 'donors.specimens.tissue', ['Solid']),
		() => ({ donors: ['D1:1', 'D2:1', 'D3:1', 'D6:1'], hits: ['f2', 'f3', 'f5'] }),
	],
	[
		'a clause on the donors themselves counts the donors meeting it',
		clause('in', 'donors.sex', ['female']),
		() => ({ donors: ['D1:2', 'D4:1', 'D6:1'], hits: ['f1', 'f3', 'f4', 'f5'] }),
	],
	[
		'a clause outside the donors counts every donor of the matching records',
		clause('in', 'name', ['f3']),
		() => ({ donors: ['D1:1', 'D3:1'], hits: ['f3'] }),
	],
	[
		'a facet on the specimens counts the matching specimens, or every specimen when the facet ignores its own field',
		clause('in', 'donors.specimens.tissue', ['Solid']),
		(filterThemselves) => ({
			hits: ['f1', 'f3', 'f4', 'f5'],
			tissues: filterThemselves ? ['Solid:4'] : ['Blood:3', 'Solid:4'],
		}),
	],
];

for (const layout of LAYOUTS) {
	suite(
		`a facet on a nested field applies each clause at its own level, on ${layout.description}`,
		{ concurrency: false },
		() => {
			let server: Server;
			let url: string;

			before(async () => {
				await esClient.indices.delete({ index: layout.esIndex }).catch(() => undefined);
				await esClient.indices.create({ body: layout.mappings, index: layout.esIndex });
				await Promise.all(
					RECORDS.map((record) =>
						esClient.index({
							body: layout.document(record),
							id: record.name,
							index: layout.esIndex,
							refresh: 'wait_for',
						}),
					),
				);

				const router = await arrangerRouter({
					configs: {
						documentType: DOCUMENT_TYPE,
						esIndex: layout.esIndex,
						...(layout.nestingPrefix && { nestingPrefix: layout.nestingPrefix }),
					},
					esClient,
				});
				server = express().use(router).listen(0, '127.0.0.1');
				await new Promise((resolve) => server.once('listening', resolve));
				url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`;
			});

			after(async () => {
				server?.close();
				await esClient.indices.delete({ index: layout.esIndex }).catch(() => undefined);
			});

			for (const [description, filters, expectedFor] of CASES) {
				for (const filterThemselves of [false, true]) {
					test(`${description}, filtering themselves ${filterThemselves}`, async () => {
						// Given records whose donors and specimens fall on both sides of the filter
						// When hits and the facets answer it
						const answer = await answerTo(url, filters, filterThemselves);

						// Then each facet counts what the filter selects at the facet's own level
						const expected = expectedFor(filterThemselves);
						const checked = Object.keys(expected) as (keyof typeof answer)[];
						assert.deepEqual(Object.fromEntries(checked.map((name) => [name, answer[name]])), expected);
					});
				}
			}
		},
	);
}
