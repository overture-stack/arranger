import { isGroupNode, type SqonNode } from '@overture-stack/sqon';

/** The slice of a catalogue's field metadata the summary needs. */
export type SummaryFields = Record<string, { displayName: string }>;

const formatValue = (value: unknown): string => (typeof value === 'string' ? `"${value}"` : String(value));

const formatValues = (value: unknown): string => (Array.isArray(value) ? value : [value]).map(formatValue).join(' or ');

const describeLeaf = (leaf: SqonNode, fields: SummaryFields): string => {
	const content = leaf.content as { fieldName?: string; fieldNames?: string[]; value: unknown };
	const { fieldName, fieldNames, value } = content;
	const label = (fieldName && fields[fieldName]?.displayName) || fieldName || (fieldNames ?? []).join(', ');

	switch (leaf.op) {
		case 'in':
			return `${label} is ${formatValues(value)}`;
		case 'not-in':
		case 'some-not-in':
			return `${label} is not ${formatValues(value)}`;
		case 'all':
			return `${label} includes all of ${formatValues(value)}`;
		case 'gt':
			return `${label} is greater than ${formatValue(value)}`;
		case 'gte':
			return `${label} is at least ${formatValue(value)}`;
		case 'lt':
			return `${label} is less than ${formatValue(value)}`;
		case 'lte':
			return `${label} is at most ${formatValue(value)}`;
		case 'between': {
			const [min, max] = Array.isArray(value) ? value : [];
			return `${label} is between ${formatValues(min)} and ${formatValues(max)}`;
		}
		case 'wildcard':
			return `${label} matches ${formatValue(value)}`;
		default:
			// Unreachable for a SQON that passed SqonSchema, but keeps the summary total.
			return `${label} ${leaf.op} ${formatValues(value)}`;
	}
};

const describeNode = (node: SqonNode, fields: SummaryFields, depth: number): string => {
	if (!isGroupNode(node)) {
		return describeLeaf(node, fields);
	}

	if (node.content.length === 0) {
		return 'no filters (matches every document)';
	}

	const parts = node.content.map((child) => describeNode(child, fields, depth + 1));

	if (node.op === 'not') {
		return `NOT (${parts.join(' AND ')})`;
	}

	const joined = parts.join(node.op === 'or' ? ' OR ' : ' AND ');
	return depth === 0 ? joined : `(${joined})`;
};

/**
 * Renders a SQON as one plain-English line for the model to read back before the query runs.
 *
 * Describes the final SQON rather than the clauses that produced it: `reduceSqon` merges clauses
 * on the same field and operator, so the filters that come out are not always the clauses that
 * went in, and the summary has to describe what will actually be queried.
 *
 * @param sqon - The built SQON.
 * @param fields - Catalogue field metadata, used to prefer display names over field names.
 * @example
 * ```ts
 * summarizeSqon(sqon, fields);
 * // 'Study is "A" or "B" AND Biological Sex is "Male" AND NOT (Age is greater than 70)'
 * ```
 * @returns A plain-English summary of the provided SQON.
 */
export const summarizeSqon = (sqon: SqonNode, fields: SummaryFields = {}): string => describeNode(sqon, fields, 0);

/**
 * Counts the leaf filter clauses in a SQON. Used to detect that `reduceSqon` merged clauses, so
 * the response can say so instead of silently returning fewer filters than the caller submitted.
 * @param sqon - The built SQON.
 * @returns The number of leaf filter clauses in the SQON.
 */
export const countFilterClauses = (sqon: SqonNode): number =>
	isGroupNode(sqon) ? sqon.content.reduce((total, child) => total + countFilterClauses(child), 0) : 1;
