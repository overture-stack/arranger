import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';

import arrangerRouter, { buildSearchClient } from '../../../modules/graphql-router/src/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: process.env.ES_HOST || 'http://127.0.0.1:9200',
	...(process.env.ES_PASS && process.env.ES_USER && { password: process.env.ES_PASS, username: process.env.ES_USER }),
});

const DOCUMENT_TYPE = 'record';
const RUN = randomUUID();
const ES_INDEX = `testing-json-fields-${RUN}`;
const SETS_INDEX = `testing-json-fields-sets-${RUN}`;

/** A value for a JSON field holding single-value lists at several depths, a list of several values, and a list of objects. */
const DETAILS = {
	labels: ['only'],
	notes: [{ tags: ['x'] }],
	panel: { codes: [7], studies: ['a', 'b'] },
};

const RECORDS = [{ details: DETAILS, name: 'p1' }];

/** A saved set's filter holding single-value lists at several depths, and a list of several values. */
const FILTER = {
	content: [
		{ content: { fieldName: 'name', value: ['p1'] }, op: 'in' },
		{
			content: [
				{ content: { fieldName: 'name', value: ['p2'] }, op: 'in' },
				{ content: { fieldName: 'name', value: ['p1', 'p3'] }, op: 'in' },
			],
			op: 'or',
		},
	],
	op: 'and',
};

suite('a field the schema types as JSON is served whole, as stored', () => {
	let base = '';
	let server: Server | undefined;

	before(async () => {
		await esClient.indices.create({
			body: {
				mappings: { properties: { details: { enabled: false, type: 'object' }, name: { type: 'keyword' } } },
			},
			index: ES_INDEX,
		});
		const { body: indexed } = await esClient.bulk({
			body: RECORDS.flatMap((record) => [{ index: { _id: record.name, _index: ES_INDEX } }, record]),
			refresh: true,
		});
		assert.equal(indexed.errors, false, JSON.stringify(indexed.items));

		const router = await arrangerRouter({
			configs: { documentType: DOCUMENT_TYPE, enableSets: true, esIndex: ES_INDEX, sets: { index: SETS_INDEX } },
			esClient,
		});
		server = express().use(router).listen(0, '127.0.0.1');
		await new Promise((resolve) => server?.once('listening', resolve));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	after(async () => {
		await new Promise((resolve) => (server ? server.close(() => resolve(undefined)) : resolve(undefined)));
		await Promise.all(
			[ES_INDEX, SETS_INDEX].map((index) => esClient.indices.delete({ index }).catch(() => undefined)),
		);
	});

	test("serves a catalogue's JSON field whole, single-value lists at every depth included", async () => {
		const { data } = await axios.post(`${base}/graphql`, {
			query: `{ ${DOCUMENT_TYPE} { hits { edges { node { name details } } } } }`,
		});

		assert.deepEqual(data, {
			data: { [DOCUMENT_TYPE]: { hits: { edges: [{ node: { details: DETAILS, name: 'p1' } }] } } },
		});
	});

	test("serves a saved set's filter through the sets connection exactly as saved", async () => {
		// Given a set saved for a filter holding single-value lists at several depths
		const { data: saved } = await axios.post(`${base}/graphql`, {
			query: `mutation ($sqon: JSON!) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "name") { setId } }`,
			variables: { sqon: FILTER },
		});
		assert.equal(saved.errors, undefined, JSON.stringify(saved.errors));
		const { setId } = saved.data.saveSet;

		// When it is read back through the sets connection
		const { data } = await axios.post(`${base}/graphql`, {
			query: 'query ($filters: JSON) { sets { hits(filters: $filters) { edges { node { setId sqon } } } } }',
			variables: { filters: { content: { fieldName: 'setId', value: [setId] }, op: 'in' } },
		});

		// Then its filter is the one saved
		assert.deepEqual(data, { data: { sets: { hits: { edges: [{ node: { setId, sqon: FILTER } }] } } } });
	});
});
