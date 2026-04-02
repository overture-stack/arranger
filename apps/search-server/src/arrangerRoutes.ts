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

	if (catalogEntries.length === 0) {
		throw new Error('No catalogs configured');
	}

	const router = Router();
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
