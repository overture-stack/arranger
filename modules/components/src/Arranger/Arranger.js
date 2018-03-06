import React from 'react';
import { get } from 'lodash';
import io from 'socket.io-client';
import ioStream from 'socket.io-stream';

import columnsToGraphql from '@arranger/mapping-utils/dist/utils/columnsToGraphql';

import api from '../utils/api';
import { ARRANGER_API } from '../utils/config';

let socket = io(ARRANGER_API);
let streamSocket = ioStream(socket);

const streamData = (type, projectId) => ({
  columns,
  sort,
  first,
  onData,
  onEnd,
  sqon,
}) => {
  return new Promise(resolve => {
    const stream = ioStream.createStream();

    stream.on('data', chunk => {
      const { data, total } = JSON.parse(chunk);
      onData({
        total,
        data: data[type].hits.edges.map(e => e.node),
      });
    });

    stream.on('end', () => {
      onEnd();
      resolve();
    });

    streamSocket.emit('client::stream', stream, {
      index: type,
      projectId,
      size: first,
      ...columnsToGraphql({ sqon, config: { columns, type }, sort, first }),
    });
  });
};

const fetchData = projectId => {
  return options => {
    return api({
      endpoint: `/${projectId}/graphql`,
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
  state = {
    selectedTableRows: [],
    sqon: null,
  };

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
    const {
      index,
      indexName,
      projectId,
      children,
      render,
      component,
    } = this.props;
    const { sqon, selectedTableRows } = this.state;

    const childProps = {
      socket,
      sqon,
      selectedTableRows,
      projectId,
      index,
      indexName,
      streamData,
      fetchData,
      setSQON: sqon => this.setState({ sqon }),
      setSelectedTableRows: selectedTableRows =>
        this.setState({ selectedTableRows }),
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
