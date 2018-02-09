import _ from 'lodash';
import utf8 from 'utf8';
import { CONSTANTS } from './constants';

/*
    Filter processor
 */
export default class FilterProcessor {
  constructor(logger) {
    this.logger = logger || console;
  }
  buildFilters(doc_type, nested, raw_filters) {
    if (raw_filters === null || Object.keys(raw_filters).length === 0)
      return raw_filters;

    let filters = this.filter_optimizer(raw_filters);
    if (!filters) {
      this.logger.error(`Must specify filters: ${filters}`);
      throw Error(`Must specify filters: ${filters}`);
    }
    let keys = Object.keys(filters);
    ['op', 'content'].forEach(item => {
      if (!keys.includes(item)) {
        this.logger.error(`Must specify : ${item}. in filters: ${filters}`);
        throw Error(`Must specify : ${item}. in filters: ${filters}`);
      }
    });

    let op = filters['op'],
      content = filters['content'],
      f;

    if (op === CONSTANTS.IN)
      f = this._get_term_or_regex_or_set_filter(doc_type, nested, filters);
    if (op === CONSTANTS.EXCLUDE)
      f = this._get_must_not_filter(doc_type, nested, filters);
    if (op === CONSTANTS.EXCLUDE_IF_ANY)
      f = this._get_must_not_any_filter(doc_type, nested, filters);
    if (op === CONSTANTS.FILTER)
      f = this._get_fuzzy_filter(doc_type, nested, content, op);
    if (CONSTANTS.IS_OPS.includes(op))
      f = this._get_missing_filter(doc_type, nested, content, op);
    if (op === CONSTANTS.AND)
      f = this._get_and_filter(doc_type, nested, content);
    if (op === CONSTANTS.OR) f = this._get_or_filter(doc_type, nested, content);
    if (CONSTANTS.RANGE_OPS.includes(op))
      f = this._get_range_filter(doc_type, nested, content, op);

    return f;
  }
  filter_optimizer(filters) {
    let op = filters['op'],
      content = filters['content'];

    if ([CONSTANTS.EQ, CONSTANTS.NEQ].includes(op))
      return this.term_optimizer(op, content);

    if (
      [CONSTANTS.IN, CONSTANTS.EXCLUDE].includes(op) &&
      content['value'].length > 1 &&
      (content['value'].some(v => v.includes('*')) ||
        content['value'].some(v => v.includes('set_id:')))
    ) {
      // seperate regex and set_id into one list, terms in another and OR them
      let ps = _.filter(
        content['value'],
        psv => psv.includes('*') || psv.includes('set_id:'),
      ).map(psv => {
        return {
          op: op,
          content: {
            field: content['field'],
            value: [psv],
          },
        };
      });

      let terms = _.filter(
          content['value'],
          psv => !psv.includes('*') && !psv.includes('set_id:'),
        ),
        ts = [];
      if (terms.length > 0) {
        ts = [
          {
            op: op,
            content: {
              field: content['field'],
              value: terms,
            },
          },
        ];
      }

      return {
        op: CONSTANTS.OR,
        content: ts.concat(ps),
      };
    }

    if (CONSTANTS.GROUP_OPS.includes(op)) {
      return {
        op: op,
        content: this.grouping_optimizer(content, op),
      };
    } else {
      return {
        op: op,
        content: content,
      };
    }
  }
  _get_term_or_regex_or_set_filter(doc_type, nested, x) {
    let value;

    typeof x['content']['value'] === 'object'
      ? (value = x['content']['value'][0])
      : (value = x['content']['value']);

    if (typeof value === 'string') {
      if (value.includes('*'))
        return this._get_regex_filter(doc_type, nested, x);
      else if (value.includes('set_id:'))
        return this._get_set_filter(doc_type, nested, x);
    }
    return this._get_term_filter(doc_type, nested, x);
  }
  _get_must_not_filter(doc_type, nested, x) {
    let tf = this._get_term_filter(doc_type, nested, x);
    return this.is_nested(tf) ? tf : this.wrap_not(tf);
  }
  _get_must_not_any_filter(doc_type, nested, x) {
    let tf = this._get_term_filter(doc_type, nested, x);
    return this.wrap_not(tf);
  }
  _get_fuzzy_filter(doc_type, nested, content, op) {
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
        this.wrap_filter_based_on_path(
          x,
          x.multi_match.fields[0].split('.'),
          nested,
          op,
        ),
      );

    return { [CONSTANTS.ES_BOOL]: { should } };
  }
  _get_missing_filter(doc_type, nested, content, op) {
    let k = this.field_to_full_path_on_doc_type(doc_type, content['field']);

    //# FIXME assumes missing
    let r = { exists: { field: k, boost: 0 } };
    let path = k.split('.');

    for (let i = 1; i < path.length; i++) {
      let p = _.chunk(path, path.length - i)[0].join('.');
      if (nested.includes(p)) {
        r = this.wrap_must(r);
        r = this.wrap_filter(r, p);
      }
    }
    if (op === CONSTANTS.IS) r = this.wrap_not(r);
    return r;
  }

  _get_and_filter(doc_type, nested, xs) {
    let musts = [],
      must_nots = [],
      shoulds = [];

    //# TODO remove for loop
    xs.forEach(x => {
      const op = x['op'],
        content = x['content'];

      const is_must = CONSTANTS.MUST_OPS.concat(CONSTANTS.RANGE_OPS).includes(
        op,
      );
      const is_must_not = CONSTANTS.MUST_NOT_OPS.includes(op);
      const is_should = op === CONSTANTS.OR;

      if (is_must || is_must_not) {
        let curr;
        if (CONSTANTS.VALUE_OPS.includes(op))
          curr = this._get_term_or_regex_or_set_filter(doc_type, nested, x);
        else if (CONSTANTS.IS_OPS.includes(op))
          curr = this._get_missing_filter(doc_type, nested, content, op);
        else if (CONSTANTS.RANGE_OPS.includes(op))
          curr = this._get_range_filter(doc_type, nested, content, op);
        else if (op === CONSTANTS.FILTER)
          curr = this._get_fuzzy_filter(doc_type, nested, content, op);

        if (this.is_nested(curr)) {
          const filteredMusts = _.filter(
            musts,
            m =>
              this.is_nested(m) && this.read_path(m) === this.read_path(curr),
          );
          this.collapse_nested_filters(
            filteredMusts.length > 0 ? filteredMusts[0] : null,
            curr,
            op === CONSTANTS.EXCLUDE_IF_ANY ? must_nots : musts,
          );
        } else if (is_must_not) must_nots.push(curr);
        else musts.push(curr);
      } else if (is_should)
        shoulds.push(this._get_or_filter(doc_type, nested, content));
    });
    //   # wrap both shoulds and must in ES_MUST so ES_SHOULD so score does not interfere
    //   # _get_or_filter already wraps shoulds with ES_SHOULD
    let r = {};
    musts = shoulds !== null ? musts.concat(shoulds) : musts;
    if (musts.length > 0) r[CONSTANTS.ES_MUST] = musts;
    if (must_nots.length > 0) r[CONSTANTS.ES_MUST_NOT] = must_nots;

    return { [CONSTANTS.ES_BOOL]: r };
  }
  _get_or_filter(doc_type, nested, content) {
    let must_not = _.filter(content, x =>
      CONSTANTS.MUST_NOT_OPS.includes(x['op']),
    ).map(x => this._get_term_or_regex_or_set_filter(doc_type, nested, x));
    let should = _.filter(content, x =>
      CONSTANTS.HAVE_OPS.includes(x['op']),
    ).map(x => this._get_term_or_regex_or_set_filter(doc_type, nested, x));
    should = should.concat(
      _.filter(content, x => x['op'] === CONSTANTS.FILTER).map(x =>
        this._get_fuzzy_filter(doc_type, nested, x['content'], x['op']),
      ),
    );
    should = should.concat(
      _.filter(content, x => x['op'] === CONSTANTS.OR).map(x =>
        this._get_or_filter(doc_type, nested, x['content']),
      ),
    );
    should = should.concat(
      _.filter(content, x => x['op'] === CONSTANTS.AND).map(x =>
        this._get_and_filter(doc_type, nested, x['content']),
      ),
    );
    should = should.concat(
      _.filter(content, x => CONSTANTS.IS_OPS.includes(x['op'])).map(x =>
        this._get_missing_filter(doc_type, nested, x['content']),
      ),
    );
    if (must_not) should.append(this.wrap_not(must_not));
    return {
      [CONSTANTS.ES_BOOL]:
        should != null || should.length > 0
          ? { [CONSTANTS.ES_SHOULD]: should }
          : {},
    };
  }
  _get_range_filter(doc_type, nested, content, op) {
    let k = this.field_to_full_path_on_doc_type(doc_type, content['field']),
      v = content['value'],
      obj = { boost: 0 };

    if (typeof v === 'object')
      v = [CONSTANTS.GT, CONSTANTS.GTE].includes(op) ? _.max(v) : _.min(v);
    else if (typeof v === 'string') v = utf8.encode(v);

    obj[CONSTANTS.ES_RANGE_OPS[op]] = v;

    let r = { range: { [k]: obj } },
      path = k.split('.');

    r = this.wrap_filter_based_on_path(r, path, nested, op);
    return r;
  }
  term_optimizer(op, content) {
    let op_mapping = {
      EQ: CONSTANTS.IN,
      NEQ: CONSTANTS.EXCLUDE,
    };

    if (typeof content['value'] === 'string')
      content['value'] = [content['value']];

    return this.filter_optimizer({
      op: op_mapping[op],
      content: content,
    });
  }
  grouping_optimizer(content, parent_op) {
    let inside = [],
      other = [];

    content.forEach(c => {
      if (c['op'].toLowerCase() === parent_op) {
        inside = inside.concat(
          this.grouping_optimizer(c['content'], parent_op),
        );
      } else {
        other.push(this.filter_optimizer(c));
      }
    });

    return other.concat(inside);
  }
  _get_regex_filter(doc_type, nested, x, upperCase) {
    let op = x['op'],
      content = x['content'];

    let k = this.this.field_to_full_path_on_doc_type(
      doc_type,
      content['field'],
    );

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

    r = this.wrap_filter_based_on_path(r, path, nested, op);
    return r;
  }
  _get_set_filter(doc_type, nested, x) {
    let op = x['op'],
      content = x['content'];

    let full_field = this.field_to_full_path_on_doc_type(
      doc_type,
      content['field'],
    );

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
    r = this.wrap_filter_based_on_path(r, path, nested, op);
    return r;
  }
  _get_term_filter(doc_type, nested, x, upperCase) {
    let op = x['op'],
      content = x['content'];

    let k = this.field_to_full_path_on_doc_type(doc_type, content['field']);
    let v = content['value'],
      t = 'term';

    if (typeof v === 'object') {
      v = v.map(item => {
        if (item == null) return '';
        // TODO: pass upperCase flag from calling functions to get an exact replacement of this:
        // if k == "project_id" or k == 'cases.project.project_id' or k == 'project.project_id':
        if (typeof item === 'string')
          return upperCase
            ? utf8.encode(item).toUpperCase()
            : utf8.encode(item);
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
    r = this.wrap_filter_based_on_path(r, path, nested, op);
    return r;
  }
  collapse_nested_filters(found, curr, musts) {
    if (found !== null) {
      if (this.read_nested_bool(curr)[CONSTANTS.ES_MUST]) {
        let child = this.read_nested_bool(curr)[CONSTANTS.ES_MUST][0];
        let found_musts = _.get(
          this.read_nested_bool(found),
          CONSTANTS.ES_MUST,
          [],
        );
        if (this.is_nested(child)) {
          let filtered = _.filter(
            found_musts,
            m =>
              this.is_nested(m) && this.read_path(m) === this.read_path(child),
          );
          this.collapse_nested_filters(
            filtered.length > 0 ? filtered[0] : null,
            child,
            found_musts,
          );
        } else {
          this.read_nested_bool(found)[CONSTANTS.ES_MUST] = _.get(
            this.read_nested_bool(found),
            CONSTANTS.ES_MUST,
            [],
          ).concat(this.read_nested_bool(curr)[CONSTANTS.ES_MUST]);
        }
      } else {
        //# must_not won't have any nested filters
        this.read_nested_bool(found)[CONSTANTS.ES_MUST_NOT] = _.get(
          this.read_nested_bool(found),
          CONSTANTS.ES_MUST_NOT,
          [],
        ).concat(this.read_nested_bool(curr)[CONSTANTS.ES_MUST_NOT]);
      }
    } else musts.push(curr);
  }
  // TODO: make this generic
  field_to_full_path_on_doc_type(doc_type, field) {
    return field;
  }
  wrap_filter_based_on_path(r, path, nested, op) {
    for (let i = 1; i < path.length; i++) {
      let p = _.chunk(path, path.length - i)[0].join('.');
      if (nested.includes(p)) {
        if (!this.is_nested(r))
          r = CONSTANTS.HAVE_NOT_OPS.includes(op)
            ? this.wrap_not(r)
            : this.wrap_must(r);
        else r = this.wrap_must(r);

        r = this.wrap_filter(r, p);
      }
    } // for loop ends here
    return r;
  }
  is_nested(x) {
    return x && x.hasOwnProperty(CONSTANTS.ES_NESTED);
  }
  wrap_bool(op, val) {
    return {
      [CONSTANTS.ES_BOOL]: { [op]: Array.isArray(val) ? val : [val] },
    };
  }
  wrap_must(val) {
    return this.wrap_bool(CONSTANTS.ES_MUST, val);
  }
  wrap_not(val) {
    return this.wrap_bool(CONSTANTS.ES_MUST_NOT, val);
  }
  wrap_filter(val, p) {
    return {
      [CONSTANTS.ES_NESTED]: {
        [CONSTANTS.ES_PATH]: p,
        [CONSTANTS.ES_QUERY]: val,
      },
    };
  }
  read_nested(x) {
    return _.get(x, CONSTANTS.ES_NESTED, {});
  }
  read_path(x) {
    return _.get(this.read_nested(x), 'path', '');
  }
  read_nested_query(x) {
    return _.get(this.read_nested(x), CONSTANTS.ES_QUERY, {});
  }
  read_nested_bool(x) {
    return _.get(this.read_nested_query(x), CONSTANTS.ES_BOOL, {});
  }
}
