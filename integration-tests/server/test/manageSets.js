import assert from 'node:assert';
import { test } from 'node:test';

import { print } from 'graphql';
import gql from 'graphql-tag';

export default ({ api, documentType }) => {
	let setId = undefined;

	test('1.creates set successfully', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
						mutation {
							newSet: saveSet(type: ${documentType}, path: "name", sqon: {}) {
								setId
							}
						}
					`),
				},
				// debug: true,
			})
			.catch((err) => {
				console.log('manageSets error', err);
			});

		assert.equal(data.errors, undefined);

		setId = data.data.newSet.setId;
	});

	test('2.retrieves newly created set successfully', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
						{
							sets {
								hits(first: 1000) {
									edges {
										node {
											setId
										}
									}
								}
							}
						}
					`),
				},
				// debug: true,
			})
			.catch((err) => {
				console.log('manageSets error', err);
			});

		assert.equal(data.errors, undefined);
		const allSetIds = data.data.sets.hits.edges.map(({ node }) => node.setId);

		assert.ok(
			allSetIds.includes(setId),
			`Expected [${allSetIds.join(', ')}] to include ${setId}`
		);
	});
};
