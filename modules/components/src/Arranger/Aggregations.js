import React from 'react';

import { AggsState, AggsQuery, TermAgg } from '../Aggs';
import { inCurrentSQON, toggleSQON } from '../SQONView/utils';

const Aggregations = ({
  setSQON,
  sqon,
  projectId,
  index,
  className = '',
  style,
}) => {
  return (
    <div className={`aggregations ${className}`} style={style}>
      <AggsState
        projectId={projectId}
        index={index}
        render={aggsState => {
          return (
            <AggsQuery
              debounceTime={300}
              projectId={projectId}
              index={index}
              aggs={aggsState.aggs.filter(x => x.active)}
              render={data =>
                data &&
                aggsState.aggs
                  .filter(x => x.active)
                  .map(agg => ({
                    ...agg,
                    ...data[index].aggregations[agg.field],
                    ...data[index].extended.find(x => x.field === agg.field),
                  }))
                  .map(agg => (
                    // TODO: switch on agg type
                    <TermAgg
                      key={agg.field}
                      {...agg}
                      Content={({ content, ...props }) => (
                        <div
                          {...props}
                          onClick={() =>
                            setSQON(
                              toggleSQON(
                                {
                                  op: 'and',
                                  content: [
                                    {
                                      op: 'in',
                                      content: {
                                        ...content,
                                        value: [].concat(content.value || []),
                                      },
                                    },
                                  ],
                                },
                                sqon,
                              ),
                            )
                          }
                        />
                      )}
                      isActive={d =>
                        inCurrentSQON({
                          value: d.value,
                          dotField: d.field,
                          currentSQON: sqon,
                        })
                      }
                    />
                  ))
              }
            />
          );
        }}
      />
    </div>
  );
};

export default Aggregations;
