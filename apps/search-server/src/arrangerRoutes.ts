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
	// TODO: extend this for multicatalog
	const firstCatalogEntry = Object.entries(catalogs)[0];
	if (firstCatalogEntry) {
		const [catalogId, { getServerSideFilter, ...catalogConfigs }] = firstCatalogEntry;

		const catalogRouter = await arrangerRouter({
			configs: {
				enableDebug,
				...catalogConfigs,
			},
			esClient,
			getServerSideFilter,
		});

		const router = Router();
		// TODO: this will be needed for multicatalog
		// app.use(catalogId, catalogRouter); // for each catalogId
		router.use(catalogRouter);

		return router;
	}

	throw new Error('No catalogs configured');
};
