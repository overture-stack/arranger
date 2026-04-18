import type { Client } from '@elastic/elasticsearch';
import arrangerRouter from '@overture-stack/arranger-graphql-router';
import { Router } from 'express';

import type { CatalogsMap } from '#configs/types/index.js';

export default async ({
	catalogs,
	enableDebug,
	esClient,
}: {
	catalogs: CatalogsMap;
	enableDebug: boolean;
	esClient?: Client;
}): Promise<Router> => {
	const catalogEntries = Object.entries(catalogs);
	const catalogLength = catalogEntries.length;

	if (catalogLength === 0) {
		throw new Error('No catalogs configured');
	}

	const router = Router();
	const firstCatalogEntry = catalogEntries[0];

	if (catalogLength === 1 && firstCatalogEntry) {
		const [catalogId, { getServerSideFilter, ...catalogConfigs }] = firstCatalogEntry;

		const catalogRouter = await arrangerRouter({
			configs: {
				enableDebug,
				...catalogConfigs,
			},
			esClient,
			getServerSideFilter,
		});

		router.use(catalogRouter)
		return router;
	}

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
	}
	return router;
};
