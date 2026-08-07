/**
 * Prepends a catalogue's configured `nestingPrefix` to a single raw ES field path (e.g. `"data"`
 * + `"age_at_menarche"` -> `"data.age_at_menarche"`). Field names built and read by Arranger's own
 * configs/schema stay clean (unprefixed); this is the seam where a clean field name becomes the
 * real ES path for a catalogue whose documents wrap their content in an envelope property. See
 * `unwrapMapping` in `searchClient/fetchMapping.ts`, the schema-side counterpart applied once at
 * startup; everything in this file applies per query/response instead.
 */
export const applyNestingPrefix = (fieldName?: string, nestingPrefix?: string): string | undefined =>
	nestingPrefix && fieldName ? `${nestingPrefix}.${fieldName}` : fieldName;

export const applyNestingPrefixToFieldNames = (
	fieldNames?: string[],
	nestingPrefix?: string,
): string[] | undefined =>
	nestingPrefix && fieldNames
		? fieldNames.map((fieldName) => applyNestingPrefix(fieldName, nestingPrefix) as string)
		: fieldNames;

/**
 * Recursively prefixes every `fieldName`/`fieldNames`/`pivot` in a SQON filter tree. Applied once,
 * at the entry point of query/aggregation building, so every filter-op builder downstream keeps
 * operating on real ES paths exactly as it always has, with no `nestingPrefix` awareness of its own.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyNestingPrefixToSqon = (sqon: any, nestingPrefix?: string): any => {
	if (!nestingPrefix || !sqon) {
		return sqon;
	}

	const { content, pivot } = sqon;
	const prefixedPivot = pivot && pivot !== '.' ? applyNestingPrefix(pivot, nestingPrefix) : pivot;

	return Array.isArray(content)
		? {
				...sqon,
				pivot: prefixedPivot,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				content: content.map((child: any) => applyNestingPrefixToSqon(child, nestingPrefix)),
			}
		: {
				...sqon,
				pivot: prefixedPivot,
				content: {
					...content,
					...(content?.fieldName ? { fieldName: applyNestingPrefix(content.fieldName, nestingPrefix) } : {}),
					...(content?.fieldNames
						? { fieldNames: applyNestingPrefixToFieldNames(content.fieldNames, nestingPrefix) }
						: {}),
				},
			};
};

/**
 * Unwraps one ES `_source` object from beneath a `nestingPrefix`, merging the envelope's own
 * properties onto the top level so response-reading code (which operates on clean, Phase-1-shaped
 * field names) finds real values instead of `undefined`. The envelope key itself, and any sibling
 * top-level metadata fields Arranger's config doesn't reference, are left in place: harmless, since
 * nothing in the schema ever asks for them.
 */
export const unwrapSource = (
	source?: Record<string, unknown>,
	nestingPrefix?: string,
): Record<string, unknown> | undefined => {
	if (!nestingPrefix || !source) {
		return source;
	}

	const unwrapped = nestingPrefix
		.split('.')
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		.reduce((node: any, segment) => node?.[segment], source);

	return unwrapped && typeof unwrapped === 'object' ? { ...source, ...unwrapped } : source;
};

/**
 * Unwraps every hit's `_source` in an ES hits response (`{ hits: [...] }`), immutably.
 */
export const unwrapHits = <T extends { hits: { _source?: Record<string, unknown> }[] }>(
	hits?: T,
	nestingPrefix?: string,
): T | undefined => {
	if (!nestingPrefix || !hits?.hits) {
		return hits;
	}

	return {
		...hits,
		hits: hits.hits.map((hit) => ({ ...hit, _source: unwrapSource(hit._source, nestingPrefix) })),
	};
};
