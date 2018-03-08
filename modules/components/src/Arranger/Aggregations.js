import React from 'react';

import { AggsState, AggsQuery, TermAgg } from '../Aggs';
import { inCurrentSQON } from '../SQONView/utils';
import { toPairs, sortedIndexBy, debounce } from 'lodash';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReactGridLayout from 'react-grid-layout';

const fetchLayout = async () =>
  Promise.resolve([
    {
      i: 'controlled_access',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    },
    {
      i: 'data_type',
      x: 0,
      y: 1,
      w: 1,
      h: 1,
    },
    {
      i: 'file_format',
      x: 0,
      y: 2,
      w: 1,
      h: 1,
    },
    {
      i: 'participants.phenotype.hpo.hpo_ids',
      x: 0,
      y: 3,
      w: 1,
      h: 1,
    },
  ]);

const saveLayout = layout => {};

class AggsLayout extends React.Component {
  state = {
    rowHeight: 0.1,
    layout: [],
  };
  aggComponents = {};
  observableAggComponentDimentions;

  onLayoutChange = newLayout => {
    const { onLayoutChange = () => {} } = this.props;
    this.adjustLayout(newLayout).then(() => {
      onLayoutChange(this.state.layout);
    });
  };

  adjustLayout = newLayout => {
    const { margin = 10 } = this.props;
    const contentPixelDimentions = toPairs(this.aggComponents).reduce(
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
      this.setState(
        {
          layout: newLayout.map(item => ({
            ...item,
            h: (contentPixelDimentions[item.i].height + margin) / 10,
            y: sortedIndexBy(newLayout, item, i => i.y),
          })),
        },
        () => resolve(),
      );
    });
  };

  async componentDidMount() {
    const layout = await fetchLayout();
    this.adjustLayout(layout);
  }

  componentDidUpdate() {
    toPairs(this.aggComponents)
      .map(([_, aggComponent]) => aggComponent.observableContainerDimention)
      .forEach(observable => {
        const onChange = () => {
          this.adjustLayout();
        };
        observable.subscribe(onChange);
      });
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
            <div key={agg.field}>
              <TermAgg
                ref={el => (this.aggComponents[agg.field] = el)}
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
}) => (
  <div className={`aggregations ${className}`} style={style}>
    <AggsState
      projectId={projectId}
      graphqlField={graphqlField}
      render={aggsState => {
        return (
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
        );
      }}
    />
  </div>
);

export default Aggregations;
