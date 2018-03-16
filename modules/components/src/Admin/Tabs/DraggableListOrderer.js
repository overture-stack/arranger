import React from 'react';
import { toPairs, sortBy } from 'lodash';
import { css } from 'emotion';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { fetchExtendedMapping } from '../../utils/api';

export default class DraggableOrders extends React.Component {
  state = {
    extendedMapping: [],
  };

  componentDidMount() {
    const { projectId, graphqlField, itemsList } = this.props;
    fetchExtendedMapping({ projectId, graphqlField }).then(
      ({ extendedMapping }) => this.setState({ extendedMapping }, () => {}),
    );
  }

  onLayoutChange = layout => {
    const { itemsList, onOrderChange = () => {} } = this.props;
    const ordered = sortBy(layout, ({ y }) => y);
    const orderedList = sortBy(
      itemsList,
      ({ field }) => layout.find(({ i }) => field === i).y,
    );
    onOrderChange(orderedList);
  };

  render() {
    const {
      itemsList,
      projectId,
      graphqlField,
      className = '',
      style,
      elementHeight = 70,
      width = 300,
    } = this.props;
    const { extendedMapping } = this.state;
    return (
      <div className={`aggregations ${className}`} style={style}>
        <ReactGridLayout
          className="layout"
          cols={1}
          layout={itemsList.map((item, index) => ({
            i: item.field,
            x: 0,
            y: index,
            w: 1,
            h: elementHeight / 10,
          }))}
          rowHeight={1}
          isResizable={false}
          width={width}
          isDraggable={true}
          onDragStop={this.onLayoutChange}
        >
          {itemsList.map((item, index) => (
            <div key={item.field} style={{ position: 'relative' }}>
              <div
                className={css`
                  height: ${elementHeight}px;
                  padding: 10px;
                  border-left: ${item.active ? 'solid 2px #a72696' : 'none'};
                  background: white;
                  box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.2);
                `}
              >
                {extendedMapping.find(ex => ex.field === item.field)
                  ?.displayName || item.field}
              </div>
            </div>
          ))}
        </ReactGridLayout>
      </div>
    );
  }
}
