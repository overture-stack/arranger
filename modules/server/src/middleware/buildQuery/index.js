import _ from 'lodash';

import {
	ES_NESTED,
	ES_QUERY,
	ES_BOOL,
	BETWEEN_OP,
	GT_OP,
	GTE_OP,
	LT_OP,
	LTE_OP,
	IN_OP,
	NOT_IN_OP,
	SOME_NOT_IN_OP,
	ES_MUST,
	ES_MUST_NOT,
	ES_ARRANGER_SET_INDEX,
	ES_ARRANGER_SET_TYPE,
	OR_OP,
	AND_OP,
	FILTER_OP,
	NOT_OP,
	REGEX,
	SET_ID,
	MISSING,
	ALL_OP,
	ES_SHOULD,
	ES_WILDCARD,
} from '../constants';
import {
	isNested,
	readPath,
	wrapMustNot,
	wrapNested,
	mergePath,
	wrapShould,
	wrapMust,
	toEsRangeValue,
} from '../utils/esFilter';

import normalizeFilters from './normalizeFilters';

const wrapFilter = ({ esFilter, nestedFieldNames, filter, isNot }) => {
	return filter?.content?.fieldName
		?.split('.')
		.slice(0, -1)
		.map((p, i, segments) => segments.slice(0, i + 1).join('.'))
		.filter((p) => nestedFieldNames?.includes?.(p))
		.reverse()
		.reduce(
			(esFilter, path, i) => wrapNested(esFilter, path),
			isNot ? wrapMustNot(esFilter) : esFilter,
		);
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
		esFilter: { regexp: { [fieldName]: value.replace('*', '.*') } },
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

function getFuzzyFilter({ nestedFieldNames, filter }) {
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
	return wrapFilter({
		esFilter: { exists: { field: fieldName, boost: 0 } },
		nestedFieldNames,
		filter,
		isNot: op === IN_OP,
	});
}

function getRangeFilter({ nestedFieldNames, filter }) {
	const {
		op,
		content: { fieldName, value },
	} = filter;
	return wrapFilter({
		filter,
		nestedFieldNames,
		esFilter: {
			range: {
				[fieldName]: {
					boost: 0,
					[op]: toEsRangeValue([GT_OP, GTE_OP]?.includes?.(op) ? _.max(value) : _.min(value)),
				},
			},
		},
	});
}

function collapseNestedFilters({ esFilter, bools }) {
	const filterIsNested = isNested(esFilter);
	const basePath = [...(filterIsNested ? [ES_NESTED, ES_QUERY] : []), ES_BOOL];
	const path = [ES_MUST, ES_MUST_NOT]
		.map((p) => [...basePath, p])
		.find((path) => _.get(esFilter, path));

	const found =
		path &&
		bools.find((bool) =>
			filterIsNested ? readPath(bool) === readPath(esFilter) : _.get(bool, path),
		);

	return [
		...bools.filter((bool) => bool !== found),
		found
			? mergePath(
					found,
					path,
					filterIsNested
						? collapseNestedFilters({
								esFilter: _.get(esFilter, path)[0],
								bools: _.get(found, path, []),
						  })
						: [..._.get(found, path), ..._.get(esFilter, path)],
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
	const isNested = !!esFilters[0]?.nested;
	if (isNested && esFilters.map((f) => f.nested?.path)?.includes?.(pivot)) {
		const flattned = esFilters.reduce(
			(bools, esFilter) =>
				op === AND_OP || op === NOT_OP
					? collapseNestedFilters({ esFilter, bools })
					: [...bools, esFilter],
			[],
		);
		return applyBooleanWrapper(flattned);
	} else {
		return applyBooleanWrapper(esFilters);
	}
}

function getSetFilter({ nestedFieldNames, filter, filter: { content, op } }) {
	return wrapFilter({
		isNot: op === NOT_IN_OP,
		filter,
		nestedFieldNames,
		esFilter: {
			terms: {
				boost: 0,
				[content.fieldName]: {
					index: ES_ARRANGER_SET_INDEX,
					type: ES_ARRANGER_SET_TYPE,
					id: _.flatMap([content.value])[0].replace('set_id:', ''),
					path: 'ids',
				},
			},
		},
	});
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
	// we need a way to handle object fields before the following error is valid
	// if (pivot && pivot !== '.' && !nestedFieldNames.includes(pivot)) {
	//   throw new Error(`Invalid pivot field "${pivot}", not a nested field`);
	// }
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
	} else if (FILTER_OP === op) {
		return getFuzzyFilter({ nestedFieldNames, filter });
	} else {
		throw new Error('unknown op');
	}
};

export default function ({ nestedFieldNames = [], filters: rawFilters }) {
	if (Object.keys(rawFilters || {}).length === 0) return {};

	return opSwitch({
		nestedFieldNames,
		filter: normalizeFilters(rawFilters),
	});
}
