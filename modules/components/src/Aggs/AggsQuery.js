import React from 'react';
import { capitalize } from 'lodash';
import Query from '../Query';
import stringifyObject from 'stringify-object';

export default ({ index = '', aggs = [], sqon = null, ...props }) =>
  !index || !aggs.length ? (
    ''
  ) : (
    <Query
      name={`${capitalize(index)}AggregationsQuery`}
      variables={{
        fields: aggs.map(x => x.field.replace(/__/g, '.')),
      }}
      query={`
    query ${capitalize(index)}AggregationsQuery($fields: [String]) {
      ${index} {
        extended(fields: $fields)
        aggregations (aggregations_filter_themselves: false ${
          sqon
            ? `filters: ${stringifyObject(sqon, { singleQuotes: false })}`
            : ''
        }){
          ${aggs.map(({ field, type }) => {
            return type === 'Aggregations'
              ? `
                ${field} {
                  buckets {
                    doc_count
                    key
                  }
                }
              `
              : `
              ${field} {
                stats {
                  max
                  min
                  count
                  avg
                  sum
                }
                histogram(interval: 1.0) {
                  buckets {
                    doc_count
                    key
                  }
                }
              }
              `;
          })}
        }
      }
    }
  `}
      {...props}
    />
  );
