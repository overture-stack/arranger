import React from 'react';
import { capitalize } from 'lodash';
import Query from '../Query';

export default ({ index = '', aggs = [], ...props }) =>
  !index || !aggs.length ? (
    ''
  ) : (
    <Query
      name={`${capitalize(index)}AggregationsQuery`}
      query={`
    query {
      ${index} {
        aggregations {
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
