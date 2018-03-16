import _ from 'lodash';
import * as CONSTANTS from '../constants';
import normalizeFilters from './normalizeFilters';
import {
  readNestedBool,
  isNested,
  readPath,
  wrapNot,
  wrapMust,
  wrapFilter,
} from '../utils/esFilter';

function collapseNestedFilters(found, curr, musts) {
  if (found === null) {
    musts.push(curr);
  } else {
    if (readNestedBool(curr)[CONSTANTS.ES_MUST]) {
      const child = readNestedBool(curr)[CONSTANTS.ES_MUST][0];
      const found_musts = _.get(readNestedBool(found), CONSTANTS.ES_MUST, []);
      if (isNested(child)) {
        const filtered = _.filter(
          found_musts,
          m => isNested(m) && readPath(m) === readPath(child),
        );
        collapseNestedFilters(
          filtered.length > 0 ? filtered[0] : null,
          child,
          found_musts,
        );
      } else {
        readNestedBool(found)[CONSTANTS.ES_MUST] = _.get(
          readNestedBool(found),
          CONSTANTS.ES_MUST,
          [],
        ).concat(readNestedBool(curr)[CONSTANTS.ES_MUST]);
      }
    } else {
      //# must_not won't have any nested filters
      readNestedBool(found)[CONSTANTS.ES_MUST_NOT] = _.get(
        readNestedBool(found),
        CONSTANTS.ES_MUST_NOT,
        [],
      ).concat(readNestedBool(curr)[CONSTANTS.ES_MUST_NOT]);
    }
  }
}

function wrapFilterBasedOnPath({ esFilter, nestedFields, filter }) {
  const path = filter.content.field.split('.');
  for (let i = 1; i < path.length; i++) {
    const p = path.slice(0, path.length - i).join('.');
    if (nestedFields.includes(p)) {
      if (!isNested(esFilter) && CONSTANTS.HAVE_NOT_OPS.includes(filter.op)) {
        esFilter = wrapNot(esFilter);
      } else {
        esFilter = wrapMust(esFilter);
      }

      esFilter = wrapFilter(esFilter, p);
    }
  }

  return esFilter;
}

function getTermOrRegexOrSetFilter({ nestedFields, filter }) {
  const { content } = filter;
  const value = Array.isArray(content.value) ? content.value[0] : content.value;

  if (`${value}`.includes('*')) {
    return getRegexFilter({ nestedFields, filter });
  } else if (`${value}`.includes('set_id:')) {
    return getSetFilter({ nestedFields, filter });
  } else {
    return getTermFilter({ nestedFields, filter });
  }
}

function getRegexFilter({ nestedFields, filter }) {
  // TODO: support all regex instead of just `*` and converting to `.*`
  const { content } = filter;
  return wrapFilterBasedOnPath({
    filter,
    nestedFields,
    esFilter: {
      regexp: {
        // TODO: calling function already does this, pass in that value to avoid this
        [content.field]: (Array.isArray(content.value)
          ? content.value[0]
          : content.value
        ).replace('*', '.*'),
      },
    },
  });
}

function getSetFilter({ nestedFields, filter }) {
  const { content } = filter;

  const setId = (Array.isArray(content.value)
    ? content.value[0]
    : content.value
  ).replace('set_id:', '');

  const index = CONSTANTS.FIELD_TO_SET_TYPE[content.field];
  return wrapFilterBasedOnPath({
    filter,
    nestedFields,
    esFilter: {
      terms: {
        boost: 0,
        [content.field]: { index, type: index, id: setId, path: 'ids' },
      },
    },
  });
}

function getTermFilter({ nestedFields, filter }) {
  const { content: { value, field } } = filter;

  return wrapFilterBasedOnPath({
    filter,
    nestedFields,
    esFilter: Array.isArray(value)
      ? {
          terms: {
            [field]: value.map(item => item || ''),
            boost: 0,
          },
        }
      : { term: { [field]: { value, boost: 0 } } },
  });
}

function getMustNotFilter({ nestedFields, filter }) {
  const termFilter = getTermFilter({ nestedFields, filter });
  return isNested(termFilter) ? termFilter : wrapNot(termFilter);
}

function getMustNotAnyFilter({ nestedFields, filter }) {
  let termFilter = getTermFilter({ nestedFields, filter });
  return wrapNot(termFilter);
}

function getFuzzyFilter({ nestedFields, filter }) {
  let { fields, value } = filter.content;

  // group queries by their nesting level
  const sortedNested = nestedFields.slice().sort((a, b) => b.length - a.length);
  const nestedMap = fields.reduce((map, field) => {
    const group = sortedNested.find(y => field.includes(y)) || '';
    return { ...map, [group]: [...(map[group] || []), field] };
  }, {});

  // construct one multi match per nested group
  const should = Object.values(nestedMap).map(fields =>
    wrapFilterBasedOnPath({
      filter: { ...filter, field: fields[0] },
      nestedFields,
      esFilter: {
        [CONSTANTS.ES_MULTI_MATCH]: {
          [CONSTANTS.ES_QUERY]: value,
          [CONSTANTS.ES_FIELDS]: fields,
          [CONSTANTS.ES_TYPE]: CONSTANTS.ES_PHRASE_PREFIX,
        },
      },
    }),
  );

  return { [CONSTANTS.ES_BOOL]: { should } };
}

function getMissingFilter({ nestedFields, filter }) {
  //# FIXME assumes missing
  let esFilter = { exists: { field: filter.content.field, boost: 0 } };
  let path = filter.content.field.split('.');

  for (let i = 1; i < path.length; i++) {
    const p = path.slice(0, path.length - i).join('.');
    if (nestedFields.includes(p)) {
      esFilter = wrapFilter(wrapMust(esFilter), p);
    }
  }

  if (filter.op === CONSTANTS.IS) {
    return wrapNot(esFilter);
  } else {
    return esFilter;
  }
}

function getAndFilter({ nestedFields, filter }) {
  const musts = [];
  const mustNots = [];

  filter.content.forEach(filter => {
    const { op } = filter;

    const isMust = CONSTANTS.MUST_OPS.concat(CONSTANTS.RANGE_OPS).includes(op);
    const isMustNot = CONSTANTS.MUST_NOT_OPS.includes(op);
    const isShould = op === CONSTANTS.OR;

    const esFilter = opSwitch({ nestedFields, filter });
    if (isMust || isMustNot) {
      if (isNested(esFilter)) {
        const nestingMatch =
          musts.filter(
            m => isNested(m) && readPath(m) === readPath(esFilter),
          )[0] || null;
        collapseNestedFilters(
          nestingMatch,
          esFilter,
          op === CONSTANTS.EXCLUDE_IF_ANY ? mustNots : musts,
        );
      } else if (isMustNot) {
        mustNots.push(esFilter);
      } else {
        musts.push(esFilter);
      }
    } else if (isShould) {
      musts.push(esFilter);
    }
  });

  return {
    [CONSTANTS.ES_BOOL]: {
      ...(musts.length ? { [CONSTANTS.ES_MUST]: musts } : {}),
      ...(mustNots.length ? { [CONSTANTS.ES_MUST_NOT]: mustNots } : {}),
    },
  };
}

function getOrFilter({ nestedFields, filter }) {
  const mustNots = filter.content
    .filter(({ op }) => CONSTANTS.MUST_NOT_OPS.includes(op))
    .map(filter => opSwitch({ nestedFields, filter }));

  const should = [
    ...filter.content
      .filter(({ op }) => !CONSTANTS.MUST_NOT_OPS.includes(op))
      .map(filter => opSwitch({ nestedFields, filter })),
    ...(mustNots.length ? [wrapNot(mustNots)] : []),
  ];

  return {
    [CONSTANTS.ES_BOOL]:
      should.length > 0 ? { [CONSTANTS.ES_SHOULD]: should } : {},
  };
}

function getRangeFilter({ nestedFields, filter }) {
  const { op, content } = filter;
  const { field } = content;
  const value = Array.isArray(content.value)
    ? [CONSTANTS.GT, CONSTANTS.GTE].includes(op)
      ? _.max(content.value)
      : _.min(content.value)
    : content.value;

  const esFilter = {
    range: { [field]: { boost: 0, [CONSTANTS.ES_RANGE_OPS[op]]: value } },
  };

  return wrapFilterBasedOnPath({ filter, nestedFields, esFilter });
}

function opSwitch({ nestedFields, filter }) {
  const { op } = filter;
  if (CONSTANTS.VALUE_OPS.includes(op)) {
    return getTermOrRegexOrSetFilter({ nestedFields, filter });
  } else if (op === CONSTANTS.FILTER) {
    return getFuzzyFilter({ nestedFields, filter });
  } else if (op === CONSTANTS.OR) {
    return getOrFilter({ nestedFields, filter });
  } else if (op === CONSTANTS.AND) {
    return getAndFilter({ nestedFields, filter });
  } else if (CONSTANTS.IS_OPS.includes(op)) {
    return getMissingFilter({ nestedFields, filter });
  } else if (CONSTANTS.RANGE_OPS.includes(op)) {
    return getRangeFilter({ nestedFields, filter });
  } else {
    throw new Error('unknown op');
  }
}

function buildQuery({ nestedFields, filters: rawFilters }) {
  if (Object.keys(rawFilters || {}).length === 0) return {};
  const filters = normalizeFilters(rawFilters);
  const filterKeys = Object.keys(filters);
  ['op', 'content'].forEach(key => {
    if (!filterKeys.includes(key)) {
      console.error(`Must specify : ${key}. in filters: ${filters}`);
      throw Error(`Must specify : ${key}. in filters: ${filters}`);
    }
  });
  // TODO: EXCLUDE and EXCLUDE_IF_ANY handled different if in root? confirm?
  const { op } = filters;
  if (op === CONSTANTS.EXCLUDE) {
    return getMustNotFilter({ nestedFields, filters });
  } else if (op === CONSTANTS.EXCLUDE_IF_ANY) {
    return getMustNotAnyFilter({ nestedFields, filters });
  } else {
    return opSwitch({ nestedFields, filter: filters });
  }
}

export default buildQuery;
