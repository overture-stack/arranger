import assert from 'node:assert/strict';
import { test } from 'node:test';

import { print } from 'graphql';
import gql from 'graphql-tag';

/** A document the suites' server-side filter excludes: one marked access_denied. Every other one is permitted. */
const isDenied = ({ _source }) => _source.access_denied === true;
const sortedNamesOf = (documents) => documents.map(({ _source }) => _source.name).sort();

/**
 * Guards the precondition every access-control assertion here rests on: a denied document exists,
 * under an `_id` no other document shares. Indexing keys on `_id`, so a shared one is overwritten
 * and the filter has nothing to exclude, which lets an exclusion assertion pass with no filter.
 */
const deniedDocumentsIn = (documents) => {
	const deniedDocuments = documents.filter(isDenied);

	assert.ok(deniedDocuments.length > 0, 'the fixture must hold a denied document for these tests to exclude');
	for (const denied of deniedDocuments) {
		assert.equal(
			documents.filter(({ _id }) => _id === denied._id).length,
			1,
			`the denied document ${denied._source.name} needs an _id of its own, or indexing overwrites it`,
		);
	}

	return deniedDocuments;
};

const queryHitNames = async ({ api, documentType, gqlPath, sqon }) => {
	const { data } = await api.post({
		endpoint: gqlPath,
		body: {
			variables: { sqon },
			query: print(gql`
				query ($sqon: JSON) {
					${documentType} {
						hits(first: 1000, filters: $sqon) {
							edges {
								node {
									name
								}
							}
							total
						}
					}
				}
			`),
		},
	});

	assert.equal(data.errors, undefined, `expected no GraphQL errors, got ${JSON.stringify(data.errors)}`);

	const { edges, total } = data.data[documentType].hits;

	return { names: edges.map(({ node }) => node.name).sort(), total };
};

/** For a server started with no filter at all: the denied document is an ordinary one. */
export const readSearchDataWithoutAccessControl = ({ api, documentType, documents, gqlPath }) => {
	test('1.returns every stored document, the denied one included, when no filter is configured', async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When every hit is requested with no client filter
		const { names, total } = await queryHitNames({ api, documentType, gqlPath, sqon: null });

		// Then every stored document comes back, the denied one with them
		assert.deepEqual(names, sortedNamesOf(documents));
		assert.equal(total, documents.length);
	});
};

export default ({ api, documentType, documents, gqlPath }) => {
	test('1.reads hits with sqon properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							hits(
								filters: {
									content: [
										{
											content: {
												fieldName: "clinical_diagnosis.clinical_stage_grouping",
												value: "Stage I"
											}
											op: "in",
										}
									]
									op: "and",
								}
							) {
								edges {
									node {
										id
									}
								}
								total
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readSearchData/hits sqon error', err.message || err);
			});

		assert.deepEqual(data, {
			data: {
				[documentType]: {
					hits: {
						edges: [
							{ node: { id: 'sagsdhertdfdgsdfgsdfg' } },
							{ node: { id: '5da62fbad545d210fe1c63a9' } },
						],
						total: 2,
					},
				},
			},
		});
	});

	test('2.paginates hits properly', async () => {
		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 1, offset: 0) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData/hits first error', err.message || err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: 'sagsdhertdfdgsdfgsdfg',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);

		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 1, offset: 1) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData/hist second error', err.message || err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: '5da62fbad545d210fe1c63a9',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);

		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 2, offset: 0) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData/hist first two error', err.message || err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: 'sagsdhertdfdgsdfgsdfg',
									},
								},
								{
									node: {
										id: '5da62fbad545d210fe1c63a9',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);

		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 2, offset: 1) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData/hits second two error', err.message || err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: '5da62fbad545d210fe1c63a9',
									},
								},
								{
									node: {
										id: '5dc9b6c3d614630f9809f7d0',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);
	});

	// depends on serverSideFilters passed at tests setup
	// TODO: leverage for Controlled Access
	test('3.returns exactly the documents the server-side filter permits, never the denied one', async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When every hit is requested with no client filter
		const { names, total } = await queryHitNames({ api, documentType, gqlPath, sqon: null });

		// Then exactly the permitted documents come back, so a dropped filter adds the denied one
		const permittedDocuments = documents.filter((document) => !isDenied(document));
		assert.deepEqual(names, sortedNamesOf(permittedDocuments));
		assert.equal(total, permittedDocuments.length);
	});

	test('4.cannot request for access_denied item', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					variables: {
						sqon: {
							content: [
								{
									content: {
										fieldName: 'access_denied',
										value: ['true'],
									},
									op: 'in',
								},
							],
							op: 'and',
						},
					},
					query: print(gql`
					query ($sqon: JSON) {
						${documentType} {
							hits(first: 1000, filters: $sqon) {
								edges {
									node {
										access_denied
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readSearchData/zero access denied error', err.message || err);
			});

		assert.deepEqual(data?.data?.[documentType]?.hits?.edges?.length, 0);
	});

	test('5.a request naming the denied document beside a permitted one returns only the permitted one', async () => {
		// Given the denied document and one permitted document from the fixture
		const [denied] = deniedDocumentsIn(documents);
		const permitted = documents.find((document) => !isDenied(document));

		// When the client names both
		const { names, total } = await queryHitNames({
			api,
			documentType,
			gqlPath,
			sqon: {
				content: [
					{ content: { fieldName: 'name', value: [denied._source.name, permitted._source.name] }, op: 'in' },
				],
				op: 'and',
			},
		});

		// Then only the permitted one comes back: the client's sqon narrowed, and the filter still applied
		assert.deepEqual(names, [permitted._source.name]);
		assert.equal(total, 1);
	});
};
