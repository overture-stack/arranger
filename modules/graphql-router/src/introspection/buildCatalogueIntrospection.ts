import type { ExtendedConfigs } from '@overture-stack/arranger-types/configs';

// Field type classification sets — verbatim from search-server/catalogDetails.ts.
// Consolidation with modules/sqon operator rules is a separate tech-debt item.
const NUMERIC_TYPES = new Set(['double', 'float', 'integer', 'long', 'number']);
const RANGE_TYPES = new Set(['date', ...NUMERIC_TYPES]);
const ENUM_LIKE_TYPES = new Set(['bits', 'boolean', 'keyword', 'list']);

const getFieldType = (field: ExtendedConfigs) => field.type || field.displayType || 'keyword';

const getValidFieldOperators = (fieldType: string): string[] => {
	if (RANGE_TYPES.has(fieldType)) {
		return ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between'];
	}

	if (ENUM_LIKE_TYPES.has(fieldType)) {
		return ['in', 'not-in', 'some-not-in', 'all', 'filter'];
	}

	return ['in', 'not-in', 'filter'];
};

const buildFields = (resolvedFields: ExtendedConfigs[]) =>
	Object.fromEntries(
		resolvedFields
			.filter((field) => !!field.fieldName)
			.map((field) => {
				const fieldType = getFieldType(field);
				return [
					field.fieldName,
					{
						displayName: field.displayName || field.fieldName,
						type: fieldType,
						...(field.unit !== undefined ? { unit: field.unit } : {}),
						validOperators: getValidFieldOperators(fieldType),
					},
				];
			}),
	);

/**
 * Builds the catalogue field introspection response body from a live-resolved
 * field list. Response shape is intentionally identical to what the old
 * `buildCatalogDetails` in search-server produced — the `field-operators` branch
 * will restructure this shape when it rebases on top of this change.
 */
export const buildCatalogueIntrospectionBody = ({
	catalogId,
	documentType,
	resolvedFields,
}: {
	catalogId: string;
	documentType: string;
	resolvedFields: ExtendedConfigs[];
}) => ({
	catalogId,
	documentType,
	fields: buildFields(resolvedFields),
	generatedAt: new Date().toISOString(),
	meta: { authFiltered: false as const },
});
