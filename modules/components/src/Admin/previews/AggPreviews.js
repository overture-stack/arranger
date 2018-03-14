import React from 'react';

import { toPairs, sortedIndexBy, debounce, sortBy } from 'lodash';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReactGridLayout from 'react-grid-layout';
import api from '../../utils/api';
import { AggsState, AggsQuery, TermAgg } from '../../Aggs';
import { inCurrentSQON } from '../../SQONView/utils';

const saveLayout = async ({ layout, aggsState }) => {
  const orderedAggFields = sortBy(
    aggsState.aggs,
    ({ field }) => layout.find(({ i }) => field.split('__').join('.') === i).y,
  ).map(({ field }) => field);
  aggsState.saveOrder(orderedAggFields);
};

class AggsLayout extends React.Component {
  state = {
    rowHeight: 0.1,
    layout: [],
  };
  aggComponents = {};

  adjustHeight = async aggComponentCollection =>
    new Promise(resolve => {
      const { margin = 10 } = this.props;

      const contentPixelDimentions = toPairs(aggComponentCollection)
        .filter(([_, termAgg]) => termAgg)
        .reduce(
          (acc, [key, termAgg]) => ({
            ...acc,
            [key]: {
              height: termAgg.container.clientHeight,
              width: termAgg.container.clientWidth,
            },
          }),
          {},
        );
      this.setState({
        layout: toPairs(contentPixelDimentions).map(
          ([key, dimention], index) => ({
            ...(this.state.layout[key]
              ? this.state.layout[key]
              : {
                  i: key,
                  x: 0,
                  y: index,
                  w: 1,
                  h: (dimention.height + margin) / 10,
                }),
          }),
        ),
      });
    });

  async componentDidMount() {
    const { projectId, graphqlField, aggsState } = this.props;
    const { observableAggComponent } = this;
    const newLayout = aggsState.aggs.map((agg, index) => ({
      i: agg.field,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    }));
    setTimeout(() => {
      // TODO: replace actual termAggs with just placeholders so not to rely on heights
      this.adjustHeight(this.aggComponents);
    }, 100);
  }

  onLayoutChange = layout => {
    const { aggsState } = this.props;
    const ordered = sortBy(layout, ({ y }) => y);
    this.setState(
      {
        layout: this.state.layout.map(l => ({
          ...l,
          y: ordered.indexOf(ordered.find(({ i }) => i === l.i)),
        })),
      },
      () => {
        saveLayout({ layout: this.state.layout, aggsState });
      },
    );
  };

  render() {
    const {
      aggsState,
      setSQON,
      sqon,
      projectId,
      graphqlField,
      className = '',
      style,
      isArrangable = false,
      data,
    } = this.props;
    const { observableAggComponent } = this;

    return (
      <ReactGridLayout
        className="layout"
        cols={1}
        layout={this.state.layout}
        rowHeight={this.state.rowHeight}
        isResizable={false}
        width={300}
        isDraggable={isArrangable}
        onDragStop={this.onLayoutChange}
      >
        {aggsState.aggs
          .map(agg => ({
            ...agg,
            ...data[graphqlField].aggregations[agg.field],
            ...data[graphqlField].extended.find(
              x => x.field.replace(/\./g, '__') === agg.field,
            ),
          }))
          .map((agg, index) => (
            // TODO: switch on agg type
            <div key={agg.field} style={{ position: 'relative' }}>
              <TermAgg
                ref={el => {
                  this.aggComponents[agg.field] = el;
                }}
                data-grid={{ x: 0, y: index }}
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
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
              />
            </div>
          ))}
      </ReactGridLayout>
    );
  }
}

const Aggregations = ({
  setSQON,
  sqon,
  projectId,
  graphqlField,
  className = '',
  style,
  isArrangable = false,
  aggsState,
}) => {
  return (
    <div className={`aggregations ${className}`} style={style}>
      <AggsQuery
        debounceTime={300}
        projectId={projectId}
        index={graphqlField}
        sqon={sqon}
        aggs={aggsState.aggs}
        render={data =>
          data && (
            <AggsLayout
              {...{
                aggsState,
                setSQON,
                sqon,
                projectId,
                graphqlField,
                className,
                style,
                isArrangable,
                data,
              }}
            />
          )
        }
      />
    </div>
  );
};

export default props => (
  <Aggregations
    {...{
      ...props,
      isArrangable: true,
    }}
  />
);
