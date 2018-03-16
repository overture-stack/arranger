import React from 'react';

import { toPairs, sortBy } from 'lodash';
import { css } from 'emotion';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReactGridLayout from 'react-grid-layout';
import { fetchExtendedMapping } from '../../utils/api';

class DraggableOrders extends React.Component {
  state = {
    rowHeight: 1, // normalizes to pixel level
    layout: [],
    extendedMapping: [],
  };
  listElements = {};

  adjustHeight = async listElements =>
    new Promise(resolve => {
      const { margin = 10 } = this.props;

      const contentPixelDimentions = toPairs(listElements)
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
                  h: (dimention.height + margin) / 10, //converts to react-grid-layout unit
                }),
          }),
        ),
      });
    });

  async componentDidMount() {
    const { projectId, graphqlField, itemsList } = this.props;
    const newLayout = itemsList.map((item, index) => ({
      i: item.field,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    }));
    fetchExtendedMapping({ projectId, graphqlField }).then(
      ({ extendedMapping }) =>
        this.setState({ extendedMapping }, () =>
          this.adjustHeight(this.listElements),
        ),
    );
  }

  onLayoutChange = layout => {
    const { itemsList, onOrderChange = () => {} } = this.props;
    const ordered = sortBy(layout, ({ y }) => y);
    this.setState(
      {
        layout: this.state.layout.map(l => ({
          ...l,
          y: ordered.indexOf(ordered.find(({ i }) => i === l.i)),
        })),
      },
      () => {
        const orderedList = sortBy(
          itemsList,
          ({ field }) => layout.find(({ i }) => field === i).y,
        );
        onOrderChange(orderedList);
      },
    );
  };

  render() {
    const {
      itemsList,
      projectId,
      graphqlField,
      className = '',
      style,
    } = this.props;
    const { extendedMapping } = this.state;
    return (
      <ReactGridLayout
        className="layout"
        cols={1}
        layout={this.state.layout}
        rowHeight={this.state.rowHeight}
        isResizable={false}
        width={300}
        isDraggable={true}
        onDragStop={this.onLayoutChange}
      >
        {itemsList.map((item, index) => (
          <div key={item.field} style={{ position: 'relative' }}>
            <div
              className={css`
                padding: 10px;
                border-left: ${item.active ? 'solid 2px #a72696' : 'none'};
                background: white;
                box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.2);
              `}
              ref={el => (this.listElements[item.field] = el)}
            >
              {extendedMapping.find(ex => ex.field === item.field)
                ?.displayName || item.field}
            </div>
          </div>
        ))}
      </ReactGridLayout>
    );
  }
}

export default ({
  projectId,
  graphqlField,
  className = '',
  style,
  itemsList,
  onOrderChange,
}) => {
  return (
    <div className={`aggregations ${className}`} style={style}>
      {itemsList.length && (
        <DraggableOrders
          {...{
            itemsList,
            onOrderChange,
            projectId,
            graphqlField,
            className,
            style,
          }}
        />
      )}
    </div>
  );
};
