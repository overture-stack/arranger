import React from 'react';

import { AggsState, AggsQuery } from '../Aggs';
import aggComponents from '../Aggs/aggComponentsMap.js';

const BaseWrapper = ({ className, ...props }) => (
  <div {...props} className={`aggregations ${className}`} />
);

const Aggregations = ({
  onValueChange = () => {},
  setSQON,
  sqon,
  projectId,
  graphqlField,
  className = '',
  style,
  api,
  Wrapper = BaseWrapper,
  containerRef,
  componentProps = {
    getTermAggProps: () => ({}),
    getRangeAggProps: () => ({}),
    getBooleanAggProps: () => ({}),
    getDatesAggProps: () => ({}),
  },
}) => {
  return (
    <Wrapper style={style} className={className}>
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
                    onValueChange: ({ sqon, value }) => {
                      onValueChange(value);
                      setSQON(sqon);
                    },
                    key: agg.field,
                    sqon,
                    containerRef,
                  }))
                  .map(agg =>
                    aggComponents[agg.type]?.({ ...agg, ...componentProps }),
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
