import { opSwitch } from '../buildQuery';
import normalizeFilters from '../buildQuery/normalizeFilters';
import { AGGS_WRAPPER_FILTERED } from '../constants';
import { cloneDeep } from 'lodash';

/*
 * due to this problem: https://github.com/kids-first/kf-portal-ui/issues/488
 * queries that are on a term that shares a parent with a aggregation field
 * needs to be dropped down to the aggregation level as a filter.
 */
const injectNestedFiltersToAggs = ({ aggs, nestedSqonFilters, aggregationsFilterThemselves }) =>
  Object.entries(aggs).reduce((acc, [aggName, aggContent]) => {
    const skipToNextLevel = () => {
      acc[aggName] = {
        ...aggContent,
        aggs: injectNestedFiltersToAggs({
          aggs: aggContent.aggs,
          nestedSqonFilters,
          aggregationsFilterThemselves,
        }),
      };
      return acc;
    };
    const wrapInFilterAgg = () => {
      acc[aggName] = {
        ...aggContent,
        aggs: {
          [`${aggContent.nested.path}:${AGGS_WRAPPER_FILTERED}`]: {
            filter: {
              bool: {
                should: nestedSqonFilters[aggContent.nested.path]
                  .filter(
                    (sqonFilter) =>
                      aggregationsFilterThemselves ||
                      aggName.split(':')[0] !== sqonFilter.content.field,
                  )
                  .map((sqonFilter) =>
                    opSwitch({
                      nestedFields: [],
                      filter: normalizeFilters(sqonFilter),
                    }),
                  ),
              },
            },
            aggs: injectNestedFiltersToAggs({
              aggs: aggContent.aggs,
              nestedSqonFilters,
              aggregationsFilterThemselves,
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
