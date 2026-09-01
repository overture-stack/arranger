import type { ArrangerBaseContext } from '@overture-stack/arranger-graphql-router';
import type { ConfigsObject } from '@overture-stack/arranger-types/configs';

import {
	type CatalogueStatusDetail,
	catalogueStatuses as CATALOGUE_STATUS,
	computeAggregateServerStatus,
} from '#availability/index.js';
import type { CataloguesMap } from '#configs/types/index.js';

import type { IntrospectionResponse } from './types.js';

const getCatalogueGraphqlPath = ({ catalogCount, catalogueId }: { catalogCount: number; catalogueId: string }) =>
	catalogCount > 1 ? `/${catalogueId}/graphql` : '/graphql';

const buildServerDetails = ({
	catalogs,
	catalogueStatuses = {},
}: {
	catalogs: CataloguesMap;
	catalogueStatuses?: Record<string, CatalogueStatusDetail>;
}): IntrospectionResponse => {
	const catalogueEntries = Object.entries(catalogs);
	const catalogCount = catalogueEntries.length;

	// The aggregate reads the same defaulted statuses as the per-catalogue entries; off the raw map it
	// would report every catalogue available under an unhealthy server.
	const resolvedStatuses: Record<string, CatalogueStatusDetail> = Object.fromEntries(
		catalogueEntries.map(([catalogueId]) => [
			catalogueId,
			catalogueStatuses[catalogueId] ?? { status: CATALOGUE_STATUS.AVAILABLE },
		]),
	);

	return {
		catalogCount,
		catalogs: Object.fromEntries(
			catalogueEntries.map(([catalogueId, catalogueConfigs]) => {
				const typedConfigs = catalogueConfigs as Partial<ConfigsObject<ArrangerBaseContext>>;
				// Absent status means the caller loaded config without routers, not that it failed.
				const statusDetail = resolvedStatuses[catalogueId] ?? { status: CATALOGUE_STATUS.AVAILABLE };

				return [
					catalogueId,
					{
						...(typedConfigs.description ? { description: typedConfigs.description } : {}),
						documentType: typedConfigs.documentType || '',
						...(statusDetail.status === CATALOGUE_STATUS.FAILED ? { error: statusDetail.error } : {}),
						paths: {
							...(catalogCount === 1 ? { fields: '/introspection/fields' } : {}),
							graphql: getCatalogueGraphqlPath({ catalogCount, catalogueId }),
							introspection: `/introspection/${catalogueId}`,
						},
						status: statusDetail.status,
					},
				];
			}),
		),
		mode: catalogCount > 1 ? 'multiple' : 'single',
		sqonSchemaPath: '/introspection/sqon',
		status: computeAggregateServerStatus(resolvedStatuses),
	};
};

export default buildServerDetails;
