import { format, isValid, parseISO } from 'date-fns';
import _ from 'lodash-es';

import * as CONSTANTS from '#middleware/constants.js';

export function mergePath(target, [key, ...path], data) {
	return {
		...target,
		[key]: path.length ? mergePath(_.get(target, key, {}), path, data) : data,
	};
}

export function isNested(filter) {
	return filter && filter.hasOwnProperty(CONSTANTS.ES_NESTED);
}

export function readPath(filter) {
	return _.get(filter, [CONSTANTS.ES_NESTED, CONSTANTS.ES_PATH], '');
}

export function wrapMustNot(value) {
	return wrapBool(CONSTANTS.ES_MUST_NOT, value);
}

export function wrapMust(value) {
	return wrapBool(CONSTANTS.ES_MUST, value);
}

export function wrapShould(value) {
	return wrapBool(CONSTANTS.ES_SHOULD, value);
}

export function wrapNested(esFilter, path) {
	return {
		[CONSTANTS.ES_NESTED]: {
			[CONSTANTS.ES_PATH]: path,
			[CONSTANTS.ES_QUERY]: esFilter[CONSTANTS.ES_BOOL] ? esFilter : wrapMust(esFilter),
		},
	};
}

export function wrapBool(op, value) {
	return {
		[CONSTANTS.ES_BOOL]: {
			[op]: Array.isArray(value) ? value : [value],
		},
	};
}

/**
 * Whether `value` is a date alone: a string of `YYYY-MM-DD` naming a real calendar date, with no time.
 *
 * @param {unknown} value a value from a filter.
 * @returns {boolean} true for a date alone, and false for anything else, a date-time or a number included.
 */
export function isDateAlone(value) {
	if (typeof value === 'string') {
		const date = parseISO(value);

		return isValid(date) && format(date, CONSTANTS.DATE_FORMAT) === value;
	}

	return false;
}

// Both written in `ES_DATE_FORMAT`, to its full precision.
const firstInstantOf = (dateAlone) => `${dateAlone} 00:00:00.000000`;
const lastInstantOf = (dateAlone) => `${dateAlone} 23:59:59.999999`;

/**
 * A range bound as the search engine receives it. A date alone on a field whose format holds the legacy
 * pattern becomes the instant giving it the reading the engine gives a date alone by itself, its whole
 * day: the day's first instant for `gte` and `lt`, and its last for `gt` and `lte`. Every other value is
 * kept as written.
 *
 * @param {object} args
 * @param {boolean} args.isLegacyDateField whether the field's mapping format holds `ES_DATE_FORMAT`.
 * @param {string} args.op the bound's operator: `gt`, `gte`, `lt` or `lte`.
 * @param {unknown} args.value the bound, as the filter holds it.
 * @returns {unknown}
 */
export function toEsRangeValue({ isLegacyDateField, op, value }) {
	if (isLegacyDateField && isDateAlone(value)) {
		return [CONSTANTS.GT_OP, CONSTANTS.LTE_OP].includes(op) ? lastInstantOf(value) : firstInstantOf(value);
	}

	return value;
}
