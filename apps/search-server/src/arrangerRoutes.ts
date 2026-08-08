import type { ConfigsObject } from '@overture-stack/arranger-types/configs';
import arrangerRouter, {
	type ArrangerBaseContext,
	classifyCatalogueFailureReason,
	logSeparator,
	type SearchClient,
} from '@overture-stack/arranger-graphql-router';
import { Router, type Router as ExpressRouter } from 'express';

import { type CatalogueStatusDetail, catalogueStatuses as CATALOGUE_STATUS } from '#availability/index.js';
import type { CataloguesMap } from '#configs/types/index.js';

export const buildCatalogueRouter = async ({
	catalogueConfigs,
	catalogueId,
	enableDebug,
	esClient,
}: {
	catalogueConfigs: CataloguesMap[string];
	catalogueId: string;
	enableDebug: boolean;
	esClient?: SearchClient;
}): Promise<ExpressRouter> => {
	const { getServerSideFilter, ...configs } = catalogueConfigs;
	return arrangerRouter({
		catalogueId,
		configs: { enableDebug, ...configs },
		esClient,
		getServerSideFilter,
	});
};

/** A catalogue that failed to build still gets a router, so requests get a clear status instead of a generic 404 or a crashed server. */
const buildFailedCatalogueRouter = ({
	catalogueConfigs,
	catalogueId,
	statusDetail,
}: {
	catalogueConfigs: CataloguesMap[string];
	catalogueId: string;
	statusDetail: Extract<CatalogueStatusDetail, { status: typeof CATALOGUE_STATUS.FAILED }>;
}): ExpressRouter => {
	const router = Router();
	const typedConfigs = catalogueConfigs as Partial<ConfigsObject<ArrangerBaseContext>>;
	const metadataBody = {
		catalogueId,
		...(typedConfigs.description ? { description: typedConfigs.description } : {}),
		documentType: typedConfigs.documentType || '',
		error: statusDetail.error,
		status: statusDetail.status,
	};

	router.get('/introspection', (_req, res) => res.json(metadataBody));
	router.use((_req, res) => res.status(404).json({ ...metadataBody, details: `/introspection/${catalogueId}` }));

	return router;
};

export default async ({
	buildCatalogueRouterFn = buildCatalogueRouter,
	catalogs,
	enableDebug,
	esClient,
}: {
	buildCatalogueRouterFn?: typeof buildCatalogueRouter;
	catalogs: CataloguesMap;
	enableDebug: boolean;
	esClient?: SearchClient;
}): Promise<{
	catalogueRouters: Record<string, ExpressRouter>;
	catalogueStatuses: Record<string, CatalogueStatusDetail>;
	router: Router;
}> => {
	const catalogueEntries = Object.entries(catalogs);
	const catalogueCount = catalogueEntries.length;

	if (catalogueCount === 0) {
		throw new Error('No catalogues configured');
	}

	const settledResults = await Promise.allSettled(
		catalogueEntries.map(([catalogueId, catalogueConfigs]) =>
			buildCatalogueRouterFn({ catalogueConfigs, catalogueId, enableDebug, esClient }),
		),
	);

	const catalogueResults = settledResults.map((result, index) => {
		const [catalogueId, catalogueConfigs] = catalogueEntries[index] as [string, CataloguesMap[string]];

		if (result.status === 'fulfilled') {
			const statusDetail: CatalogueStatusDetail = { status: CATALOGUE_STATUS.AVAILABLE };
			return { catalogueId, catalogueRouter: result.value, statusDetail };
		}

		const error = classifyCatalogueFailureReason(result.reason);
		const statusDetail: CatalogueStatusDetail = { status: CATALOGUE_STATUS.FAILED, error };

		console.error(
			`\n${logSeparator(catalogueId)}\nCatalogue "${catalogueId}" failed to load (${error.code}: ${error.message}); continuing with the remaining catalogues.\n`,
		);

		return {
			catalogueId,
			catalogueRouter: buildFailedCatalogueRouter({ catalogueConfigs, catalogueId, statusDetail }),
			statusDetail,
		};
	});

	const catalogueRouters = Object.fromEntries(
		catalogueResults.map(({ catalogueId, catalogueRouter }) => [catalogueId, catalogueRouter]),
	);
	const catalogueStatuses = Object.fromEntries(
		catalogueResults.map(({ catalogueId, statusDetail }) => [catalogueId, statusDetail]),
	);

	const router = Router();
	const [singleResult] = catalogueResults;

	if (catalogueCount === 1 && singleResult) {
		router.use(singleResult.catalogueRouter);
	} else {
		for (const { catalogueId, catalogueRouter, statusDetail } of catalogueResults) {
			router.use(`/${catalogueId}`, catalogueRouter);
			console.log(`  - Catalogue mounted at /${catalogueId} (${statusDetail.status})`);
		}
	}

	return { catalogueRouters, catalogueStatuses, router };
};
