import React from 'react';
import { capitalize } from 'lodash';
import Query from './Query';

export default ({ index, aggs, ...props }) => (
  <Query
    name={`${capitalize(index)}AggregationsQuery`}
    query={`
    query {
      ${index} {
        aggregations {
          ${aggs.map(([name, type]) => {
            return type === 'Aggregations'
              ? `
                ${name} {
                  buckets {
                    doc_count
                    key
                  }
                }
              `
              : `
              ${name} {
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
