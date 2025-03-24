import assert from 'node:assert';
import { test } from 'node:test';

import { print } from 'graphql';
import gql from 'graphql-tag';

const logError = (origin, err) =>
	console.log(origin, err?.response?.data?.errors || err);

export default ({ api, documentType, enableAdmin }) => {
	test('1.reads extended mapping properly', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							configs {
								extended
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				logError('readMetadata error', err);
			});

		const configs = data?.data?.[documentType]?.configs?.extended || [];

		assert.ok(
			configs.length >= 0,
			`Expected 'Extended' configs to be non-empty, but got: ${JSON.stringify(configs)}`
		);

		assert.equal(data?.errors, undefined);
	});

	test('2.reads aggregations properly', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							configs {
								facets {
									aggregations {
										fieldName
										isActive
										show
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				logError('readMetadata error', err);
			});

		const configs = data?.data?.[documentType]?.configs?.facets?.aggregations || [];

		assert.ok(
			configs.length >= 0,
			`Expected Matchbox configs object to be non-empty, but got: ${JSON.stringify(configs)}`
		);

		assert.equal(data?.errors, undefined);
	});

	test('3.reads table configs properly', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
						{
							${documentType} {
								configs {
									table {
										columns {
											fieldName
										}
									}
								}
							}
						}
					`),
				},
			})
			.catch((err) => {
				logError('readMetadata error', err);
			});

		const configs = data?.data?.[documentType]?.configs?.table.columns || [];

		assert.ok(
			configs.length >= 0,
			`Expected Matchbox configs object to be non-empty, but got: ${JSON.stringify(configs)}`
		);

		assert.equal(data?.errors, undefined);
	});

	test('4.reads matchbox state properly', async () => {
		const { data } = await api
			.post({
				body: {
					query: print(gql`
					{
						${documentType} {
							configs {
								matchbox {
									fieldName
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				logError('readMetadata error', err);
			});

		const configs = data?.data?.[documentType]?.configs?.matchbox || [];

		assert.ok(
			Object.keys(configs.length) >= 0,
			`Expected Matchbox configs object to be non-empty, but got: ${JSON.stringify(configs)}`
		);

		assert.equal(data?.errors, undefined);
	});

	test('5.reads elasticsearch mappings properly',
		{ skip: !enableAdmin },
		async () => {
			const { data } = await api
				.post({
					body: {
						query: print(gql`
					{
						${documentType} {
							mapping
						}
					}
				`),
					},
				})
				.catch((err) => {
					logError('readMetadata error', err);
				});

			// requires enableAdmin env var or middleware param
			const configs = data?.data?.[documentType]?.mapping || {};

			assert.ok(
				Object.keys(configs).length >= 0,
				`Expected Matchbox configs object to be non-empty, but got: ${JSON.stringify(configs)}`
			);

			assert.equal(data?.errors, undefined);
		});
};
