import { inCurrentSQON } from '@/SQONViewer/utils';

import Location from '../Location';

import TermAgg from './TermAgg';
import AggsQuery from './AggsQuery';

const AggsPanel = ({ index, aggs = [], ...props }) =>
  !aggs.length ? null : (
    <AggsQuery
      index={index}
      aggs={aggs}
      render={({ data, loading }) =>
        loading ? (
          'loading'
        ) : (
          <div className="remainder">
            {Object.entries(data[index].aggregations).map(([fieldName, data]) => (
              <Location
                key={fieldName}
                render={(search) => (
                  <TermAgg
                    fieldName={fieldName}
                    buckets={data.buckets}
                    isActive={(d) =>
                      inCurrentSQON({
                        currentSQON: (search.filters || {}).content,
                        dotFieldName: d.fieldName,
                        value: d.value,
                      })
                    }
                    handleFieldClick={(d) => {
                      // history.push({
                      //   search: stringify({
                      //     filters: JSON.stringify({
                      //       op: 'and',
                      //       content: [
                      //         {
                      //           op: 'in',
                      //           content: {
                      //             fieldName: d.fieldName,
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

export default AggsPanel;
