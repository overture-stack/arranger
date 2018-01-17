
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
            f = _get_must_not_filter(doc_type, nested, filters);
        if(op === CONSTANTS.EXCLUDE_IF_ANY)
            f = _get_must_not_any_filter(doc_type, nested, filters);
        if(op in CONSTANTS.IS_OPS)
            f = _get_missing_filter(doc_type, nested, content,op);
        if(op === CONSTANTS.AND)
            f = _get_and_filter(doc_type, nested, content);
        if(op === CONSTANTS.OR)
            f = _get_or_filter(doc_type, nested, content);
        if(op in CONSTANTS.RANGE_OPS_KEYS)
            f = _get_range_filter(doc_type, nested, content, op);

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

}

