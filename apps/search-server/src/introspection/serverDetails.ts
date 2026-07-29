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

	return {
		catalogCount,
		catalogs: Object.fromEntries(
			catalogueEntries.map(([catalogueId, catalogueConfigs]) => {
				const typedConfigs = catalogueConfigs as Partial<ConfigsObject<ArrangerBaseContext>>;
				// A catalogue with no recorded status hasn't gone through arrangerRoutes' status
				// tracking (e.g. a caller that only loaded config, not routers); treat as available
				// rather than requiring every caller to pass a status for every catalogue.
				const statusDetail: CatalogueStatusDetail = catalogueStatuses[catalogueId] ?? {
					status: CATALOGUE_STATUS.AVAILABLE,
				};

				return [
					catalogueId,
					{
						...(typedConfigs.description ? { description: typedConfigs.description } : {}),
						...(statusDetail.status === CATALOGUE_STATUS.FAILED ? { error: statusDetail.error } : {}),
						documentType: typedConfigs.documentType || '',
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
		status: computeAggregateServerStatus(catalogueStatuses),
	};
};

export default buildServerDetails;
