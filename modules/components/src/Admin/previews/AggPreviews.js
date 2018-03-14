import React from 'react';

import { toPairs, sortedIndexBy, debounce, sortBy } from 'lodash';
import { css } from 'emotion';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReactGridLayout from 'react-grid-layout';
import api from '../../utils/api';
import { AggsState, AggsQuery, TermAgg } from '../../Aggs';
import { inCurrentSQON } from '../../SQONView/utils';
import { fetchExtendedMapping } from '../../utils/api';

const saveLayout = async ({ layout, aggsState }) => {
  const orderedAggFields = sortBy(
    aggsState.aggs,
    ({ field }) => layout.find(({ i }) => field === i).y,
  ).map(({ field }) => field);
  aggsState.saveOrder(orderedAggFields);
};

class AggsLayout extends React.Component {
  state = {
    rowHeight: 0.1,
    layout: [],
    extendedMapping: [],
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
              height: termAgg.clientHeight,
              width: termAgg.clientWidth,
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
    fetchExtendedMapping({ projectId, graphqlField }).then(
      ({ extendedMapping }) =>
        this.setState({ extendedMapping }, () =>
          this.adjustHeight(this.aggComponents),
        ),
    );
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
      projectId,
      graphqlField,
      className = '',
      style,
      isArrangable = false,
    } = this.props;
    const { observableAggComponent } = this;
    const { extendedMapping } = this.state;
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
        {aggsState.aggs.map((agg, index) => (
          <div key={agg.field} style={{ position: 'relative' }}>
            <div
              className={css`
                padding: 10px;
                border-left: solid 2px #a72696;
                background: white;
                box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.2);
              `}
              ref={el => (this.aggComponents[agg.field] = el)}
            >
              {extendedMapping.find(
                ex => ex.field.replace(/\./g, '__') === agg.field,
              )?.displayName || agg.field}
            </div>
          </div>
        ))}
      </ReactGridLayout>
    );
  }
}

const Aggregations = ({
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
      {aggsState.aggs.length && (
        <AggsLayout
          {...{
            aggsState,
            projectId,
            graphqlField,
            className,
            style,
            isArrangable,
          }}
        />
      )}
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
