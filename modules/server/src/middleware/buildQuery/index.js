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
import normalizeFilters from './normalizeFilters';
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

const wrapFilter = ({ esFilter, nestedFields, filter, isNot }) => {
  return filter.content.field
    .split('.')
    .slice(0, -1)
    .map((p, i, segments) => segments.slice(0, i + 1).join('.'))
    .filter((p) => nestedFields.includes(p))
    .reverse()
    .reduce(
      (esFilter, path, i) => wrapNested(esFilter, path),
      isNot ? wrapMustNot(esFilter) : esFilter,
    );
};

function getRegexFilter({ nestedFields, filter }) {
  const {
    op,
    content: {
      field,
      value: [value],
    },
  } = filter;
  const esFilter = wrapFilter({
    filter,
    nestedFields,
    esFilter: { regexp: { [field]: value.replace('*', '.*') } },
    isNot: NOT_IN_OP === op,
  });

  return op === SOME_NOT_IN_OP ? wrapMustNot(esFilter) : esFilter;
}

function getTermFilter({ nestedFields, filter }) {
  const {
    op,
    content: { value, field },
  } = filter;
  const esFilter = wrapFilter({
    filter,
    nestedFields,
    esFilter: { terms: { [field]: value.map((item) => item || ''), boost: 0 } },
    isNot: NOT_IN_OP === op,
  });

  return op === SOME_NOT_IN_OP ? wrapMustNot(esFilter) : esFilter;
}

function getFuzzyFilter({ nestedFields, filter }) {
  const { content } = filter;
  const { value, fields } = content;

  // group queries by their nesting level
  const sortedNested = nestedFields.slice().sort((a, b) => b.length - a.length);
  const nestedMap = fields.reduce((acc, field) => {
    const group = sortedNested.find((y) => field.includes(y)) || '';
    if (acc[group]) {
      acc[group].push(field);
    } else {
      acc[group] = [field];
    }
    return acc;
  }, {});

  // construct one multi match per nested group
  return wrapShould(
    Object.values(nestedMap).map((fields) =>
      wrapFilter({
        filter: { ...filter, content: { ...content, field: fields[0] } },
        nestedFields,
        esFilter: wrapShould(
          fields.map((field) => ({
            [ES_WILDCARD]: {
              [field]: {
                value: `${value}`,
              },
            },
          })),
        ),
      }),
    ),
  );
}

function getMissingFilter({ nestedFields, filter }) {
  const {
    content: { field },
  } = filter;
  return wrapFilter({
    esFilter: { exists: { field: field, boost: 0 } },
    nestedFields,
    filter,
    isNot: true,
  });
}

function getRangeFilter({ nestedFields, filter }) {
  const {
    op,
    content: { field, value },
  } = filter;
  return wrapFilter({
    filter,
    nestedFields,
    esFilter: {
      range: {
        [field]: {
          boost: 0,
          [op]: toEsRangeValue([GT_OP, GTE_OP].includes(op) ? _.max(value) : _.min(value)),
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
function getGroupFilter({ nestedFields, filter: { content, op, pivot } }) {
  const applyBooleanWrapper = wrappers[op];
  const esFilters = content.map((filter) => opSwitch({ nestedFields, filter }));
  const isNested = !!esFilters[0]?.nested;
  if (isNested && pivot === esFilters[0]?.nested.path) {
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

function getSetFilter({ nestedFields, filter, filter: { content, op } }) {
  return wrapFilter({
    isNot: op === NOT_IN_OP,
    filter,
    nestedFields,
    esFilter: {
      terms: {
        boost: 0,
        [content.field]: {
          index: ES_ARRANGER_SET_INDEX,
          type: ES_ARRANGER_SET_TYPE,
          id: _.flatMap([content.value])[0].replace('set_id:', ''),
          path: 'ids',
        },
      },
    },
  });
}

const getBetweenFilter = ({ nestedFields, filter }) => {
  const {
    content: { field, value },
  } = filter;
  return wrapFilter({
    filter,
    nestedFields,
    esFilter: {
      range: {
        [field]: {
          boost: 0,
          [GTE_OP]: _.min(value),
          [LTE_OP]: _.max(value),
        },
      },
    },
  });
};

export const opSwitch = ({ nestedFields, filter }) => {
  const {
    op,
    pivot,
    content: { value },
  } = filter;
  // we need a way to handle object fields before the following error is valid
  // if (pivot && pivot !== '.' && !nestedFields.includes(pivot)) {
  //   throw new Error(`Invalid pivot field "${pivot}", not a nested field`);
  // }
  if ([OR_OP, AND_OP, NOT_OP].includes(op)) {
    return getGroupFilter({ nestedFields, filter });
  } else if ([IN_OP, NOT_IN_OP, SOME_NOT_IN_OP].includes(op)) {
    if (`${value[0]}`.includes(REGEX)) {
      return getRegexFilter({ nestedFields, filter });
    } else if (`${value[0]}`.includes(SET_ID)) {
      return getSetFilter({ nestedFields, filter });
    } else if (`${value[0]}`.includes(MISSING)) {
      return getMissingFilter({ nestedFields, filter });
    } else {
      return getTermFilter({ nestedFields, filter });
    }
  } else if ([ALL_OP].includes(op)) {
    return getGroupFilter({
      nestedFields,
      filter: {
        op: AND_OP,
        pivot: pivot || '.',
        content: filter.content.value.map((v) => ({
          op: IN_OP,
          content: {
            field: filter.content.field,
            value: [v],
          },
        })),
      },
    });
  } else if ([GT_OP, GTE_OP, LT_OP, LTE_OP].includes(op)) {
    return getRangeFilter({ nestedFields, filter });
  } else if ([BETWEEN_OP].includes(op)) {
    return getBetweenFilter({ nestedFields, filter });
  } else if (FILTER_OP === op) {
    return getFuzzyFilter({ nestedFields, filter });
  } else {
    throw new Error('unknown op');
  }
};

export default function ({ nestedFields, filters: rawFilters }) {
  if (Object.keys(rawFilters || {}).length === 0) return {};
  return opSwitch({
    nestedFields,
    filter: normalizeFilters(rawFilters),
  });
}
