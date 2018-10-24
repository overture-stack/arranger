import React from 'react';
import { sortBy } from 'lodash';

import { AggsState, AggsQuery } from '../Aggs';
import aggComponents from '../Aggs/aggComponentsMap.js';

export { AggsWrapper } from '../Aggs';

const BaseWrapper = ({ className, ...props }) => (
  <div {...props} className={`aggregations ${className}`} />
);

export const AggregationsListDisplay = ({
  data,
  onValueChange = () => {},
  aggs,
  graphqlField,
  setSQON,
  sqon,
  containerRef,
  componentProps = {
    getTermAggProps: () => ({}),
    getRangeAggProps: () => ({}),
    getBooleanAggProps: () => ({}),
    getDatesAggProps: () => ({}),
  },
  getCustomItems = ({ aggs }) => [], // Array<{index: number, component: Component | Function}>
}) => {
  const aggComponentInstances =
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
      .map(agg => aggComponents[agg.type]?.({ ...agg, ...componentProps }));
  if (aggComponentInstances) {
    // sort the list by the index specified for each component to prevent order bumping
    const componentListToInsert = sortBy(getCustomItems({ aggs }), 'index');
    // go through the list of inserts and inject them by splitting and joining
    const inserted = componentListToInsert.reduce(
      (acc, { index, component }) => {
        const firstChunk = acc.slice(0, index);
        const secondChunk = acc.slice(index, acc.length);
        return [...firstChunk, component(), ...secondChunk];
      },
      aggComponentInstances,
    );
    return inserted;
  } else {
    return aggComponentInstances;
  }
};

export const AggregationsList = ({
  onValueChange = () => {},
  setSQON,
  sqon,
  projectId,
  graphqlField,
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
  aggs = [],
  debounceTime,
  getCustomItems,
}) => (
  <AggsQuery
    api={api}
    debounceTime={300}
    projectId={projectId}
    index={graphqlField}
    sqon={sqon}
    aggs={aggs}
    render={({ data }) =>
      AggregationsListDisplay({
        data,
        onValueChange,
        aggs,
        graphqlField,
        setSQON,
        sqon,
        containerRef,
        componentProps,
        getCustomItems,
      })
    }
  />
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
            <AggregationsList
              onValueChange={onValueChange}
              setSQON={setSQON}
              style={style}
              Wrapper={Wrapper}
              containerRef={containerRef}
              componentProps={componentProps}
              api={api}
              debounceTime={300}
              projectId={projectId}
              graphqlField={graphqlField}
              sqon={sqon}
              aggs={aggs}
            />
          );
        }}
      />
    </Wrapper>
  );
};

export default Aggregations;
