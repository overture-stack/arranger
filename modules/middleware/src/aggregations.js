import { CONSTANTS } from './constants';
import FilterProcessor from './filters';
/*
    Aggregation Processor

    Services provided:
      buildAggregations({ type, fields, graphql_fields, nested_fields, args })
      pruneAggregations({ nested_fields, aggs })

    Use by creating a new instance of Aggregationprocessor and passing the graphQL content to buildAggregations
    Example:
      new AggregationProcessor().buildAggregations({ type, fields, graphql_fields, nested_fields, args });
 */
export default class AggregationProcessor {
  querySize = 100;
  histogramInterval = 1000;
  filterProcessor = new FilterProcessor();

  constructor(logger) {
    this.logger = logger || console;
  }
  buildAggregations({ type, fields, graphql_fields, nested_fields, args }) {
    /*
    To Match the GDCAPI response, this needs to return an object of the form:
      { query: {}, aggs: {} }

      Sample output:
      {
        query: { bool: { must: [ { terms: { primary_site: [ 'Colorectal' ], boost: 0 } } ] } }},
        aggs:  { primary_site: { terms: { field: 'primary_site', size: 100 } } }
      }
    */

    const doc_type = type.name.toLowerCase();
    const filters = this.build_filters_from_args({
      args,
      doc_type,
      fields,
      nested_fields,
    });

    // global_aggregations boolean is set as inverse of argument 'aggregations_filter_themselves' value
    const global_aggregations = !args.aggregations_filter_themselves;
    const aggs = this.build_aggregations({
      filters,
      fields,
      nested_fields,
      graphql_fields,
      global_aggregations,
    });
    return { query: filters, aggs };
  }

  pruneAggregations({ nested_fields, aggs }) {
    const pruned = this.prune_aggs(aggs, nested_fields);
    return { pruned: pruned };
  }

  /**
   * Filters are built by the FilterProcessor -
   *  build_filters_from_args prepares the inputs for the FilterProcessor by:
   *   - collecting filter arguments from the provided args.filters
   *   - wrapping the args.query into the in the expected json format for filters
   *
   * Default: Returns an empty object if no filters found in args
   */
  build_filters_from_args({ args, doc_type, fields, nested_fields }) {
    let filters = {};

    if (args && (args.query || args.filters)) {
      filters = { op: CONSTANTS.AND, content: [] };

      // Get filters from args
      args.filters && filters.content.push(args.filters);

      // Format filters from args.query
      args.query &&
        filters.content.push(this.build_prefix_filters(args.query, fields));

      // Send to FilterProcessor middleware
      filters = this.filterProcessor.buildFilters(
        doc_type,
        nested_fields,
        filters,
      );
    }

    return filters;
  }

  /**
   * Format query into filter json for use by FilterProcessor
   */
  build_prefix_filters(query, fields) {
    return {
      op: CONSTANTS.OR,
      content: fields.map(x => {
        return {
          op: CONSTANTS.EQ,
          content: {
            field: x,
            value: query + '*',
          },
        };
      }),
    };
  }

  build_aggregations({
    filters,
    fields,
    nested_fields,
    graphql_fields,
    global_aggregations = false,
  }) {
    // NOTE: This is an implementation of gdcapi utils.build_aggregations, not request.build_aggregations
    // The latter (request.build_aggregation) is referenced in the gdcapi search service, which is not the use case being worked on here.

    const aggs = {};

    // Add to aggs for each field
    fields.forEach(raw_field => {
      // Translate from graphql field format by:
      //  - get field name before .
      //  - replace all __ with .
      const double_underscore_field = raw_field.split('.')[0];
      const field = double_underscore_field.split('__').join('.');

      // find the longest nested path to the facet if it exists
      const path_to_facet = this.get_nested_path_to_field({
        field,
        nested: nested_fields,
      });

      if (path_to_facet) {
        const nested_query = this.get_nested_query_from_path({
          query: filters,
          path: path_to_facet,
          nested_fields,
          match_all: false,
        });
        const nested_field_agg = this.create_term_or_numeric_agg(
          field,
          graphql_fields[double_underscore_field],
          path_to_facet,
        );

        const nested_aggs = this.ensure_path_to_agg(
          aggs,
          path_to_facet,
          nested_fields,
          filters,
          global_aggregations,
        );

        if (nested_query) {
          const query = nested_query.nested ? nested_query.nested.query : {};

          if (global_aggregations) {
            const cleaned_query = this.remove_field_from_query({
              field,
              query,
              use_if_not_found: query,
              use_if_clean_empty: null,
            });
            if (cleaned_query) {
              const filteredAgg = this.create_filtered_agg(
                field,
                cleaned_query,
                nested_field_agg,
              );
              Object.assign(nested_aggs, filteredAgg);
            } else {
              // There is a query but it is just the nested field - just add it to aggs
              Object.assign(nested_aggs, nested_field_agg);
            }
          }

          const filteredAgg = this.create_filtered_agg(
            field,
            query,
            nested_field_agg,
          );
          Object.assign(nested_aggs, filteredAgg);
        } else {
          // No query - just add to aggs
          Object.assign(nested_aggs, nested_field_agg);
        }
      } else {
        const field_agg = this.create_term_or_numeric_agg(
          field,
          graphql_fields[double_underscore_field],
        );

        let cleaned_query = null;

        if (global_aggregations) {
          cleaned_query = this.remove_field_from_query({
            field,
            filters,
            use_if_not_found: null,
            use_if_clean_empty: { match_all: {} },
          });
        }

        if (cleaned_query) {
          const filteredAgg = this.create_filtered_agg(
            field,
            cleaned_query,
            field_agg,
          );
          Object.assign(aggs, filteredAgg);
        } else {
          Object.assign(aggs, field_agg);
        }
      }
    });

    return aggs;
  }

  remove_field_from_query({
    field,
    query,
    use_if_not_found = null,
    use_if_clean_empty = null,
  }) {
    return this.remove_pred_from_query(
      item => item?.terms?.hasOwnProperty(field),
      item =>
        !item.hasOwnProperty('terms') ||
        (item.hasOwnProperty('terms') && !item.terms.hasOwnProperty(field)),
      query,
      use_if_not_found,
      use_if_clean_empty,
    );
  }

  remove_path_from_query(
    _path,
    query,
    use_if_not_found = null,
    use_if_clean_empty = null,
  ) {
    return this.remove_pred_from_query(
      item => item.nested?.path === _path,
      item => !item.hasOwnProperty('nested') || item.nested?.path !== _path,
      query,
      use_if_not_found,
      use_if_clean_empty,
    );
  }

  remove_pred_from_query(
    pred_find,
    pred_clean,
    query,
    use_if_not_found,
    use_if_clean_empty,
  ) {
    let clean_filter = use_if_not_found;

    const musts = query?.bool?.must || [];
    const found_filter = musts.some(item => pred_find(item));

    if (found_filter) {
      clean_filter = musts.filter(item => pred_clean(item));
      if (clean_filter.length === 0) {
        clean_filter = use_if_clean_empty;
      } else if (clean_filter.length === 1) {
        clean_filter = clean_filter[0];
      } else {
        clean_filter = {
          [CONSTANTS.ES_BOOL]: { [CONSTANTS.ES_MUST]: clean_filter },
        };
      }
    }

    return clean_filter;
  }

  get_nested_query_from_path({ query, path, nested_fields, match_all = true }) {
    const match_all_query = {
      nested: { path: path, query: { bool: { must: [{ match_all: {} }] } } },
    };

    let nested_query = null;
    let parent = null;

    const segments = path.split(',');
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      parent = parent ? `${parent}.${seg}` : seg;

      if (nested_fields.hasOwnProperty(parent)) {
        if (nested_query === null) {
          // ORIGINAL: nested_query = get_nested_query(query.get('bool', {}).get('must', []), parent)
          nested_query = this.get_nested_query(query?.bool?.must || [], parent);
        } else {
          // ORIGINAL: nested_query = get_nested_query(read_nested_bool(nested_query).get('must', []), parent)
          const nested_bool = this.filterProcessor.read_nested_bool(
            nested_query,
          );
          nested_query = this.get_nested_query(nested_bool?.must || [], parent);
        }
      } else {
        continue;
      }

      if (nested_query === null) {
        if (match_all) {
          return match_all_query;
        } else {
          break;
        }
      }
    }

    return nested_query;
  }

  /**
   * Return the first item in arr where its path matches _path
   */
  get_nested_query(arr, _path) {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (this.filterProcessor.read_path(item) === _path) {
        return item;
      }
    }
    // Return null if no matches were found in the arr
    return null;
  }

  /**
   * Creates an ES aggregation with proper nesting to the field. Also wraps in :global or :filtered aggs if needed
   */
  ensure_path_to_agg(
    aggs,
    path,
    nested_fields,
    query,
    global_aggregations = false,
  ) {
    // NOT IMPLEMENTED - global_aggregations always false, this is reference code in case it becomes needed
    if (global_aggregations) {
      this.ensure_global_when_needed(aggs, path, nested_fields, query);
    }

    return this.ensure_filtered_along_path(
      aggs,
      path,
      nested_fields,
      query,
      global_aggregations,
    );
  }

  /**
   * Non-functional Warning - This modifies the content of the aggs variable.
   */
  ensure_global_when_needed(aggs, _path, nested_fields, query) {
    const short_nested_path = this.get_nested_path_to_field({
      field: _path,
      nested: nested_fields,
      short_circuit: true,
    });
    const nested_query = this.get_nested_query_from_path({
      query,
      path: short_nested_path,
      nested_fields,
      match_all: false,
    });

    const label = `${short_nested_path}:global`;
    if (!(aggs.hasOwnProperty(nested_query) && aggs.hasOwnProperty(label))) {
      const nested_aggs = {};
      if (aggs.hasOwnProperty(short_nested_path)) {
        nested_aggs[short_nested_path] = aggs[short_nested_path];

        delete aggs[short_nested_path];
      }
      const globalAgg = this.create_global_agg(short_nested_path, nested_aggs);

      // This line modifies the input aggs
      Object.assign(aggs, globalAgg);
    }

    // Return the input aggs, potentially modified
    return aggs;
  }

  ensure_filtered_along_path(
    aggs,
    path,
    nested_fields,
    query,
    global_aggregations = false,
  ) {
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

      if (Array.isArray(nested_fields) && nested_fields.includes(path)) {
        let label = p;
        let path_aggs = {
          [p]: {
            nested: { path: p },
            aggs: {},
          },
        };

        if (global_aggregations) {
          const cleaned_query = this.remove_path_from_query(p, nested_aggs);

          if (cleaned_query) {
            label = `${label}:filtered`;
            path_aggs = this.create_filtered_agg(p, cleaned_query, path_aggs);

            // The following python code was not transcribed as the nested_query object it defines
            //  is not used outside of this block - Not sure the intention of this code, but the methods have no side effects and
            //  the outputs are unused, so we can ignore them
            /*
            if query and len(query.keys()) > 0:
                    nested_query = get_nested_query_from_path(query, p, nested_fields, match_all=False)
                    if nested_query:
                        nested_query = read_nested_query(nested_query)
            */
          }
        }

        Object.assign(nested_aggs, path_aggs);
        nested_aggs = nested_aggs[label].aggs;

        if (nested_aggs.hasOwnProperty(p)) {
          nested_aggs = nested_aggs[path].aggs;
        }
      }
    } // end for loop

    return nested_aggs;
  }

  get_nested_path_to_field({ field, nested, short_circuit = false }) {
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
        if (short_circuit) {
          break;
        }
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
      },
    };
  }

  create_global_agg(field, aggs) {
    const globalFieldName = `${field}:global`;
    return {
      [globalFieldName]: {
        global: {},
        aggs,
      },
    };
  }

  create_term_or_numeric_agg(field, graphql_fields, nested = false) {
    if (!graphql_fields) {
      // Return empty object if no content
      return {};
    } else {
      if (graphql_fields[CONSTANTS.BUCKETS]) {
        if (nested) {
          return this.create_term_nested_field_agg(field);
        } else {
          return this.create_term_field_agg(field);
        }
      } else {
        return this.create_numeric_field_agg(field, graphql_fields);
      }
    }
  }

  create_term_nested_field_agg(field) {
    return {
      [field]: {
        aggs: { rn: { reverse_nested: {} } },
        terms: { field, size: this.querySize },
      },
    };
  }

  create_term_field_agg(field) {
    return {
      [field]: {
        terms: { field, size: this.querySize },
      },
    };
  }

  create_numeric_field_agg(field, graphql_fields) {
    let numeric_agg = {};

    if (graphql_fields[CONSTANTS.STATS]) {
      numeric_agg[`${field}:stats`] = {
        stats: {
          field,
        },
      };
    }

    if (graphql_fields[CONSTANTS.HISTOGRAM]) {
      const args = graphql_fields.histogram.arguments;
      const interval = args?.[0]?.interval || this.histogramInterval;

      numeric_agg[`${field}:histogram`] = {
        histogram: {
          field,
          interval,
        },
      };
    }

    return numeric_agg;
  }

  prune_aggs(aggs, nested_fields) {
    /*
     Transcribed from gdcapi utils.prune_aggs

     TODO: nested_fields is not used... need to determine if it can be removed.
     */

    const p_a = {};

    Object.entries(aggs).forEach(entry => {
      const k = entry[0];
      let v = entry[1];

      if (k === 'doc_count') {
        // Don't add doc_count to output
        return;
      }

      const field_type = k.split(':');
      const field = field_type[0];
      const agg_type = field_type.length === 2 ? field_type[1] : null;

      switch (agg_type) {
        case 'global':
          // Note: this is transcribed correctly, but it means sub_field will always be the same as agg_type
          //  Therefore this whole block is useless...
          const sub_field_type = k.split(':');
          const sub_type =
            sub_field_type.length === 2 ? sub_field_type[1] : null;
          if (sub_type === 'filtered') {
            v = v[`${field}:filtered`][field];
          }
          break;

        case 'filtered':
          // ORIGINAL: v = { k: innerValue for k, innerValue in v.items() if re.match(r"{}(:(stats|histogram))?".format(field), k) is not None}
          const filteredEntries = Object.entries(v).filter(item => {
            const key = item[0];
            return [`${field}:stats`, `${field}:histogram`].includes(key);
          });

          const innerValues = filteredEntries.map(item => item[1]);
          v = {
            [k]: innerValues,
          };
          break;

        case 'stats':
          const stats_agg = p_a[field] || {};
          Object.assign(stats_agg, { stats: v });
          p_a[field] = stats_agg;
          break;

        case 'histogram':
          const histo_agg = p_a[field] || {};
          Object.assign(histo_agg, { histogram: v });
          p_a[field] = histo_agg;
          break;

        default:
          break;
      }

      if (!['stats', 'histogram'].includes(agg_type)) {
        if (v.buckets && Array.isArray(v.buckets)) {
          v.buckets.forEach(bucket => {
            if (bucket.rn) {
              bucket.doc_count = bucket.rn.doc_count;
              delete bucket.rn;
            }
          });

          p_a[field] = v;
        } else {
          Object.assign(p_a, this.prune_aggs(v, nested_fields));
        }
      }
    });

    return p_a;
  }
}
