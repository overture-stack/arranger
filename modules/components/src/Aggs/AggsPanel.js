import React from 'react';
import { stringify } from 'query-string';
import Query from './Query';
import TermAgg from './TermAgg';
import { inCurrentFilters } from './filters';
import Location from './Location';

export default ({ agg, history }) => (
  <Query
    name="FacetQuery"
    query={`
    query {
      ${agg.type} {
        aggregations {
          ${agg.mapping
            // .filter(field => {
            //   let [name] = field.split(':').map(x => x.trim())
            //   return activeFacets.includes(name)
            // })
            .map(([name, type]) => {
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
  >
    {data =>
      !data ? (
        'loading'
      ) : (
        <div className="remainder">
          {Object.entries(data[agg.type].aggregations).map(([field, data]) => (
            <div key={field}>
              <Location>
                {p => (
                  <TermAgg
                    field={field}
                    buckets={data.buckets}
                    isActive={d =>
                      inCurrentFilters({
                        key: d.value,
                        dotField: d.field,
                        currentFilters: (p.filters || {}).content,
                      })
                    }
                    handleFieldClick={d => {
                      history.push({
                        search: stringify({
                          filters: JSON.stringify({
                            op: 'and',
                            content: [
                              {
                                op: 'in',
                                content: {
                                  field: d.field,
                                  value: [d.value],
                                },
                              },
                            ],
                          }),
                        }),
                      });
                    }}
                  />
                )}
              </Location>
            </div>
          ))}
        </div>
      )
    }
  </Query>
);
