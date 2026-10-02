import { addContext } from '@overture-stack/arranger-graphql-router/utils';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import morgan from 'morgan';
// TODO: add winston in module and import here

import arrangerRoutes from '#arrangerRoutes.js';
import { computeAggregateServerStatus, serverAggregateStatuses, startEngineProbe } from '#availability/index.js';
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
		const catalogueEntries = Object.entries(catalogs);
		const catalogueMode = catalogueEntries.length > 1 ? 'multiple' : 'single';

		catalogueMode === 'single' ||
			console.log(`  - Loaded ${catalogueEntries.length} catalogues in ${catalogueMode} mode`);

		enableDebug &&
			console.log(
				`    Catalogue IDs: ${catalogueEntries.map(([catalogueId]) => catalogueId).join(', ') || '(none found)'}`,
			);

		enableLogs &&
			console.log(
				`    Extensive console logging enabled${enableDebug ? ' (everything but health checks)' : ''}.`,
			);

		console.log('\n  Success!');

		const app = express();
		// Also blocks Playground/Sandbox in-browser when restrictive; see docs/reference/07-feature-flags.md.
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

		// Liveness: process-alive only, deliberately blind to catalogue state. A slow or
		// unreachable search engine must never cause Kubernetes to restart an otherwise-healthy
		// Arranger process; that's a readiness concern, not a liveness one.
		app.get(health.pingPath, (_req, res) => res.send({ message: 'Reporting for duty...' }));

		const {
			router: arrangerRouter,
			catalogueRouters,
			catalogueStatuses,
		} = await arrangerRoutes({ catalogs, enableDebug, esClient });

		const serverStatus = computeAggregateServerStatus(catalogueStatuses);
		const failedCatalogueIds = Object.entries(catalogueStatuses)
			.filter(([, detail]) => detail.status === 'failed')
			.map(([catalogueId]) => catalogueId);

		enableDebug ||
			console.log(
				`\n  Catalogue availability: ${serverStatus}` +
					(failedCatalogueIds.length ? ` (${failedCatalogueIds.join(', ')} unavailable)` : ''),
			);

		/**
		 * Polls the engine every `pingMs` so readiness can change after startup. Catalogue statuses
		 * themselves are still decided once, while routers are built; this covers the failure that
		 * actually recurs in a cluster, which is the engine going away or coming back under a
		 * process that is otherwise fine.
		 */
		const engineProbe = startEngineProbe({
			esClient,
			index: Object.values(catalogs)[0]?.esIndex ?? '_arranger_probe',
			intervalMs: health.pingMs,
		});

		// Readiness: reflects whether this replica can usefully serve traffic right now. Only
		// `unhealthy` (zero enabled catalogues available) should pull the pod out of rotation;
		// `degraded` still serves real traffic for its available catalogues.
		app.get(health.readyPath, (_req, res) => {
			const status = computeAggregateServerStatus(catalogueStatuses);
			const engineReachable = engineProbe.isReachable();
			const ready = engineReachable && status !== serverAggregateStatuses.UNHEALTHY;

			res.status(ready ? 200 : 503).json({ status, engineReachable });
		});

		app.use(createIntrospectionRoutes({ catalogs, catalogueRouters, catalogueStatuses }));
		app.use('/', arrangerRouter);

		const server = app.listen(serverPort, () => {
			/**
			 * Reported from the bound address rather than from the configured value, because the two
			 * differ whenever `serverPort` is 0: the OS assigns a free port and the configured value
			 * is not the one anything can connect to.
			 */
			const address = server.address();
			const boundPort = typeof address === 'object' && address !== null ? address.port : serverPort;

			const message = `⚡️⚡️⚡️ Listening on port ${boundPort} ⚡️⚡️⚡️`;
			const line = '-'.repeat(message.length);

			console.info(`\n${line}`);
			console.log(message);
			console.info(`${line}\n`);

			if (enableDebug) {
				console.log(`URL: http://localhost:${boundPort}\n`);
			}
		});

		server.on('error', (err: NodeJS.ErrnoException) => {
			console.log('\n\n------------------------------------');
			console.log('\nEnding server due to an error:');
			console.error(err.code === 'EADDRINUSE' ? `Port ${serverPort} is already in use.` : err);

			process.exit(1);
		});

		server.on('close', () => engineProbe.stop());

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
