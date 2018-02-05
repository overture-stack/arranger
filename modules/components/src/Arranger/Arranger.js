import React from 'react';
import { get } from 'lodash';
import io from 'socket.io-client';

import { columnsToGraphql } from '../DataTable';
import { api } from '../Admin/Dashboard';
import { API, ES_HOST } from '../utils/config';

let socket = io(API);

const streamData = type => ({ columns, sort, first, onData, onEnd }) => {
  socket.on('server::chunk', ({ data, total }) =>
    onData({
      total,
      data: data[type].hits.edges.map(e => e.node),
    }),
  );

  socket.on('server::stream::end', onEnd);

  socket.emit('client::stream', {
    index: type,
    size: 100,
    ...columnsToGraphql({ columns, sort, first }),
  });
};

const fetchData = projectId => {
  return options => {
    return api({
      endpoint: `/${projectId}/graphql`,
      headers: {
        ES_HOST,
      },
      body: columnsToGraphql(options),
    }).then(r => {
      const hits = get(r, `data.${options.config.type}.hits`) || {};
      const data = get(hits, 'edges', []).map(e => e.node);
      const total = hits.total || 0;
      return { total, data };
    });
  };
};

class Arranger extends React.Component {
  componentWillMount() {
    const hasChildren =
      this.props.children && React.Children.count(this.props.children) !== 0;

    if (this.props.component && this.props.render) {
      console.warn(
        'You should not use <Arranger component> and <Arranger render> in the same arranger; <Arranger render> will be ignored',
      );
    }

    if (this.props.component && hasChildren) {
      console.warn(
        'You should not use <Arranger component> and <Arranger children> in the same arranger; <Arranger children> will be ignored',
      );
    }

    if (this.props.render && hasChildren) {
      console.warn(
        'You should not use <Arranger render> and <Arranger children> in the same arranger; <Arranger children> will be ignored',
      );
    }
  }

  render() {
    const { index, projectId, children, render, component } = this.props;
    const { sqon } = this.state;

    const childProps = {
      socket,
      sqon,
      projectId,
      index,
      streamData,
      fetchData,
      setSQON: sqon => this.setState({ sqon }),
    };

    if (component) {
      return React.createElement(component, childProps);
    } else if (render) {
      return render(childProps);
    } else if (children) {
      return typeof children === 'function' ? children(childProps) : children;
    } else {
      return null;
    }
  }
}

export default Arranger;
