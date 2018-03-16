import _ from 'lodash';
import {
  ES_NESTED,
  ES_QUERY,
  ES_BOOL,
  GT_OP,
  GTE_OP,
  LT_OP,
  LTE_OP,
  IN_OP,
  NOT_IN_OP,
  SOME_NOT_IN_OP,
  ES_MUST,
  ES_MUST_NOT,
  ES_MULTI_MATCH,
  ES_FIELDS,
  ES_TYPE,
  ES_PHRASE_PREFIX,
  OR_OP,
  AND_OP,
  MISSING_OP,
  FILTER_OP,
  NOT_OP,
} from '../constants';
import normalizeFilters from './normalizeFilters';
import {
  isNested,
  readPath,
  wrapMustNot,
  wrapNested,
  mergePath,
  wrapShould,
  wrapMust,
} from '../utils/esFilter';

function wrapFilter({ esFilter, nestedFields, filter, isNot }) {
  return filter.content.field
    .split('.')
    .slice(0, -1)
    .map((p, i, segments) => segments.slice(0, i + 1).join('.'))
    .filter(p => nestedFields.includes(p))
    .reverse()
    .reduce(
      (esFilter, path, i) => wrapNested(esFilter, path),
      isNot ? wrapMustNot(esFilter) : esFilter,
    );
}

function getRegexFilter({ nestedFields, filter }) {
  const { op, content: { field, value: [value] } } = filter;

  const esFilter = wrapFilter({
    filter,
    nestedFields,
    esFilter: { regexp: { [field]: value } },
    isNot: NOT_IN_OP === op,
  });

  return op === SOME_NOT_IN_OP ? wrapMustNot(esFilter) : esFilter;
}

function getTermFilter({ nestedFields, filter }) {
  const { op, content: { value, field } } = filter;

  const esFilter = wrapFilter({
    filter,
    nestedFields,
    esFilter: { terms: { [field]: value.map(item => item || ''), boost: 0 } },
    isNot: NOT_IN_OP === op,
  });

  return op === SOME_NOT_IN_OP ? wrapMustNot(esFilter) : esFilter;
}

function getFuzzyFilter({ nestedFields, filter }) {
  const { content: { value, fields } } = filter;

  // group queries by their nesting level
  const sortedNested = nestedFields.slice().sort((a, b) => b.length - a.length);
  const nestedMap = fields.reduce((map, field) => {
    const group = sortedNested.find(y => field.includes(y)) || '';
    return { ...map, [group]: [...(map[group] || []), field] };
  }, {});

  // construct one multi match per nested group
  return wrapShould(
    Object.values(nestedMap).map(fields =>
      wrapFilter({
        filter: { ...filter, field: fields[0] },
        nestedFields,
        esFilter: {
          [ES_MULTI_MATCH]: {
            [ES_QUERY]: value,
            [ES_FIELDS]: fields,
            [ES_TYPE]: ES_PHRASE_PREFIX,
          },
        },
      }),
    ),
  );
}

function getMissingFilter({ nestedFields, filter }) {
  const { content: { value, field } } = filter;

  return wrapFilter({
    esFilter: { exists: { field: field, boost: 0 } },
    nestedFields,
    filter,
    isNot: value,
  });
}

function getRangeFilter({ nestedFields, filter }) {
  const { op, content: { field, value } } = filter;

  return wrapFilter({
    filter,
    nestedFields,
    esFilter: {
      range: {
        [field]: {
          boost: 0,
          [op]: [GT_OP, GTE_OP].includes(op) ? _.max(value) : _.min(value),
        },
      },
    },
  });
}

function collapseNestedFilters({ esFilter, bools }) {
  const filterIsNested = isNested(esFilter);
  const basePath = [...(filterIsNested ? [ES_NESTED, ES_QUERY] : []), ES_BOOL];
  const path = [ES_MUST, ES_MUST_NOT]
    .map(p => [...basePath, p])
    .find(path => _.get(esFilter, path));

  const found =
    path &&
    bools.find(
      bool =>
        filterIsNested
          ? readPath(bool) === readPath(esFilter)
          : _.get(bool, path),
    );

  return [
    ...bools.filter(bool => bool !== found),
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
function getGroupFilter({ nestedFields, filter: { content, op } }) {
  const esFilters = content
    .map(filter => opSwitch({ nestedFields, filter }))
    .reduce(
      (bools, esFilter) =>
        op === AND_OP || op === NOT_OP
          ? collapseNestedFilters({ esFilter, bools })
          : [...bools, esFilter],
      [],
    );

  return wrappers[op](esFilters);
}

function opSwitch({ nestedFields, filter }) {
  const { op, content: { isRegex } } = filter;
  if ([OR_OP, AND_OP, NOT_OP].includes(op)) {
    return getGroupFilter({ nestedFields, filter });
  } else if ([IN_OP, NOT_IN_OP, SOME_NOT_IN_OP].includes(op)) {
    if (isRegex) {
      return getRegexFilter({ nestedFields, filter });
    } else {
      return getTermFilter({ nestedFields, filter });
    }
  } else if ([GT_OP, GTE_OP, LT_OP, LTE_OP].includes(op)) {
    return getRangeFilter({ nestedFields, filter });
  } else if (MISSING_OP === op) {
    return getMissingFilter({ nestedFields, filter });
  } else if (FILTER_OP === op) {
    return getFuzzyFilter({ nestedFields, filter });
  } else {
    throw new Error('unknown op');
  }
}

export default function({ nestedFields, filters: rawFilters }) {
  if (Object.keys(rawFilters || {}).length === 0) return {};
  return opSwitch({ nestedFields, filter: normalizeFilters(rawFilters) });
}
