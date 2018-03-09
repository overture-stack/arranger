import React from 'react';

import { toPairs, sortedIndexBy, debounce, sortBy } from 'lodash';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReactGridLayout from 'react-grid-layout';
import api from '../../utils/api';
import { AggsState, AggsQuery, TermAgg } from '../../Aggs';
import { inCurrentSQON } from '../../SQONView/utils';

const saveLayout = async ({ layout, aggsState }) =>
  layout.map(e =>
    aggsState.update({
      field: e.i,
      key: 'orderIndex',
      value: e.y,
    }),
  );

class AggsLayout extends React.Component {
  state = {
    rowHeight: 0.1,
    layout: [],
  };
  aggComponents = {};
  observableAggComponentDimentions;

  onLayoutChange = newLayout => {
    const {
      projectId,
      aggsState,
      graphqlField,
      onLayoutChange = () => {},
    } = this.props;
    this.adjustLayout(newLayout).then(() => {
      const { aggsState } = this.props;
      const aggs = aggsState.aggs.filter(x => x.active);
      saveLayout({
        layout: this.state.layout,
        aggsState,
      });
    });
  };

  adjustHeight = async aggComponentCollection => {
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

    return new Promise((resolve, reject) => {
      if (toPairs(contentPixelDimentions).length != this.state.layout.length) {
        this.setState(
          {
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
          },
          () => resolve(),
        );
      } else {
        resolve();
      }
    });
  };

  adjustLayout = newLayout => {
    const sorted = sortBy(newLayout, i => i.y);
    return new Promise((resolve, reject) => {
      this.adjustHeight(this.aggComponents).then(() =>
        this.setState(
          {
            layout: newLayout.map(item => ({
              ...item,
              y: sorted.indexOf(item),
            })),
          },
          () => resolve(),
        ),
      );
    });
  };

  async componentDidMount() {
    const { projectId, graphqlField, aggsState } = this.props;
    const { observableAggComponent, adjustLayout } = this;
    const newLayout = aggsState.aggs
      .filter(x => x.active)
      .map((agg, index) => ({
        i: agg.field,
        x: 0,
        y: agg.orderIndex || 0,
        w: 1,
        h: 1,
      }));
    adjustLayout(newLayout);
  }

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
          .filter(x => x.active)
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
                  setTimeout(() => {
                    // TODO: actually grab container when available
                    this.adjustHeight(this.aggComponents);
                  }, 100);
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
  onLayoutChange,
  aggsState,
}) => {
  return (
    <div className={`aggregations ${className}`} style={style}>
      <AggsQuery
        debounceTime={300}
        projectId={projectId}
        index={graphqlField}
        sqon={sqon}
        aggs={aggsState.aggs.filter(x => x.active)}
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
                onLayoutChange,
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
