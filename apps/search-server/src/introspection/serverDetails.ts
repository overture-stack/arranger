import type { ConfigsObject } from '@overture-stack/arranger-types/configs';

import type { CatalogsMap } from '#configs/types/index.js';

import type { IntrospectionResponse } from './types.js';

const getCatalogGraphqlPath = ({ catalogCount, catalogId }: { catalogCount: number; catalogId: string }) =>
	catalogCount > 1 ? `/${catalogId}/graphql` : '/graphql';

const buildServerDetails = ({ catalogs }: { catalogs: CatalogsMap }): IntrospectionResponse => {
	const catalogEntries = Object.entries(catalogs);
	const catalogCount = catalogEntries.length;

	return {
		catalogCount,
		catalogs: Object.fromEntries(
			catalogEntries.map(([catalogId, catalogConfigs]) => {
				const typedConfigs = catalogConfigs as Partial<ConfigsObject>;

				return [
					catalogId,
					{
						documentType: typedConfigs.documentType || '',
						paths: {
							...(catalogCount === 1 ? { fields: '/introspection/fields' } : {}),
							graphql: getCatalogGraphqlPath({ catalogCount, catalogId }),
							introspection: `/introspection/${catalogId}`,
						},
					},
				];
			}),
		),
		mode: catalogCount > 1 ? 'multiple' : 'single',
		sqonSchemaPath: '/introspection/sqon',
	};
};

export default buildServerDetails;
