import _ from 'lodash';
import * as CONSTANTS from '../constants';
import normalizeFilters from './normalizeFilters';

function isNested(x) {
  return x && x.hasOwnProperty(CONSTANTS.ES_NESTED);
}

function getTermOrRegexOrSetFilter(nested, filter) {
  const { content } = filter;
  const value = Array.isArray(content.value) ? content.value[0] : content.value;

  if (`${value}`.includes('*')) {
    return getRegexFilter(nested, filter);
  } else if (`${value}`.includes('set_id:')) {
    return getSetFilter(nested, filter);
  } else {
    return getTermFilter(nested, filter);
  }
}

function getRegexFilter(nested, filter) {
  // TODO: support all regex instead of just `*` and converting to `.*`
  const { op, content } = filter;
  return wrapFilterBasedOnPath(
    {
      regexp: {
        // TODO: calling function already does this, pass in that value to avoid this
        [content.field]: (Array.isArray(content.value)
          ? content.value[0]
          : content.value
        ).replace('*', '.*'),
      },
    },
    content.field.split('.'),
    nested,
    op,
  );
}

function getSetFilter(nested, filter) {
  const { op, content } = filter;
  const fullField = content.field;

  const setId = (Array.isArray(content.value)
    ? content.value[0]
    : content.value
  ).replace('set_id:', '');

  const index = CONSTANTS.FIELD_TO_SET_TYPE[content.field];
  return wrapFilterBasedOnPath(
    {
      terms: {
        boost: 0,
        [fullField]: { index, type: index, id: setId, path: 'ids' },
      },
    },
    fullField.split('.'),
    nested,
    op,
  );
}

function getTermFilter(nested, filter, upperCase) {
  const { op, content: { value, field } } = filter;

  return wrapFilterBasedOnPath(
    Array.isArray(value)
      ? {
          terms: {
            [field]: value.map(item => item || ''),
            boost: 0,
          },
        }
      : { term: { [field]: { value, boost: 0 } } },
    field.split('.'),
    nested,
    op,
  );
}

function wrapFilterBasedOnPath(esFilter, path, nested, op) {
  for (let i = 1; i < path.length; i++) {
    const p = path.slice(0, path.length - i).join('.');
    if (nested.includes(p)) {
      if (!isNested(esFilter) && CONSTANTS.HAVE_NOT_OPS.includes(op)) {
        esFilter = wrapNot(esFilter);
      } else {
        esFilter = wrapMust(esFilter);
      }

      esFilter = wrapFilter(esFilter, p);
    }
  }

  return esFilter;
}

function wrapNot(val) {
  return wrapBool(CONSTANTS.ES_MUST_NOT, val);
}

function wrapMust(val) {
  return wrapBool(CONSTANTS.ES_MUST, val);
}

function wrapFilter(val, p) {
  return {
    [CONSTANTS.ES_NESTED]: {
      [CONSTANTS.ES_PATH]: p,
      [CONSTANTS.ES_QUERY]: val,
    },
  };
}

function wrapBool(op, val) {
  return {
    [CONSTANTS.ES_BOOL]: { [op]: Array.isArray(val) ? val : [val] },
  };
}

function getMustNotFilter(nested, filter) {
  const termFilter = getTermFilter(nested, filter);
  return isNested(termFilter) ? termFilter : wrapNot(termFilter);
}

function getMustNotAnyFilter(nested, filter) {
  let termFilter = getTermFilter(nested, filter);
  return wrapNot(termFilter);
}

function getFuzzyFilter(nested, content, op) {
  let { fields, value } = content;

  // group queries by their nesting level
  const sortedNested = nested.slice().sort((a, b) => b.length - a.length);
  const nestedMap = fields.reduce((map, field) => {
    const group = sortedNested.find(y => field.includes(y)) || '';
    return { ...map, [group]: [...(map[group] || []), field] };
  }, {});

  // construct one multi match per nested group
  const should = Object.values(nestedMap).map(fields =>
    wrapFilterBasedOnPath(
      {
        [CONSTANTS.ES_MULTI_MATCH]: {
          [CONSTANTS.ES_QUERY]: value,
          [CONSTANTS.ES_FIELDS]: fields,
          [CONSTANTS.ES_TYPE]: CONSTANTS.ES_PHRASE_PREFIX,
        },
      },
      fields[0].split('.'),
      nested,
      op,
    ),
  );

  return { [CONSTANTS.ES_BOOL]: { should } };
}

function getMissingFilter(nested, content, op) {
  //# FIXME assumes missing
  let esFilter = { exists: { field: content.field, boost: 0 } };
  let path = content.field.split('.');

  for (let i = 1; i < path.length; i++) {
    const p = path.slice(0, path.length - i).join('.');
    if (nested.includes(p)) {
      esFilter = wrapFilter(wrapMust(esFilter), p);
    }
  }

  if (op === CONSTANTS.IS) {
    return wrapNot(esFilter);
  } else {
    return esFilter;
  }
}

function getAndFilter(nestedFields, filters) {
  const musts = [];
  const mustNots = [];

  filters.forEach(filter => {
    const { op } = filter;

    const isMust = CONSTANTS.MUST_OPS.concat(CONSTANTS.RANGE_OPS).includes(op);
    const isMustNot = CONSTANTS.MUST_NOT_OPS.includes(op);
    const isShould = op === CONSTANTS.OR;

    const esFilter = opSwitch({ nested: nestedFields, filter });
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

function getOrFilter(nested, filters) {
  const mustNots = filters
    .filter(({ op }) => CONSTANTS.MUST_NOT_OPS.includes(op))
    .map(filter => opSwitch({ nested, filter }));

  const should = [
    ...filters
      .filter(({ op }) => !CONSTANTS.MUST_NOT_OPS.includes(op))
      .map(filter => opSwitch({ nested, filter })),
    ...(mustNots.length ? [wrapNot(mustNots)] : []),
  ];

  return {
    [CONSTANTS.ES_BOOL]:
      should.length > 0 ? { [CONSTANTS.ES_SHOULD]: should } : {},
  };
}

function getRangeFilter(nested, content, op) {
  const value = Array.isArray(content.value)
    ? [CONSTANTS.GT, CONSTANTS.GTE].includes(op)
      ? _.max(content.value)
      : _.min(content.value)
    : content.value;

  const esFilter = {
    range: {
      [content.field]: { boost: 0, [CONSTANTS.ES_RANGE_OPS[op]]: value },
    },
  };

  return wrapFilterBasedOnPath(esFilter, content.field.split('.'), nested, op);
}

function readPath(filter) {
  return _.get(filter, [CONSTANTS.ES_NESTED, CONSTANTS.ES_PATH], '');
}

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

function readNestedBool(x) {
  return _.get(
    x,
    [CONSTANTS.ES_NESTED, CONSTANTS.ES_QUERY, CONSTANTS.ES_BOOL],
    {},
  );
}

function opSwitch({ nested, filter }) {
  const { op } = filter;
  if (CONSTANTS.VALUE_OPS.includes(op)) {
    return getTermOrRegexOrSetFilter(nested, filter);
  } else if (op === CONSTANTS.FILTER) {
    return getFuzzyFilter(nested, filter.content, filter.op);
  } else if (op === CONSTANTS.OR) {
    return getOrFilter(nested, filter.content);
  } else if (op === CONSTANTS.AND) {
    return getAndFilter(nested, filter.content);
  } else if (CONSTANTS.IS_OPS.includes(op)) {
    return getMissingFilter(nested, filter.content, filter.op);
  } else if (CONSTANTS.RANGE_OPS.includes(op)) {
    return getRangeFilter(nested, filter.content, filter.op);
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
    return getMustNotFilter(nestedFields, filters);
  } else if (op === CONSTANTS.EXCLUDE_IF_ANY) {
    return getMustNotAnyFilter(nestedFields, filters);
  } else {
    return opSwitch({ nested: nestedFields, filter: filters });
  }
}

export default buildQuery;
