import { cloneDeep } from 'lodash-es';

import { opSwitch } from '#middleware/buildQuery/index.js';
import normalizeFilters from '#middleware/buildQuery/normalizeFilters.js';
import { AGGS_WRAPPER_FILTERED } from '#middleware/constants.js';
import { applyNestingPrefix } from '#middleware/utils/nestingPrefix.js';

/*
 * due to this problem: https://github.com/kids-first/kf-portal-ui/issues/488
 * queries that are on a term that shares a parent with a aggregation field
 * needs to be dropped down to the aggregation level as a filter.
 */
const injectNestedFiltersToAggs = ({ aggs, nestedSqonFilters, aggregationsFilterThemselves, nestingPrefix }) =>
	Object.entries(aggs).reduce((acc, [aggName, aggContent]) => {
		const skipToNextLevel = () => {
			acc[aggName] = {
				...aggContent,
				aggs: injectNestedFiltersToAggs({
					aggs: aggContent.aggs,
					nestedSqonFilters,
					aggregationsFilterThemselves,
					nestingPrefix,
				}),
			};
			return acc;
		};
		const wrapInFilterAgg = () => {
			// aggName's own field name is clean (Phase-1-shaped); nestedSqonFilters' entries carry the
			// real, nestingPrefix-qualified ES path (see middleware/buildAggregations/index.js), so it
			// needs the same prefix applied before the two can be compared.
			const esFieldName = applyNestingPrefix(aggName.split(':')[0], nestingPrefix);

			acc[aggName] = {
				...aggContent,
				aggs: {
					[`${aggContent.nested.path}:${AGGS_WRAPPER_FILTERED}`]: {
						filter: {
							bool: {
								should: nestedSqonFilters[aggContent.nested.path]
									.filter(
										(sqonFilter) =>
											aggregationsFilterThemselves || esFieldName !== sqonFilter.content.fieldName,
									)
									.map((sqonFilter) =>
										opSwitch({
											nestedFieldNames: [],
											filter: normalizeFilters(sqonFilter),
										}),
									),
							},
						},
						aggs: injectNestedFiltersToAggs({
							aggs: aggContent.aggs,
							nestedSqonFilters,
							aggregationsFilterThemselves,
							nestingPrefix,
						}),
					},
				},
			};
			return acc;
		};

		if (aggContent.global || aggContent.filter) {
			return skipToNextLevel();
		} else if (aggContent.nested) {
			if (nestedSqonFilters[aggContent.nested.path]) {
				return wrapInFilterAgg();
			} else {
				return skipToNextLevel();
			}
		} else {
			return acc;
		}
	}, cloneDeep(aggs));

export default injectNestedFiltersToAggs;
