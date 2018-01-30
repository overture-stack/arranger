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
import _ from 'lodash';
import utf8 from 'utf8';
import { CONSTANTS } from './constants';
import FilterProcessor from './filters';
/*
    Aggregation Processor

    Use by creating a new instance of Aggregationprocessor and passing the graphQL content to buildAggregations
    Example:
      new AggregationProcessor().buildAggregations({ type, fields, graphql_fields, nested_fields, args });

    Sample output:
    { query: { bool: { must: [ { terms: { primary_site: [ 'Colorectal' ], boost: 0 } } ] } }},
      aggs:  { primary_site: { terms: { field: 'primary_site', size: 100 } } }
    }
 */
export default class AggregationProcessor{

  querySize = 100;
  historgramInterval = 1000;
  filterProcessor = new FilterProcessor();

  constructor(logger) {
      this.logger = logger || console;
  }
  buildAggregations({ type, fields, graphql_fields, nested_fields, args }) {
    /* To Match the GDCAPI response, this needs to return an object of the form:
      { query: {}, aggs: {} };
    */
    
    const doc_type = type.name.toLowerCase();
    const filters = this.build_filters_from_args( {args, doc_type, fields, nested_fields} );
    
    // No logic found in the gdcapi method that makes global_aggregations true
    // In this code I pass the variable through in case we find a need for it, but the code has not been implemented to handle the true cases.
    //  In most cases, the python code that would be implemented for the true case is included as a comment.
    const global_aggregations = false;
    const aggs = this.build_aggregations( {filters, fields, nested_fields, graphql_fields, global_aggregations} );
    return { 'query':filters, aggs };
  }

  /**
   * Filters are built by the FilterProcessor - 
   *  build_filters_from_args prepares the inputs for the FilterProcessor by:
   *   - collecting filter arguments from the provided args.filters
   *   - wrapping the args.query into the in the expected json format for filters
   * 
   * Default: Returns an empty object if no filters found in args
   */
  build_filters_from_args( {args, doc_type, fields, nested_fields} ) {
    
    let filters = {};

    if (args && (args.query || args.filters) ) {
      filters = {op: CONSTANTS.AND, content: []};
      
      // Get filters from args
      args.filters && filters.content.push(args.filters);
      
      // Format filters from args.query
      args.query && filters.content.push(this.build_prefix_filters(args.query, fields));

      // Send to FilterProcessor middleware
      filters = this.filterProcessor.buildFilters(doc_type, nested_fields, filters);
    }

    return filters;
  }

  /**
   * Format query into filter json for use by FilterProcessor
   */
  build_prefix_filters(query, fields){
    return {
        op: CONSTANTS.OR,
        content: fields.map(x => {
            return {
              op: CONSTANTS.EQ,
              content: {
                  field: x,
                  value: query + '*'
              }
            }
        })
    }
  }

  build_aggregations({filters, fields, nested_fields, graphql_fields, global_aggregations}) {

    // NOTE: This is an implementation of gdcapi utils.build_aggregations, not request.build_aggregations
    // The latter (request.build_aggregation) is referenced in the gdcapi search service, which is not the use case being worked on here.
    
    const aggs = {}

    // Add to aggs for each field
    fields.forEach( raw_field => {
      // Translate from graphql field format by:
      //  - get field name before .
      //  - replace all __ with .
      const double_underscore_field = raw_field.split('.')[0]
      const field = double_underscore_field.replace('__','.')

      // find the longest nested path to the facet if it exists
      const path_to_facet = this.get_nested_path_to_field(field, nested_fields)

      if (path_to_facet) {
        const nested_query = this.get_nested_query_from_path(filters, path_to_facet, nested_fields, match_all=false);
        const nested_field_agg = this.create_term_or_numeric_agg(field, graphql_fields[double_underscore_field], path_to_facet);

        const nested_aggs = this.ensure_path_to_agg(aggs, path_to_facet, nested_fields, filters, global_aggregations);

        if(nested_query) {
          const query = nested_query.nested ? nested_query.nested.query : {};
          
          // NOT IMPLEMENTED - global_aggregations always false, this is reference code in case it becomes needed
          /*
          if global_aggregations:
              cleaned_query = remove_field_from_query(
                  field, query,
                  # if field not in query use query because nested aggs still need to be filtered by other
                  # fields in the nested path
                  use_if_not_found=query,
                  # if field only term found in query then it doesn't need to be filtered
                  use_if_clean_empty=None
              )
              if cleaned_query:
                  nested_aggs.update(create_filtered_agg(field, cleaned_query, nested_field_agg))
              else:
                  # There is a query but it is just the nested field - just add it to aggs
                  nested_aggs.update(nested_field_agg)
          else:
              nested_aggs.update(create_filtered_agg(field, query, nested_field_agg))
          */
          const filteredAgg = this.create_filtered_agg(field, query, nested_field_agg);
          Object.assign(nested_aggs, filteredAgg);
          
        } else {
          // No query - just add to aggs
          Object.assign(nested_aggs, nested_field_agg);
        }

      } else {
        const field_agg = this.create_term_or_numeric_agg(field, graphql_fields[double_underscore_field]);
        
        // NOT IMPLEMENTED - global_aggregations always false, this is reference code in case it becomes needed
        /*
          cleaned_query = None
          if global_aggregations:
              cleaned_query = remove_field_from_query(
                  field, filters,
                  # if the field isn't in the filter do nothing and let ES filter it
                  use_if_not_found=None,
                  # if the field is the only filter do not let ES filter it
                  use_if_clean_empty={"match_all": {}}
              )

          if cleaned_query:
              # needs to be global of ES will auto filter the aggs results
              aggs.update(create_global_agg(field, create_filtered_agg(field, cleaned_query, field_agg)))
          else:
              aggs.update(field_agg)
        */
        Object.assign(aggs, field_agg);
      }
      
    });

    return aggs;
  }

  get_nested_query_from_path(query, path, nested_fields, match_all=true) {
    
    const match_all_query = {'nested': {'path': path, 'query': {'bool': {'must': [{'match_all': {}}]}}}};

    let nested_query = null;
    let parent = null;

    const segments = path.split(',');
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      parent = parent ? `${parent}.${seg}` : seg;

      if (nested_fields.hasOwnProperty(parent)) {
        if (nested_query === null) {
          // ORIGINAL: nested_query = get_nested_query(query.get('bool', {}).get('must', []), parent)
          nested_query = this.get_nested_query( (query?.bool?.must || []), parent);
        } else {
          // ORIGINAL: nested_query = get_nested_query(read_nested_bool(nested_query).get('must', []), parent)
          const nested_bool = this.filterProcessor.read_nested_bool(nested_query);
          nested_query = this.get_nested_query( _.get(nested_bool, 'must', []), parent);
        }
      } else {
        continue;
      }

      if (nested_query===null) {
        if (match_all) { return match_all_query; }
        else { break; }
      }
    }

    return nested_query;
  }

  /** 
   * Return the first item in arr where its path matches _path
   */
  get_nested_query(arr, _path) {
    for(let i=0; i < arr.length; i++) {
      const item = arr[i];
      if (filterProcessor.read_path(item) === _path) {
        return item;
      };
    }
    // Return null if no matches were found in the arr
    return null;
  }

  /**
   * Creates an ES aggregation with proper nesting to the field. Also wraps in :global or :filtered aggs if needed
   */
  ensure_path_to_agg(aggs, path, nested_fields, query, global_aggregations=false) {
    
    // NOT IMPLEMENTED - global_aggregations always false, this is reference code in case it becomes needed
    /*
    if global_aggregations:
        ensure_global_when_needed(aggs, path, nested_fields, query)
    */

    return this.ensure_filtered_along_path(aggs, path, nested_fields, query, global_aggregations);

  }

  ensure_filtered_along_path(aggs, path, nested_fields, query, global_aggregations=false) {
    let nested_aggs = Object.assign({}, aggs);
    
    let p = null;

    const segments = path.split('.');
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      p = p ? `${p}.${seg}` : seg;
      
      const globalPath = `${p}:global`;
      if (nested_aggs.hasOwnProperty(globalPath)) {
        nested_aggs = nested_aggs[globalPath].aggs;
      }

      const filteredPath = `${p}:filtered`;
      if (nested_aggs.hasOwnProperty(filteredPath)) {
        nested_aggs = nested_aggs[filteredPath].aggs;
      }

      if (nested_aggs.hasOwnProperty(p)) {
        nested_aggs = nested_aggs[path].aggs;
        continue;
      }

      if (Array.isArray(nested) && nested_fields.includes(path)) {
        let label = p;
        const path_aggs = {
          p: {
            'nested': {'path':p},
            'aggs': {}
          }
        }

        // NOT IMPLEMENTED - global_aggregations always false, this is reference code in case it becomes needed
        /*
        if global_aggregations:
                cleaned_query = remove_path_from_query(p, nested_query, use_if_not_found=nested_query)

                if cleaned_query:
                    label = '{}:filtered'.format(label)
                    path_aggs = create_filtered_agg(p, cleaned_query, path_aggs)

                if query and len(query.keys()) > 0:
                    nested_query = get_nested_query_from_path(query, p, nested_fields, match_all=False)
                    if nested_query:
                        nested_query = read_nested_query(nested_query)
        */

        Object.assign(nested_aggs, path_aggs);
        nested_aggs = nested_aggs[label].aggs;

        if (nested_aggs.hasOwnProperty(p)) {
          nested_aggs = nested_aggs[path].aggs
        }
      }

    } // end for loop

    return nested_aggs;
  }

  get_nested_path_to_field(field, nested, short_circuit=false) {
    if (!Array.isArray(nested)) {
      return null;
    }

    let path = null;
    let workingPath = null;

    const segments = field.split('.');
    for (let i = 0; i < segments.length; i++) {

      const seg = segments[i];
      
      const testPath = workingPath ? `${workingPath}.${seg}` : seg;
      if (nested.includes(testPath)) {
        path = testPath;
        if (short_circuit) {break;}
      }
      workingPath = testPath;
    }

    return path;
  }

  create_filtered_agg(field, filters, aggs) {
    const filteredFieldName = `${field}:filtered`;
    return {
      [filteredFieldName]: {
        filters,
        aggs,
      }
    };
  }

  create_term_or_numeric_agg(field, graphql_fields, nested=false) {

    if( !(graphql_fields) ){
      // Return empty object if no content
      return {};

    } else {

      if (graphql_fields[CONSTANTS.BUCKETS]) {
        if (nested) {
          return this.create_term_nested_field_agg(field);
        } else {
          return this.create_term_field_agg(field)
        }
      } else {
        return this.create_numeric_field_agg(field, graphql_fields);
      }
    }
  }

  create_term_nested_field_agg(field) {
    return {
      [field]: {
        aggs: {rn: {reverse_nested: {}}},
        terms: {field, size: this.querySize},
      }
    };
  }

  create_term_field_agg(field) {
    return {
      [field]: {
        terms: {field, size: this.querySize},
      }
    };
  }

  create_numeric_field_agg(field, graphql_fields) {
    numeric_agg = {};

    if (graphql_fields[CONSTANTS.STATS]) {
      
      numeric_agg[`${field}:stats`] = {
        stats: {
          field,
        },
      };
    }
    
    if (graphql_fields[CONSTANTS.HISTOGRAM]) {

      const args = graphql_fields.histogram.arguments;
      const interval = _.get(args, '[0].interval', this.historgramInterval);
      
      numeric_agg[`${field}:historgram`] = {
        histogram: {
          field,
          interval,
        }
      };
    }

    return numeric_agg;
  }

};
