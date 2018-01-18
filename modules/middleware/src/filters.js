
/**
 *
 * Copyright (c) 2017 The Ontario Institute for Cancer Research. All rights reserved.
 *
 * This program and the accompanying materials are made available under the terms of the GNU Public License v3.0.
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

"use strict";
import CONSTANTS from 'constants';
import _ from 'lodash';
import utf8 from 'utf8';
/*
    Filter processor
 */
export default class FilterProcessor{
    constructor(logger) {
        this.logger = logger || console;
    }
    buildFilters(doc_type, nested, raw_filters){
        if(raw_filters === null || Object.keys(raw_filters).length === 0)
            return raw_filters;

        let filters = this.filter_optimizer(raw_filters);
        if(! filters){
            logger.error(`Must specify filters: ${filters}`);
            throw Error(`Must specify filters: ${filters}`);
        }
        let keys = Object.keys(filters);
        ["op", "content"].forEach(item => {
            if(!keys.includes(item)){
                logger.error(`Must specify : ${item}. in filters: ${filters}`);
                throw Error(`Must specify : ${item}. in filters: ${filters}`);
            }
        });

        let op = filters["op"],
            content = filters["content"];

        if(op === CONSTANTS.IN)
            f = this._get_term_or_regex_or_set_filter(doc_type, nested, filters);
        if(op === CONSTANTS.EXCLUDE)
            f = this._get_must_not_filter(doc_type, nested, filters);
        if(op === CONSTANTS.EXCLUDE_IF_ANY)
            f = this._get_must_not_any_filter(doc_type, nested, filters);
        if(op in CONSTANTS.IS_OPS)
            f = this._get_missing_filter(doc_type, nested, content,op);
        if(op === CONSTANTS.AND)
            f = this._get_and_filter(doc_type, nested, content);
        if(op === CONSTANTS.OR)
            f = this._get_or_filter(doc_type, nested, content);
        if(op in CONSTANTS.RANGE_OPS_KEYS)
            f = this._get_range_filter(doc_type, nested, content, op);

        return f
    }
    filter_optimizer(filters){
        let op = filters["op"],
            content = filters["content"];

        if (op in [CONSTANTS.EQ , CONSTANTS.NEQ])
            return this.term_optimizer(op, content);

        if (op in [CONSTANTS.IN, CONSTANTS.EXCLUDE]
            && content['value'].length > 1
            && (content['value'].some(v => v.includes('*')) || content['value'].some(v => v.includes('set_id:')))){

            // seperate regex and set_id into one list, terms in another and OR them
            let ps =
                _.filter(content['value'], psv => psv.includes('*') || psv.includes('set_id:'))
                    .map(psv => { return {
                        "op": op,
                        "content": {
                        "field": content['field'],
                         "value": [psv]
                    }}});

            let terms = _.filter(content['value'],psv => (!psv.includes('*')) && (!psv.includes('set_id:'))),
                ts = [];
            if (terms.length > 0) {
                ts = [{
                    "op": op,
                    "content": {
                        "field": content['field'],
                        "value": terms
                    }
                }];
            }

            return {
                "op": OR,
                "content": ts.concat(ps)
                }
        }

        if (op in CONSTANTS.GROUP_OPS) {
            return {
                "op": op,
                "content": this.grouping_optimizer(content, op)
            };
        } else {
            return {
                "op": op,
                "content": content
            };
        }
    }
    _get_term_or_regex_or_set_filter(doc_type, nested, x){
        let value;

        typeof x['content']['value'] === "object" ? value = x['content']['value'][0] : value = x['content']['value'];

        if (typeof value === "string"){
            if (value.includes('*'))
                return this._get_regex_filter(doc_type, nested, x);
            else if (value.includes('set_id:'))
                return this._get_set_filter(doc_type, nested, x);
        }
        return this._get_term_filter(doc_type, nested, x);
    }
    _get_must_not_filter(doc_type, nested, x){
        let tf = this._get_term_filter(doc_type, nested, x)
        return this.is_nested(tf) ? tf : this.wrap_not(tf);
    }
    _get_must_not_any_filter(doc_type, nested, x){
        let tf = _get_term_filter(doc_type, nested, x);
        return this.wrap_not(tf);
    }
    _get_missing_filter(doc_type, nested, content, op){
        // TODO: make this generic
        let k = field_to_full_path_on_doc_type(doc_type, content['field']);

        //# FIXME assumes missing
        let r = {'exists': {'field': k, "boost": 0}};
        let path = k.split(".");

        for( let i =1; i < path.length; i++) {
            let p = _.chunk(path, path.length - i)[0].join(".");
            if (nested.includes(p)) {
                r = this.wrap_must(r);
                r = this.wrap_filter(r, p);
            }
        }
        if (op === CONSTANTS.IS) r = this.wrap_not(r);
        return r
    }
    _get_and_filter(doc_type, nested, xs){
        let musts= [],
            must_nots = [],
            shoulds = [];

        //# TODO remove for loop
        xs.forEach(x => {
            let op = x['op'],
                content = x['content'];

            let is_must = op in CONSTANTS.MUST_OPS.concat(CONSTANTS.RANGE_OPS_KEYS);
            let is_must_not = op in CONSTANTS.MUST_NOT_OPS;
            let is_should = op === CONSTANTS.OR;

            if (is_must || is_must_not){
                let curr;
                if (op in CONSTANTS.VALUE_OPS)
                    curr = this._get_term_or_regex_or_set_filter(doc_type, nested, x);
                else if(op in CONSTANTS.IS_OPS)
                    curr = this._get_missing_filter(doc_type, nested, content, op);
                else if (op in CONSTANTS.RANGE_OPS_KEYS)
                    curr = this._get_range_filter(doc_type, nested, content, op);

                if (this.is_nested(curr)){
                    let filteredMusts =
                        _.filter(musts, m => this.is_nested(m) && this.read_path(m) === this.read_path(curr));
                    this.collapse_nested_filters(filteredMusts.length > 0 ? filteredMusts[0] : null,
                        curr, op === CONSTANTS.EXCLUDE_IF_ANY ? must_nots : musts);
                }
                else if(is_must_not) must_nots.concat(curr);
                else musts.concat(curr)
            }
            else if (is_should)
                shoulds.concat(this._get_or_filter(doc_type, nested, content));
        });
        //   # wrap both shoulds and must in ES_MUST so ES_SHOULD so score does not interfere
        //   # _get_or_filter already wraps shoulds with ES_SHOULD
        let esMust = CONSTANTS.ES_MUST,
            esMustNot = CONSTANTS.ES_MUST_NOT;
        let r = _.reduce({ esMust: shoulds !== null ? musts.concat(shoulds): musts,
              esMustNot : must_nots
            }, (result, value, key) => value !== null && value.length > 0 ? result[key] = value : result
            , {});

        return {ES_BOOL:r}
    }
    _get_or_filter(doc_type, nested, content){
        let must_not =
            _.filter(content, x => x['op'] in CONSTANTS.MUST_NOT_OPS).
            map(x => this._get_term_or_regex_or_set_filter(doc_type, nested, x));
        let should =
            _.filter(content, x=> x['op'] in CONSTANTS.HAVE_OPS).
                map(x => this._get_term_or_regex_or_set_filter(doc_type, nested, x));
        should =
            should.concat(_.filter(content, x=> x['op'] === CONSTANTS.OR).
            map(x => this._get_or_filter(doc_type, nested, x['content'])));
        should =
            should.concat(_.filter(content, x=> x['op'] === CONSTANTS.AND).
                map(x => this._get_and_filter(doc_type, nested, x['content'])));
        should =
            should.concat(_.filter(content, x=> x['op'] in CONSTANTS.IS_OPS).
                map(x => this._get_missing_filter(doc_type, nested, x['content'])));
        if (must_not) should.append(this.wrap_not(must_not));
        return { ES_BOOL: should != null || should.length>0 ? { ES_SHOULD: should } : {}};
    }
    _get_range_filter(doc_type, nested, content, op){
        // TODO: make this generic
        let k = field_to_full_path_on_doc_type(doc_type, content['field']),
            v = content["value"],
            obj = { "boost": 0 };

        if(typeof v === "object")
            v = op in [CONSTANTS.GT, CONSTANTS.GTE] ? _.max(v) : _.min(v);
        else if( typeof v === "string")
            v = utf8.encode(v);

        obj[CONSTANTS.RANGE_OPS[op]] = v;

        let r = {"range": {k: obj}},
            path = k.split(".");

        r = this.wrap_filter_based_on_path(r, path,nested, op);
        return r;
    }
    term_optimizer(op, content){
        let op_mapping = {
            EQ: IN,
            NEQ: EXCLUDE
        };

        if (typeof content["value"] === "string")
            content["value"] = [content["value"]];

        return this.filter_optimizer({
            "op": op_mapping[op],
            "content": content
        })
    }
    grouping_optimizer(content, parent_op){
        let inside = [],
            other = [];

        content.forEach(c => {
            if(c['op'].toLowerCase() === parent_op)
                inside.concat(this.grouping_optimizer(c['content'], parent_op));
            else
                other = [other, this.filter_optimizer(c)];
        });

        return other.concat(inside);
    }
    _get_regex_filter(doc_type, nested, x, upperCase){
        let op = x['op'],
            content = x['content'];

        // TODO: make this generic
        let k = this.field_to_full_path_on_doc_type(doc_type, content['field']);

        let v = typeof content["value"] === "object" ? content["value"][0] : content["value"];
        let t = "regexp";

        v = v.replace('*', '.*');
        v =  utf8.encode(v);
        // TODO: pass upperCase flag from calling functions to get an exact replacement of this:
        // if k == "project_id" or k == 'cases.project.project_id' or k == 'project.project_id':
        if(upperCase) v = v.toUpperCase();

        // TODO: Check for correctness: replacement for if '*' in v[0]: v = v[0][:-1]
        if(v.startswith('*')) v = "";

        let r = {t: {k: v}};
        let path = k.split(".");

        r = this.wrap_filter_based_on_path(r, path,nested, op);
        return r
    }
    _get_set_filter(doc_type, nested, x){
        let op = x['op'],
            content = x['content'];

        // TODO: make this generic
        let full_field = field_to_full_path_on_doc_type(doc_type, content['field'])

        let values = content['value'],
            t = "terms",
            value = values;

        value = typeof values === "object" ? values[0] : value;
        value =  utf8.encode(value);
        let set_id = value.replace('set_id:', '');

        let r = {
            t: {
                "boost": 0,
                full_field: {
                    "index" : CONSTANTS.FIELD_TO_SET_TYPE[content['field']],
                    "type" : CONSTANTS.FIELD_TO_SET_TYPE[content['field']],
                    "id" : set_id,
                    "path" : "ids"
                }
            }
        };

        let path = full_field.split(".");
        r = this.wrap_filter_based_on_path(r, path,nested, op);
        return r
    }
    _get_term_filter(doc_type, nested, x,upperCase) {
        let op= x['op'],
            content = x['content'];

        // TODO: make this generic
        let k = this.field_to_full_path_on_doc_type(doc_type, content['field']);
        let v = content["value"],
            t = "term";

        if(typeof v === "object"){
            v = v.map(item => {
                if(item == null) return "";
                // TODO: pass upperCase flag from calling functions to get an exact replacement of this:
                // if k == "project_id" or k == 'cases.project.project_id' or k == 'project.project_id':
                if(typeof item === "string") return upperCase ? utf8.encode(item).toUpperCase() : utf8.encode(item);
                else return item;
            });
            t = "terms";
        }
        else if(typeof  v === "string") {
            // TODO: pass upperCase flag from calling functions to get an exact replacement of this:
            // if k == "project_id" or k == 'cases.project.project_id' or k == 'project.project_id':
            v = upperCase ? utf8.encode(v).toUpperCase() : utf8.encode(v);
        }
        if (t == "term")
            r = {t: {k: {"value": v, "boost": 0}}};
        else
            r = {t: {k: v, "boost": 0}};

        let path = k.split(".");
        r = this.wrap_filter_based_on_path(r, path,nested, op);
        return r
    }
    collapse_nested_filters(found, curr, musts){
        if (found !== null) {
            if(this.read_nested_bool(curr).includes(CONSTANTS.ES_MUST)) {
                let child = this.read_nested_bool(curr)[ES_MUST][0];
                let found_musts = _.get(this.read_nested_bool(found), CONSTANTS.ES_MUST, []);
                if (this.is_nested(child)) {
                    let filtered = _.filter(found_musts,
                        m => this.is_nested(m) && this.read_path(m) === this.read_path(child));
                    this.collapse_nested_filters(filtered.length > 0 ? filtered[0] : null, child, found_musts)
                }
                else {
                    this.read_nested_bool(found)[CONSTANTS.ES_MUST] =
                        _.get(this.read_nested_bool(found), CONSTANTS.ES_MUST, []).
                        concat(this.read_nested_bool(curr)[CONSTANTS.ES_MUST]);
                }
            }
        else
            {
                //# must_not won't have any nested filters
               this.read_nested_bool(found)[CONSTANTS.ES_MUST_NOT] =
                   _.get(this.read_nested_bool(found),CONSTANTS.ES_MUST_NOT, []).
                   concat(this.read_nested_bool(curr)[CONSTANTS.ES_MUST_NOT]);
            }
        }
        else
            musts.concat(curr)

    }
    wrap_filter_based_on_path(r, path,nested, op){
        for( let i =1; i < path.length; i++) {
            let p = _.chunk(path, path.length - i)[0].join(".");
            if (nested.includes(p)) {
                if(!this.is_nested(r))
                    r = CONSTANTS.HAVE_NOT_OPS.includes(op) ? this.wrap_not(r) : this.wrap_must(r);
                else
                    r = this.wrap_must(r);

                r = this.wrap_filter(r, p)
            }
        }
    }
    is_nested(x){
        return x.includes(CONSTANTS.ES_NESTED);
    }
    wrap_bool(op, val) {
        return {ES_BOOL: {op: typeof val === "object" ? val : [val]}}
    }
    wrap_must(val){
        return this.wrap_bool(CONSTANTS.ES_MUST, val)
    }
    wrap_not(val) {
        return this.wrap_bool(CONSTANTS.ES_MUST_NOT, val)
    }
    wrap_filter(val, p){
        return {
            ES_NESTED: {
                ES_PATH: p,
                ES_QUERY: val
            }
        }
    }
    read_nested(x){
        return _.get(x,CONSTANTS.ES_NESTED, {});
    }
    read_path(x){
        return _.get(this.read_nested(x),'path', '');
    }
    read_nested_query(x){
        return _.get(this.read_nested(x), CONSTANTS.ES_QUERY, {});
    }
    read_nested_bool(x){
        return _.get(this.read_nested_query(x), CONSTANTS.ES_BOOL, {});
    }

}

