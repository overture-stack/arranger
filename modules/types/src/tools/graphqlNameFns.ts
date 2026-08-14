/**
 * Sanitizes a single name segment (a document type name, or one leaf field name at one nesting
 * level, never a full dotted path) into a valid GraphQL identifier: replaces any character
 * graphql-js's Name grammar disallows with `_`, then prefixes `_` if the result would start with
 * a digit.
 */
export const sanitizeGraphqlNameSegment = (segment: string): string => {
	const withValidChars = segment.replace(/[^_A-Za-z0-9]/g, '_');
	return /^[0-9]/.test(withValidChars) ? `_${withValidChars}` : withValidChars;
};

/**
 * Flattens a full (possibly dotted) ES field path into one GraphQL-safe name, for the aggregations
 * schema specifically: unlike scalar/nested fields (built hierarchically, one leaf segment per
 * type), an aggregation field's whole path becomes a single flat name. Dots become `__` (not `_`,
 * preserving the existing convention that avoids e.g. `donor.id` colliding with an unrelated
 * top-level `donor_id`); every other disallowed character becomes `_`, and a leading digit gets an
 * `_` prefix.
 */
export const sanitizeGraphqlFlatName = (dottedPath: string): string =>
	sanitizeGraphqlNameSegment(dottedPath.split('.').join('__'));
