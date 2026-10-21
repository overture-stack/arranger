import {
	checkSqonDepth,
	isSqonOpAlias,
	SQON_COMBINATION_OPS,
	SQON_OP_ALIASES,
	type SqonFieldOp,
} from '@overture-stack/sqon';

import type { DraftRecordKeyRegistration } from './draftRegistration.js';

type FoundField = Readonly<{ format: unknown; kind: 'found'; type: unknown }>;

type FieldLookup = Readonly<{ kind: 'absent' }> | FoundField | Readonly<{ kind: 'nested'; path: string }>;

type ConditionLeaf = Readonly<{ fieldName: string; kind: 'leaf'; op: unknown; value: unknown }>;

type ConditionNode =
	| Readonly<{ children: readonly unknown[]; kind: 'group' }>
	| ConditionLeaf
	| Readonly<{ kind: 'unreadable' }>;

/** The values a field of one kind holds: `fits` tests one value, and `description` states their form. */
type ValueForm = Readonly<{ description: string; fieldKind: string; fits: (value: unknown) => boolean }>;

const RANGE_OPERATORS = ['between', 'gt', 'gte', 'lt', 'lte'] as const satisfies readonly SqonFieldOp[];

const LEAF_OPERATORS = ['in', ...RANGE_OPERATORS] as const satisfies readonly SqonFieldOp[];

type LeafOperator = (typeof LEAF_OPERATORS)[number];

const NUMERIC_TYPES: readonly string[] = [
	'byte',
	'double',
	'float',
	'half_float',
	'integer',
	'long',
	'scaled_float',
	'short',
	'unsigned_long',
];

/** The format names a date field's format may hold, alone or joined by `||`. */
const DATE_FORMAT_NAMES: readonly string[] = ['date_optional_time', 'epoch_millis', 'strict_date_optional_time'];

const ISO_8601_DATE =
	/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/u;

/** An object keyed by name: a list is never one, so a list where a map belongs is unreadable rather than empty. */
const isKeyedRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isProblem = (problem: string | undefined): problem is string => problem !== undefined;

const isLeafOperator = (op: unknown): op is LeafOperator => LEAF_OPERATORS.some((known) => known === op);

const isRangeOperator = (op: unknown): boolean => RANGE_OPERATORS.some((known) => known === op);

const isNumericType = (type: unknown): boolean => NUMERIC_TYPES.some((known) => known === type);

const isEnforceableDateFormat = (format: unknown): boolean =>
	format === undefined ||
	(typeof format === 'string' && format.split('||').every((name) => DATE_FORMAT_NAMES.includes(name)));

/** `items` as a list in words, such as "1", "1 and 3" or "1, 2 and 4" joined by "and". */
const inWords = (items: readonly string[], conjunction: string): string =>
	items.length > 1 ? `${items.slice(0, -1).join(', ')} ${conjunction} ${items.slice(-1).join('')}` : items.join('');

// A real calendar date comes back unchanged from Date.UTC. A year below 100 does not, since Date.UTC reads it
// as one in the 1900s, so such a year is refused.
const isCalendarDate = (year: number, month: number, day: number): boolean => {
	const date = new Date(Date.UTC(year, month - 1, day));

	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const offsetMillisecondsOf = (offset: string): number => {
	const direction = offset.startsWith('-') ? -1 : 1;

	return offset === 'Z' ? 0 : direction * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6))) * 60_000;
};

/**
 * The instant the span `value` names starts at, a time without an offset read in UTC, or undefined when `value`
 * is not a full date or date-time naming a real calendar date and time.
 */
const dateStartOf = (value: unknown): number | undefined => {
	const match = typeof value === 'string' ? ISO_8601_DATE.exec(value) : null;

	if (match) {
		const [, year = '', month = '', day = '', hour = '0', minute = '0', second = '0', fraction = '', offset = 'Z'] =
			match;
		const isRealDateTime =
			isCalendarDate(Number(year), Number(month), Number(day)) &&
			Number(hour) < 24 &&
			Number(minute) < 60 &&
			Number(second) < 60;
		const milliseconds = Number(fraction.padEnd(3, '0'));

		return isRealDateTime
			? Date.UTC(
					Number(year),
					Number(month) - 1,
					Number(day),
					Number(hour),
					Number(minute),
					Number(second),
					milliseconds,
				) - offsetMillisecondsOf(offset)
			: undefined;
	}

	return undefined;
};

const isDateValue = (value: unknown): boolean => dateStartOf(value) !== undefined;

const DATE_VALUES: ValueForm = {
	description:
		'a full date (YYYY-MM-DD) or a full date-time (YYYY-MM-DDTHH:MM, optionally with seconds, a fraction of a second of up to 3 digits and an offset of Z, +HH:MM or -HH:MM) naming a real calendar date and time',
	fieldKind: 'date',
	fits: isDateValue,
};

const KEYWORD_VALUES: ValueForm = {
	description: 'a non-empty string',
	fieldKind: 'keyword',
	fits: (value) => typeof value === 'string' && value.length > 0,
};

const NUMERIC_VALUES: ValueForm = {
	description: 'a finite number',
	fieldKind: 'numeric',
	fits: (value) => typeof value === 'number' && Number.isFinite(value),
};

/** The form of the values on a field mapped as `type`, for each type whose values are checked. */
const valueFormOf = (type: unknown): ValueForm | undefined => {
	if (type === 'date') {
		return DATE_VALUES;
	}

	if (type === 'keyword') {
		return KEYWORD_VALUES;
	}

	return isNumericType(type) ? NUMERIC_VALUES : undefined;
};

const childOf = (containers: readonly unknown[], segment: string): unknown =>
	containers.filter(isKeyedRecord).find((container) => Object.hasOwn(container, segment))?.[segment];

/**
 * Finds `segments` among `containers`, then through each field's properties and its multi-fields, stopping
 * at the first nested path.
 */
const lookUp = (containers: readonly unknown[], segments: readonly string[], prefix: string): FieldLookup => {
	const [segment, ...rest] = segments;
	const node = segment === undefined ? undefined : childOf(containers, segment);

	if (isKeyedRecord(node) && segment !== undefined) {
		const path = prefix ? `${prefix}.${segment}` : segment;

		if (node.type === 'nested') {
			return { kind: 'nested', path };
		}

		return rest.length === 0
			? { format: node.format, kind: 'found', type: node.type }
			: lookUp([node.properties, node.fields], rest, path);
	}

	return { kind: 'absent' };
};

const dateFormatProblemOf = (fieldName: string, format: unknown): string => {
	const mappedIn = typeof format === 'string' ? `in the format "${format}"` : 'with a format that is not a string';
	return `field "${fieldName}" is mapped as a date ${mappedIn}, while access is enforced on a date field only when it names no format, or one whose every alternative, split on "||", is ${inWords(DATE_FORMAT_NAMES, 'or')}`;
};

const typeProblemOf = (
	{ format, type }: FoundField,
	fieldName: string,
	op: LeafOperator | undefined,
): string | undefined => {
	if (type === 'date') {
		return isEnforceableDateFormat(format) ? undefined : dateFormatProblemOf(fieldName, format);
	}

	if (isNumericType(type)) {
		return undefined;
	}

	if (type === 'keyword') {
		return isRangeOperator(op)
			? `the range "${op}" on field "${fieldName}" needs a date or numeric field, while it is mapped as a keyword`
			: undefined;
	}

	const mappedAs = typeof type === 'string' ? `as "${type}"` : 'with no type';
	return `field "${fieldName}" is mapped ${mappedAs}, while access is enforced only on a keyword, date or numeric field`;
};

/** Why access cannot be enforced on `fieldName` as `lookup` found it, tested with `op` where that is known. */
const mappedFieldProblemOf = (
	lookup: FieldLookup,
	fieldName: string,
	op: LeafOperator | undefined,
): string | undefined => {
	switch (lookup.kind) {
		case 'absent':
			return `field "${fieldName}" is absent from its index mapping`;
		case 'nested':
			return `field "${fieldName}" lies inside the nested mapping "${lookup.path}", while the record is the unit of access`;
		case 'found':
			return typeProblemOf(lookup, fieldName, op);
	}
};

/**
 * Why `fieldName` cannot key a record's resource as `mapping` maps it: resolved as a condition's field is,
 * multi-fields included, but a keyword alone suits, since a resource is matched by its exact value.
 */
const resourceFieldProblemOf = (mapping: unknown, fieldName: string): string | undefined => {
	const lookup = lookUp([mapping], fieldName.split('.'), '');

	switch (lookup.kind) {
		case 'absent':
			return `field "${fieldName}" is absent from its index mapping`;
		case 'nested':
			return `field "${fieldName}" lies inside the nested mapping "${lookup.path}", while the record is the unit of access`;
		case 'found':
			return lookup.type === 'keyword'
				? undefined
				: `field "${fieldName}" is not mapped as a keyword, so an exact match cannot enforce on it`;
	}
};

const operatorProblemOf = (fieldName: string, op: unknown): string => {
	const uses = typeof op === 'string' ? `uses the operator "${op}"` : 'names no operator';
	return `the condition on field "${fieldName}" ${uses}, while the adapter enforces only ${LEAF_OPERATORS.join(', ')}`;
};

/** `op` under its own name, since each of SQON's aliases means the operator it stands for. */
const canonicalOperatorOf = (op: unknown): unknown =>
	typeof op === 'string' && isSqonOpAlias(op) ? SQON_OP_ALIASES[op] : op;

/** Why `value`, a list or a single value standing as a list of one, holds values outside `form`, by position. */
const valueProblemOf = (fieldName: string, op: LeafOperator, form: ValueForm, value: unknown): string | undefined => {
	const values: readonly unknown[] = Array.isArray(value) ? value : [value];
	const positions = values.flatMap((listed, index) => (form.fits(listed) ? [] : [String(index + 1)]));

	if (positions.length > 0) {
		const valuesAt =
			positions.length > 1
				? `its values at positions ${inWords(positions, 'and')}`
				: `its value at position ${inWords(positions, 'and')}`;
		return `the condition on field "${fieldName}" using "${op}" has ${valuesAt} outside the form required on a ${form.fieldKind} field: ${form.description}`;
	}

	return undefined;
};

/**
 * Why a date `between` holding `value` cannot run: its first bound starts after its second. The grammar keeps
 * two strings in code-unit order, so this keeps that order and the bounds' instants in step.
 */
const betweenOrderProblemOf = (fieldName: string, value: unknown): string | undefined => {
	const [first, second] = Array.isArray(value) ? value.map((bound) => dateStartOf(bound)) : [];

	return first !== undefined && second !== undefined && first > second
		? `the condition on field "${fieldName}" using "between" has a first bound starting after its second, while a "between" on a date field lists its earlier bound first, compared as instants`
		: undefined;
};

/** Why the values of a condition on an enforceable field cannot run: one outside its field's form, or a date `between`'s bounds out of order. */
const valuesProblemOf = (fieldName: string, op: LeafOperator, form: ValueForm, value: unknown): string | undefined =>
	valueProblemOf(fieldName, op, form, value) ??
	(op === 'between' && form === DATE_VALUES ? betweenOrderProblemOf(fieldName, value) : undefined);

const leafProblemsOf = (mapping: unknown, { fieldName, op, value }: ConditionLeaf): string[] => {
	const canonicalOperator = canonicalOperatorOf(op);
	const knownOperator = isLeafOperator(canonicalOperator) ? canonicalOperator : undefined;
	const lookup = lookUp([mapping], fieldName.split('.'), '');
	const problems = [
		knownOperator ? undefined : operatorProblemOf(fieldName, op),
		mappedFieldProblemOf(lookup, fieldName, knownOperator),
	].filter(isProblem);
	const form = lookup.kind === 'found' ? valueFormOf(lookup.type) : undefined;

	// Values are read only against an enforceable field and operator, so a leaf already refused keeps its one
	// reason.
	return problems.length === 0 && knownOperator && form
		? [valuesProblemOf(fieldName, knownOperator, form, value)].filter(isProblem)
		: problems;
};

const readNode = (node: unknown): ConditionNode => {
	if (isKeyedRecord(node) && SQON_COMBINATION_OPS.some((op) => op === node.op) && Array.isArray(node.content)) {
		return { children: node.content, kind: 'group' };
	}

	if (isKeyedRecord(node) && isKeyedRecord(node.content) && typeof node.content.fieldName === 'string') {
		return { fieldName: node.content.fieldName, kind: 'leaf', op: node.op, value: node.content.value };
	}

	return { kind: 'unreadable' };
};

/** Why access cannot be enforced on `node`, at `position` within its condition, walking to every leaf. */
const nodeProblemsOf = (mapping: unknown, node: unknown, position: string): string[] => {
	const read = readNode(node);

	switch (read.kind) {
		case 'group':
			return read.children.flatMap((child, index) =>
				nodeProblemsOf(mapping, child, position ? `${position}.content[${index}]` : `content[${index}]`),
			);
		case 'leaf':
			return leafProblemsOf(mapping, read);
		case 'unreadable': {
			const where = position ? `node at ${position}` : 'root node';
			return [
				`the condition's ${where} is neither a group (${SQON_COMBINATION_OPS.join(', ')}) holding a content list nor a condition naming its field in content.fieldName`,
			];
		}
	}
};

/**
 * Why access cannot be enforced on `condition`, its depth checked first and iteratively, since a walk
 * recursing past the stack would throw.
 */
const treeProblemsOf = (mapping: unknown, condition: unknown): string[] =>
	checkSqonDepth(condition)
		? nodeProblemsOf(mapping, condition, '')
		: ['the condition nests deeper than a SQON may, so it cannot be read'];

/** Each problem with `conditions`' categories, prefixed by `prefixOf`, or undefined when `conditions` is no map. */
const categoryProblemsOf = (
	mapping: unknown,
	conditions: unknown,
	prefixOf: (categoryName: string) => string,
): string[] | undefined =>
	isKeyedRecord(conditions)
		? Object.entries(conditions).flatMap(([categoryName, condition]) =>
				treeProblemsOf(mapping, condition).map((problem) => `${prefixOf(categoryName)}: ${problem}`),
			)
		: undefined;

const resourceCategoryProblemsOf = (catalogue: string, mapping: unknown, resources: unknown): string[] => {
	if (resources === undefined) {
		return [];
	}

	return isKeyedRecord(resources)
		? Object.entries(resources).flatMap(
				([resource, conditions]) =>
					categoryProblemsOf(
						mapping,
						conditions,
						(categoryName) => `${catalogue}, category "${categoryName}" of resource "${resource}"`,
					) ?? [
						`${catalogue} registers categories for resource "${resource}" that are not a map of conditions by category name`,
					],
			)
		: [`${catalogue} registers resource categories that are not a map of categories by resource`];
};

/**
 * Every reason access cannot be enforced on a draft record registration, against the catalogue's index
 * mapping as the GraphQL router fetched it. The resource field must be a keyword, a multi-field's keyword
 * subfield included, outside any nested mapping. Each field a condition names, in the global categories and
 * in every resource's own, must resolve through the mapping's properties or a field's multi-fields, lie
 * outside any nested mapping, and be a keyword, date or numeric field, a date_nanos field being none of
 * them: `in` suits any of them, and a range only a date or numeric one. A date field must name no format,
 * or one whose every alternative, split on `||`, is `date_optional_time`, `epoch_millis` or
 * `strict_date_optional_time`.
 *
 * Each value a condition holds in `content.value`, a list or a single value standing as a list of one, must
 * be one its field's type holds: a non-empty string on a keyword field, a finite number on a numeric one,
 * and on a date field a full ISO 8601 date, or date-time to the minute or finer down to the millisecond,
 * naming a real calendar date and time. A date `between` lists the bound starting earlier first, its bounds
 * compared as instants and a time without an offset read in UTC, while the bounds starting at one instant may
 * stand in either order. Values are checked only on a condition with no other reason. The
 * rest of a value's shape, such as how many values each operator takes, is Usher's to check, as is the
 * registration's shape. Each of SQON's operator aliases counts as the operator it stands for. Whatever the
 * walk cannot read, an operator other than `in` and the ranges included, is a reason rather than a pass.
 * Each reason names the catalogue, the category and the field or node at fault, all of them configuration
 * rather than data, and names a value only by its position, never by what it holds.
 *
 * @param catalogueId the catalogue's key.
 * @param registration what the catalogue is to register, read from its file unvalidated.
 * @param mapping the catalogue's index mapping, its properties at the root.
 */
export const conditionProblemsOf = (
	catalogueId: string,
	registration: DraftRecordKeyRegistration,
	mapping: unknown,
): string[] => {
	const catalogue = `catalogue "${catalogueId}"`;
	const { categories, resourceFieldName } = registration;

	const resourceFieldProblem =
		typeof resourceFieldName === 'string'
			? resourceFieldProblemOf(mapping, resourceFieldName)
			: 'its resource field name is not a string';

	const categoryProblems = isKeyedRecord(categories)
		? [
				...(categoryProblemsOf(
					mapping,
					categories.global,
					(categoryName) => `${catalogue}, category "${categoryName}"`,
				) ?? [`${catalogue} registers global categories that are not a map of conditions by category name`]),
				...resourceCategoryProblemsOf(catalogue, mapping, categories.resource),
			]
		: [`${catalogue} registers categories that are not a map of global and resource categories`];

	return [...(resourceFieldProblem ? [`${catalogue}: ${resourceFieldProblem}`] : []), ...categoryProblems];
};
