import type { ExtendedConfigs } from '@overture-stack/arranger-types/configs';

// Field type classification sets: verbatim from search-server/catalogDetails.ts.
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
			.map((field) => [
				field.fieldName,
				{
					displayName: field.displayName || field.fieldName,
					type: getFieldType(field),
					...(field.unit !== undefined ? { unit: field.unit } : {}),
				},
			]),
	);

const buildFieldOperators = (resolvedFields: ExtendedConfigs[]): Record<string, string[]> => {
	const types = [
		...new Set(
			resolvedFields.filter((field) => !!field.fieldName).map((field) => getFieldType(field)),
		),
	];
	return Object.fromEntries(types.map((type) => [type, getValidFieldOperators(type)]));
};

/**
 * Builds the catalogue field introspection response body from a live-resolved field list.
 * `operators` is keyed by field type: clients can look up valid operators for a given type
 * without inspecting each field individually. `description` is included only when provided.
 */
export const buildCatalogueIntrospectionBody = ({
	catalogId,
	description,
	documentType,
	resolvedFields,
}: {
	catalogId: string;
	description?: string;
	documentType: string;
	resolvedFields: ExtendedConfigs[];
}) => ({
	catalogId,
	...(description ? { description } : {}),
	documentType,
	fields: buildFields(resolvedFields),
	operators: buildFieldOperators(resolvedFields),
	generatedAt: new Date().toISOString(),
	meta: { authFiltered: false as const },
});
