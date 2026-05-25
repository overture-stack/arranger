import arrangerRouter, { type SearchClient } from '@overture-stack/arranger-graphql-router';
import { Router } from 'express';

import type { CatalogsMap } from '#configs/types/index.js';

export default async ({
	catalogs,
	enableDebug,
	esClient,
}: {
	catalogs: CatalogsMap;
	enableDebug: boolean;
	esClient?: SearchClient;
}): Promise<Router> => {
	const catalogEntries = Object.entries(catalogs);
	const catalogLength = catalogEntries.length;

	if (catalogLength === 0) {
		throw new Error('No catalogs configured');
	}

	const router = Router();

	try {
		// TODO: (multicatalog-status): add catalog-root metadata responses for unavailable catalogs.
		// With enableDebug, these responses should eventually include richer diagnostics such as stack/context.
		if (catalogLength === 1 && catalogEntries[0]) {
			const [catalogId, { getServerSideFilter, ...catalogConfigs }] = catalogEntries[0];

			const catalogRouter = await arrangerRouter({
				configs: {
					enableDebug,
					...catalogConfigs,
				},
				esClient,
				getServerSideFilter,
			});

			router.use(catalogRouter);
		} else {
			for (const [catalogId, { getServerSideFilter, ...catalogConfigs }] of catalogEntries) {
				const catalogRouter = await arrangerRouter({
					configs: {
						enableDebug,
						...catalogConfigs,
					},
					esClient,
					getServerSideFilter,
				});
				router.use(`/${catalogId}`, catalogRouter);
				console.log(`  - Catalog mounted at /${catalogId}`);
			}
		}
	} catch (err) {
		console.error('\n------\nError creating catalog routers:\n', err instanceof Error ? err.message : err);
		throw new Error('Failure to generate catalog routing');
	}

	return router;
};
