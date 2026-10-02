import assert from 'node:assert/strict';
import { test } from 'node:test';

import { print } from 'graphql';
import gql from 'graphql-tag';
import { orderBy } from 'lodash-es';

const isDenied = ({ _source }) => _source.access_denied === true;

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

/**
 * The `access_denied` buckets a correct aggregation over `documents` returns with missing values
 * left out: one bucket per stored boolean, counted. Derived from the fixture rather than written
 * out, so the expectation follows the documents a server is meant to count.
 */
const accessDeniedBucketsOf = (documents) =>
	orderBy(
		Object.entries(
			documents
				.map(({ _source }) => _source.access_denied)
				.filter((value) => typeof value === 'boolean')
				.reduce((counts, value) => ({ ...counts, [String(value)]: (counts[String(value)] ?? 0) + 1 }), {}),
		).map(([keyAsString, docCount]) => ({ doc_count: docCount, key_as_string: keyAsString })),
		'key_as_string',
	);

const queryAccessDeniedBuckets = async ({ aggregationsFilterThemselves, api, documentType, sqon }) => {
	const { data } = await api.post({
		body: {
			variables: { aggregationsFilterThemselves, sqon },
			query: print(gql`
				query ($sqon: JSON, $aggregationsFilterThemselves: Boolean) {
					${documentType} {
						aggregations(
							aggregations_filter_themselves: $aggregationsFilterThemselves
							filters: $sqon
							include_missing: false
						) {
							access_denied {
								buckets {
									doc_count
									key_as_string
								}
							}
						}
					}
				}
			`),
		},
	});

	assert.equal(data.errors, undefined, `expected no GraphQL errors, got ${JSON.stringify(data.errors)}`);

	return orderBy(data.data[documentType].aggregations.access_denied.buckets, 'key_as_string');
};

/** For a server started with no filter at all: the denied document is counted like any other. */
export const readAggregationWithoutAccessControl = ({ api, documentType, documents }) => {
	test('1.counts the denied document when no filter is configured', async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When the access_denied facet is aggregated with no client filter
		const buckets = await queryAccessDeniedBuckets({
			aggregationsFilterThemselves: true,
			api,
			documentType,
			sqon: null,
		});

		// Then the denied document is counted beside the permitted ones
		assert.deepEqual(buckets, accessDeniedBucketsOf(documents));
	});
};

export default async ({ api, documentType, documents }) => {
	const expectedBuckets = [
		{
			doc_count: 2,
			key: 'Stage I',
		},
	];

	test('1.reads aggregations properly', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation/read all error', err.message || err);
			});

		assert.deepEqual(
			data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping.buckets,
			expectedBuckets.concat([
				{
					doc_count: 1,
					key: '__missing__',
				},
			]),
		);
	});

	test('2.reads aggregations with sqon properly', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								filters: {
									content: [
										{
											content: {
												fieldName: "clinical_diagnosis.clinical_stage_grouping",
												value: "Stage I"
											},
											op: "in",
										}
									],
									op: "and",
								},
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation/read sqon error', err.message || err);
			});

		assert.deepEqual(
			orderBy(data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping.buckets, 'key'),
			expectedBuckets,
		);
	});

	test('3.should work with prefix filter sqon', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								filters: {
									content: [
										{
											content: {
												fieldNames: [
													"name",
													"primary_site",
													"clinical_diagnosis.clinical_tumor_diagnosis",
													"gender",
													"race"
												]
												value: "Colorectal*"
											}
											op: "filter"
										}
									]
									op: "and"
								},
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation/read sqon prefix error', err.message || err);
			});

		assert.deepEqual(
			orderBy(data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping.buckets, 'key'),
			expectedBuckets,
		);
	});

	test('4.should work with suffix filter sqon', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								filters: {
									content: [
										{
											content: {
												fieldNames: [
													"name",
													"primary_site",
													"clinical_diagnosis.clinical_tumor_diagnosis",
													"gender",
													"race"
												],
												value: "*cancer"
											}
											op: "filter",
										}
									],
									op: "and",
								},
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation/ read sqon suffix error', err.message || err);
			});

		assert.deepEqual(
			orderBy(data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping.buckets, 'key'),
			expectedBuckets,
		);
	});

	test('5.should work with pre and suffix filter sqon', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								filters: {
									content: [
										{
											content: {
												fieldNames: [
													"name",
													"primary_site",
													"clinical_diagnosis.clinical_tumor_diagnosis",
													"gender",
													"race"
												],
												value: "*SOMEONE*"
											}
											op: "filter"
										}
									]
									op: "and"
								},
								aggregations_filter_themselves: true
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation/read sqon wildcard error', err.message || err);
			});

		assert.deepEqual(
			orderBy(data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping.buckets, 'key'),
			expectedBuckets,
		);
	});

	test('6.should count the correct number of buckets', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
							) {
								clinical_diagnosis__clinical_stage_grouping {
									bucket_count
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation/count buckets error', err.message || err);
			});

		assert.deepEqual(
			data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping.bucket_count,
			2,
		);
	});

	test('7.should ignore buckets with key "MISSING" when include_missing=false', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								include_missing: false
							) {
								clinical_diagnosis__histological_type {
									bucket_count
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err.message || err);
			});

		assert.deepEqual(data.data[documentType].aggregations.clinical_diagnosis__histological_type.bucket_count, 0);
	});

	test('8.should count buckets with key "MISSING" when include_missing is defaulted to true', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
							) {
								clinical_diagnosis__histological_type {
									bucket_count
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation/count buckets & missing error', err.message || err);
			});

		assert.deepEqual(data.data[documentType].aggregations.clinical_diagnosis__histological_type.bucket_count, 1);
	});

	test("9.does not count the denied document in its own field's facet when the facet filters itself", async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When the access_denied facet is aggregated with no client filter
		const buckets = await queryAccessDeniedBuckets({
			aggregationsFilterThemselves: true,
			api,
			documentType,
			sqon: null,
		});

		// Then only the permitted documents are counted
		assert.deepEqual(buckets, accessDeniedBucketsOf(documents.filter((document) => !isDenied(document))));
	});

	// With aggregations_filter_themselves left false, a facet whose field the query constrains is
	// rebuilt as a global aggregation, which ignores the search query, and the filter's own field is
	// one such field. The access-control filter has to be restated inside that aggregation.
	test('10.does not count the denied document in a facet rebuilt as a global aggregation', async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When the access_denied facet is aggregated without filtering itself
		const buckets = await queryAccessDeniedBuckets({
			aggregationsFilterThemselves: false,
			api,
			documentType,
			sqon: null,
		});

		// Then only the permitted documents are counted
		assert.deepEqual(buckets, accessDeniedBucketsOf(documents.filter((document) => !isDenied(document))));
	});

	test('11.does not count the denied document when the client filters on the denied value itself', async () => {
		// Given the fixture, which stores a denied document under its own _id
		deniedDocumentsIn(documents);

		// When the client filters on access_denied true and the facet ignores its own field's filter
		const buckets = await queryAccessDeniedBuckets({
			aggregationsFilterThemselves: false,
			api,
			documentType,
			sqon: { content: [{ content: { fieldName: 'access_denied', value: ['true'] }, op: 'in' }], op: 'and' },
		});

		// Then the facet still counts only the permitted documents
		assert.deepEqual(buckets, accessDeniedBucketsOf(documents.filter((document) => !isDenied(document))));
	});
};
