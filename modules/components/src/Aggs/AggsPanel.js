import React from 'react';
import { inCurrentFilters } from '../SQONView/utils';
import Location from '../Location';
import TermAgg from './TermAgg';
import AggsQuery from './AggsQuery';

export default ({ index, aggs = [], ...props }) =>
  !aggs.length ? null : (
    <AggsQuery
      index={index}
      aggs={aggs}
      render={({ data, loading }) =>
        loading ? (
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
      {...props}
    />
  );
