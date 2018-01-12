import React from 'react';
import { stringify } from 'query-string';
import { capitalize } from 'lodash';
import Query from './Query';
import TermAgg from './TermAgg';
import { inCurrentFilters } from './filters';
import Location from './Location';
import AggsQuery from './AggsQuery';

export default ({ index, aggs }) => (
  <AggsQuery
    index={index}
    aggs={aggs}
    render={data =>
      !data ? (
        'loading'
      ) : (
        <div className="remainder">
          {Object.entries(data[index].aggregations).map(([field, data]) => (
            <Location
              key={field}
              render={search => (
                <TermAgg
                  field={field}
                  buckets={data.buckets}
                  isActive={d =>
                    inCurrentFilters({
                      key: d.value,
                      dotField: d.field,
                      currentFilters: (search.filters || {}).content,
                    })
                  }
                  handleFieldClick={d => {
                    // history.push({
                    //   search: stringify({
                    //     filters: JSON.stringify({
                    //       op: 'and',
                    //       content: [
                    //         {
                    //           op: 'in',
                    //           content: {
                    //             field: d.field,
                    //             value: [d.value],
                    //           },
                    //         },
                    //       ],
                    //     }),
                    //   }),
                    // });
                  }}
                />
              )}
            />
          ))}
        </div>
      )
    }
  />
);
