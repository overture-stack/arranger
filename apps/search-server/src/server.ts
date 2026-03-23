import { addContext } from '@overture-stack/arranger-graphql-router/utils';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import morgan from 'morgan';
// TODO: add winston in module and import here

import arrangerRoutes from '#arrangerRoutes.js';
import loadAllConfigs from '#configs/index.js';
import type { ExternalConfigs } from '#configs/types/index.js';

// TODO: add JSDocs for this param. not sure why anyone could benefit,
// from this, but it helps for testing, so please don't take it away.
const arrangerServer = async ({ esClient, ...externalConfigs }: ExternalConfigs) => {
	console.log('------------------------------------');
	console.log('Starting Arranger Server\n');
	console.log('------------------------------------');

	const { catalogs, enableDebug, enableLogs, health, serverPort } = await loadAllConfigs(externalConfigs);

	enableLogs &&
		console.log(`    Extensive console logging enabled${enableDebug ? ' (everything but health checks)' : ''}.`);
	// TODO: this would also be a good point to log out whether the server will run as multicatalog or single

	console.log('\n  Success!');


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
				return enableDebug || enableLogs
					? [health.pingPath].some((endpoint) => req.originalUrl.includes(endpoint))
					: res.statusCode < 400;
			},
		}),
	);

	app.get(health.pingPath, (_req, res) => res.send({ message: 'Reporting for duty...' }));
	app.use(
		'/',
		addContext({
			enableDebug,
		}),
	);

	app.use('/', await arrangerRoutes({ catalogs, enableDebug, esClient }));

	const server = app.listen(serverPort, () => {
		const message = `⚡️⚡️⚡️ Listening on port ${serverPort} ⚡️⚡️⚡️`;
		const line = '-'.repeat(message.length);

		console.info(`\n${line}`);
		console.log(message);
		console.info(`${line}\n`);

		if (enableDebug) {
			console.log(`URL: http://localhost:${serverPort}\n`);
		}
	});

	server.on('error', (err: NodeJS.ErrnoException) => {
		console.log('\n\n------------------------------------');
		console.log('\nEnding server due to an error:');
		console.error(err.code === 'EADDRINUSE' ? `Port ${serverPort} is already in use.` : err);

		process.exit(1);
	});

	return server;
};

export default arrangerServer;
