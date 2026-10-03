import { omit } from 'lodash-es';

import {
	IN_OP,
	NOT_IN_OP,
	SOME_NOT_IN_OP,
	OR_OP,
	AND_OP,
	NOT_OP,
	OP_ALIASES,
	ARRAY_CONTENT,
	REGEX,
	SET_ID,
	MISSING,
	ALL_OP,
} from '#middleware/constants.js';

import { InvalidFilterError } from './InvalidFilterError.js';

// _UNFLAT_KEY_ is a ephemeral mark for groupingOptimizer to not apply grouping
const _UNFLAT_KEY_ = '__unflat__';
function groupingOptimizer({ op, content, pivot }) {
	return {
		op,
		pivot,
		content: content.map(normalizeFilters).reduce((filters, f) => {
			const samePivot = f.pivot === pivot || !f.pivot;
			// An empty combination means every document, so flattening one away is removal, which leaves
			// the meaning unchanged only under `and`: under `or` it would turn "X or everything" into X.
			const removable = f.content.length > 0 || op === AND_OP;
			// `not` excluded: flattening is associativity, which negation lacks. `not[not[X]]` is X.
			if (f.op === op && op !== NOT_OP && !f[_UNFLAT_KEY_] && samePivot && removable) {
				return [...filters, ...f.content];
			} else {
				return [...filters, omit(f, _UNFLAT_KEY_)];
			}
		}, []),
	};
}

function isSpecialFilter(value) {
	return [REGEX, SET_ID, MISSING].some((x) => `${value}`.includes(x));
}

function isLeafContent(content) {
	return !!content && typeof content === 'object' && !Array.isArray(content) && 'value' in content;
}

const applyDefaultPivots = (filter) => {
	const { content, pivot = null } = filter;

	if (isLeafContent(content)) {
		return {
			...filter,
			pivot,
		};
	} else {
		return {
			...filter,
			pivot,
			content: filter.content.map(applyDefaultPivots),
		};
	}
};

function normalizeFilters(filter) {
	const { op, content } = filter;

	if (!op) {
		throw new InvalidFilterError('Each filter node must name its operator in op.');
	} else if (!content) {
		throw new InvalidFilterError('Each filter node must carry its content.');
	}

	const { value } = content;
	if (OP_ALIASES[op]) {
		return normalizeFilters({ ...filter, op: OP_ALIASES[op] });
	} else if (ARRAY_CONTENT.includes(op) && !Array.isArray(value)) {
		return normalizeFilters({
			...filter,
			content: { ...content, value: [].concat(value) },
		});
	} else if ([IN_OP, NOT_IN_OP, SOME_NOT_IN_OP].includes(op) && value.some(isSpecialFilter) && value.length > 1) {
		// Each special value gets a clause of its own, beside one clause for the plain values, and the parts
		// are joined by the operator's meaning below.
		const specialFilters = value.filter(isSpecialFilter).map((specialValue) => ({
			...filter,
			content: { ...content, value: [specialValue] },
		}));

		const normalValues = value.filter((psv) => !isSpecialFilter(psv));
		const filters =
			normalValues.length > 0
				? [{ ...filter, content: { ...content, value: normalValues } }, ...specialFilters]
				: specialFilters;

		// Matching any of the values is an or of the parts; excluding all of them is an and of the parts.
		return normalizeFilters({ op: op === IN_OP ? OR_OP : AND_OP, content: filters });
	} else if ([AND_OP, OR_OP, NOT_OP].includes(op)) {
		return groupingOptimizer(filter);
	} else {
		return filter;
	}
}

export default (filter) => {
	const output = filter ? applyDefaultPivots(normalizeFilters(filter)) : filter;

	return output;
};
