import type { ConfigsObject } from '@overture-stack/arranger-types/configs';

import type { CatalogsMap } from '#configs/types/index.js';

import type { IntrospectionResponse } from './types.js';

const getCatalogueGraphqlPath = ({ catalogCount, catalogId }: { catalogCount: number; catalogId: string }) =>
	catalogCount > 1 ? `/${catalogId}/graphql` : '/graphql';

const buildServerDetails = ({ catalogs }: { catalogs: CatalogsMap }): IntrospectionResponse => {
	const catalogueEntries = Object.entries(catalogs);
	const catalogCount = catalogueEntries.length;

	return {
		catalogCount,
		catalogs: Object.fromEntries(
			catalogueEntries.map(([catalogId, catalogueConfigs]) => {
				const typedConfigs = catalogueConfigs as Partial<ConfigsObject>;

				return [
					catalogId,
					{
						...(typedConfigs.description ? { description: typedConfigs.description } : {}),
						documentType: typedConfigs.documentType || '',
						paths: {
							...(catalogCount === 1 ? { fields: '/introspection/fields' } : {}),
							graphql: getCatalogueGraphqlPath({ catalogCount, catalogId }),
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
