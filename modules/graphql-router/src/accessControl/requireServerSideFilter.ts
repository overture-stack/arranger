import { SQON_OP_ALIASES } from '@overture-stack/sqon';

import { AccessControlError } from './AccessControlError.js';

const INTENT_ADVICE =
	'To allow a request without restricting it, return `includeEverything(context)`. ' +
	'A deployment with no access control passes nothing to the router as `getServerSideFilter`.';

const DENY_ADVICE = 'To deny a request, return a filter that matches nothing (an `in` with an empty value list).';

const ABSENT_FILTER_REFUSAL =
	'A server-side filter is required. A `getServerSideFilter` callback must return a SQON node for every ' +
	`request, including unauthenticated ones. ${INTENT_ADVICE}`;

/**
 * A part of a filter that would match broadly where nobody meant it to: its kind, its operator, and its
 * path from the root, such as `content[1].content[0]`.
 */
type BroadPart = {
	kind: 'all' | 'combination' | 'field' | 'node' | 'range' | 'value';
	operator: unknown;
	position: string;
	usesField?: boolean;
};

const refusalFor = ({ kind, operator, position, usesField }: BroadPart): string => {
	const problem = {
		all:
			`holds an 'all' clause with an empty value list at ${position}, which the compiler reads as an ` +
			'empty combination, matching every document.',
		combination: `holds an empty '${String(operator)}' combination at ${position}, and an empty combination matches every document. Remove it.`,
		field: usesField
			? `holds a clause naming no field at ${position}: it uses \`field\`, where SQON names a clause's field \`fieldName\`. A clause naming no field restricts nothing.`
			: `holds a clause naming no field at ${position}, and a clause naming no field restricts nothing.`,
		node: `holds an entry at ${position} that is not a SQON node, which the compiler drops, leaving an empty combination.`,
		range: `holds a '${String(operator)}' clause with no bound at ${position}, and a range with no bound matches every document that has the field.`,
		value: `holds a '${String(operator)}' clause with no value list at ${position}, which compiles to excluding only empty values and so matches nearly every document.`,
	}[kind];

	return `The server-side filter ${problem} ${DENY_ADVICE} ${INTENT_ADVICE}`;
};

const CANONICAL_OPERATORS: ReadonlyMap<string, string> = new Map(Object.entries(SQON_OP_ALIASES));

const COMBINATION_OPERATORS = new Set(['and', 'not', 'or']);

/** The exclusion operators, which compile to excluding only empty values when their value list is lost. */
const EXCLUSION_OPERATORS = new Set(['not-in', 'some-not-in']);

/** The range operators, which compile to a range with no bound unless their value holds a bound. */
const RANGE_OPERATORS = new Set(['between', 'gt', 'gte', 'lt', 'lte']);

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

const isFilterNode = (filter: unknown): filter is { op: unknown } =>
	isObject(filter) && 'op' in filter && Boolean(filter.op);

const contentOf = (node: unknown): unknown => (isObject(node) && 'content' in node ? node.content : undefined);

const operatorOf = (node: unknown): unknown => (isObject(node) && 'op' in node ? node.op : undefined);

const canonicalOperatorOf = (node: unknown): unknown => {
	const operator = operatorOf(node);

	return typeof operator === 'string' ? (CANONICAL_OPERATORS.get(operator) ?? operator) : operator;
};

const isNonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

/**
 * A value the search engine can use as a range bound: a finite number, a non-empty string, or a valid
 * date. `null`, `Infinity` and `NaN` reach the engine as no bound at all.
 */
const isBound = (value: unknown): boolean =>
	(typeof value === 'number' && Number.isFinite(value)) ||
	(typeof value === 'string' && value.length > 0) ||
	(value instanceof Date && !Number.isNaN(value.getTime()));

/** Whether a range clause's value bounds it: `between` needs a list holding a bound, the others a bound or a list holding one. */
const isBoundedRange = (operator: string, value: unknown): boolean =>
	Array.isArray(value) ? value.some(isBound) : operator !== 'between' && isBound(value);

const namesAField = (content: object): boolean =>
	('fieldName' in content && typeof content.fieldName === 'string' && content.fieldName.length > 0) ||
	('fieldNames' in content && isNonEmptyArray(content.fieldNames));

/**
 * What, if anything, makes a clause match broadly: no field named, an exclusion that lost its value list,
 * an empty `all`, or a range with no bound.
 */
const broadClauseKind = (node: unknown): BroadPart['kind'] | undefined => {
	const content = contentOf(node);

	if (!isObject(content) || !namesAField(content)) {
		return 'field';
	}

	const operator = canonicalOperatorOf(node);
	const value = 'value' in content ? content.value : undefined;

	if (typeof operator === 'string' && EXCLUSION_OPERATORS.has(operator) && (value === undefined || value === null)) {
		return 'value';
	}

	if (operator === 'all' && Array.isArray(value) && value.length === 0) {
		return 'all';
	}

	if (typeof operator === 'string' && RANGE_OPERATORS.has(operator) && !isBoundedRange(operator, value)) {
		return 'range';
	}

	return undefined;
};

/**
 * The first part of `node` that would match broadly where nobody meant it to, depth first, or `undefined`
 * when it holds none. The parts are an empty combination, an entry that is not a SQON node (a hole, an
 * absent entry, or content that is not a list), a clause naming no field, an exclusion with no value
 * list, an `all` with an empty value list, and a range with no bound. An `in` with an empty value list, as `matchNothing` and
 * `includeEverything` build it, matches nothing and is never counted, and an exclusion with an empty value
 * list excludes nothing as written.
 */
const findBroadPart = (node: unknown, path = ''): BroadPart | undefined => {
	const position = path || 'the root';
	const operator = operatorOf(node);

	if (!isFilterNode(node)) {
		return { kind: 'node', operator, position };
	}

	const content = contentOf(node);

	if (!Array.isArray(content)) {
		if (COMBINATION_OPERATORS.has(String(canonicalOperatorOf(node)))) {
			return { kind: 'node', operator, position };
		}

		const kind = broadClauseKind(node);
		const usesField = isObject(content) && 'field' in content;

		return kind ? { kind, operator, position, ...(kind === 'field' && { usesField }) } : undefined;
	}

	if (content.length === 0) {
		return { kind: 'combination', operator, position };
	}

	// `Array.from` visits holes as undefined, which a plain `reduce` would skip.
	return Array.from(content).reduce<BroadPart | undefined>(
		(found, child, index) => found ?? findBroadPart(child, `${path ? `${path}.` : ''}content[${index}]`),
		undefined,
	);
};

/**
 * Returns `serverSideFilter` when it holds nothing that would match broadly where nobody meant it to, and
 * refuses it otherwise: an empty combination, which matches every document, wherever it sits; an `all`
 * with no values, which the compiler reads as one; a range with no bound; an exclusion that lost its value
 * list; a clause naming no field, which restricts nothing; and an entry that is not a SQON node, which the
 * compiler drops. Everything else is
 * served as it is today. The refusal names the problem and where it sits, never the filter's values, and
 * advises what to return for each intent: denying a request, allowing one, or applying no access control.
 *
 * @param serverSideFilter the filter a callback returned, checked as received, before it is combined
 *   with any client filter.
 * @throws {AccessControlError} when the filter is absent, or holds any of those parts at any depth.
 */
export const requireServerSideFilter = <Filter>(serverSideFilter: Filter): Filter => {
	if (!isFilterNode(serverSideFilter)) {
		throw new AccessControlError(ABSENT_FILTER_REFUSAL);
	}

	const broadPart = findBroadPart(serverSideFilter);

	if (broadPart) {
		throw new AccessControlError(refusalFor(broadPart));
	}

	return serverSideFilter;
};
