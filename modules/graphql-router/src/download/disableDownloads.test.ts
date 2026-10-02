import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import express from 'express';
import request from 'supertest';

import refuseDisabledDownloads from './disableDownloads.js';

const appWithDownloadsDisabled = () => {
	const app = express();
	app.use('/download', refuseDisabledDownloads());
	return app;
};

suite('download/disableDownloads', () => {
	test('refuses a download request with 404', async () => {
		const response = await request(appWithDownloadsDisabled()).post('/download');

		assert.equal(response.status, 404);
		assert.deepEqual(response.body, { error: 'Downloads are disabled for this server.' });
	});

	test('refuses every method, not only the one the real route serves', async () => {
		const app = appWithDownloadsDisabled();

		for (const status of await Promise.all(
			[request(app).get('/download'), request(app).put('/download'), request(app).delete('/download')].map(
				async (pending) => (await pending).status,
			),
		)) {
			assert.equal(status, 404);
		}
	});

	test('refuses paths beneath the mount, so no sub-route escapes the flag', async () => {
		const response = await request(appWithDownloadsDisabled()).post('/download/anything/deeper');

		assert.equal(response.status, 404);
	});

	test('answers 404 rather than 403, which stays reserved for a caller-specific refusal', async () => {
		const response = await request(appWithDownloadsDisabled()).post('/download');

		assert.notEqual(response.status, 403);
	});
});
