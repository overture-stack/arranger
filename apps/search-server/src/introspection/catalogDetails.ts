import type { ConfigsObject, ExtendedConfigs } from '@overture-stack/arranger-types/configs';

import type { CatalogsMap } from '#configs/types/index.js';

import type { CatalogFieldIntrospection, CatalogIntrospectionResponse } from './types.js';

const NUMERIC_TYPES = new Set(['double', 'float', 'integer', 'long', 'number']);
const RANGE_TYPES = new Set(['date', ...NUMERIC_TYPES]);
const ENUM_LIKE_TYPES = new Set(['bits', 'boolean', 'keyword', 'list']);

const getFieldType = (field: ExtendedConfigs) => field.type || field.displayType || 'keyword';

const getValidOperators = (fieldType: string) => {
	if (RANGE_TYPES.has(fieldType)) {
		return ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between'];
	}

	if (ENUM_LIKE_TYPES.has(fieldType)) {
		return ['in', 'not-in', 'some-not-in', 'all', 'filter'];
	}

	return ['in', 'not-in', 'filter'];
};

const buildFields = (extendedFields: ExtendedConfigs[] = []): Record<string, CatalogFieldIntrospection> =>
	Object.fromEntries(
		extendedFields
			.filter((field) => !!field.fieldName)
			.map((field) => {
				const fieldType = getFieldType(field);

				return [
					field.fieldName,
					{
						displayName: field.displayName || field.fieldName,
						type: fieldType,
						...(field.unit !== undefined ? { unit: field.unit } : {}),
						validOperators: getValidOperators(fieldType),
					},
				];
			}),
	);

const buildCatalogDetails = ({
	authFiltered = false,
	catalogId,
	catalogs,
	generatedAt,
}: {
	authFiltered?: boolean;
	catalogId: string;
	catalogs: CatalogsMap;
	generatedAt: string;
}): CatalogIntrospectionResponse | null => {
	const catalogConfigs = catalogs[catalogId] as Partial<ConfigsObject> | undefined;

	if (!catalogConfigs) {
		return null;
	}

	return {
		catalogId,
		documentType: catalogConfigs.documentType || '',
		fields: buildFields(catalogConfigs.extended),
		generatedAt,
		meta: {
			authFiltered,
		},
	};
};

export default buildCatalogDetails;
