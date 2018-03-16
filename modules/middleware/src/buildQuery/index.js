import _ from 'lodash';
import utf8 from 'utf8';
import * as CONSTANTS from '../constants';
import normalizeFilters from './normalizeFilters';

function getTermOrRegexOrSetFilter(nested, x) {
  let value;

  typeof x['content']['value'] === 'object'
    ? (value = x['content']['value'][0])
    : (value = x['content']['value']);

  if (typeof value === 'string') {
    if (value.includes('*')) return getRegexFilter(nested, x);
    else if (value.includes('set_id:')) return getSetFilter(nested, x);
  }
  return getTermFilter(nested, x);
}

function getRegexFilter(nested, x, upperCase) {
  let op = x['op'],
    content = x['content'];

  let k = content['field'];

  let v =
    typeof content['value'] === 'object'
      ? content['value'][0]
      : content['value'];
  let t = 'regexp';

  v = v.replace('*', '.*');
  v = utf8.encode(v);
  // TODO: pass upperCase flag from calling functions to get an exact replacement of this:
  // if k == "project_id" or k == 'cases.project.project_id' or k == 'project.project_id':
  if (upperCase) v = v.toUpperCase();

  // TODO: Check for correctness: replacement for if "*" in v[0]: v = v[0][:-1]
  if (v.startswith('*')) v = '';

  let r = { [t]: { [k]: v } };
  let path = k.split('.');

  r = wrapFilterBasedOnPath(r, path, nested, op);
  return r;
}

function getSetFilter(nested, x) {
  let op = x['op'],
    content = x['content'];

  let full_field = content['field'];

  let values = content['value'],
    t = 'terms',
    value = values;

  value = typeof values === 'object' ? values[0] : value;
  value = utf8.encode(value);
  let set_id = value.replace('set_id:', '');

  let r = {
    [t]: {
      boost: 0,
      full_field: {
        index: CONSTANTS.FIELD_TO_SET_TYPE[content['field']],
        type: CONSTANTS.FIELD_TO_SET_TYPE[content['field']],
        id: set_id,
        path: 'ids',
      },
    },
  };

  let path = full_field.split('.');
  r = wrapFilterBasedOnPath(r, path, nested, op);
  return r;
}

function getTermFilter(nested, x, upperCase) {
  let op = x['op'],
    content = x['content'];

  let k = content['field'];
  let v = content['value'],
    t = 'term';

  if (typeof v === 'object') {
    v = v.map(item => {
      if (item == null) return '';
      // TODO: pass upperCase flag from calling functions to get an exact replacement of this:
      // if k == "project_id" or k == 'cases.project.project_id' or k == 'project.project_id':
      if (typeof item === 'string')
        return upperCase ? utf8.encode(item).toUpperCase() : utf8.encode(item);
      else return item;
    });
    t = 'terms';
  } else if (typeof v === 'string') {
    // TODO: pass upperCase flag from calling functions to get an exact replacement of this:
    // if k == "project_id" or k == 'cases.project.project_id' or k == 'project.project_id':
    v = upperCase ? utf8.encode(v).toUpperCase() : utf8.encode(v);
  }
  let r;
  if (t === 'term') r = { [t]: { [k]: { value: v, boost: 0 } } };
  else r = { [t]: { [k]: v, boost: 0 } };

  let path = k.split('.');
  r = wrapFilterBasedOnPath(r, path, nested, op);
  return r;
}

function wrapFilterBasedOnPath(r, path, nested, op) {
  for (let i = 1; i < path.length; i++) {
    let p = _.chunk(path, path.length - i)[0].join('.');
    if (nested.includes(p)) {
      if (!isNested(r))
        r = CONSTANTS.HAVE_NOT_OPS.includes(op) ? wrapNot(r) : wrapMust(r);
      else r = wrapMust(r);

      r = wrapFilter(r, p);
    }
  }
  return r;
}

function isNested(x) {
  return x && x.hasOwnProperty(CONSTANTS.ES_NESTED);
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

function getMustNotFilter(nested, x) {
  let tf = getTermFilter(nested, x);
  return isNested(tf) ? tf : wrapNot(tf);
}

function getMustNotAnyFilter(nested, x) {
  let tf = getTermFilter(nested, x);
  return wrapNot(tf);
}

function getFuzzyFilter(nested, content, op) {
  let { fields, value } = content;

  // group queries by their nesting level
  const sortedNested = nested.sort((x, y) => y.length - x.length);
  const nestedMap = fields.reduce((map, x) => {
    const group = sortedNested.find(y => x.includes(y)) || '';
    return { ...map, [group]: group in map ? [...map[group], x] : [x] };
  }, {});

  // construct one multi match per nested group
  const should = Object.keys(nestedMap)
    .map(x => ({
      [CONSTANTS.ES_MULTI_MATCH]: {
        [CONSTANTS.ES_QUERY]: value,
        [CONSTANTS.ES_FIELDS]: nestedMap[x],
        [CONSTANTS.ES_TYPE]: CONSTANTS.ES_PHRASE_PREFIX,
      },
    }))
    .map(x =>
      wrapFilterBasedOnPath(x, x.multi_match.fields[0].split('.'), nested, op),
    );

  return { [CONSTANTS.ES_BOOL]: { should } };
}

function getMissingFilter(nested, content, op) {
  let k = content['field'];

  //# FIXME assumes missing
  let r = { exists: { field: k, boost: 0 } };
  let path = k.split('.');

  for (let i = 1; i < path.length; i++) {
    let p = _.chunk(path, path.length - i)[0].join('.');
    if (nested.includes(p)) {
      r = wrapMust(r);
      r = wrapFilter(r, p);
    }
  }
  if (op === CONSTANTS.IS) r = wrapNot(r);
  return r;
}

function getAndFilter(nestedFields, filters) {
  let musts = [];
  const must_nots = [];
  const shoulds = [];

  filters.forEach(filter => {
    const { op, content } = filter;

    const is_must = CONSTANTS.MUST_OPS.concat(CONSTANTS.RANGE_OPS).includes(op);
    const is_must_not = CONSTANTS.MUST_NOT_OPS.includes(op);
    const is_should = op === CONSTANTS.OR;

    if (is_must || is_must_not) {
      let curr;
      if (CONSTANTS.VALUE_OPS.includes(op)) {
        curr = getTermOrRegexOrSetFilter(nestedFields, filter);
      } else if (CONSTANTS.IS_OPS.includes(op)) {
        curr = getMissingFilter(nestedFields, content, op);
      } else if (CONSTANTS.RANGE_OPS.includes(op)) {
        curr = getRangeFilter(nestedFields, content, op);
      } else if (op === CONSTANTS.FILTER) {
        curr = getFuzzyFilter(nestedFields, content, op);
      }

      if (isNested(curr)) {
        const filteredMusts = musts.filter(
          m => isNested(m) && readPath(m) === readPath(curr),
        );
        collapseNestedFilters(
          filteredMusts.length > 0 ? filteredMusts[0] : null,
          curr,
          op === CONSTANTS.EXCLUDE_IF_ANY ? must_nots : musts,
        );
      } else if (is_must_not) {
        must_nots.push(curr);
      } else {
        musts.push(curr);
      }
    } else if (is_should) shoulds.push(getOrFilter(nestedFields, content));
  });
  //   # wrap both shoulds and must in ES_MUST so ES_SHOULD so score does not interfere
  //   # _get_or_filter already wraps shoulds with ES_SHOULD
  let r = {};
  musts = shoulds !== null ? musts.concat(shoulds) : musts;
  if (musts.length > 0) r[CONSTANTS.ES_MUST] = musts;
  if (must_nots.length > 0) r[CONSTANTS.ES_MUST_NOT] = must_nots;

  return { [CONSTANTS.ES_BOOL]: r };
}

function getOrFilter(nested, content) {
  let must_not = _.filter(content, x =>
    CONSTANTS.MUST_NOT_OPS.includes(x['op']),
  ).map(x => getTermOrRegexOrSetFilter(nested, x));
  let should = _.filter(content, x => CONSTANTS.HAVE_OPS.includes(x['op'])).map(
    x => getTermOrRegexOrSetFilter(nested, x),
  );
  should = should.concat(
    _.filter(content, x => x['op'] === CONSTANTS.FILTER).map(x =>
      getFuzzyFilter(nested, x['content'], x['op']),
    ),
  );
  should = should.concat(
    _.filter(content, x => x['op'] === CONSTANTS.OR).map(x =>
      getOrFilter(nested, x['content']),
    ),
  );
  should = should.concat(
    _.filter(content, x => x['op'] === CONSTANTS.AND).map(x =>
      getAndFilter(nested, x['content']),
    ),
  );
  should = should.concat(
    _.filter(content, x => CONSTANTS.IS_OPS.includes(x['op'])).map(x =>
      getMissingFilter(nested, x['content']),
    ),
  );
  if (must_not && must_not.length) should.push(wrapNot(must_not));
  return {
    [CONSTANTS.ES_BOOL]:
      should && should.length > 0 ? { [CONSTANTS.ES_SHOULD]: should } : {},
  };
}

function getRangeFilter(nested, content, op) {
  let k = content['field'],
    v = content['value'],
    obj = { boost: 0 };

  if (typeof v === 'object')
    v = [CONSTANTS.GT, CONSTANTS.GTE].includes(op) ? _.max(v) : _.min(v);
  else if (typeof v === 'string') v = utf8.encode(v);

  obj[CONSTANTS.ES_RANGE_OPS[op]] = v;

  let r = { range: { [k]: obj } },
    path = k.split('.');

  r = wrapFilterBasedOnPath(r, path, nested, op);
  return r;
}

function readPath(x) {
  return _.get(x, [CONSTANTS.ES_NESTED, CONSTANTS.ES_PATH], '');
}

function collapseNestedFilters(found, curr, musts) {
  if (found !== null) {
    if (readNestedBool(curr)[CONSTANTS.ES_MUST]) {
      let child = readNestedBool(curr)[CONSTANTS.ES_MUST][0];
      let found_musts = _.get(readNestedBool(found), CONSTANTS.ES_MUST, []);
      if (isNested(child)) {
        let filtered = _.filter(
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
  } else musts.push(curr);
}

function readNestedBool(x) {
  return _.get(
    x,
    [CONSTANTS.ES_NESTED, CONSTANTS.ES_QUERY, CONSTANTS.ES_BOOL],
    {},
  );
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

  const { op, content } = filters;

  if (op === CONSTANTS.AND) {
    return getAndFilter(nestedFields, content);
  } else if (op === CONSTANTS.OR) {
    return getOrFilter(nestedFields, content);
  } else if (op === CONSTANTS.IN) {
    return getTermOrRegexOrSetFilter(nestedFields, filters);
  } else if (op === CONSTANTS.EXCLUDE) {
    return getMustNotFilter(nestedFields, filters);
  } else if (op === CONSTANTS.EXCLUDE_IF_ANY) {
    return getMustNotAnyFilter(nestedFields, filters);
  } else if (op === CONSTANTS.FILTER) {
    return getFuzzyFilter(nestedFields, content, op);
  } else if (CONSTANTS.IS_OPS.includes(op)) {
    return getMissingFilter(nestedFields, content, op);
  } else if (CONSTANTS.RANGE_OPS.includes(op)) {
    return getRangeFilter(nestedFields, content, op);
  }
}

export default buildQuery;
