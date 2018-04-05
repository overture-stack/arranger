import React from 'react';

import { AggsState, AggsQuery, TermAgg } from '../Aggs';
import { inCurrentSQON } from '../SQONView/utils';
import aggComponents from '../Aggs/aggComponentsMap.js';

const Aggregations = ({
  setSQON,
  sqon,
  projectId,
  graphqlField,
  className = '',
  style,
}) => {
  return (
    <div className={`aggregations ${className}`} style={style}>
      <AggsState
        projectId={projectId}
        graphqlField={graphqlField}
        render={aggsState => {
          const aggs = aggsState.aggs.filter(x => x.show);
          return (
            <AggsQuery
              debounceTime={300}
              projectId={projectId}
              index={graphqlField}
              sqon={sqon}
              aggs={aggs}
              render={({ data }) =>
                data &&
                aggs
                  .map(agg => ({
                    ...agg,
                    ...data[graphqlField].aggregations[agg.field],
                    ...data[graphqlField].extended.find(
                      x => x.field.replace(/\./g, '__') === agg.field,
                    ),
                  }))
                  .map(agg =>
                    aggComponents[agg.type]?.({
                      onValueChange: ({ sqon }) => setSQON(sqon),
                      key: agg.field,
                      sqon,
                      ...agg,
                    }),
                  )
              }
            />
          );
        }}
      />
    </div>
  );
};

export default Aggregations;
