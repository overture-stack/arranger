import assert from 'node:assert';
import { test } from 'node:test';

export default ({ api }) => {
	test("1.should register a '/ping' endpoint", async () => {
		const { statusText } = await api
			.get({
				endpoint: '/ping',
			})
			.catch((err) => {
				console.log('spinupActive error', err);
			});

		assert.equal(statusText, 'OK');
	});

	test("2.should register a '/graphql' endpoint", async () => {
		const { statusText } = await api
			.post({
				body: {
					query: `{ __schema { queryType { name } } }`
				}
			})
			.catch((err) => {
				console.log('spinupActive error', err);
			});

		assert.equal(statusText, 'OK');
	});
};
