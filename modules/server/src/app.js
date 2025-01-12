import cors from 'cors';
import express, { json, urlencoded } from 'express';

import { ENV_CONFIG } from './config';
import arranger from './server';

const app = express();
app.use(cors());

export default async function (rootPath = '') {
	global.__basedir = rootPath;

	/**
	 * @param {boolean} enableAdmin
	 * @param {boolean} enabledDocumentHits - enables including "hits" property in the GQL response
	 */
	return arranger({
		enableAdmin: ENV_CONFIG.ENABLE_ADMIN,
		enableDocumentHits: ENV_CONFIG.ENABLE_DOCUMENT_HITS,
	}).then((router) => {
		app.use(router);

		app.use(urlencoded({ extended: false, limit: '50mb' }));
		app.use(json({ limit: '50mb' }));

		app.listen(ENV_CONFIG.PORT, async () => {
			const message = `⚡️⚡️⚡️ Listening on port ${ENV_CONFIG.PORT} ⚡️⚡️⚡️`;
			const line = '-'.repeat(message.length);

			console.info(`\n${line}`);
			console.log(message);
			console.info(`${line}\n`);
		});
	});
}
