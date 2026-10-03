import { setsProperties } from '@overture-stack/arranger-types/configs';
import _ from 'lodash-es';

import fallbackConfigs from '#config/constants.js';
import {
	ALL_OP,
	AND_OP,
	BETWEEN_OP,
	ES_BOOL,
	ES_MUST,
	ES_MUST_NOT,
	ES_NESTED,
	ES_QUERY,
	ES_SHOULD,
	ES_WILDCARD,
	FILTER_OP,
	WILDCARD_OP,
	GTE_OP,
	GT_OP,
	IN_OP,
	LTE_OP,
	LT_OP,
	MISSING,
	NOT_IN_OP,
	NOT_OP,
	OR_OP,
	REGEX,
	SET_ID,
	SOME_NOT_IN_OP,
} from '#middleware/constants.js';
import {
	isNested,
	mergePath,
	readPath,
	toEsRangeValue,
	wrapMust,
	wrapMustNot,
	wrapNested,
	wrapShould,
} from '#middleware/utils/esFilter.js';
import { applyNestingPrefixToFieldNames, applyNestingPrefixToSqon } from '#middleware/utils/nestingPrefix.js';

import { InvalidFilterError } from './InvalidFilterError.js';
import normalizeFilters from './normalizeFilters.js';

const { sets } = fallbackConfigs;

const wrapFilter = ({ esFilter, nestedFieldNames, filter, isNot }) => {
	return filter?.content?.fieldName
		?.split('.')
		.slice(0, -1)
		.map((p, i, segments) => segments.slice(0, i + 1).join('.'))
		.filter((p) => nestedFieldNames?.includes?.(p))
		.reverse()
		.reduce((esFilter, path, i) => wrapNested(esFilter, path), isNot ? wrapMustNot(esFilter) : esFilter);
};

function getRegexFilter({ nestedFieldNames, filter }) {
	const {
		op,
		content: {
			fieldName,
			value: [value],
		},
	} = filter;
	const esFilter = wrapFilter({
		filter,
		nestedFieldNames,
		esFilter: { regexp: { [fieldName]: value.replace(/\*/g, '.*') } },
		isNot: NOT_IN_OP === op,
	});

	return op === SOME_NOT_IN_OP ? wrapMustNot(esFilter) : esFilter;
}

function getTermFilter({ nestedFieldNames, filter }) {
	const {
		op,
		content: { value, fieldName },
	} = filter;
	const esFilter = wrapFilter({
		filter,
		nestedFieldNames,
		esFilter: { terms: { [fieldName]: value.map((item) => item || ''), boost: 0 } },
		isNot: NOT_IN_OP === op,
	});

	return op === SOME_NOT_IN_OP ? wrapMustNot(esFilter) : esFilter;
}

function getWildcardFilter({ nestedFieldNames, filter }) {
	const { content } = filter;
	const { value, fieldNames } = content;

	// group queries by their nesting level
	const sortedNested = nestedFieldNames?.slice().sort((a, b) => b.length - a.length);
	const nestedMap = fieldNames.reduce((acc, fieldName) => {
		const group = sortedNested?.find((y) => fieldName?.includes?.(y)) || '';
		if (acc[group]) {
			acc[group].push(fieldName);
		} else {
			acc[group] = [fieldName];
		}
		return acc;
	}, {});

	// construct one multi match per nested group
	return wrapShould(
		Object.values(nestedMap).map((fieldNames) =>
			wrapFilter({
				filter: { ...filter, content: { ...content, fieldName: fieldNames[0] } },
				nestedFieldNames,
				esFilter: wrapShould(
					fieldNames.map((fieldName) => ({
						[ES_WILDCARD]: {
							[fieldName]: {
								value: `${value}`,
								case_insensitive: true,
							},
						},
					})),
				),
			}),
		),
	);
}

function getMissingFilter({ nestedFieldNames, filter }) {
	const {
		content: { fieldName },
		op,
	} = filter;
	const wrapExists = (isNot) =>
		wrapFilter({ esFilter: { exists: { field: fieldName, boost: 0 } }, nestedFieldNames, filter, isNot });
	const someItemLacksIt = wrapExists(true);

	if (op === IN_OP) {
		return someItemLacksIt;
	}

	// some-not-in is universal on a nested field: no item lacks the field. On a flat field it reads as not-in.
	if (op === SOME_NOT_IN_OP && isNested(someItemLacksIt)) {
		return wrapMustNot(someItemLacksIt);
	}

	return wrapExists(false);
}

/** An entry that can bound a range: a finite number, a non-empty string, or any other value a search engine might accept. */
const canBoundRange = (bound) =>
	typeof bound === 'number' ? Number.isFinite(bound) : typeof bound === 'string' ? bound.length > 0 : bound != null;

// Every bound in a list applies: a list of numbers reduces to its strictest, and any other list is
// applied bound by bound. An entry that cannot bound a range is left out beside one that can.
function getRangeFilter({ nestedFieldNames, filter }) {
	const {
		op,
		content: { fieldName, value },
	} = filter;
	const usableBounds = value.filter(canBoundRange);
	const bounds = usableBounds.length > 0 ? usableBounds : value;
	const rangeFrom = (bound) => ({ range: { [fieldName]: { boost: 0, [op]: toEsRangeValue(bound) } } });
	const reducesToOneBound = bounds.length === 1 || bounds.every((bound) => typeof bound === 'number');

	return wrapFilter({
		filter,
		nestedFieldNames,
		esFilter: reducesToOneBound
			? rangeFrom([GT_OP, GTE_OP].includes(op) ? _.max(bounds) : _.min(bounds))
			: wrapMust(bounds.map(rangeFrom)),
	});
}

// Only nested clauses on the same path merge, which holds their conditions to one item. Any other
// clause stays its own: merging two bools would change what a not, or a must_not, negates.
function collapseNestedFilters({ esFilter, bools }) {
	if (!isNested(esFilter)) {
		return [...bools, esFilter];
	}

	const basePath = [ES_NESTED, ES_QUERY, ES_BOOL];
	const path = [ES_MUST, ES_MUST_NOT].map((p) => [...basePath, p]).find((path) => _.get(esFilter, path));
	const found = path && bools.find((bool) => readPath(bool) === readPath(esFilter));

	return [
		...bools.filter((bool) => bool !== found),
		found
			? mergePath(
					found,
					path,
					collapseNestedFilters({
						esFilter: _.get(esFilter, path)[0],
						bools: _.get(found, path, []),
					}),
				)
			: esFilter,
	];
}

const wrappers = {
	[AND_OP]: wrapMust,
	[OR_OP]: wrapShould,
	[NOT_OP]: wrapMustNot,
};
function getGroupFilter({ nestedFieldNames, filter: { content, op, pivot } }) {
	const applyBooleanWrapper = wrappers[op];
	const esFilters = content.map((filter) => opSwitch({ nestedFieldNames, filter }));
	// A pivot holds the conditions on its path to one nested item, whichever child comes first.
	if (esFilters.some((esFilter) => isNested(esFilter) && esFilter.nested.path === pivot)) {
		const flattned = esFilters.reduce(
			(bools, esFilter) =>
				op === AND_OP || op === NOT_OP ? collapseNestedFilters({ esFilter, bools }) : [...bools, esFilter],
			[],
		);
		return applyBooleanWrapper(flattned);
	} else {
		return applyBooleanWrapper(esFilters);
	}
}

function getSetFilter({ nestedFieldNames, filter, filter: { content, op } }) {
	const esFilter = wrapFilter({
		isNot: op === NOT_IN_OP,
		filter,
		nestedFieldNames,
		esFilter: {
			terms: {
				boost: 0,
				[content.fieldName]: {
					// FIXME: use configs from router instead of constants
					index: sets[setsProperties.INDEX],
					type: sets[setsProperties.INDEX],
					id: _.flatMap([content.value])[0].replace('set_id:', ''),
					path: 'ids',
				},
			},
		},
	});

	return op === SOME_NOT_IN_OP ? wrapMustNot(esFilter) : esFilter;
}

const getBetweenFilter = ({ nestedFieldNames, filter }) => {
	const {
		content: { fieldName, value },
	} = filter;
	return wrapFilter({
		filter,
		nestedFieldNames,
		esFilter: {
			range: {
				[fieldName]: {
					boost: 0,
					[GTE_OP]: _.min(value),
					[LTE_OP]: _.max(value),
				},
			},
		},
	});
};

export const opSwitch = ({ nestedFieldNames, filter }) => {
	const {
		op,
		pivot,
		content: { value },
	} = filter;

	if (pivot && pivot !== '.' && !nestedFieldNames.includes(pivot)) {
		throw new InvalidFilterError(
			"A filter's pivot must name a nested field of this catalogue; it requires the filter's conditions to hold for the same nested object.",
		);
	}

	if ([OR_OP, AND_OP, NOT_OP].includes(op)) {
		return getGroupFilter({ nestedFieldNames, filter });
	} else if ([IN_OP, NOT_IN_OP, SOME_NOT_IN_OP].includes(op)) {
		if (`${value[0]}`.includes(REGEX)) {
			return getRegexFilter({ nestedFieldNames, filter });
		} else if (`${value[0]}`.includes(SET_ID)) {
			return getSetFilter({ nestedFieldNames, filter });
		} else if (`${value[0]}`.includes(MISSING)) {
			return getMissingFilter({ nestedFieldNames, filter });
		} else {
			return getTermFilter({ nestedFieldNames, filter });
		}
	} else if ([ALL_OP].includes(op)) {
		return getGroupFilter({
			nestedFieldNames,
			filter: {
				op: AND_OP,
				pivot: pivot || '.',
				content: filter.content.value.map((v) => ({
					op: IN_OP,
					content: {
						fieldName: filter.content.fieldName,
						value: [v],
					},
				})),
			},
		});
	} else if ([GT_OP, GTE_OP, LT_OP, LTE_OP].includes(op)) {
		return getRangeFilter({ nestedFieldNames, filter });
	} else if ([BETWEEN_OP].includes(op)) {
		return getBetweenFilter({ nestedFieldNames, filter });
	} else if (WILDCARD_OP === op || FILTER_OP === op) {
		return getWildcardFilter({ nestedFieldNames, filter });
	} else {
		throw new InvalidFilterError(
			'Each filter node must name an operator SQON defines, such as and, or, not, in or gte.',
		);
	}
};

/**
 * Compiles a SQON into an Elasticsearch query body.
 *
 * @param {object} args
 * @param {string} [args.caller] Label used in diagnostics only.
 * @param {string[]} [args.nestedFieldNames] Paths mapped as `nested`, so their clauses are wrapped.
 * @param {string} [args.nestingPrefix] Prefix applied to field names before compilation.
 * @param {object} [args.filters] The SQON to compile. Absent or empty compiles to `{}`, which
 *   matches every document, so callers on an access-control path must guarantee a filter separately.
 *   `compileFilter` is what enforces that, and it throws rather than returning a nullish filter.
 * @returns {object} An Elasticsearch query body.
 */
export default function ({ caller = 'unknown', nestedFieldNames = [], nestingPrefix, filters: rawFilters }) {
	if (Object.keys(rawFilters || {}).length === 0) return {};

	return opSwitch({
		nestedFieldNames: applyNestingPrefixToFieldNames(nestedFieldNames, nestingPrefix) ?? nestedFieldNames,
		filter: normalizeFilters(applyNestingPrefixToSqon(rawFilters, nestingPrefix)),
	});
}
