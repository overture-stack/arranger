import React from 'react';

import { AggsState, AggsQuery } from '../Aggs';
import aggComponents from '../Aggs/aggComponentsMap.js';

const Aggregations = ({
  setSQON,
  sqon,
  projectId,
  graphqlField,
  className = '',
  style,
  api,
  Wrapper = props => (
    <div {...props} className={`aggregations ${className}`} style={style} />
  ),
}) => {
  return (
    <Wrapper>
      <AggsState
        api={api}
        projectId={projectId}
        graphqlField={graphqlField}
        render={aggsState => {
          const aggs = aggsState.aggs.filter(x => x.show);
          return (
            <AggsQuery
              api={api}
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
    </Wrapper>
  );
};

export default Aggregations;
