/**
 * An independent statement of which records a principal may see under Usher's category model, written from the
 * model's requirements rather than from any query compiler, so a suite can hold a search engine's answers against
 * it. Conditions read fields as the engines do: a multi-valued field matches through any one of its values, a date
 * bound or listed date covers the span it names, and a record's date is the instant it names. It imports nothing, so
 * it runs without an engine.
 */

/** The category a principal holds on a resource to see that resource's records carrying no category. */
export const UNMARKED_CATEGORY = 'global.unmarked';

/**
 * A value a condition lists or bounds by: a non-empty string on a keyword field, an ISO 8601 string on a date field,
 * a finite number on a number field.
 */
export type ConditionValue = number | string;

type RangeOperator = '<' | '<=' | '>' | '>=' | 'gt' | 'gte' | 'lt' | 'lte';

/**
 * A category's condition, a SQON node: `in` on keyword, date and number fields, listing distinct values; the ranges
 * `gt`, `gte`, `lt` and `lte`, each with one bound, and `between`, with two bounds of one kind, numbers lowest first,
 * on date and number fields; and `and`, `or` and `not` combining them, where `not` holds exactly one condition. A
 * listed date or a date bound covers the span it names, a whole day for a date alone, and a date `between` lists
 * its bounds earliest first and in code-unit order, running from its first bound's span start to its second's end.
 * The SQON aliases `=`, `==` and `===` read as `in`, and `>`, `>=`, `<` and `<=` as the ranges.
 */
export type Condition =
	| Readonly<{ content: readonly Condition[]; op: 'and' | 'or' }>
	| Readonly<{ content: readonly [Condition]; op: 'not' }>
	| Readonly<{
			content: Readonly<{ fieldName: string; value: readonly ConditionValue[] }>;
			op: '=' | '==' | '===' | 'in';
	  }>
	| Readonly<{ content: Readonly<{ fieldName: string; value: ConditionValue }>; op: RangeOperator }>
	| Readonly<{
			content: Readonly<{ fieldName: string; value: readonly [ConditionValue, ConditionValue] }>;
			op: 'between';
	  }>;

/**
 * A catalogue's registration under the category model, a local draft of the Usher Bridge's shape. Global categories
 * apply to every record of the catalogue, and a resource's categories to that resource's records only; no condition
 * reads the resource field. `resources`, when given, lists the known resources, so a record holding none of them is
 * never served, and must list every resource with categories of its own. `absentCategories` names global categories
 * no record of the catalogue carries; they define no condition, so they place no record in any category.
 */
export type RecordKeyRegistration = Readonly<{
	absentCategories?: readonly `global.${string}`[];
	categories: Readonly<{
		global: Readonly<{ [name: `global.${string}`]: Condition }>;
		resource?: Readonly<{ [resourceId: string]: Readonly<{ [name: `resource.${string}`]: Condition }> }>;
	}>;
	kind: 'record';
	resourceFieldName: string;
	resources?: readonly string[];
}>;

/**
 * An index's field properties, as its mapping's `properties` holds them. A condition reads only a top-level field
 * typed `keyword`, `date` or a numeric type.
 */
export type IndexMapping = Readonly<Record<string, Readonly<{ type?: string }>>>;

/** A catalogue as the checker reads it: the index mapping typing each field, and the registration. */
export type Catalogue = Readonly<{ mapping: IndexMapping; registration: RecordKeyRegistration }>;

/** One indexed record, by field name. */
export type CatalogueRecord = Readonly<Record<string, unknown>>;

/** A principal's grants: the category names held on each resource, by resource id. */
export type Grants = Readonly<Record<string, readonly string[]>>;

type FieldType = 'date' | 'keyword' | 'number';

/** The first and last millisecond of the span a date names, or a number as itself at both ends. */
type Span = Readonly<{ end: number; start: number }>;

const CONDITION_KEYS: readonly string[] = ['content', 'op'];
const DAY_MILLISECONDS = 86_400_000;
const LEAF_KEYS: readonly string[] = ['fieldName', 'value'];
const LEAF_OPERATORS: readonly string[] = ['between', 'gt', 'gte', 'in', 'lt', 'lte'];
const MINUTE_MILLISECONDS = 60_000;
const NUMBER_MAPPING_TYPES: readonly string[] = [
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
const OPERATOR_ALIASES: Readonly<Record<string, string>> = {
	'!=': 'not-in',
	'!==': 'not-in',
	'<': 'lt',
	'<=': 'lte',
	'=': 'in',
	'==': 'in',
	'===': 'in',
	'>': 'gt',
	'>=': 'gte',
};
const RESERVED_MARKERS: readonly string[] = ['*', '__missing__', 'set_id:'];
const RESERVED_RESOURCE_CATEGORY = 'resource.unmarked';
const SECOND_MILLISECONDS = 1_000;

const isAfterSpan = (value: number, bound: Span): boolean => value > bound.end;
const isBeforeSpan = (value: number, bound: Span): boolean => value < bound.start;
const isFromSpanStart = (value: number, bound: Span): boolean => value >= bound.start;
const isToSpanEnd = (value: number, bound: Span): boolean => value <= bound.end;

const RANGE_TESTS: Readonly<Record<RangeOperator, (value: number, bound: Span) => boolean>> = {
	'<': isBeforeSpan,
	'<=': isToSpanEnd,
	'>': isAfterSpan,
	'>=': isFromSpanStart,
	gt: isAfterSpan,
	gte: isFromSpanStart,
	lt: isBeforeSpan,
	lte: isToSpanEnd,
};

const VALUE_FORMS: Readonly<Record<FieldType, string>> = {
	date: 'an ISO 8601 date string',
	keyword: 'a string',
	number: 'a finite number',
};

const ISO_8601_DATE =
	/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$/u;

const NO_CATEGORIES: Readonly<Record<string, Condition>> = {};

// Lookups by a name taken from data never reach the prototype chain, so a resource or field named `constructor`
// is as absent as any other name nobody configured.
const ownValue = <Value>(container: Readonly<Record<string, Value>>, key: string): Value | undefined =>
	Object.hasOwn(container, key) ? container[key] : undefined;

const isPlainObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const quoted = (names: readonly unknown[]): string => names.map((name) => JSON.stringify(name)).join(', ');

const canonicalOperatorOf = (op: string): string => ownValue(OPERATOR_ALIASES, op) ?? op;

const fieldTypeOf = (mapping: IndexMapping, fieldName: string): FieldType | undefined => {
	const mappingType = ownValue(mapping, fieldName)?.type ?? '';

	if (mappingType === 'date' || mappingType === 'keyword') {
		return mappingType;
	}

	return NUMBER_MAPPING_TYPES.includes(mappingType) ? 'number' : undefined;
};

const offsetMillisecondsOf = (offset: string): number => {
	const direction = offset.startsWith('-') ? -1 : 1;
	const hours = Number(offset.slice(1, 3));
	const minutes = Number(offset.slice(4, 6));

	return offset === 'Z' ? 0 : direction * (hours * 60 + minutes) * 60_000;
};

const spanMillisecondsOf = (
	hour: string | undefined,
	second: string | undefined,
	fraction: string | undefined,
): number => {
	if (hour === undefined) {
		return DAY_MILLISECONDS;
	}

	if (second === undefined) {
		return MINUTE_MILLISECONDS;
	}

	return fraction === undefined ? SECOND_MILLISECONDS : 1;
};

// A date names a span at its own precision: a day, a minute, a second or, given a fraction, one millisecond. The
// engines round a bound down to the span's start for gte and lt and up to its last millisecond for gt and lte, match
// a listed date over its whole span, and hold a record's value at the span's start. A date alone is in UTC, as is a
// time without an offset, where `Date.parse` would read the latter in the machine's own time zone.
const spanOf = (text: string): Span | undefined => {
	const match = ISO_8601_DATE.exec(text);

	if (match) {
		const [, year = '', month = '', day = '', hour, minute, second, fraction, offset = 'Z'] = match;
		const years = Number(year);
		const months = Number(month);
		const days = Number(day);
		const hours = Number(hour ?? '0');
		const minutes = Number(minute ?? '0');
		const seconds = Number(second ?? '0');
		const milliseconds = Number((fraction ?? '').padEnd(3, '0').slice(0, 3));
		const wallClock = Date.UTC(years, months - 1, days, hours, minutes, seconds, milliseconds);
		const date = new Date(wallClock);
		const isCalendarDate =
			date.getUTCFullYear() === years &&
			date.getUTCMonth() === months - 1 &&
			date.getUTCDate() === days &&
			hours < 24 &&
			minutes < 60 &&
			seconds < 60;
		const start = wallClock - offsetMillisecondsOf(offset);

		return isCalendarDate ? { end: start + spanMillisecondsOf(hour, second, fraction) - 1, start } : undefined;
	}

	return undefined;
};

const spanOfValue = (fieldType: FieldType, value: unknown): Span | undefined => {
	if (fieldType === 'number') {
		return typeof value === 'number' && Number.isFinite(value) ? { end: value, start: value } : undefined;
	}

	return fieldType === 'date' && typeof value === 'string' ? spanOf(value) : undefined;
};

const instantOf = (fieldType: FieldType, value: unknown): number | undefined => spanOfValue(fieldType, value)?.start;

const comparableValueOf = (fieldType: FieldType, value: unknown): number | string | undefined => {
	if (fieldType === 'keyword') {
		return typeof value === 'string' ? value : undefined;
	}

	return instantOf(fieldType, value);
};

const isAuthoredValue = (value: unknown): boolean =>
	(typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length > 0);

const problemWithValue = (fieldName: string, fieldType: FieldType, value: unknown): string | undefined => {
	if (typeof value === 'string' && RESERVED_MARKERS.some((marker) => value.includes(marker))) {
		return `a value may not contain ${quoted(RESERVED_MARKERS)}`;
	}

	if (isAuthoredValue(value)) {
		return comparableValueOf(fieldType, value) === undefined
			? `"${fieldName}" is a ${fieldType} field, so each of its values is ${VALUE_FORMS[fieldType]}`
			: undefined;
	}

	return 'each value is a finite number or a non-empty string';
};

const firstProblem = (problems: readonly (string | undefined)[]): string | undefined =>
	problems.find((problem) => problem !== undefined);

// Two dates come earliest first by the instants their spans start at, which the startup check holds, and two
// strings in code-unit order, which the grammar holds, so both readings of a between's order agree.
const problemWithDateOrder = (fieldType: FieldType, lower: unknown, upper: unknown): string | undefined => {
	const lowerStart = instantOf(fieldType, lower);
	const upperStart = instantOf(fieldType, upper);

	return fieldType === 'date' && lowerStart !== undefined && upperStart !== undefined && lowerStart > upperStart
		? '"between" takes its two dates earliest first'
		: undefined;
};

const problemWithStringOrder = (lower: unknown, upper: unknown): string | undefined =>
	typeof lower === 'string' && typeof upper === 'string' && lower > upper
		? '"between" takes its two strings in code-unit order'
		: undefined;

const problemWithBetweenBounds = (
	fieldName: string,
	fieldType: FieldType,
	lower: unknown,
	upper: unknown,
): string | undefined => {
	if (typeof lower !== typeof upper) {
		return '"between" takes two bounds of one kind';
	}

	if (typeof lower === 'number' && typeof upper === 'number' && lower > upper) {
		return '"between" takes its two numbers lowest first';
	}

	return firstProblem([
		...[lower, upper].map((bound) => problemWithValue(fieldName, fieldType, bound)),
		problemWithDateOrder(fieldType, lower, upper),
		problemWithStringOrder(lower, upper),
	]);
};

const problemWithLeafValue = ({
	canonical,
	fieldName,
	fieldType,
	op,
	value,
}: {
	canonical: string;
	fieldName: string;
	fieldType: FieldType;
	op: string;
	value: unknown;
}): string | undefined => {
	if (canonical === 'in') {
		if (Array.isArray(value) && value.length > 0) {
			return new Set(value).size === value.length
				? firstProblem(value.map((listed) => problemWithValue(fieldName, fieldType, listed)))
				: `"${op}" lists each value once`;
		}

		return `"${op}" lists its values, at least one of them`;
	}

	if (fieldType === 'keyword') {
		return `"${op}" compares only date and number fields, and "${fieldName}" is a keyword field`;
	}

	if (canonical === 'between') {
		return Array.isArray(value) && value.length === 2
			? problemWithBetweenBounds(fieldName, fieldType, value[0], value[1])
			: '"between" takes exactly two bounds';
	}

	return Array.isArray(value) ? `"${op}" takes one bound, not a list` : problemWithValue(fieldName, fieldType, value);
};

const problemWithLeaf = (op: string, content: unknown, mapping: IndexMapping): string | undefined => {
	if (isPlainObject(content)) {
		const extraKeys = Object.keys(content).filter((key) => !LEAF_KEYS.includes(key));
		const { fieldName, value } = content;

		if (extraKeys.length > 0) {
			return `a leaf's content holds only "fieldName" and "value", not ${quoted(extraKeys)}`;
		}

		if (typeof fieldName === 'string' && fieldName.length > 0) {
			const fieldType = fieldTypeOf(mapping, fieldName);

			return fieldType
				? problemWithLeafValue({ canonical: canonicalOperatorOf(op), fieldName, fieldType, op, value })
				: `"${fieldName}" is not a keyword, date or number field of the index mapping`;
		}

		return `"${op}" names its field with a non-empty "fieldName"`;
	}

	return `"${op}" holds its field and value as an object of "fieldName" and "value"`;
};

const describedOperator = (op: unknown): string =>
	typeof op === 'string' && canonicalOperatorOf(op) !== op
		? `${JSON.stringify(op)} (${canonicalOperatorOf(op)})`
		: JSON.stringify(op);

const ACCEPTED_ALIASES = Object.keys(OPERATOR_ALIASES).filter((alias) =>
	LEAF_OPERATORS.includes(canonicalOperatorOf(alias)),
);

const problemWithCondition = (node: unknown, mapping: IndexMapping): string | undefined => {
	if (isPlainObject(node)) {
		const extraKeys = Object.keys(node).filter((key) => !CONDITION_KEYS.includes(key));
		const { content, op } = node;

		if (extraKeys.length > 0) {
			return `a condition holds only "op" and "content", not ${quoted(extraKeys)}`;
		}

		if (op === 'and' || op === 'or') {
			return Array.isArray(content) && content.length > 0
				? firstProblem(content.map((child) => problemWithCondition(child, mapping)))
				: `"${op}" holds at least one condition`;
		}

		if (op === 'not') {
			return Array.isArray(content) && content.length === 1
				? problemWithCondition(content[0], mapping)
				: '"not" holds exactly one condition';
		}

		return typeof op === 'string' && LEAF_OPERATORS.includes(canonicalOperatorOf(op))
			? problemWithLeaf(op, content, mapping)
			: `the operator ${describedOperator(op)} is not one a condition may use, which are and, or, not, ${LEAF_OPERATORS.join(', ')} and the aliases ${ACCEPTED_ALIASES.join(', ')}`;
	}

	return 'a condition is an object of "op" and "content"';
};

const fieldNamesReadBy = (condition: Condition): string[] => {
	switch (condition.op) {
		case 'and':
		case 'not':
		case 'or': {
			return condition.content.flatMap((child) => fieldNamesReadBy(child));
		}
		default: {
			return [condition.content.fieldName];
		}
	}
};

const problemWithCategory = (
	name: string,
	condition: Condition,
	{ mapping, resourceFieldName }: { mapping: IndexMapping; resourceFieldName: string },
): string | undefined => {
	const conditionProblem = problemWithCondition(condition, mapping);

	if (conditionProblem) {
		return `the category "${name}" has a condition a deployment refuses: ${conditionProblem}`;
	}

	return fieldNamesReadBy(condition).includes(resourceFieldName)
		? `the category "${name}" reads the resource field "${resourceFieldName}", which no condition may read`
		: undefined;
};

const problemWithCatalogue = ({ mapping, registration }: Catalogue): string | undefined => {
	const { absentCategories = [], categories, kind, resourceFieldName, resources } = registration;
	const resourceCategories = categories.resource ?? {};
	const resourceCategoryNames = Object.values(resourceCategories).flatMap((named) => Object.keys(named));
	const namedConditions = [
		...Object.entries(categories.global),
		...Object.values(resourceCategories).flatMap((named) => Object.entries(named)),
	];
	const absentNotGlobal = absentCategories.filter(
		(name: unknown) => !(typeof name === 'string' && name.startsWith('global.')),
	);
	const unlistedWithCategories = resources
		? Object.keys(resourceCategories).filter((resourceId) => !resources.includes(resourceId))
		: [];
	const [reservedName] = [
		...Object.keys(categories.global).filter((name) => name === UNMARKED_CATEGORY),
		...resourceCategoryNames.filter((name) => name === RESERVED_RESOURCE_CATEGORY),
	];

	if (kind !== 'record') {
		return `its kind is ${JSON.stringify(kind)}, where a catalogue of records with categories is "record"`;
	}

	if (fieldTypeOf(mapping, resourceFieldName) !== 'keyword') {
		return `its resource field "${resourceFieldName}" is not a keyword field of the index mapping`;
	}

	if (absentNotGlobal.length > 0) {
		return `absentCategories holds global category names only, not ${quoted(absentNotGlobal)}`;
	}

	if (reservedName !== undefined) {
		return `the category name "${reservedName}" is reserved`;
	}

	if (unlistedWithCategories.length > 0) {
		return `resources does not list ${quoted(unlistedWithCategories)}, though each has categories of its own`;
	}

	return firstProblem(
		namedConditions.map(([name, condition]) =>
			problemWithCategory(name, condition, { mapping, resourceFieldName }),
		),
	);
};

/**
 * Throws, naming the category and the rule it breaks, when `catalogue` holds what a deployment refuses at startup:
 * an operator other than `in`, `not`, `and`, `or`, `gt`, `gte`, `lt`, `lte`, `between` and the aliases of `in` and
 * the ranges; an empty `and` or `or`; a `not` not holding exactly one condition; an `in` listing a value twice; a
 * range listing bounds, or on a keyword field; a `between` whose bounds differ in kind, whose numbers are not
 * lowest first, or whose dates are not earliest first, as instants, and in code-unit order; a value that is neither a finite number nor a non-empty string, or names a saved set, a wildcard or
 * missing records; a field the mapping does not type as keyword, date or number; a condition reading the resource
 * field; a global category named `global.unmarked` or a resource category named `resource.unmarked`; an absent
 * category that is not global; or a `resources` list leaving out a resource with categories of its own. Every other
 * export calls it first.
 */
export const assertValidCatalogue = (catalogue: Catalogue): void => {
	const problem = problemWithCatalogue(catalogue);

	if (problem) {
		throw new Error(`Refused catalogue: ${problem}`);
	}
};

const presentValuesOf = (record: CatalogueRecord, fieldName: string): unknown[] =>
	[ownValue(record, fieldName)].flat(Infinity).filter((value) => value !== null && value !== undefined);

const valueOrThrow = <Comparable>(
	fieldName: string,
	fieldType: FieldType,
	value: unknown,
	convert: (fieldType: FieldType, value: unknown) => Comparable | undefined,
): Comparable => {
	const converted = convert(fieldType, value);

	if (converted === undefined) {
		throw new Error(`"${fieldName}" holds ${JSON.stringify(value)}, which is not ${VALUE_FORMS[fieldType]}`);
	}

	return converted;
};

const recordValuesOf = <Comparable>(
	record: CatalogueRecord,
	fieldName: string,
	fieldType: FieldType,
	convert: (fieldType: FieldType, value: unknown) => Comparable | undefined,
): Comparable[] =>
	presentValuesOf(record, fieldName).map((value) => valueOrThrow(fieldName, fieldType, value, convert));

const requiredFieldTypeOf = (mapping: IndexMapping, fieldName: string): FieldType => {
	const fieldType = fieldTypeOf(mapping, fieldName);

	if (fieldType) {
		return fieldType;
	}

	throw new Error(`"${fieldName}" is not a keyword, date or number field of the index mapping`);
};

const matches = (mapping: IndexMapping, record: CatalogueRecord, condition: Condition): boolean => {
	switch (condition.op) {
		case 'and': {
			return condition.content.every((child) => matches(mapping, record, child));
		}
		case 'or': {
			return condition.content.some((child) => matches(mapping, record, child));
		}
		case 'not': {
			return condition.content.every((child) => !matches(mapping, record, child));
		}
		case '=':
		case '==':
		case '===':
		case 'in': {
			const { fieldName, value } = condition.content;
			const fieldType = requiredFieldTypeOf(mapping, fieldName);

			if (fieldType === 'keyword') {
				const listed = value.map((listedValue) =>
					valueOrThrow(fieldName, fieldType, listedValue, comparableValueOf),
				);

				return recordValuesOf(record, fieldName, fieldType, comparableValueOf).some((recordValue) =>
					listed.includes(recordValue),
				);
			}

			const spans = value.map((listedValue) => valueOrThrow(fieldName, fieldType, listedValue, spanOfValue));

			return recordValuesOf(record, fieldName, fieldType, instantOf).some((recordValue) =>
				spans.some((span) => isFromSpanStart(recordValue, span) && isToSpanEnd(recordValue, span)),
			);
		}
		case 'between': {
			const { fieldName, value } = condition.content;
			const [firstBound, secondBound] = value;
			const fieldType = requiredFieldTypeOf(mapping, fieldName);
			const firstSpan = valueOrThrow(fieldName, fieldType, firstBound, spanOfValue);
			const secondSpan = valueOrThrow(fieldName, fieldType, secondBound, spanOfValue);
			// Its bounds come lowest first, as instants and by code unit alike, so it runs from the first bound's
			// span start to the second's end.
			return recordValuesOf(record, fieldName, fieldType, instantOf).some(
				(recordValue) => isFromSpanStart(recordValue, firstSpan) && isToSpanEnd(recordValue, secondSpan),
			);
		}
		default: {
			const { fieldName, value } = condition.content;
			const fieldType = requiredFieldTypeOf(mapping, fieldName);
			const bound = valueOrThrow(fieldName, fieldType, value, spanOfValue);
			const satisfies = RANGE_TESTS[condition.op];

			return recordValuesOf(record, fieldName, fieldType, instantOf).some((recordValue) =>
				satisfies(recordValue, bound),
			);
		}
	}
};

/**
 * Whether `record` carries the category `condition` defines. Missing any field the condition reads, whether absent,
 * null, an empty array or an array of nulls, places the record in the category whatever the rest of the condition
 * says, so a record the condition cannot be judged on fails closed.
 */
const carries = (mapping: IndexMapping, record: CatalogueRecord, condition: Condition): boolean =>
	fieldNamesReadBy(condition).some((fieldName) => presentValuesOf(record, fieldName).length === 0) ||
	matches(mapping, record, condition);

const carriedAmong = (
	mapping: IndexMapping,
	record: CatalogueRecord,
	named: Readonly<{ [name: string]: Condition }>,
): string[] =>
	Object.entries(named)
		.filter(([, condition]) => carries(mapping, record, condition))
		.map(([name]) => name);

const resourceIdsOf = (registration: RecordKeyRegistration, record: CatalogueRecord): string[] => {
	const values = presentValuesOf(record, registration.resourceFieldName);
	const resourceIds = values.filter((value): value is string => typeof value === 'string');

	if (resourceIds.length === values.length) {
		return [...new Set(resourceIds)];
	}

	throw new Error(`A record holds a resource value in "${registration.resourceFieldName}" that is not a string`);
};

/**
 * The global categories `record` carries, and, by each of its resource values, the categories of that resource's own
 * it carries.
 */
const carriedBy = (
	{ mapping, registration }: Catalogue,
	record: CatalogueRecord,
): Readonly<{ global: readonly string[]; resource: ReadonlyMap<string, readonly string[]> }> => {
	const { global, resource = {} } = registration.categories;

	return {
		global: carriedAmong(mapping, record, global),
		resource: new Map(
			resourceIdsOf(registration, record).map((resourceId): [string, string[]] => [
				resourceId,
				carriedAmong(mapping, record, ownValue(resource, resourceId) ?? NO_CATEGORIES),
			]),
		),
	};
};

/**
 * Whether the rendered access filter serves `record` to a principal holding `grants`. With V the record's resource
 * values, the known resources are `registration.resources` when the registration lists them, otherwise the resources
 * the grants name, and the held resources are the granted ones that are known. The filter serves the record only when
 * all of these hold, the missing-field rule deciding which categories it carries:
 *
 * 1. some value in V is a held resource;
 * 2. no value in V is known but not held, values that are not known being passed over;
 * 3. for every global category the record carries, no value in V is a held resource lacking it;
 * 4. for every category of a resource R in V that the record carries, R is not a held resource lacking it;
 * 5. for every held value v in V lacking `global.unmarked`, the record carries a category of C(v), which holds every
 *    global category and v's own resource categories, so a resource category counts only toward its own resource.
 *
 * A record of one resource meets the same steps with one value, and a record missing its resource field, whether
 * absent, null, an empty array or an array of nulls, fails the first.
 */
const isServedByFilter = (catalogue: Catalogue, grants: Grants, record: CatalogueRecord): boolean => {
	const { registration } = catalogue;
	const values = resourceIdsOf(registration, record);
	const known = registration.resources ?? Object.keys(grants);
	const isKnown = (resourceId: string): boolean => known.includes(resourceId);
	const heldOn = (resourceId: string): readonly string[] | undefined =>
		isKnown(resourceId) ? ownValue(grants, resourceId) : undefined;
	const heldValues = values.flatMap((resourceId): [string, readonly string[]][] => {
		const held = heldOn(resourceId);

		return held ? [[resourceId, held]] : [];
	});
	const isHeldOnEveryHeldValue = (name: string): boolean => heldValues.every(([, held]) => held.includes(name));
	const carried = carriedBy(catalogue, record);
	const carriesCategoryFor = (resourceId: string): boolean =>
		carried.global.length > 0 || (carried.resource.get(resourceId) ?? []).length > 0;

	const someValueHeld = heldValues.length > 0;
	const everyKnownValueHeld = values.filter(isKnown).every((resourceId) => heldOn(resourceId) !== undefined);
	const globalCategoriesHeld = carried.global.every(isHeldOnEveryHeldValue);
	const resourceCategoriesHeld = [...carried.resource].every(([resourceId, resourceCategories]) => {
		const held = heldOn(resourceId);

		return held === undefined || resourceCategories.every((name) => held.includes(name));
	});
	const unmarkedHeldWhereNeeded = heldValues.every(
		([resourceId, held]) => held.includes(UNMARKED_CATEGORY) || carriesCategoryFor(resourceId),
	);

	return (
		someValueHeld &&
		everyKnownValueHeld &&
		globalCategoriesHeld &&
		resourceCategoriesHeld &&
		unmarkedHeldWhereNeeded
	);
};

/**
 * The distinct resource ids `record` holds in the registration's resource field, empty when that field is missing:
 * absent, null, an empty array or an array of nulls. Throws on a resource value that is not a string.
 */
export const resourcesOf = ({ catalogue, record }: { catalogue: Catalogue; record: CatalogueRecord }): string[] => {
	assertValidCatalogue(catalogue);

	return resourceIdsOf(catalogue.registration, record);
};

/**
 * The names of the categories `record` carries, in alphabetical order: every global category, and every category of
 * each resource the record holds, whose condition the record meets or reads a field the record is missing.
 */
export const categoriesOf = ({ catalogue, record }: { catalogue: Catalogue; record: CatalogueRecord }): string[] => {
	assertValidCatalogue(catalogue);

	const carried = carriedBy(catalogue, record);

	return [...new Set([...carried.global, ...[...carried.resource.values()].flat()])].toSorted();
};

/**
 * Whether a principal holding `grants` may see `record`, as the rendered access filter decides it. A record of one
 * resource is visible when that resource is known and granted and holds every category the record carries, or, the
 * record carrying none, holds `global.unmarked`. A record of several resources is visible when one of them is held,
 * none is known but not held, every held one holds each global category it carries, each held one holds the
 * categories of its own that the record carries, and every held one for which the record carries no global category
 * and none of its own holds `global.unmarked`. A record missing its resource field is never visible.
 */
export const isVisible = ({
	catalogue,
	grants,
	record,
}: {
	catalogue: Catalogue;
	grants: Grants;
	record: CatalogueRecord;
}): boolean => {
	assertValidCatalogue(catalogue);

	return isServedByFilter(catalogue, grants, record);
};

/** The records of `records` a principal holding `grants` may see, in their given order. */
export const visibleRecords = <Indexed extends CatalogueRecord>({
	catalogue,
	grants,
	records,
}: {
	catalogue: Catalogue;
	grants: Grants;
	records: readonly Indexed[];
}): Indexed[] => {
	assertValidCatalogue(catalogue);

	return records.filter((record) => isServedByFilter(catalogue, grants, record));
};
