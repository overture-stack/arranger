import arrangerRouter, { type SearchClient } from '@overture-stack/arranger-graphql-router';
import { Router, type Router as ExpressRouter } from 'express';

import type { CatalogsMap } from '#configs/types/index.js';

const buildCatalogueRouter = async ({
	catalogueId,
	catalogueConfigs,
	enableDebug,
	esClient,
}: {
	catalogueId: string;
	catalogueConfigs: CatalogsMap[string];
	enableDebug: boolean;
	esClient?: SearchClient;
}): Promise<[string, ExpressRouter]> => {
	const { getServerSideFilter, ...configs } = catalogueConfigs;
	const catalogueRouter = await arrangerRouter({
		configs: { enableDebug, ...configs },
		esClient,
		getServerSideFilter,
	});
	return [catalogueId, catalogueRouter];
};

export default async ({
	catalogs,
	enableDebug,
	esClient,
}: {
	catalogs: CatalogsMap;
	enableDebug: boolean;
	esClient?: SearchClient;
}): Promise<{ router: Router; catalogueRouters: Record<string, ExpressRouter> }> => {
	const catalogueEntries = Object.entries(catalogs);
	const catalogueCount = catalogueEntries.length;

	if (catalogueCount === 0) {
		throw new Error('No catalogues configured');
	}

	try {
		// TODO: (multicatalogue-status): add catalogue-root metadata responses for unavailable catalogues.
		// With enableDebug, these responses should eventually include richer diagnostics such as stack/context.
		const cataloguePairs = await Promise.all(
			catalogueEntries.map(([catalogueId, catalogueConfigs]) =>
				buildCatalogueRouter({ catalogueId, catalogueConfigs, enableDebug, esClient }),
			),
		);

		const catalogueRouters = Object.fromEntries(cataloguePairs);
		const router = Router();

		if (catalogueCount === 1 && cataloguePairs[0]) {
			const [, catalogueRouter] = cataloguePairs[0];
			router.use(catalogueRouter);
		} else {
			for (const [catalogueId, catalogueRouter] of cataloguePairs) {
				router.use(`/${catalogueId}`, catalogueRouter);
				console.log(`  - Catalogue mounted at /${catalogueId}`);
			}
		}

		return { router, catalogueRouters };
	} catch (err) {
		console.error('\n------\nError creating catalogue routers:\n', err instanceof Error ? err.message : err);
		throw new Error('Failure to generate catalogue routing');
	}
};
