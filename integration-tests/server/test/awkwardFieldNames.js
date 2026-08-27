import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { print } from 'graphql';
import gql from 'graphql-tag';
import { orderBy } from 'lodash-es';

/**
 * Fields whose raw Elasticsearch names GraphQL disallows are exposed under sanitized names, so a
 * resolver has to translate back to the raw path before it queries Elasticsearch. These assert on
 * the returned **values**, never on whether the field resolved: a resolver that sends the sanitized
 * name to Elasticsearch still answers, it just answers `null` for hits and an empty bucket list for
 * aggregations, which a resolution-only assertion accepts.
 *
 * Nothing here touches the query Arranger builds. The response shape comes from the schema, which
 * a translation fix does not change, so these keep their meaning across any fix that makes them
 * pass.
 *
 * Fixture (`model_centric_1`): `ca19-9` carries a hyphen, `2020_baseline` opens with a digit, and
 * `qc-metrics.batch-id` carries one in both an object and its leaf.
 */
export default ({ api, documentType }) => {
	const targetModel = 'HCM-TOHI-1111-A03';

	suite('fields whose raw names GraphQL disallows', () => {
		test('1.hits resolve to their stored values, not null', async () => {
			const { data } = await api
				.post({
					body: {
						query: print(gql`
							{
								${documentType} {
									hits(
										filters: {
											op: "and"
											content: [{ op: "in", content: { fieldName: "name", value: "${targetModel}" } }]
										}
									) {
										edges {
											node {
												ca19_9
												_2020_baseline
												qc_metrics {
													batch_id
												}
											}
										}
									}
								}
							}
						`),
					},
				})
				.catch((err) => {
					console.log('awkwardFieldNames/hits error', err.message || err);
				});

			const node = data?.data?.[documentType]?.hits?.edges?.[0]?.node;

			assert.equal(node?.ca19_9, 'negative');
			assert.equal(node?._2020_baseline, 'yes');
			assert.equal(node?.qc_metrics?.batch_id, 'B-18');
		});

		test('2.a SQON filter addresses the field by its raw name, not its GraphQL one', async () => {
			// SQON travels as an argument value rather than as part of the selection set, so it is
			// never sanitized and the raw name is what a caller sends. Asserted because "filtering is
			// unaffected" is the kind of claim that stays true only until something starts
			// translating argument values too.
			const { data } = await api
				.post({
					body: {
						query: print(gql`
							{
								${documentType} {
									hits(
										filters: {
											op: "and"
											content: [{ op: "in", content: { fieldName: "ca19-9", value: "positive" } }]
										}
									) {
										total
									}
								}
							}
						`),
					},
				})
				.catch((err) => {
					console.log('awkwardFieldNames/sqon error', err.message || err);
				});

			assert.equal(data?.data?.[documentType]?.hits?.total, 2);
		});

		test('3.aggregations bucket by the stored values, not an empty list', async () => {
			const { data } = await api
				.post({
					body: {
						query: print(gql`
							{
								${documentType} {
									aggregations {
										ca19_9 {
											buckets {
												doc_count
												key
											}
										}
										qc_metrics__batch_id {
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
					console.log('awkwardFieldNames/aggregations error', err.message || err);
				});

			const aggregations = data?.data?.[documentType]?.aggregations;

			// Counts are over three documents, not the four records in the fixture: the first two
			// share an `_id`, so the second overwrites the first at index time. The same reason
			// `readAggregation` expects two `Stage I` documents where three records carry it.
			assert.deepEqual(orderBy(aggregations?.ca19_9?.buckets, 'key'), [
				{ doc_count: 1, key: 'negative' },
				{ doc_count: 2, key: 'positive' },
			]);
			assert.deepEqual(orderBy(aggregations?.qc_metrics__batch_id?.buckets, 'key'), [
				{ doc_count: 1, key: 'B-17' },
				{ doc_count: 2, key: 'B-18' },
			]);
		});
	});
};
