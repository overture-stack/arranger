import { addContext } from '@overture-stack/arranger-graphql-router/utils';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import morgan from 'morgan';
// TODO: add winston in module and import here

import arrangerRoutes from '#arrangerRoutes.js';
import loadAllConfigs from '#configs/index.js';
import type { ExternalConfigs } from '#configs/types/index.js';
import createIntrospectionRoutes from '#introspection/index.js';

// TODO: add JSDocs for this param. not sure why anyone could benefit,
// from this, but it helps for testing, so please don't take it away.
const arrangerServer = async ({ esClient, ...externalConfigs }: ExternalConfigs) => {
	console.log('------------------------------------');
	console.log('Starting Arranger Server\n');
	console.log('------------------------------------');

	try {
		const { allowedCorsOrigins, catalogs, enableDebug, enableLogs, health, serverPort } =
			await loadAllConfigs(externalConfigs);

		const catalogEntries = Object.entries(catalogs);
		const catalogMode = catalogEntries.length > 1 ? 'multiple' : 'single';

		catalogMode === 'single' || console.log(`  - Loaded ${catalogEntries.length} catalogs in ${catalogMode} mode`);

		enableDebug &&
			console.log(
				`    Catalog IDs: ${catalogEntries.map(([catalogId]) => catalogId).join(', ') || '(none found)'}`,
			);

		enableLogs &&
			console.log(
				`    Extensive console logging enabled${enableDebug ? ' (everything but health checks)' : ''}.`,
			);

		console.log('\n  Success!');

		const app = express();
		app.use(cors(allowedCorsOrigins?.length ? { origin: allowedCorsOrigins } : undefined));
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

		app.use(
			'/',
			addContext({
				enableDebug,
			}),
		);

		app.get(health.pingPath, (_req, res) => res.send({ message: 'Reporting for duty...' }));

		const { router: arrangerRouter, catalogueRouters } = await arrangerRoutes({ catalogs, enableDebug, esClient });

		app.use(createIntrospectionRoutes({ catalogs, catalogueRouters }));
		app.use('/', arrangerRouter);

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
	} catch (err) {
		console.error('\n------------------------------------');
		console.error('Could not start Arranger Server\n');
		console.error(`  ${err instanceof Error ? err.message : err}\n`);
		console.error('------------------------------------\n');
		throw err;
	}
};

export default arrangerServer;
