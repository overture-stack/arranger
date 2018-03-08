import React from 'react';

import { toPairs, sortedIndexBy, debounce } from 'lodash';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReactGridLayout from 'react-grid-layout';
import api from '../../utils/api';
import { AggsState, AggsQuery, TermAgg } from '../../Aggs';
import { inCurrentSQON } from '../../SQONView/utils';

const fetchLayout = async () =>
  Promise.resolve([
    {
      i: 'cancer_related_somatic_mutations',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    },
    {
      i: 'clinical_stage',
      x: 0,
      y: 1,
      w: 1,
      h: 1,
    },
    {
      i: 'disease_status_at_unlinking',
      x: 0,
      y: 2,
      w: 1,
      h: 1,
    },
    {
      i: 'gender',
      x: 0,
      y: 2,
      w: 1,
      h: 1,
    },
  ]);

const aggFields = `
  state {
    field
    active
    type
    layout
  }
`;

const saveLayout = async ({ layout, projectId, aggs }) => {
  return Promise.all(
    aggs.map(agg =>
      api({
        endpoint: `/${projectId}/graphql`,
        body: {
          variables: {
            state: {
              ...agg,
              layout: layout.find(({ i }) => i === agg.field),
            },
          },
          query: `
        mutation($state: JSON!) {
          saveAggsState(
            state: $state
            graphqlField: "${projectId}"
          ) {
            ${aggFields}
          }
        }
      `,
        },
      }),
    ),
  );
};

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
      // onLayoutChange(this.state.layout);
      const { aggsState } = this.props;
      const aggs = aggsState.aggs.filter(x => x.active);
      saveLayout({
        layout: this.state.layout,
        projectId: this.props.projectId,
        aggs,
      });
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

  componentWillReceiveProps(nextProps) {
    // const { aggsState } = nextProps;
    // if (aggsState) {
    //   const aggs = aggsState.aggs.filter(x => x.active);
    //   this.setState({
    //     layout: aggs.map(
    //       agg =>
    //         this.state.layout[agg.field] || {
    //           i: agg.field,
    //           x: 0,
    //           y: aggs.length,
    //           w: 1,
    //           h: 1,
    //         },
    //       this.adjustLayout(this.state.layout),
    //     ),
    //   });
    // }
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
            <div key={agg.field} style={{ position: 'relative' }}>
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
