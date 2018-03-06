import React from 'react';

import { AggsState, AggsQuery, TermAgg } from '../Aggs';
import { inCurrentSQON, toggleSQON } from '../SQONView/utils';

const Aggregations = ({
  setSQON,
  sqon,
  projectId,
  index,
  indexName,
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
              index={indexName}
              sqon={sqon}
              aggs={aggsState.aggs.filter(x => x.active)}
              render={data =>
                data &&
                aggsState.aggs
                  .filter(x => x.active)
                  .map(agg => ({
                    ...agg,
                    ...data[indexName].aggregations[agg.field],
                    ...data[indexName].extended.find(
                      x => x.field.replace(/\./g, '__') === agg.field,
                    ),
                  }))
                  .map(agg => (
                    // TODO: switch on agg type
                    <TermAgg
                      key={agg.field}
                      {...agg}
                      handleValueClick={({ generateNextSQON }) =>
                        setSQON(generateNextSQON(sqon))
                      }
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
