import React from 'react';
import { get, pick } from 'lodash';
import ioStream from 'socket.io-stream';

import columnsToGraphql from '@arranger/mapping-utils/dist/utils/columnsToGraphql';

import defaultApi from '../utils/api';
import initSocket from '../utils/initSocket';
import { DISABLE_SOCKET } from '../utils/config';

const streamData = ({ streamSocket }) => {
  return (type, projectId) => ({
    columns,
    sort,
    first,
    onData,
    onEnd,
    sqon,
  }) => {
    return new Promise(resolve => {
      if (streamSocket) {
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
      } else {
        console.warn(
          'No socket available. This warning can be safely dismissed if `disableSocket` was set on arranger',
        );
        resolve();
      }
    });
  };
};

class Arranger extends React.Component {
  constructor(props) {
    super(props);

    const { disableSocket = DISABLE_SOCKET } = props;

    let socket =
      !disableSocket &&
      initSocket(
        pick(props, ['socket', 'socketConnectionString', 'socketOptions']),
      );
    let streamSocket = !disableSocket && ioStream(socket);

    this.state = {
      selectedTableRows: [],
      sqon: null,
      socket,
      streamSocket,
    };
  }

  fetchData = projectId => {
    return options => {
      const { api = defaultApi } = this.props;
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
      graphqlField,
      projectId,
      children,
      render,
      component,
      api = defaultApi,
    } = this.props;
    const { sqon, selectedTableRows } = this.state;

    const childProps = {
      api,
      socket: this.state.socket,
      sqon,
      selectedTableRows,
      projectId,
      index,
      graphqlField,
      streamData: streamData({ streamSocket: this.state.streamSocket }),
      fetchData: this.fetchData,
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
