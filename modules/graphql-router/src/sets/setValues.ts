import { applyNestingPrefix } from '#middleware/utils/nestingPrefix.js';

/**
 * The engine field a saved set's values are matched on, for a path given in SQON's dotted form: `_id` is never
 * prefixed, since it is an engine meta field, and any other path is read under the catalogue's nesting prefix.
 *
 * @param args.fieldName the saved path, dotted.
 * @param args.nestingPrefix the catalogue's nesting prefix, if it has one.
 */
export const setValuesFieldOf = ({
	fieldName,
	nestingPrefix,
}: {
	fieldName: string;
	nestingPrefix: string | undefined;
}): string => (fieldName === '_id' ? '_id' : (applyNestingPrefix(fieldName, nestingPrefix) ?? fieldName));

/**
 * A terms clause holding a saved set's `values` on its path, built the one way every reader of a saved set builds it,
 * so a check and a read of the same set cannot match different fields.
 *
 * @param args.fieldName the saved path, dotted.
 * @param args.nestingPrefix the catalogue's nesting prefix, if it has one.
 * @param args.values the saved values to match.
 */
export const setValuesTermsOf = ({
	fieldName,
	nestingPrefix,
	values,
}: {
	fieldName: string;
	nestingPrefix: string | undefined;
	values: readonly string[];
}): { terms: Record<string, readonly string[]> } => ({
	terms: { [setValuesFieldOf({ fieldName, nestingPrefix })]: values },
});

/**
 * The values split into consecutive chunks of at most `size`, in order.
 *
 * @param values the values to split.
 * @param size the most values a chunk holds.
 */
export const chunksOf = <Value>(values: readonly Value[], size: number): Value[][] =>
	Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
		values.slice(index * size, (index + 1) * size),
	);
