import arrangerRouter, { addContext } from '@overture-stack/arranger-graphql-router';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import morgan from 'morgan';

import loadAllConfigs from './configs/index.js';

const arrangerServer = async (rootPath = '') => {
	console.log('------------------------------------');
	console.log('Starting Arranger Server\n');
	console.log('------------------------------------');

	const { catalogs, enableDebug, enableLogs, pingPath, port } = await loadAllConfigs({
		rootPath,
	});

	enableLogs &&
		console.log(`    Extensive console logging enabled${enableDebug ? ' (everything but health checks)' : ''}.`);

	console.log('\n  Success!');

	// TODO: this would be a good point to log out whether the server will run as multicatalog or single

	const app = express();
	// TODO: get allowed cors by env
	// if enableCors
	app.use(cors());
	app.use(json({ limit: '50mb' }));
	app.use(urlencoded({ extended: false, limit: '50mb' }));

	app.use(
		morgan('dev', {
			skip: (req, res) => {
				// log everything on debug mode. errors only otherwise
				return enableDebug || enableLogs ? req.originalUrl.includes(pingPath) : res.statusCode < 400;
			},
		}),
	);

	app.get(pingPath, (_req, res) => res.send({ message: 'Reporting for duty...' }));
	app.use(
		'/',
		addContext({
			enableDebug,
		}),
	);

	// TODO: extend this for other catalogs
	const catalogId = Object.keys(catalogs)[0] as string;

	const router = await arrangerRouter({
		configs: {
			enableDebug,
			...catalogs[catalogId],
		},
	});

	app.use(router);

	const server = app.listen(port, () => {
		const message = `⚡️⚡️⚡️ Listening on port ${port} ⚡️⚡️⚡️`;
		const line = '-'.repeat(message.length);

		console.info(`\n${line}`);
		console.log(message);
		console.info(`${line}\n`);

		if (enableDebug) {
			console.log(`URL: http://localhost:${port}\n`);
		}
	});

	server.on('error', (err: NodeJS.ErrnoException) => {
		console.log('\n\n------------------------------------');
		console.log('\nEnding server due to an error:');
		console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : err);

		process.exit(1);
	});
};

export default arrangerServer;
