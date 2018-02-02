import React from 'react';
import { get } from 'lodash';

import io from 'socket.io-client';

import { columnsToGraphql } from '../DataTable';
import { api } from '../Admin/Dashboard';
import { API, ES_HOST } from '../utils/config';

let socket = io(API);

function streamData({ type, columns, sort, first, onData, onEnd }) {
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
}

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
  state = {
    shouldRefresh: false,
    sqon: null,
  };

  onSQONChange = sqon => {
    return this.setState({ sqon });
  };

  componentDidMount() {
    if (!this.props.index) {
      console.warn('arranger requires an index to be passed in');
    }

    if (!this.props.index) {
      console.warn('arranger requires a projectId to be passed in');
    }

    socket.on('server::refresh', () => {
      this.setState({ shouldRefresh: true });
    });
  }

  render() {
    const { index, projectId, render } = this.props;
    const { shouldRefresh, sqon } = this.state;

    return (
      <>
        {shouldRefresh && (
          <div
            css={`
              z-index: 10000;
              position: fixed;
              bottom: 20px;
              right: 20px;
              background: #383838;
              color: white;
              padding: 10px;
              border-radius: 6px;
            `}
          >
            A new version of this app is available.{' '}
            <span
              css={`
                cursor: pointer;
                color: rgb(154, 232, 229);
                font-weight: bold;
              `}
              onClick={() => (window.location.href = window.location.href)}
            >
              REFRESH
            </span>
          </div>
        )}
        <div
          style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
        >
          {index &&
            projectId && (
              <div
                className="portal"
                css={`
                  display: flex;
                  flex-direction: column;
                `}
              >
                {render
                  ? render({
                      projectId,
                      index,
                      sqon,
                      streamData: options =>
                        streamData({ ...options, type: index }),
                      fetchData,
                      onSQONChange: this.onSQONChange,
                    })
                  : 'default'}
              </div>
            )}
        </div>
      </>
    );
  }
}

export default Arranger;
