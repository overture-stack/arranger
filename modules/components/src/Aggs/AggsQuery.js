import React from 'react';
import { capitalize } from 'lodash';
import Query from '../Query';

export default ({ index = '', aggs = [], sqon = null, ...props }) =>
  !index || !aggs.length ? (
    ''
  ) : (
    <Query
      name={`${capitalize(index)}AggregationsQuery`}
      variables={{
        fields: aggs.map(x => x.field.replace(/__/g, '.')),
        sqon,
      }}
      query={`
    query ${capitalize(index)}AggregationsQuery(
      $fields: [String]
      $sqon: JSON
    ) {
      ${index} {
        extended(fields: $fields)
        aggregations (
          aggregations_filter_themselves: false
          filters: $sqon
        ){
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
