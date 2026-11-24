import { type SearchClient } from '#searchClient/types.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** How an index's mapping holds one field: not at all, as a keyword, or as anything else. */
export type FieldMappingKind = 'absent' | 'keyword' | 'other';

/** How an index's mapping holds `field`, a mark a saved set records. */
export const fieldMappingOf = (indexMapping: unknown, field: string): FieldMappingKind => {
	const mapped =
		isRecord(indexMapping) && isRecord(indexMapping.mappings) && isRecord(indexMapping.mappings.properties)
			? indexMapping.mappings.properties[field]
			: undefined;

	return mapped === undefined ? 'absent' : isRecord(mapped) && mapped.type === 'keyword' ? 'keyword' : 'other';
};

/** How an index's mapping holds `attribution`, the mark recording how a set was saved. */
export const attributionMappingOf = (indexMapping: unknown): FieldMappingKind =>
	fieldMappingOf(indexMapping, 'attribution');

/**
 * Whether the sets index maps `field` as a keyword now, so a mark written to it is recorded and read back. Read at each
 * save rather than once at startup, since an index can be recreated after the router starts. Every index the name
 * reaches must map it so, and a mapping that cannot be read counts as one that does not.
 *
 * @param details the search client, the sets index's name, and the field.
 */
export const recordsKeywordField = ({
	esClient,
	field,
	setsIndex,
}: {
	esClient: SearchClient;
	field: string;
	setsIndex: string;
}) =>
	Promise.resolve()
		.then(() => esClient.indices.getMapping({ index: setsIndex }))
		.then(
			({ body }) => {
				const indexMappings = Object.values(isRecord(body) ? body : {});

				return (
					indexMappings.length > 0 &&
					indexMappings.every((indexMapping) => fieldMappingOf(indexMapping, field) === 'keyword')
				);
			},
			() => false,
		);

/**
 * Whether the sets index maps `attribution` as a keyword now; see `recordsKeywordField`.
 *
 * @param details the search client, and the sets index's name.
 */
export const recordsAttribution = ({ esClient, setsIndex }: { esClient: SearchClient; setsIndex: string }) =>
	recordsKeywordField({ esClient, field: 'attribution', setsIndex });

/**
 * Whether the sets index maps `catalogue` as a keyword now, so the catalogue a set was saved from is recorded and read
 * back; see `recordsKeywordField`.
 *
 * @param details the search client, and the sets index's name.
 */
export const recordsCatalogue = ({ esClient, setsIndex }: { esClient: SearchClient; setsIndex: string }) =>
	recordsKeywordField({ esClient, field: 'catalogue', setsIndex });
